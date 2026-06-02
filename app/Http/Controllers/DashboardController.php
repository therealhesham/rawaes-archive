<?php

namespace App\Http\Controllers;

use App\Models\ArchiveDocument;
use App\Models\AuditLog;
use App\Models\DocumentFolder;
use App\Models\DocumentType;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();

        // Determine if user has full access (admin/manager/auditor) or sector-scoped (employee)
        $hasFullAccess = $user->hasAnyRole(['super-admin', 'archive-manager', 'auditor']);
        $sectorId = (!$hasFullAccess && $user->sector_id) ? $user->sector_id : null;

        // Base query with sector scoping + confidential filtering
        $base = fn() => ArchiveDocument::query()
            ->when($sectorId, fn($q) => $q->where('sector_id', $sectorId))
            ->when(
                !$user->hasAnyRole(['super-admin', 'archive-manager']),
                fn($q) => $q->where(function ($sub) use ($user) {
                    $sub->where('is_confidential', false)
                        ->orWhere('uploaded_by', $user->id);
                })
            );

        $totalDocs    = $base()->count();
        $electronicDocs = $base()->whereIn('upload_source', ['web', 'api'])->count();
        $paperDocs = $base()->where('upload_source', 'scanner')->count();
        $expiringSoon = $base()->expiringSoon(30)->count();
        $expired      = $base()->expired()->count();
        $confidential = $base()->where('is_confidential', true)->count();
        $checkedOutCount = $base()->where('is_checked_out', true)->count();
        $totalSize    = (int) $base()->sum('file_size');

        // By sector (only show all sectors for users with full access)
        $bySector = $hasFullAccess
            ? ArchiveDocument::select('sector_id', DB::raw('count(*) as count'))
                ->with('sector:id,name')
                ->groupBy('sector_id')
                ->get()
                ->map(fn($r) => ['name' => $r->sector?->name ?? 'غير محدد', 'count' => $r->count])
            : collect();

        // By document type (scoped)
        $byType = $base()
            ->select('document_type_id', DB::raw('count(*) as count'))
            ->with('documentType:id,name')
            ->groupBy('document_type_id')
            ->get()
            ->map(fn($r) => ['name' => $r->documentType?->name ?? 'غير محدد', 'count' => $r->count]);

        $trend = $base()
            ->select(DB::raw('DATE(created_at) as date'), DB::raw('count(*) as count'))
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $recent = $base()
            ->with(['sector:id,name', 'documentType:id,name', 'uploader:id,name'])
            ->latest()
            ->take(6)
            ->get();

        $expiringList = $base()
            ->expiringSoon(30)
            ->with(['sector:id,name', 'documentType:id,name'])
            ->orderBy('expiry_date')
            ->take(5)
            ->get();

        $checkedOutList = $base()
            ->where('is_checked_out', true)
            ->with(['sector:id,name', 'documentType:id,name', 'uploader:id,name'])
            ->orderByDesc('checked_out_at')
            ->take(6)
            ->get();

        // Activity log: full access only
        $recentActivity = $hasFullAccess
            ? AuditLog::with('user:id,name')->latest('created_at')->take(8)->get()
            : collect();

        // Employee-specific stats
        $myUploads = ArchiveDocument::where('uploaded_by', $user->id)->count();
        $myUploadsThisMonth = ArchiveDocument::where('uploaded_by', $user->id)
            ->where('created_at', '>=', now()->startOfMonth())
            ->count();

        // Accessible sectors info for the user
        $accessibleSectors = $hasFullAccess
            ? Sector::where('is_active', true)->withCount('documents')->get()
            : $user->allowedSectors()->withCount('documents')->get()
                ->merge($user->sector ? collect([$user->sector->loadCount('documents')]) : collect())
                ->unique('id')
                ->values();

        return Inertia::render('Dashboard', [
            'stats' => [
                'total'              => $totalDocs,
                'total_electronic'   => $electronicDocs,
                'total_paper'        => $paperDocs,
                'expiring_soon'      => $expiringSoon,
                'expired'            => $expired,
                'confidential'       => $confidential,
                'checked_out'        => $checkedOutCount,
                'sectors'            => $hasFullAccess ? Sector::count() : $accessibleSectors->count(),
                'folders'            => DocumentFolder::when($sectorId, fn($q) => $q->where('sector_id', $sectorId))->count(),
                'types'              => DocumentType::count(),
                'users'              => $hasFullAccess ? User::count() : null,
                'my_uploads'         => $myUploads,
                'my_uploads_month'   => $myUploadsThisMonth,
            ],
            'bySector'         => $bySector,
            'byType'           => $byType,
            'trend'            => $trend,
            'recent'           => $recent,
            'expiringList'     => $expiringList,
            'checkedOutList'   => $checkedOutList,
            'recentActivity'   => $recentActivity,
            'isScoped'         => !$hasFullAccess,
            'sectorName'       => $sectorId ? $user->sector?->name : null,
            'accessibleSectors' => $accessibleSectors,
            'currentUser'      => [
                'name'  => $user->name,
                'job_title' => $user->job_title,
                'sector_name' => $user->sector?->name,
                'department' => $user->department,
            ],
        ]);
    }
}
