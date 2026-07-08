<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDocumentOcr;
use App\Mail\DocumentEmailMail;
use App\Models\ArchiveDocument;
use App\Models\ArchiveDocumentMovement;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\DocumentType;
use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', ArchiveDocument::class);
        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds(); // [] = full access

        $query = ArchiveDocument::withTrashed()
            ->with(['folder', 'documentType', 'sector', 'uploader'])
            // Sector scoping based on accessible sectors
            ->when(
                !empty($allowedSectorIds),
                fn($q) => $q->whereIn('sector_id', $allowedSectorIds)
            )
            // Hide confidential from others
            ->when(
                !$user->hasAnyRole(['super-admin', 'archive-manager']),
                fn($q) => $q->where(function ($sub) use ($user) {
                    $sub->where('is_confidential', false)
                        ->orWhere('uploaded_by', $user->id);
                })
            )
            ->when($request->search, fn($q) => $q->search($request->search))
            ->when($request->sector_id, fn($q) => $q->where('sector_id', $request->sector_id))
            ->when($request->folder_id, fn($q) => $q->where('folder_id', $request->folder_id))
            ->when($request->type_id, fn($q) => $q->where('document_type_id', $request->type_id))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->expired === 'true', fn($q) => $q->expired())
            ->when($request->expiring_soon === 'true', fn($q) => $q->expiringSoon())
            ->when($request->date_from, fn($q) => $q->where('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->where('created_at', '<=', $request->date_to))
            ->orderByDesc('serial_number')
            ->paginate(20)
            ->withQueryString();

        // المسار الكامل للمجلد (مجلد / مجلد فرعي / ...) لكل مستند
        $allFolders = DocumentFolder::withTrashed()->get(['id', 'parent_id', 'name'])->keyBy('id');
        foreach ($query->items() as $doc) {
            $parts = [];
            $folderId = $doc->folder_id;
            $guard = 0;
            while ($folderId && ($f = $allFolders->get($folderId)) && $guard++ < 20) {
                array_unshift($parts, $f->name);
                $folderId = $f->parent_id;
            }
            $doc->setAttribute('folder_path', implode(' / ', $parts));
        }

        return Inertia::render('Archive/Documents/Index', [
            'documents' => $query,
            'sectors' => Sector::where('is_active', true)->get(),
            'folders' => DocumentFolder::where('is_active', true)->get(),
            'documentTypes' => DocumentType::where('is_active', true)->get(),
            'filters' => $request->only(['search', 'sector_id', 'folder_id', 'type_id', 'status', 'expired', 'expiring_soon', 'date_from', 'date_to']),
        ]);
    }

    public function create(): Response
    {
        $this->authorize('create', ArchiveDocument::class);

        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds(); // empty = all
        $allowedFolderIds = $user->accessibleFolderIds(); // empty = no specific restriction

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

        return Inertia::render('Archive/Documents/Create', [
            'sectors' => $sectorsQuery->get(),
            'folders' => $foldersQuery->get(['id', 'sector_id', 'parent_id', 'name', 'name_en']),
            'documentTypes' => DocumentType::where('is_active', true)->get(),
        ]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', ArchiveDocument::class);

        $validated = $request->validate([
            'files' => 'required|array|min:1',
            'files.*' => 'required|file|max:51200|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx,ppt,pptx,txt',
            'folder_id' => 'required|exists:document_folders,id',
            'document_type_id' => 'required|exists:document_types,id',
            'sector_id' => 'required|exists:sectors,id',
            'issuing_entity' => 'nullable|string|max:255',
            'issue_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'no_expiry_date' => 'nullable|boolean',
            'notes' => 'nullable|string',
            'is_confidential' => 'nullable|boolean',
            'sources' => 'nullable|array',
        ]);

        $validated['no_expiry_date'] = (bool) ($validated['no_expiry_date'] ?? false);
        if (!empty($validated['expiry_date'])) {
            $validated['no_expiry_date'] = false;
        }
        if ($validated['no_expiry_date']) {
            $validated['expiry_date'] = null;
        }

        // Enforce sector & folder access
        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds();
        $allowedFolderIds = $user->accessibleFolderIds();

        if (!empty($allowedSectorIds) && !in_array($validated['sector_id'], $allowedSectorIds)) {
            abort(403, 'لا تملك صلاحية الرفع لهذا القطاع');
        }
        if (!empty($allowedFolderIds) && !in_array($validated['folder_id'], $allowedFolderIds)) {
            abort(403, 'لا تملك صلاحية الرفع لهذا المجلد');
        }

        $documents = [];

        // File names contain dots, so dot-notation input() lookups can't reach these keys
        $titles = (array) $request->input('titles', []);
        $documentNumbers = (array) $request->input('document_numbers', []);
        $sources = (array) $request->input('sources', []);

        $diskName = config('filesystems.archive_disk', 'local');

        foreach ($request->file('files') as $file) {
            $path = $file->store('archive/' . now()->format('Y/m'), $diskName);
            $qrCode = Str::uuid()->toString();
            $originalName = $file->getClientOriginalName();

            $title = ($titles[$originalName] ?? null)
                ?: pathinfo($originalName, PATHINFO_FILENAME);

            // ورقي إذا جاء الملف من السكانر، وإلا إلكتروني
            $uploadSource = ($sources[$originalName] ?? null) === 'scanner'
                ? 'scanner'
                : 'web';

            $doc = ArchiveDocument::create([
                'title' => $title,
                'document_number' => $documentNumbers[$originalName] ?? null,
                'folder_id' => $validated['folder_id'],
                'document_type_id' => $validated['document_type_id'],
                'sector_id' => $validated['sector_id'],
                'uploaded_by' => auth()->id(),
                'upload_source' => $uploadSource,
                'file_path' => $path,
                'storage_disk' => $diskName,
                'file_name' => $file->getClientOriginalName(),
                'file_extension' => $file->getClientOriginalExtension(),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'issuing_entity' => $validated['issuing_entity'] ?? null,
                'issue_date' => $validated['issue_date'] ?? null,
                'expiry_date' => $validated['expiry_date'] ?? null,
                'no_expiry_date' => $validated['no_expiry_date'],
                'qr_code' => $qrCode,
                'barcode' => strtoupper(Str::random(12)),
                'notes' => $validated['notes'] ?? null,
                'is_confidential' => $validated['is_confidential'] ?? false,
            ]);

            AuditLog::record('upload', $doc, [], $doc->toArray(), "رفع المستند: {$doc->title}");

            // Dispatch OCR job (runs in background via queue)
            ProcessDocumentOcr::dispatch($doc->id);

            $documents[] = $doc;
        }

        return redirect()->route('archive.documents.index')
            ->with('success', 'تم رفع ' . count($documents) . ' مستند بنجاح');
    }

    public function show(ArchiveDocument $document): Response
    {
        $this->authorize('view', $document);
        $document->load(['folder.parent', 'documentType', 'sector', 'uploader', 'metadata']);
        $document->setAttribute('folder_path', $document->folder?->path);
        AuditLog::record('view', $document, [], [], "استعراض المستند: {$document->title}");

        // المجلدات المتاحة للنقل (بنفس تقييد صلاحيات الرفع)
        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds();
        $allowedFolderIds = $user->accessibleFolderIds();

        $foldersQuery = DocumentFolder::where('is_active', true);
        if (!empty($allowedSectorIds)) {
            $foldersQuery->whereIn('sector_id', $allowedSectorIds);
        }
        if (!empty($allowedFolderIds)) {
            $foldersQuery->whereIn('id', $allowedFolderIds);
        }

        return Inertia::render('Archive/Documents/Show', [
            'document' => $document,
            'folders' => $foldersQuery->get(['id', 'sector_id', 'parent_id', 'name']),
        ]);
    }

    public function edit(ArchiveDocument $document): Response
    {
        $this->authorize('update', $document);
        return Inertia::render('Archive/Documents/Edit', [
            'document' => $document->load('metadata'),
            'sectors' => Sector::where('is_active', true)->get(),
            'folders' => DocumentFolder::with('children')
                ->whereNull('parent_id')
                ->where('is_active', true)
                ->get(['id', 'sector_id', 'parent_id', 'name', 'name_en']),
            'documentTypes' => DocumentType::where('is_active', true)->get(),
        ]);
    }

    /**
     * نقل المستند إلى مجلد آخر (مع تحديث القطاع تلقائياً حسب قطاع المجلد الهدف).
     */
    public function move(Request $request, ArchiveDocument $document)
    {
        $this->authorize('update', $document);

        $validated = $request->validate([
            'folder_id' => 'required|exists:document_folders,id',
        ]);

        $folder = DocumentFolder::findOrFail($validated['folder_id']);
        if (!$folder->is_active) {
            throw ValidationException::withMessages(['folder_id' => 'المجلد الهدف غير نشط']);
        }

        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds();
        $allowedFolderIds = $user->accessibleFolderIds();
        if (!empty($allowedSectorIds) && !in_array((int) $folder->sector_id, array_map('intval', $allowedSectorIds), true)) {
            abort(403, 'لا تملك صلاحية النقل إلى هذا القطاع');
        }
        if (!empty($allowedFolderIds) && !in_array((int) $folder->id, array_map('intval', $allowedFolderIds), true)) {
            abort(403, 'لا تملك صلاحية النقل إلى هذا المجلد');
        }

        if ((int) $folder->id === (int) $document->folder_id) {
            return back()->with('success', 'المستند موجود في هذا المجلد بالفعل');
        }

        $old = $document->only(['folder_id', 'sector_id']);
        $oldPath = $document->folder?->path ?? '—';

        $document->update([
            'folder_id' => $folder->id,
            'sector_id' => $folder->sector_id ?? $document->sector_id,
        ]);

        AuditLog::record(
            'move',
            $document,
            $old,
            $document->only(['folder_id', 'sector_id']),
            "نقل المستند \"{$document->title}\" من \"{$oldPath}\" إلى \"{$folder->path}\""
        );

        return back()->with('success', "تم نقل المستند إلى: {$folder->path}");
    }

    /**
     * نسخ المستند إلى مجلد (لصق بعد نسخ): يكرر الملف والسجل بمعرفات جديدة.
     */
    public function copy(Request $request, ArchiveDocument $document)
    {
        $this->authorize('view', $document);
        abort_unless(auth()->user()->can('documents.create'), 403);

        $validated = $request->validate([
            'folder_id' => 'required|exists:document_folders,id',
        ]);

        $folder = DocumentFolder::findOrFail($validated['folder_id']);
        if (!$folder->is_active) {
            throw ValidationException::withMessages(['folder_id' => 'المجلد الهدف غير نشط']);
        }

        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds();
        $allowedFolderIds = $user->accessibleFolderIds();
        if (!empty($allowedSectorIds) && !in_array((int) $folder->sector_id, array_map('intval', $allowedSectorIds), true)) {
            abort(403, 'لا تملك صلاحية النسخ إلى هذا القطاع');
        }
        if (!empty($allowedFolderIds) && !in_array((int) $folder->id, array_map('intval', $allowedFolderIds), true)) {
            abort(403, 'لا تملك صلاحية النسخ إلى هذا المجلد');
        }

        if (!Storage::disk($document->disk())->exists($document->file_path)) {
            throw ValidationException::withMessages(['folder_id' => 'ملف المستند الأصلي غير موجود']);
        }

        // نسخة فعلية جديدة من الملف على نفس قرص الأصل
        $newPath = 'archive/' . now()->format('Y/m') . '/' . Str::random(32) . '.' . $document->file_extension;
        Storage::disk($document->disk())->copy($document->file_path, $newPath);

        $copy = $document->replicate([
            'serial_number', 'qr_code', 'barcode',
            'is_checked_out', 'checked_out_to', 'checked_out_by', 'checked_out_at', 'checked_out_notes',
        ]);
        $copy->folder_id = $folder->id;
        $copy->sector_id = $folder->sector_id ?? $document->sector_id;
        $copy->file_path = $newPath;
        $copy->storage_disk = $document->disk();
        $copy->uploaded_by = $user->id;
        $copy->qr_code = Str::uuid()->toString();
        $copy->barcode = strtoupper(Str::random(12));
        $copy->is_checked_out = false;
        // نفس المجلد: ميّز النسخة بالاسم
        if ((int) $folder->id === (int) $document->folder_id) {
            $copy->title = $document->title . ' - نسخة';
        }
        $copy->save();

        AuditLog::record(
            'copy',
            $copy,
            [],
            $copy->toArray(),
            "نسخ المستند \"{$document->title}\" إلى \"{$folder->path}\""
        );

        return back()->with('success', "تم نسخ المستند إلى: {$folder->path}");
    }

    public function update(Request $request, ArchiveDocument $document)
    {
        $this->authorize('update', $document);
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'document_number' => 'nullable|string|max:255',
            'folder_id' => 'required|exists:document_folders,id',
            'document_type_id' => 'required|exists:document_types,id',
            'sector_id' => 'required|exists:sectors,id',
            'issuing_entity' => 'nullable|string|max:255',
            'issue_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'no_expiry_date' => 'nullable|boolean',
            'notes' => 'nullable|string',
            'is_confidential' => 'boolean',
            'status' => 'in:active,expired,archived,pending_review',
        ]);

        $validated['no_expiry_date'] = (bool) ($validated['no_expiry_date'] ?? false);
        if (!empty($validated['expiry_date'])) {
            $validated['no_expiry_date'] = false;
        }
        if ($validated['no_expiry_date']) {
            $validated['expiry_date'] = null;
        }

        $old = $document->toArray();
        $document->update($validated);
        AuditLog::record('update', $document, $old, $document->fresh()->toArray(), "تعديل المستند: {$document->title}");

        return redirect()->route('archive.documents.show', $document)
            ->with('success', 'تم تحديث المستند بنجاح');
    }

    public function destroy(ArchiveDocument $document)
    {
        $this->authorize('delete', $document);
        AuditLog::record('delete', $document, $document->toArray(), [], "حذف المستند: {$document->title}");
        $document->delete();

        return redirect()->route('archive.documents.index')
            ->with('success', 'تم حذف المستند بنجاح');
    }

    public function download(ArchiveDocument $document)
    {
        $this->authorize('download', $document);
        AuditLog::record('download', $document, [], [], "تحميل المستند: {$document->title}");

        return Storage::disk($document->disk())->download($document->file_path, $document->file_name);
    }

    public function preview(ArchiveDocument $document)
    {
        $this->authorize('view', $document);
        if (!Storage::disk($document->disk())->exists($document->file_path)) {
            abort(404);
        }

        $safeName = 'document.' . $document->file_extension;
        $encodedName = rawurlencode($document->file_name);

        // بث الملف عبر Laravel (يعمل مع القرص المحلي وDigitalOcean Spaces)
        return Storage::disk($document->disk())->response(
            $document->file_path,
            $safeName,
            [
                'Content-Type' => $document->mime_type,
                'Content-Disposition' => "inline; filename=\"{$safeName}\"; filename*=UTF-8''{$encodedName}",
                'X-Content-Type-Options' => 'nosniff',
            ]
        );
    }

    public function runOcr(Request $request, ArchiveDocument $document)
    {
        // If OCR already exists and not forcing re-run, no-op.
        if (!$request->boolean('force') && !empty($document->ocr_content)) {
            return back()->with('success', 'النص المستخرج موجود بالفعل');
        }

        // Async by default to avoid blocking the request.
        if ($request->boolean('async', true)) {
            ProcessDocumentOcr::dispatch($document->id);
            return back()->with('success', 'تم بدء استخراج النص (OCR) وسيظهر عند اكتماله');
        }

        // Synchronous fallback (not recommended for large files).
        ProcessDocumentOcr::dispatchSync($document->id);

        return back()->with('success', 'تم استخراج النص من المستند');
    }

    public function email(Request $request, ArchiveDocument $document)
    {
        $this->authorize('view', $document);

        $validated = $request->validate([
            'recipients'   => 'required|array|min:1|max:10',
            'recipients.*' => 'required|email',
            'subject'      => 'nullable|string|max:255',
            'note'         => 'nullable|string|max:2000',
            'cc'           => 'nullable|array|max:10',
            'cc.*'         => 'nullable|email',
        ]);

        $sender = auth()->user();

        try {
            $mail = Mail::to($validated['recipients']);
            if (!empty($validated['cc'])) {
                $mail->cc(array_filter($validated['cc']));
            }
            $mail->send(new DocumentEmailMail(
                document: $document,
                senderName: $sender->name,
                note: $validated['note'] ?? null,
                subjectText: $validated['subject'] ?? ''
            ));
        } catch (\Throwable $e) {
            \Log::error('Email send failed: ' . $e->getMessage());
            return back()->with('error', 'فشل إرسال البريد: ' . $e->getMessage());
        }

        $recipientList = implode(', ', $validated['recipients']);
        AuditLog::record(
            'document_emailed',
            $document,
            [],
            ['recipients' => $validated['recipients'], 'subject' => $validated['subject']],
            "إرسال المستند «{$document->title}» إلى: {$recipientList}"
        );

        return back()->with('success', 'تم إرسال المستند بنجاح إلى ' . count($validated['recipients']) . ' مستلم');
    }

    public function custodyCheckout(Request $request, ArchiveDocument $document)
    {
        $this->authorize('update', $document);
        abort_unless($request->user()?->can('documents.custody.checkout'), 403);

        $validated = $request->validate([
            'to_person' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'signature' => 'required|string',
        ]);

        if ($document->is_checked_out) {
            return back()->with('error', 'المستند مُسلّم بالفعل');
        }

        $document->forceFill([
            'is_checked_out' => true,
            'checked_out_to' => $validated['to_person'],
            'checked_out_by' => $request->user()?->id,
            'checked_out_at' => now(),
            'checked_out_notes' => $validated['notes'] ?? null,
        ])->save();

        $signaturePath = $this->storeSignatureDataUrl(
            $validated['signature'],
            'signatures/custody/documents/'.now()->format('Y/m')
        );

        ArchiveDocumentMovement::create([
            'document_id' => $document->id,
            'action' => 'checkout',
            'to_person' => $validated['to_person'],
            'notes' => $validated['notes'] ?? null,
            'signature_path' => $signaturePath,
            'created_by' => $request->user()?->id,
        ]);

        AuditLog::record('document_custody_checkout', $document, [], [], "تسليم عهدة مستند: {$document->title}");

        return back()->with('success', 'تم تسليم العهدة');
    }

    public function custodyCheckin(Request $request, ArchiveDocument $document)
    {
        $this->authorize('update', $document);
        abort_unless($request->user()?->can('documents.custody.checkin'), 403);

        $validated = $request->validate([
            'notes' => 'nullable|string',
            'signature' => 'required|string',
        ]);

        if (!$document->is_checked_out) {
            return back()->with('error', 'المستند غير مُسلّم حالياً');
        }

        $signaturePath = $this->storeSignatureDataUrl(
            $validated['signature'],
            'signatures/custody/documents/'.now()->format('Y/m')
        );

        ArchiveDocumentMovement::create([
            'document_id' => $document->id,
            'action' => 'checkin',
            'to_person' => $document->checked_out_to,
            'notes' => $validated['notes'] ?? null,
            'signature_path' => $signaturePath,
            'created_by' => $request->user()?->id,
        ]);

        $document->forceFill([
            'is_checked_out' => false,
            'checked_out_to' => null,
            'checked_out_by' => null,
            'checked_out_at' => null,
            'checked_out_notes' => $validated['notes'] ?? null,
        ])->save();

        AuditLog::record('document_custody_checkin', $document, [], [], "استلام عهدة مستند: {$document->title}");

        return back()->with('success', 'تم استلام العهدة');
    }

    private function storeSignatureDataUrl(string $dataUrl, string $dir): string
    {
        $dataUrl = trim($dataUrl);
        if (!str_starts_with($dataUrl, 'data:image/png;base64,')) {
            throw ValidationException::withMessages([
                'signature' => 'صيغة التوقيع غير صحيحة (PNG فقط).',
            ]);
        }

        $base64 = substr($dataUrl, strlen('data:image/png;base64,'));
        $binary = base64_decode($base64, true);

        if ($binary === false) {
            throw ValidationException::withMessages([
                'signature' => 'تعذّر قراءة التوقيع.',
            ]);
        }

        // prevent huge payloads (~1MB max)
        if (strlen($binary) > 1024 * 1024) {
            throw ValidationException::withMessages([
                'signature' => 'حجم التوقيع كبير جداً.',
            ]);
        }

        $filename = Str::uuid()->toString().'.png';
        $path = rtrim($dir, '/').'/'.$filename;

        Storage::disk('public')->put($path, $binary);

        return $path;
    }
}