<?php

namespace App\Http\Controllers\Archive;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    private const ACTION_LABELS = [
        'upload'         => 'رفع مستند',
        'view'           => 'استعراض',
        'download'       => 'تحميل',
        'update'         => 'تعديل',
        'delete'         => 'حذف',
        'login'          => 'تسجيل دخول',
        'logout'         => 'تسجيل خروج',
        'login_failed'   => 'دخول فاشل',
        'create_user'    => 'إنشاء مستخدم',
        'update_user'    => 'تعديل مستخدم',
        'delete_user'    => 'حذف مستخدم',
        'create_sector'  => 'إنشاء قطاع',
        'update_sector'  => 'تعديل قطاع',
        'delete_sector'  => 'حذف قطاع',
        'create_folder'  => 'إنشاء مجلد',
        'update_folder'  => 'تعديل مجلد',
        'delete_folder'  => 'حذف مجلد',
        'create_type'    => 'إنشاء نوع مستند',
        'update_type'    => 'تعديل نوع مستند',
        'delete_type'    => 'حذف نوع مستند',
        'scan_received'  => 'مسح ضوئي جديد',
        'scan_assigned'  => 'تصنيف مسح ضوئي',
        'scan_deleted'   => 'حذف مسح ضوئي',
        'document_restored' => 'استرجاع مستند',
        'document_force_deleted' => 'حذف نهائي لمستند',
        'document_emailed' => 'إرسال المستند بالبريد',
        'document_custody_checkout' => 'تسليم عهدة مستند',
        'document_custody_checkin' => 'استلام عهدة مستند',
        'inventory_checkout' => 'تسليم ملف ورقي (الجرد)',
        'inventory_checkin' => 'استلام ملف ورقي (الجرد)',
        'inventory_update_physical_folder' => 'تعديل ملف ورقي (الجرد)',
        'inventory_delete_physical_folder' => 'حذف ملف ورقي (الجرد)',
        'create_physical_folder' => 'إنشاء ملف ورقي (الجرد)',
        'audit_export' => 'تصدير سجل التدقيق',
    ];

    private const TAB_ACTIONS = [
        // Incoming = documents entering the system
        'incoming' => ['upload', 'scan_received', 'scan_assigned', 'document_restored'],
        // Outgoing = actions that take documents out of the system
        'outgoing' => ['download', 'document_emailed', 'audit_export'],
    ];

    public function index(Request $request)
    {
        $tab = $request->get('tab'); // incoming|outgoing

        $logs = AuditLog::with('user')
            ->when(
                $tab && isset(self::TAB_ACTIONS[$tab]),
                fn($q) => $q->whereIn('action', self::TAB_ACTIONS[$tab])
            )
            ->when($request->action, fn($q) => $q->where('action', $request->action))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->search, fn($q) => $q->where('description', 'like', "%{$request->search}%"))
            ->when($request->date_from, fn($q) => $q->where('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->where('created_at', '<=', $request->date_to . ' 23:59:59'))
            ->latest('created_at')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('Archive/AuditLog/Index', [
            'logs' => $logs,
            'filters' => $request->only(['tab', 'action', 'user_id', 'search', 'date_from', 'date_to']),
            'users' => User::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function export(Request $request)
    {
        $tab = $request->get('tab'); // incoming|outgoing

        $query = AuditLog::with('user')
            ->when(
                $tab && isset(self::TAB_ACTIONS[$tab]),
                fn($q) => $q->whereIn('action', self::TAB_ACTIONS[$tab])
            )
            ->when($request->action, fn($q) => $q->where('action', $request->action))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->search, fn($q) => $q->where('description', 'like', "%{$request->search}%"))
            ->when($request->date_from, fn($q) => $q->where('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->where('created_at', '<=', $request->date_to . ' 23:59:59'))
            ->orderByDesc('created_at');

        $filename = 'audit-log-' . now()->format('Y-m-d-His') . '.csv';

        // Log the export itself
        AuditLog::create([
            'user_id'        => auth()->id(),
            'user_name'      => auth()->user()->name,
            'ip_address'     => $request->ip(),
            'user_agent'     => $request->userAgent(),
            'action'         => 'audit_export',
            'auditable_type' => AuditLog::class,
            'auditable_id'   => 0,
            'description'    => "تصدير سجل التدقيق إلى Excel",
            'created_at'     => now(),
        ]);

        return new StreamedResponse(function () use ($query) {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM for Excel Arabic
            fputs($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                '#', 'الإجراء', 'المستخدم', 'البريد الإلكتروني',
                'عنوان IP', 'الوصف', 'النوع', 'المعرّف',
                'التاريخ', 'الوقت', 'User-Agent',
            ]);

            $query->chunk(500, function ($logs) use ($out) {
                foreach ($logs as $log) {
                    fputcsv($out, [
                        $log->id,
                        self::ACTION_LABELS[$log->action] ?? $log->action,
                        $log->user_name,
                        $log->user?->email ?? '',
                        $log->ip_address,
                        $log->description ?? '',
                        class_basename($log->auditable_type),
                        $log->auditable_id,
                        $log->created_at->format('Y-m-d'),
                        $log->created_at->format('H:i:s'),
                        $log->user_agent ?? '',
                    ]);
                }
            });

            fclose($out);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }
}
