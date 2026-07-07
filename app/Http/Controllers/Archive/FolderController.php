<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class FolderController extends Controller
{
    public function index()
    {
        $sectors = Sector::with([
            'folders' => function ($q) {
                $q->whereNull('parent_id')
                    ->withCount('documents')
                    ->withSum('documents as documents_size', 'file_size')
                    ->with('children')
                    ->orderBy('sort_order');
            }
        ])->where('is_active', true)->get();

        return Inertia::render('Archive/Folders/Index', [
            'sectors' => $sectors,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sector_id' => 'required|exists:sectors,id',
            'parent_id' => 'nullable|exists:document_folders,id',
            'name' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:20',
        ]);

        $folder = DocumentFolder::create($validated);
        AuditLog::record('create_folder', $folder, [], $folder->toArray(), "إنشاء مجلد: {$folder->name}");

        return back()->with('success', 'تم إنشاء المجلد بنجاح');
    }

    public function update(Request $request, DocumentFolder $folder)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);

        $old = $folder->toArray();
        $folder->update($validated);
        AuditLog::record('update_folder', $folder, $old, $folder->fresh()->toArray(), "تعديل مجلد: {$folder->name}");

        return back()->with('success', 'تم تحديث المجلد بنجاح');
    }

    /**
     * مستندات مجلد معيّن (للعرض في المستكشف).
     */
    public function documents(DocumentFolder $folder)
    {
        $user = auth()->user();

        $allowedSectorIds = $user->accessibleSectorIds();
        if (!empty($allowedSectorIds) && !in_array((int) $folder->sector_id, array_map('intval', $allowedSectorIds), true)) {
            abort(403);
        }

        $docs = $folder->documents()
            ->when(
                !$user->hasAnyRole(['super-admin', 'archive-manager']),
                fn($q) => $q->where(function ($sub) use ($user) {
                    $sub->where('is_confidential', false)
                        ->orWhere('uploaded_by', $user->id);
                })
            )
            ->orderByDesc('serial_number')
            ->get(['id', 'title', 'file_extension', 'file_size', 'serial_number', 'is_confidential', 'upload_source', 'folder_id', 'created_at']);

        return response()->json($docs);
    }

    /**
     * نقل مجلد إلى أب جديد (لصق بعد قص). parent_id=null مع sector_id = جذر القطاع.
     * يمنع النقل داخل المجلد نفسه أو أحد أحفاده، ويحدّث قطاع كل المحتويات عند تغيّره.
     */
    public function move(Request $request, DocumentFolder $folder)
    {
        $validated = $request->validate([
            'parent_id' => 'nullable|exists:document_folders,id',
            'sector_id' => 'required_without:parent_id|nullable|exists:sectors,id',
        ]);

        $parent = !empty($validated['parent_id'])
            ? DocumentFolder::findOrFail($validated['parent_id'])
            : null;

        if ($parent) {
            if ((int) $parent->id === (int) $folder->id) {
                return back()->with('error', 'لا يمكن نقل المجلد إلى نفسه');
            }
            // منع النقل إلى حفيد: امش لأعلى من الهدف وابحث عن المجلد المنقول
            $cursor = $parent;
            $guard = 0;
            while ($cursor && $guard++ < 50) {
                if ((int) $cursor->parent_id === (int) $folder->id) {
                    return back()->with('error', 'لا يمكن نقل المجلد داخل مجلد فرعي منه');
                }
                $cursor = $cursor->parent_id ? DocumentFolder::find($cursor->parent_id) : null;
            }
        }

        $targetSectorId = $parent ? $parent->sector_id : (int) $validated['sector_id'];

        if ((int) ($folder->parent_id ?? 0) === (int) ($parent?->id ?? 0)
            && (int) $folder->sector_id === (int) $targetSectorId) {
            return back()->with('success', 'المجلد موجود هنا بالفعل');
        }

        $old = $folder->only(['parent_id', 'sector_id']);
        $oldPath = $folder->path;

        $folder->update([
            'parent_id' => $parent?->id,
            'sector_id' => $targetSectorId,
        ]);

        // عند تغيير القطاع: حدّث كل المجلدات الفرعية ومستنداتها
        if ((int) $old['sector_id'] !== (int) $targetSectorId) {
            $descendantIds = [];
            $frontier = [$folder->id];
            $guard = 0;
            while (!empty($frontier) && $guard++ < 50) {
                $children = DocumentFolder::whereIn('parent_id', $frontier)->pluck('id')->all();
                $descendantIds = array_merge($descendantIds, $children);
                $frontier = $children;
            }
            if (!empty($descendantIds)) {
                DocumentFolder::whereIn('id', $descendantIds)->update(['sector_id' => $targetSectorId]);
            }
            \App\Models\ArchiveDocument::withTrashed()
                ->whereIn('folder_id', array_merge([$folder->id], $descendantIds))
                ->update(['sector_id' => $targetSectorId]);
        }

        AuditLog::record(
            'move_folder',
            $folder,
            $old,
            $folder->only(['parent_id', 'sector_id']),
            "نقل المجلد \"{$folder->name}\" من \"{$oldPath}\" إلى \"{$folder->fresh()->path}\""
        );

        return back()->with('success', 'تم نقل المجلد بنجاح');
    }

    /**
     * نسخ مجلد (لصق بعد نسخ): نسخ عميق للمجلدات الفرعية والمستندات وملفاتها.
     */
    public function copy(Request $request, DocumentFolder $folder)
    {
        $validated = $request->validate([
            'parent_id' => 'nullable|exists:document_folders,id',
            'sector_id' => 'required_without:parent_id|nullable|exists:sectors,id',
        ]);

        $parent = !empty($validated['parent_id'])
            ? DocumentFolder::findOrFail($validated['parent_id'])
            : null;

        // منع النسخ إلى داخل المجلد نفسه أو أحفاده (يتجنب التكرار اللانهائي)
        if ($parent) {
            $cursor = $parent;
            $guard = 0;
            while ($cursor && $guard++ < 50) {
                if ((int) $cursor->id === (int) $folder->id) {
                    return back()->with('error', 'لا يمكن نسخ المجلد إلى داخل نفسه');
                }
                $cursor = $cursor->parent_id ? DocumentFolder::find($cursor->parent_id) : null;
            }
        }

        $targetSectorId = $parent ? (int) $parent->sector_id : (int) $validated['sector_id'];
        $user = auth()->user();

        // حماية من نسخ شجرة ضخمة دفعة واحدة
        $subtreeFolderIds = [$folder->id];
        $frontier = [$folder->id];
        $guard = 0;
        while (!empty($frontier) && $guard++ < 50) {
            $frontier = DocumentFolder::whereIn('parent_id', $frontier)->pluck('id')->all();
            $subtreeFolderIds = array_merge($subtreeFolderIds, $frontier);
        }
        $docCount = ArchiveDocument::whereIn('folder_id', $subtreeFolderIds)->count();
        if (count($subtreeFolderIds) + $docCount > 300) {
            return back()->with('error', 'المجلد كبير جداً للنسخ دفعة واحدة');
        }

        $isPrivileged = $user->hasAnyRole(['super-admin', 'archive-manager']);

        $copyTree = function (DocumentFolder $src, ?int $parentId, bool $isRoot) use (&$copyTree, $targetSectorId, $user, $isPrivileged, $parent, $folder) {
            $name = $src->name;
            // نفس الأب الأصلي: ميّز النسخة بالاسم
            if ($isRoot && (int) ($parent?->id ?? 0) === (int) ($folder->parent_id ?? 0)
                && (int) $targetSectorId === (int) $folder->sector_id) {
                $name .= ' - نسخة';
            }

            $new = DocumentFolder::create([
                'sector_id' => $targetSectorId,
                'parent_id' => $parentId,
                'name' => $name,
                'name_en' => $src->name_en,
                'description' => $src->description,
                'icon' => $src->icon,
                'color' => $src->color,
                'sort_order' => $src->sort_order ?? 0,
            ]);

            // انسخ فقط المستندات المرئية للمستخدم
            $docsQuery = $src->documents();
            if (!$isPrivileged) {
                $docsQuery->where(function ($q) use ($user) {
                    $q->where('is_confidential', false)->orWhere('uploaded_by', $user->id);
                });
            }
            foreach ($docsQuery->get() as $doc) {
                if (!Storage::disk(config('filesystems.archive_disk', 'local'))->exists($doc->file_path)) {
                    continue;
                }
                $newPath = 'archive/' . now()->format('Y/m') . '/' . Str::random(32) . '.' . $doc->file_extension;
                Storage::disk(config('filesystems.archive_disk', 'local'))->copy($doc->file_path, $newPath);

                $copyDoc = $doc->replicate([
                    'serial_number', 'qr_code', 'barcode',
                    'is_checked_out', 'checked_out_to', 'checked_out_by', 'checked_out_at', 'checked_out_notes',
                ]);
                $copyDoc->folder_id = $new->id;
                $copyDoc->sector_id = $targetSectorId;
                $copyDoc->file_path = $newPath;
                $copyDoc->uploaded_by = $user->id;
                $copyDoc->qr_code = Str::uuid()->toString();
                $copyDoc->barcode = strtoupper(Str::random(12));
                $copyDoc->is_checked_out = false;
                $copyDoc->save();
            }

            foreach ($src->children()->get() as $child) {
                $copyTree($child, $new->id, false);
            }

            return $new;
        };

        $newRoot = $copyTree($folder, $parent?->id, true);

        AuditLog::record(
            'copy_folder',
            $newRoot,
            [],
            $newRoot->toArray(),
            "نسخ المجلد \"{$folder->path}\" إلى \"{$newRoot->path}\""
        );

        return back()->with('success', "تم نسخ المجلد إلى: {$newRoot->path}");
    }

    public function destroy(DocumentFolder $folder)
    {
        if ($folder->documents()->count() > 0) {
            return back()->with('error', 'لا يمكن حذف مجلد يحتوي على مستندات');
        }
        if ($folder->children()->count() > 0) {
            return back()->with('error', 'لا يمكن حذف مجلد يحتوي على مجلدات فرعية');
        }

        AuditLog::record('delete_folder', $folder, $folder->toArray(), [], "حذف مجلد: {$folder->name}");
        $folder->delete();

        return back()->with('success', 'تم حذف المجلد بنجاح');
    }

    public function tree()
    {
        $sectors = Sector::with([
            'folders' => function ($q) {
                $q->whereNull('parent_id')
                    ->with('children')
                    ->orderBy('sort_order');
            }
        ])->where('is_active', true)->get();

        return response()->json($sectors);
    }
}
