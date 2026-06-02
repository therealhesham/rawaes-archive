<?php

namespace App\Http\Controllers;

use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use App\Models\DocumentType;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        $from = $request->from ?? now()->subMonths(3)->format('Y-m-d');
        $to = $request->to ?? now()->format('Y-m-d');
        $toFull = $to . ' 23:59:59';

        $filters = [
            'from' => $from,
            'to' => $to,
            'sector_id' => $request->sector_id,
            'type_id' => $request->type_id,
            'uploader_id' => $request->uploader_id,
            'department' => $request->department,
        ];

        $base = ArchiveDocument::query()
            ->whereNull('deleted_at')
            ->when($filters['sector_id'], fn($q) => $q->where('sector_id', $filters['sector_id']))
            ->when($filters['type_id'], fn($q) => $q->where('document_type_id', $filters['type_id']))
            ->when($filters['uploader_id'], fn($q) => $q->where('uploaded_by', $filters['uploader_id']))
            ->when($filters['department'], fn($q) => $q->whereHas('uploader', fn($u) => $u->where('department', $filters['department'])))
            ->whereBetween('created_at', [$from, $toFull]);

        $uploadsTrend = (clone $base)->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count'),
                DB::raw('SUM(file_size) as total_size')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $bySector = DB::table('archive_documents')
            ->join('sectors', 'sectors.id', '=', 'archive_documents.sector_id')
            ->join('users', 'users.id', '=', 'archive_documents.uploaded_by')
            ->select('sectors.name', DB::raw('count(*) as count'), DB::raw('SUM(archive_documents.file_size) as total_size'))
            ->whereBetween('archive_documents.created_at', [$from, $toFull])
            ->whereNull('archive_documents.deleted_at')
            ->when($filters['sector_id'], fn($q) => $q->where('archive_documents.sector_id', $filters['sector_id']))
            ->when($filters['type_id'], fn($q) => $q->where('archive_documents.document_type_id', $filters['type_id']))
            ->when($filters['uploader_id'], fn($q) => $q->where('archive_documents.uploaded_by', $filters['uploader_id']))
            ->when($filters['department'], fn($q) => $q->where('users.department', $filters['department']))
            ->groupBy('sectors.id', 'sectors.name')
            ->orderByDesc('count')
            ->get();

        $byType = DB::table('archive_documents')
            ->join('document_types', 'document_types.id', '=', 'archive_documents.document_type_id')
            ->join('users', 'users.id', '=', 'archive_documents.uploaded_by')
            ->select('document_types.name', DB::raw('count(*) as count'))
            ->whereBetween('archive_documents.created_at', [$from, $toFull])
            ->whereNull('archive_documents.deleted_at')
            ->when($filters['sector_id'], fn($q) => $q->where('archive_documents.sector_id', $filters['sector_id']))
            ->when($filters['type_id'], fn($q) => $q->where('archive_documents.document_type_id', $filters['type_id']))
            ->when($filters['uploader_id'], fn($q) => $q->where('archive_documents.uploaded_by', $filters['uploader_id']))
            ->when($filters['department'], fn($q) => $q->where('users.department', $filters['department']))
            ->groupBy('document_types.id', 'document_types.name')
            ->orderByDesc('count')
            ->get();

        $topUploaders = DB::table('archive_documents')
            ->join('users', 'users.id', '=', 'archive_documents.uploaded_by')
            ->select('users.name', DB::raw('count(*) as count'))
            ->whereBetween('archive_documents.created_at', [$from, $toFull])
            ->whereNull('archive_documents.deleted_at')
            ->when($filters['sector_id'], fn($q) => $q->where('archive_documents.sector_id', $filters['sector_id']))
            ->when($filters['type_id'], fn($q) => $q->where('archive_documents.document_type_id', $filters['type_id']))
            ->when($filters['uploader_id'], fn($q) => $q->where('archive_documents.uploaded_by', $filters['uploader_id']))
            ->when($filters['department'], fn($q) => $q->where('users.department', $filters['department']))
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        $activityCounts = AuditLog::select('action', DB::raw('count(*) as count'))
            ->whereBetween('created_at', [$from, $toFull])
            ->when($filters['uploader_id'], fn($q) => $q->where('user_id', $filters['uploader_id']))
            ->groupBy('action')
            ->get();

        $totals = [
            'documents' => (clone $base)->count(),
            'size' => (int) (clone $base)->sum('file_size'),
            'expired' => ArchiveDocument::query()
                ->whereNull('deleted_at')
                ->when($filters['sector_id'], fn($q) => $q->where('sector_id', $filters['sector_id']))
                ->when($filters['type_id'], fn($q) => $q->where('document_type_id', $filters['type_id']))
                ->when($filters['uploader_id'], fn($q) => $q->where('uploaded_by', $filters['uploader_id']))
                ->when($filters['department'], fn($q) => $q->whereHas('uploader', fn($u) => $u->where('department', $filters['department'])))
                ->expired()
                ->count(),
            'expiring' => ArchiveDocument::query()
                ->whereNull('deleted_at')
                ->when($filters['sector_id'], fn($q) => $q->where('sector_id', $filters['sector_id']))
                ->when($filters['type_id'], fn($q) => $q->where('document_type_id', $filters['type_id']))
                ->when($filters['uploader_id'], fn($q) => $q->where('uploaded_by', $filters['uploader_id']))
                ->when($filters['department'], fn($q) => $q->whereHas('uploader', fn($u) => $u->where('department', $filters['department'])))
                ->expiringSoon(30)
                ->count(),
        ];

        return Inertia::render('Reports/Index', [
            'filters' => $filters,
            'totals' => $totals,
            'uploadsTrend' => $uploadsTrend,
            'bySector' => $bySector,
            'byType' => $byType,
            'topUploaders' => $topUploaders,
            'activityCounts' => $activityCounts,
            'sectors' => Sector::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'documentTypes' => DocumentType::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'uploaders' => User::where('is_active', true)->orderBy('name')->get(['id', 'name', 'department']),
            'departments' => User::whereNotNull('department')->where('department', '!=', '')
                ->distinct()
                ->orderBy('department')
                ->pluck('department')
                ->values(),
        ]);
    }

    public function export(Request $request)
    {
        $from = $request->from ?? now()->subMonths(3)->format('Y-m-d');
        $to = $request->to ?? now()->format('Y-m-d');
        $toFull = $to . ' 23:59:59';

        $sectorId = $request->sector_id;
        $typeId = $request->type_id;
        $uploaderId = $request->uploader_id;
        $department = $request->department;

        $documents = ArchiveDocument::with(['sector:id,name', 'documentType:id,name', 'uploader:id,name,department'])
            ->whereNull('deleted_at')
            ->when($sectorId, fn($q) => $q->where('sector_id', $sectorId))
            ->when($typeId, fn($q) => $q->where('document_type_id', $typeId))
            ->when($uploaderId, fn($q) => $q->where('uploaded_by', $uploaderId))
            ->when($department, fn($q) => $q->whereHas('uploader', fn($u) => $u->where('department', $department)))
            ->whereBetween('created_at', [$from, $toFull])
            ->orderBy('created_at')
            ->get();

        $filename = "archive-report-{$from}-to-{$to}.csv";

        return new StreamedResponse(function () use ($documents) {
            $out = fopen('php://output', 'w');
            fputs($out, "\xEF\xBB\xBF"); // UTF-8 BOM

            fputcsv($out, [
                'ID', 'العنوان', 'رقم الوثيقة', 'القطاع', 'النوع',
                'الجهة المصدرة', 'تاريخ الإصدار', 'تاريخ الانتهاء',
                'الحالة', 'سري', 'الحجم', 'رفع بواسطة', 'القسم', 'تاريخ الرفع',
                'النص المستخرج (OCR)',
            ]);

            foreach ($documents as $doc) {
                fputcsv($out, [
                    $doc->id,
                    $doc->title,
                    $doc->document_number ?? '',
                    $doc->sector?->name ?? '',
                    $doc->documentType?->name ?? '',
                    $doc->issuing_entity ?? '',
                    $doc->issue_date?->format('Y-m-d') ?? '',
                    $doc->expiry_date?->format('Y-m-d') ?? '',
                    $doc->status,
                    $doc->is_confidential ? 'نعم' : 'لا',
                    $doc->file_size_formatted,
                    $doc->uploader?->name ?? '',
                    $doc->uploader?->department ?? '',
                    $doc->created_at?->format('Y-m-d H:i'),
                    $doc->ocr_content ?? '',
                ]);
            }

            fclose($out);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
