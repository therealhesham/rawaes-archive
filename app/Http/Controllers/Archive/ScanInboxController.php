<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDocumentOcr;
use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\DocumentType;
use App\Models\PendingScan;
use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ScanInboxController extends Controller
{
    public function index()
    {
        $scans = PendingScan::with('claimer:id,name')
            ->where('status', 'new')
            ->latest()
            ->paginate(30);

        return Inertia::render('Archive/ScanInbox/Index', [
            'scans' => $scans,
            'count' => PendingScan::where('status', 'new')->count(),
        ]);
    }

    public function show(PendingScan $pendingScan)
    {
        $user = auth()->user();
        $allowedSectorIds = $user->accessibleSectorIds();

        $sectorsQuery = Sector::where('is_active', true);
        if (!empty($allowedSectorIds)) {
            $sectorsQuery->whereIn('id', $allowedSectorIds);
        }

        $foldersQuery = DocumentFolder::where('is_active', true);
        if (!empty($allowedSectorIds)) {
            $foldersQuery->whereIn('sector_id', $allowedSectorIds);
        }

        return Inertia::render('Archive/ScanInbox/Assign', [
            'scan' => $pendingScan,
            'sectors' => $sectorsQuery->get(),
            'folders' => $foldersQuery->get(['id', 'sector_id', 'parent_id', 'name']),
            'documentTypes' => DocumentType::where('is_active', true)->get(),
        ]);
    }

    /**
     * Convert a pending scan into a real archive document.
     */
    public function assign(Request $request, PendingScan $pendingScan)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
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

        // Move the file to a permanent location under archive/
        $newPath = 'archive/' . now()->format('Y/m') . '/' . Str::random(32) . '.' . $pendingScan->file_extension;
        Storage::disk('local')->move($pendingScan->file_path, $newPath);

        $doc = ArchiveDocument::create([
            'title' => $validated['title'],
            'document_number' => $validated['document_number'] ?? null,
            'folder_id' => $validated['folder_id'],
            'document_type_id' => $validated['document_type_id'],
            'sector_id' => $validated['sector_id'],
            'uploaded_by' => auth()->id(),
            'upload_source' => 'scanner',
            'file_path' => $newPath,
            'file_name' => $pendingScan->original_name,
            'file_extension' => $pendingScan->file_extension,
            'file_size' => $pendingScan->file_size,
            'mime_type' => $pendingScan->mime_type,
            'issuing_entity' => $validated['issuing_entity'] ?? null,
            'issue_date' => $validated['issue_date'] ?? null,
            'expiry_date' => $validated['expiry_date'] ?? null,
            'qr_code' => Str::uuid()->toString(),
            'barcode' => strtoupper(Str::random(12)),
            'notes' => $validated['notes'] ?? null,
            'is_confidential' => $validated['is_confidential'] ?? false,
        ]);

        AuditLog::record('upload', $doc, [], $doc->toArray(), "أرشفة من السكانر: {$doc->title}");
        AuditLog::record('scan_assigned', $pendingScan, [], ['document_id' => $doc->id, 'title' => $doc->title], "تصنيف وحفظ مسح ضوئي: {$doc->title}");
        ProcessDocumentOcr::dispatch($doc->id);

        $pendingScan->update([
            'status' => 'assigned',
            'assigned_to_document_id' => $doc->id,
        ]);

        return redirect()->route('archive.documents.show', $doc)
            ->with('success', 'تم أرشفة المستند الممسوح');
    }

    public function destroy(PendingScan $pendingScan)
    {
        AuditLog::record('scan_deleted', $pendingScan, $pendingScan->toArray(), [], "حذف مسح ضوئي: {$pendingScan->original_name}");
        Storage::disk('local')->delete($pendingScan->file_path);
        $pendingScan->update(['status' => 'rejected']);
        $pendingScan->delete();

        return back()->with('success', 'تم حذف المسح');
    }

    public function preview(PendingScan $pendingScan)
    {
        if (!Storage::disk('local')->exists($pendingScan->file_path)) {
            abort(404);
        }

        return response()->file(
            Storage::disk('local')->path($pendingScan->file_path),
            [
                'Content-Type' => $pendingScan->mime_type,
                'Content-Disposition' => 'inline; filename="document.' . $pendingScan->file_extension . '"',
            ]
        );
    }
}
