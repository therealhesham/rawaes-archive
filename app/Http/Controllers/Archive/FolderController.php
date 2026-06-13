<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class FolderController extends Controller
{
    public function index()
    {
        $sectors = Sector::with([
            'folders' => function ($q) {
                $q->whereNull('parent_id')
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

    public function destroy(DocumentFolder $folder)
    {
        if ($folder->documents()->count() > 0) {
            return back()->with('error', 'لا يمكن حذف مجلد يحتوي على مستندات');
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
