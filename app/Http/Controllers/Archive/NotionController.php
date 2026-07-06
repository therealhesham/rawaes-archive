<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDocumentOcr;
use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\DocumentType;
use App\Models\Sector;
use App\Services\NotionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class NotionController extends Controller
{
    private const ALLOWED_EXTENSIONS = [
        'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
    ];

    private const MIME_TO_EXT = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/bmp' => 'bmp',
        'image/tiff' => 'tif',
        'text/plain' => 'txt',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
    ];

    private const MAX_FILE_BYTES = 52428800; // 50MB

    public function index(): Response
    {
        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds();
        $allowedFolderIds = $user->accessibleFolderIds();

        $sectorsQuery = Sector::where('is_active', true);
        if (!empty($allowedSectorIds)) {
            $sectorsQuery->whereIn('id', $allowedSectorIds);
        }

        $foldersQuery = DocumentFolder::where('is_active', true);
        if (!empty($allowedSectorIds)) {
            $foldersQuery->whereIn('sector_id', $allowedSectorIds);
        }
        if (!empty($allowedFolderIds)) {
            $foldersQuery->whereIn('id', $allowedFolderIds);
        }

        return Inertia::render('Archive/Notion/Index', [
            'configured' => (bool) config('services.notion.token'),
            'databaseId' => config('services.notion.database_id'),
            'sectors' => $sectorsQuery->get(['id', 'name']),
            'folders' => $foldersQuery->get(['id', 'sector_id', 'parent_id', 'name']),
            'documentTypes' => DocumentType::where('is_active', true)->get(['id', 'name']),
        ]);
    }

    /**
     * جلب صفوف قاعدة Notion كـ JSON (تستدعيها الواجهة).
     */
    public function rows()
    {
        if (!config('services.notion.token')) {
            return response()->json([
                'error' => 'لم يتم ضبط NOTION_API_TOKEN في إعدادات الخادم',
            ], 422);
        }

        try {
            $rows = app(NotionService::class)->fetchDatabaseRows(request('database_id'));
            return response()->json(['rows' => $rows]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'فشل الجلب من Notion: ' . $e->getMessage(),
            ], 502);
        }
    }

    /**
     * نسخ ملفات صفوف Notion المحددة إلى مجلد في الأرشيف.
     * الخادم هو من يحمّل الملفات من Notion (الروابط موقعة ومؤقتة).
     */
    public function import(Request $request, NotionService $notion)
    {
        $user = $request->user();
        abort_unless($user->can('documents.create'), 403, 'لا تملك صلاحية إضافة مستندات');

        $validated = $request->validate([
            'items' => 'required|array|min:1|max:50',
            'items.*.page_id' => 'required|string|max:64',
            'items.*.name' => 'required|string|max:255',
            'folder_id' => 'required|exists:document_folders,id',
            'document_type_id' => 'required|exists:document_types,id',
        ]);

        $folder = DocumentFolder::findOrFail($validated['folder_id']);
        if (!$folder->is_active) {
            return response()->json(['error' => 'المجلد الهدف غير نشط'], 422);
        }

        $allowedSectorIds = $user->accessibleSectorIds();
        $allowedFolderIds = $user->accessibleFolderIds();
        if (!empty($allowedSectorIds) && !in_array((int) $folder->sector_id, array_map('intval', $allowedSectorIds), true)) {
            abort(403, 'لا تملك صلاحية النسخ إلى هذا القطاع');
        }
        if (!empty($allowedFolderIds) && !in_array((int) $folder->id, array_map('intval', $allowedFolderIds), true)) {
            abort(403, 'لا تملك صلاحية النسخ إلى هذا المجلد');
        }

        $results = [];

        foreach ($validated['items'] as $item) {
            $results[] = $this->importPage($notion, $item, $folder, (int) $validated['document_type_id'], $user);
        }

        return response()->json([
            'results' => $results,
            'imported' => count(array_filter($results, fn ($r) => $r['status'] === 'ok')),
        ]);
    }

    /**
     * استيراد ملفات صفحة Notion واحدة كمستندات أرشيف.
     */
    private function importPage(NotionService $notion, array $item, DocumentFolder $folder, int $documentTypeId, $user): array
    {
        $base = ['page_id' => $item['page_id'], 'name' => $item['name']];

        try {
            $files = $notion->pageFiles($item['page_id']);
        } catch (\Throwable $e) {
            return $base + ['status' => 'error', 'message' => 'تعذر قراءة الصفحة من Notion'];
        }

        if (empty($files)) {
            return $base + ['status' => 'error', 'message' => 'لا توجد ملفات مرفقة في هذا الصف'];
        }

        $created = [];
        foreach ($files as $i => $file) {
            try {
                $response = Http::timeout(90)->retry(1, 500)->get($file['url']);
                if (!$response->successful()) {
                    throw new \RuntimeException('HTTP ' . $response->status());
                }

                $body = $response->body();
                if (strlen($body) > self::MAX_FILE_BYTES) {
                    throw new \RuntimeException('الملف أكبر من 50MB');
                }

                $ext = $this->resolveExtension($file, $response->header('Content-Type'));
                if (!$ext) {
                    throw new \RuntimeException('نوع الملف غير مدعوم');
                }

                $path = 'archive/' . now()->format('Y/m') . '/' . Str::random(32) . '.' . $ext;
                Storage::disk('local')->put($path, $body);

                $title = $item['name'] . ($i > 0 ? ' - ' . ($i + 1) : '');

                $doc = ArchiveDocument::create([
                    'title' => $title,
                    'folder_id' => $folder->id,
                    'document_type_id' => $documentTypeId,
                    'sector_id' => $folder->sector_id,
                    'uploaded_by' => $user->id,
                    'upload_source' => 'api',
                    'file_path' => $path,
                    'file_name' => $file['name'] ?: ($title . '.' . $ext),
                    'file_extension' => $ext,
                    'file_size' => strlen($body),
                    'mime_type' => explode(';', $response->header('Content-Type') ?? 'application/octet-stream')[0],
                    'qr_code' => Str::uuid()->toString(),
                    'barcode' => strtoupper(Str::random(12)),
                ]);

                AuditLog::record('upload', $doc, [], $doc->toArray(), "استيراد من Notion: {$doc->title}");
                ProcessDocumentOcr::dispatch($doc->id);

                $created[] = $doc->id;
            } catch (\Throwable $e) {
                // فشل ملف واحد لا يوقف بقية ملفات الصف
                continue;
            }
        }

        if (empty($created)) {
            return $base + ['status' => 'error', 'message' => 'فشل تحميل الملفات من Notion'];
        }

        return $base + [
            'status' => 'ok',
            'documents' => $created,
            'message' => count($created) . ' ملف',
        ];
    }

    private function resolveExtension(array $file, ?string $contentType): ?string
    {
        // من اسم الملف أو مسار الرابط (بدون الـ query)
        foreach ([$file['name'] ?? '', parse_url($file['url'], PHP_URL_PATH) ?? ''] as $candidate) {
            $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
            if ($ext && in_array($ext, self::ALLOWED_EXTENSIONS, true)) {
                return $ext === 'jpeg' ? 'jpg' : $ext;
            }
        }

        // من Content-Type
        $mime = strtolower(explode(';', $contentType ?? '')[0]);

        return self::MIME_TO_EXT[$mime] ?? null;
    }
}
