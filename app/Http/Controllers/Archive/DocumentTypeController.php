<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DocumentType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DocumentTypeController extends Controller
{
    public function index()
    {
        return Inertia::render('Archive/DocumentTypes/Index', [
            'types' => DocumentType::withCount('documents')->latest()->get(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Archive/DocumentTypes/Form');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'code' => 'required|string|max:30|unique:document_types,code',
            'requires_expiry' => 'boolean',
        ]);

        $type = DocumentType::create($validated);
        AuditLog::record('create_type', $type, [], $type->toArray(), "إنشاء نوع مستند: {$type->name}");

        return redirect()->route('archive.document-types.index')
            ->with('success', 'تم إنشاء النوع بنجاح');
    }

    public function edit(DocumentType $documentType)
    {
        return Inertia::render('Archive/DocumentTypes/Form', ['type' => $documentType]);
    }

    public function update(Request $request, DocumentType $documentType)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'code' => 'required|string|max:30|unique:document_types,code,' . $documentType->id,
            'requires_expiry' => 'boolean',
            'is_active' => 'boolean',
        ]);

        $old = $documentType->toArray();
        $documentType->update($validated);
        AuditLog::record('update_type', $documentType, $old, $documentType->fresh()->toArray(), "تعديل نوع مستند: {$documentType->name}");

        return redirect()->route('archive.document-types.index')
            ->with('success', 'تم التحديث بنجاح');
    }

    public function destroy(DocumentType $documentType)
    {
        if ($documentType->documents()->count() > 0) {
            return back()->with('error', 'لا يمكن حذف نوع مستخدم في مستندات');
        }
        AuditLog::record('delete_type', $documentType, $documentType->toArray(), [], "حذف نوع مستند: {$documentType->name}");
        $documentType->delete();

        return back()->with('success', 'تم الحذف بنجاح');
    }

    public function show(DocumentType $documentType)
    {
        return redirect()->route('archive.document-types.index');
    }
}
