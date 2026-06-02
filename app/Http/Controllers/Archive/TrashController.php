<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TrashController extends Controller
{
    public function index(Request $request)
    {
        abort_unless(auth()->user()->can('documents.trash.view'), 403);

        $deleted = ArchiveDocument::onlyTrashed()
            ->with(['folder', 'documentType', 'sector', 'uploader'])
            ->orderByDesc('deleted_at')
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('Archive/Documents/Trash', [
            'documents' => $deleted,
        ]);
    }

    public function restore(int $id)
    {
        abort_unless(auth()->user()->can('documents.restore'), 403);

        $document = ArchiveDocument::withTrashed()->findOrFail($id);
        if (!$document->trashed()) {
            return back()->with('error', 'المستند غير موجود في سلة المحذوفات');
        }

        $document->restore();
        AuditLog::record('document_restored', $document, [], $document->toArray(), "استرجاع مستند: {$document->title}");

        return back()->with('success', 'تم استرجاع المستند');
    }

    public function forceDestroy(int $id)
    {
        abort_unless(auth()->user()->can('documents.force_delete'), 403);

        $document = ArchiveDocument::withTrashed()->findOrFail($id);
        if (!$document->trashed()) {
            return back()->with('error', 'المستند غير موجود في سلة المحذوفات');
        }

        $old = $document->toArray();
        $document->forceDelete();
        AuditLog::record('document_force_deleted', $document, $old, [], "حذف نهائي لمستند: {$old['title']}");

        return back()->with('success', 'تم الحذف النهائي');
    }
}
