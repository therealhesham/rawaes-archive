import { Head, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Shield, Search, Eye, Download, Edit2, Trash2, LogIn, LogOut, Upload, UserPlus, UserCog, AlertCircle, Archive, FolderPlus, FolderOpen, Settings, Plus, ScanLine, FileCheck, FileSpreadsheet, Calendar, Mail, RotateCcw, XCircle, Info, Hand, Handshake } from 'lucide-react';
import { useState } from 'react';

const actionConfig = {
    upload:         { label: 'رفع مستند',        icon: Upload,      color: 'bg-blue-100 text-blue-700' },
    view:           { label: 'استعراض',          icon: Eye,         color: 'bg-gray-100 text-gray-700' },
    download:       { label: 'تحميل',            icon: Download,    color: 'bg-green-100 text-green-700' },
    update:         { label: 'تعديل',            icon: Edit2,       color: 'bg-amber-100 text-amber-700' },
    delete:         { label: 'حذف',              icon: Trash2,      color: 'bg-red-100 text-red-700' },
    login:          { label: 'تسجيل دخول',       icon: LogIn,       color: 'bg-emerald-100 text-emerald-700' },
    logout:         { label: 'تسجيل خروج',       icon: LogOut,      color: 'bg-slate-100 text-slate-700' },
    login_failed:   { label: 'دخول فاشل',        icon: AlertCircle, color: 'bg-red-100 text-red-700' },
    create_user:    { label: 'إنشاء مستخدم',     icon: UserPlus,    color: 'bg-purple-100 text-purple-700' },
    update_user:    { label: 'تعديل مستخدم',     icon: UserCog,     color: 'bg-purple-100 text-purple-700' },
    delete_user:    { label: 'حذف مستخدم',       icon: Trash2,      color: 'bg-red-100 text-red-700' },
    create_sector:  { label: 'إنشاء قطاع',       icon: Archive,     color: 'bg-amber-100 text-amber-700' },
    update_sector:  { label: 'تعديل قطاع',       icon: Archive,     color: 'bg-amber-100 text-amber-700' },
    delete_sector:  { label: 'حذف قطاع',         icon: Archive,     color: 'bg-red-100 text-red-700' },
    create_folder:  { label: 'إنشاء مجلد',       icon: FolderPlus,  color: 'bg-blue-100 text-blue-700' },
    update_folder:  { label: 'تعديل مجلد',       icon: FolderOpen,  color: 'bg-blue-100 text-blue-700' },
    delete_folder:  { label: 'حذف مجلد',         icon: FolderOpen,  color: 'bg-red-100 text-red-700' },
    create_type:    { label: 'إنشاء نوع مستند',  icon: Settings,    color: 'bg-green-100 text-green-700' },
    update_type:    { label: 'تعديل نوع مستند',  icon: Settings,    color: 'bg-green-100 text-green-700' },
    delete_type:    { label: 'حذف نوع مستند',    icon: Settings,    color: 'bg-red-100 text-red-700' },
    scan_received:  { label: 'مسح ضوئي جديد',    icon: ScanLine,    color: 'bg-cyan-100 text-cyan-700' },
    scan_assigned:  { label: 'تصنيف مسح ضوئي',   icon: FileCheck,   color: 'bg-emerald-100 text-emerald-700' },
	    scan_deleted:   { label: 'حذف مسح ضوئي',     icon: ScanLine,    color: 'bg-red-100 text-red-700' },
	    document_emailed: { label: 'إرسال بالبريد',  icon: Mail,        color: 'bg-blue-100 text-blue-700' },
        document_custody_checkout: { label: 'تسليم عهدة مستند', icon: Handshake, color: 'bg-red-100 text-red-700' },
        document_custody_checkin: { label: 'استلام عهدة مستند', icon: Hand, color: 'bg-emerald-100 text-emerald-700' },
        inventory_checkout: { label: 'تسليم ملف ورقي (الجرد)', icon: Handshake, color: 'bg-red-100 text-red-700' },
        inventory_checkin: { label: 'استلام ملف ورقي (الجرد)', icon: Hand, color: 'bg-emerald-100 text-emerald-700' },
        document_restored: { label: 'استرجاع مستند', icon: RotateCcw,  color: 'bg-emerald-100 text-emerald-700' },
        document_force_deleted: { label: 'حذف نهائي لمستند', icon: XCircle, color: 'bg-red-100 text-red-700' },
	    audit_export:   { label: 'تصدير سجل التدقيق', icon: FileSpreadsheet, color: 'bg-green-100 text-green-700' },
	};

const TABS = [
    { key: '', label: 'الكل' },
    { key: 'incoming', label: 'الوارد' },
    { key: 'outgoing', label: 'الصادر' },
];

export default function AuditLogIndex({ logs, filters, users }) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [tab, setTab] = useState(filters.tab ?? '');
    const [userId, setUserId] = useState(filters.user_id ?? '');
    const [expanded, setExpanded] = useState(null);

    const applySearch = (e) => {
        e.preventDefault();
        router.get('/archive/audit-logs', { ...filters, tab, user_id: userId, search, date_from: dateFrom, date_to: dateTo }, { preserveState: true });
    };

    const applyFilter = (key, value) => {
        router.get('/archive/audit-logs', { ...filters, [key]: value }, { preserveState: true });
    };

    // Build export URL with current filters
    const exportParams = new URLSearchParams();
    Object.entries({ ...filters, tab, user_id: userId, search, date_from: dateFrom, date_to: dateTo }).forEach(([k, v]) => {
        if (v) exportParams.append(k, v);
    });
    const exportUrl = `/archive/audit-logs/export?${exportParams.toString()}`;

    return (
        <>
            <Head title="سجل التدقيق" />

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => {
                            setTab(t.key);
                            router.get('/archive/audit-logs', { ...filters, tab: t.key, action: '', user_id: userId || '' }, { preserveState: true });
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                            (tab ?? '') === t.key
                                ? 'bg-amber-50 border-amber-300 text-amber-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
                <Shield size={20} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                    <p className="font-semibold text-amber-800">سجل التدقيق محمي</p>
                    <p className="text-amber-700 text-sm">هذا السجل مشفر ولا يمكن تعديله أو حذفه من قِبل أي مستخدم بما في ذلك مدير النظام.</p>
                </div>
            </div>

            {/* Filters */}
            <form onSubmit={applySearch} className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-48">
                        <label className="block text-xs text-gray-500 mb-1">بحث في الوصف</label>
                        <div className="relative">
                            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="ابحث..."
                                className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">من تاريخ</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">إلى تاريخ</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">الإجراء</label>
                        <select
                            value={filters.action ?? ''}
                            onChange={e => applyFilter('action', e.target.value)}
                            className="border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">كل الإجراءات</option>
                            {Object.entries(actionConfig).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">المستخدم</label>
                        <select
                            value={userId}
                            onChange={e => {
                                setUserId(e.target.value);
                                router.get('/archive/audit-logs', { ...filters, tab, user_id: e.target.value }, { preserveState: true });
                            }}
                            className="border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">كل المستخدمين</option>
                            {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                        تطبيق
                    </button>

                    <a
                        href={exportUrl}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors mr-auto"
                    >
                        <FileSpreadsheet size={16} />
                        تصدير Excel
                    </a>
                </div>
            </form>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['الإجراء', 'المستخدم', 'عنوان IP', 'الوصف', 'التاريخ والوقت'].map(h => (
                                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
	                            {logs.data?.length > 0 ? logs.data.map(log => {
	                                const cfg = actionConfig[log.action] ?? { label: log.action, color: 'bg-gray-100 text-gray-700' };
	                                return (
	                                    <>
	                                        <tr key={log.id} className="hover:bg-gray-50">
	                                        <td className="px-4 py-3">
	                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
	                                                {cfg.label}
	                                            </span>
	                                        </td>
	                                        <td className="px-4 py-3">
	                                            <p className="text-sm font-medium text-gray-800">{log.user_name}</p>
	                                        </td>
	                                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">{log.ip_address}</td>
	                                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{log.description ?? '—'}</td>
	                                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
	                                            <div>{new Date(log.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
	                                            <div className="text-xs text-gray-400">{new Date(log.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpanded(v => v === log.id ? null : log.id)}
                                                    className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
                                                >
                                                    <Info size={12} /> تفاصيل
                                                </button>
	                                        </td>
	                                    </tr>
	                                    {expanded === log.id && (
	                                        <tr key={`${log.id}-details`} className="bg-amber-50/40">
	                                            <td colSpan={5} className="px-4 py-3 text-xs text-gray-700">
	                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
	                                                    <div><span className="text-gray-500">النوع:</span> {log.auditable_type ? log.auditable_type.split('\\').pop() : '—'}</div>
	                                                    <div><span className="text-gray-500">المعرّف:</span> <span className="font-mono">{log.auditable_id ?? '—'}</span></div>
	                                                    <div className="md:col-span-1"><span className="text-gray-500">User-Agent:</span> {log.user_agent ?? '—'}</div>
	                                                </div>
	                                            </td>
	                                        </tr>
	                                    )}
	                                    </>
	                                );
	                            }) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                                        <Shield size={32} className="mx-auto mb-2 opacity-30" />
                                        لا توجد سجلات
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

AuditLogIndex.layout = page => <ArchiveLayout title="سجل التدقيق" children={page} />;
