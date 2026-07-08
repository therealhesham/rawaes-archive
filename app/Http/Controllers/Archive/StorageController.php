<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class StorageController extends Controller
{
    private const DISKS = ['local', 'spaces'];

    public function index(): Response
    {
        abort_unless(auth()->user()->can('sectors.manage'), 403);

        return Inertia::render('Archive/Storage/Index', [
            'spacesConfigured' => (bool) config('filesystems.disks.spaces.key'),
            'counts' => [
                'local' => ArchiveDocument::withTrashed()->where('storage_disk', 'local')->count(),
                'spaces' => ArchiveDocument::withTrashed()->where('storage_disk', 'spaces')->count(),
            ],
        ]);
    }

    /**
     * قائمة المستندات مع قرص تخزين كل واحد (تستدعيها صفحة إدارة التخزين).
     */
    public function documents(Request $request)
    {
        abort_unless($request->user()->can('sectors.manage'), 403);

        $docs = ArchiveDocument::withTrashed()
            ->with(['folder:id,name', 'sector:id,name'])
            ->orderByDesc('id')
            ->get(['id', 'title', 'file_name', 'file_extension', 'file_size', 'storage_disk', 'folder_id', 'sector_id', 'created_at']);

        return response()->json([
            'documents' => $docs->map(fn ($d) => [
                'id' => $d->id,
                'title' => $d->title,
                'file_name' => $d->file_name,
                'file_extension' => $d->file_extension,
                'file_size' => $d->file_size,
                'storage_disk' => $d->storage_disk,
                'folder' => $d->folder?->name,
                'sector' => $d->sector?->name,
                'created_at' => $d->created_at,
            ]),
        ]);
    }

    /**
     * نقل مستندات محددة من قرص إلى آخر (مثلاً local -> spaces).
     * كل مستند ينتقل بمفرده ونتيجته تُرجع فوراً حتى تظهر تقدماً حياً في الواجهة.
     */
    public function transfer(Request $request)
    {
        $user = $request->user();
        abort_unless($user->can('sectors.manage'), 403);

        $validated = $request->validate([
            'ids' => 'required|array|min:1|max:50',
            'ids.*' => 'integer',
            'to' => 'required|in:local,spaces',
        ]);

        $to = $validated['to'];
        if ($to === 'spaces' && !config('filesystems.disks.spaces.key')) {
            return response()->json(['error' => 'لم يتم ضبط بيانات اعتماد DigitalOcean Spaces في إعدادات الخادم'], 422);
        }

        $toDisk = Storage::disk($to);
        $results = [];

        foreach (ArchiveDocument::withTrashed()->whereIn('id', $validated['ids'])->get() as $doc) {
            $base = ['id' => $doc->id, 'title' => $doc->title];

            if ($doc->storage_disk === $to) {
                $results[] = $base + ['status' => 'skipped', 'message' => 'موجود بالفعل على هذا القرص'];
                continue;
            }

            try {
                $fromDisk = Storage::disk($doc->disk());
                if (!$fromDisk->exists($doc->file_path)) {
                    $results[] = $base + ['status' => 'error', 'message' => 'الملف غير موجود على القرص المصدر'];
                    continue;
                }

                if (!$toDisk->exists($doc->file_path)) {
                    $stream = $fromDisk->readStream($doc->file_path);
                    $toDisk->writeStream($doc->file_path, $stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                }

                $fromDiskName = $doc->disk();
                $doc->update(['storage_disk' => $to]);

                AuditLog::record(
                    'storage_transfer',
                    $doc,
                    ['storage_disk' => $fromDiskName],
                    ['storage_disk' => $to],
                    "نقل ملف المستند \"{$doc->title}\" من {$fromDiskName} إلى {$to}"
                );

                $results[] = $base + ['status' => 'ok'];
            } catch (\Throwable $e) {
                $results[] = $base + ['status' => 'error', 'message' => 'فشل النقل: ' . $e->getMessage()];
            }
        }

        return response()->json([
            'results' => $results,
            'transferred' => count(array_filter($results, fn ($r) => $r['status'] === 'ok')),
        ]);
    }
}
