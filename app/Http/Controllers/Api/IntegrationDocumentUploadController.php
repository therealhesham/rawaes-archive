<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDocumentOcr;
use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class IntegrationDocumentUploadController extends Controller
{
    public function store(Request $request)
    {
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
            'source_device' => 'nullable|string|max:100',
        ]);

        $folderSectorId = DocumentFolder::whereKey($validated['folder_id'])->value('sector_id');
        if ($folderSectorId && (int) $folderSectorId !== (int) $validated['sector_id']) {
            return response()->json(['error' => 'Folder does not belong to sector'], 422);
        }

        $uploaderId = (int) (config('services.integration.uploader_user_id') ?: 0);
        if (!$uploaderId) {
            $uploaderId = (int) User::role('super-admin')->value('id');
        }
        if (!$uploaderId) {
            return response()->json(['error' => 'Integration uploader user not configured'], 500);
        }

        $file = $request->file('file');
        $diskName = config('filesystems.archive_disk', 'local');
        $path = $file->store('archive/' . now()->format('Y/m'), $diskName);
        $qrCode = Str::uuid()->toString();
        $title = $validated['title'] ?? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        $doc = ArchiveDocument::create([
            'title' => $title,
            'document_number' => $validated['document_number'] ?? null,
            'folder_id' => $validated['folder_id'],
            'document_type_id' => $validated['document_type_id'],
            'sector_id' => $validated['sector_id'],
            'uploaded_by' => $uploaderId,
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

        $who = $validated['source_device'] ?? 'integration';
        AuditLog::create([
            'user_id' => null,
            'user_name' => "Integration [{$who}]",
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'action' => 'upload',
            'auditable_type' => ArchiveDocument::class,
            'auditable_id' => $doc->id,
            'description' => "رفع عبر تكامل خارجي: {$doc->title}",
            'created_at' => now(),
        ]);

        ProcessDocumentOcr::dispatch($doc->id);

        return response()->json([
            'success' => true,
            'id' => $doc->id,
            'serial_number' => $doc->serial_number,
            'title' => $doc->title,
            'url' => route('archive.documents.show', $doc),
        ]);
    }
}

