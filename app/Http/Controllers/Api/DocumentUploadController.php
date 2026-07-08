<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDocumentOcr;
use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DocumentUploadController extends Controller
{
    /**
     * Upload a document directly to the archive.
     *
     * Auth: Sanctum Bearer token (Authorization: Bearer <token>)
     */
    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless($user, 401);
        abort_unless($user->can('documents.create'), 403);

        $validated = $request->validate([
            'file' => 'required|file|max:51200|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx,ppt,pptx,txt',
            'title' => 'nullable|string|max:255',
            'document_number' => 'nullable|string|max:255',
            'folder_id' => 'required|exists:document_folders,id',
            'document_type_id' => 'required|exists:document_types,id',
            'sector_id' => 'required|exists:sectors,id',
            'issuing_entity' => 'nullable|string|max:255',
            'issue_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'is_confidential' => 'nullable|boolean',
        ]);

        // Enforce sector & folder access (same logic as web upload)
        $allowedSectorIds = $user->accessibleSectorIds();
        $allowedFolderIds = $user->accessibleFolderIds();

        if (!empty($allowedSectorIds) && !in_array((int) $validated['sector_id'], array_map('intval', $allowedSectorIds), true)) {
            abort(403, 'لا تملك صلاحية الرفع لهذا القطاع');
        }
        if (!empty($allowedFolderIds) && !in_array((int) $validated['folder_id'], array_map('intval', $allowedFolderIds), true)) {
            abort(403, 'لا تملك صلاحية الرفع لهذا المجلد');
        }

        // Extra guard: folder must belong to the selected sector
        $folderSectorId = DocumentFolder::whereKey($validated['folder_id'])->value('sector_id');
        if ($folderSectorId && (int) $folderSectorId !== (int) $validated['sector_id']) {
            abort(422, 'المجلد لا يتبع القطاع المحدد');
        }

        $file = $request->file('file');
        $diskName = config('filesystems.archive_disk', 'local');
        $path = $file->store('archive/' . now()->format('Y/m'), $diskName);
        $qrCode = Str::uuid()->toString();

        $title = $validated['title']
            ?? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        $doc = ArchiveDocument::create([
            'title' => $title,
            'document_number' => $validated['document_number'] ?? null,
            'folder_id' => $validated['folder_id'],
            'document_type_id' => $validated['document_type_id'],
            'sector_id' => $validated['sector_id'],
            'uploaded_by' => $user->id,
            'upload_source' => 'api',
            'file_path' => $path,
            'storage_disk' => $diskName,
            'file_name' => $file->getClientOriginalName(),
            'file_extension' => $file->getClientOriginalExtension(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'issuing_entity' => $validated['issuing_entity'] ?? null,
            'issue_date' => $validated['issue_date'] ?? null,
            'expiry_date' => $validated['expiry_date'] ?? null,
            'qr_code' => $qrCode,
            'barcode' => strtoupper(Str::random(12)),
            'notes' => $validated['notes'] ?? null,
            'is_confidential' => (bool) ($validated['is_confidential'] ?? false),
        ]);

        AuditLog::record('upload', $doc, [], $doc->toArray(), "رفع عبر API: {$doc->title}");

        ProcessDocumentOcr::dispatch($doc->id);

        return response()->json([
            'success' => true,
            'id' => $doc->id,
            'serial_number' => $doc->serial_number,
            'title' => $doc->title,
            'url' => route('archive.documents.show', $doc),
        ]);
    }

    public function download(ArchiveDocument $document)
    {
        $user = request()->user();
        abort_unless($user, 401);
        abort_unless($user->can('documents.download'), 403);

        // Reuse policy logic via Gate
        $this->authorize('download', $document);

        return Storage::disk($document->disk())->download($document->file_path, $document->file_name);
    }
}

