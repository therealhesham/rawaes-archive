import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import SignaturePad from '@/Components/SignaturePad';
import MoveDocumentModal from '@/Components/Archive/MoveDocumentModal';
import {
    Search, Filter, Download, Eye, Edit2, Trash2,
    FileText, AlertTriangle, Clock, CheckCircle, FolderOpen,
    ChevronLeft, ChevronRight, MoreVertical, Upload, Handshake, Hand
} from 'lucide-react';

const statusColors = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    archived: 'bg-gray-100 text-gray-700',
    pending_review: 'bg-yellow-100 text-yellow-700',
};

const statusLabels = {
    active: 'نشط',
    expired: 'منتهي',
    archived: 'مؤرشف',
    pending_review: 'قيد المراجعة',
};

function DocumentRow({ doc, can, folders }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    const [custodyOpen, setCustodyOpen] = useState(false);
    const [custodyTo, setCustodyTo] = useState('');
    const [custodyNotes, setCustodyNotes] = useState('');
    const [custodySignature, setCustodySignature] = useState('');
    const [custodyProcessing, setCustodyProcessing] = useState(false);

    const isExpired = doc.is_expired;
    const isExpiringSoon = doc.is_expiring_soon;
    const isDeleted = !!doc.deleted_at;
    const sourceLabel = doc.upload_source === 'scanner' ? 'ورقي' : 'إلكتروني';
    const isCheckedOut = !!doc.is_checked_out;
    const canCheckout = !!can['documents.custody.checkout'];
    const canCheckin = !!can['documents.custody.checkin'];
    const canCustodyAction = isCheckedOut ? canCheckin : canCheckout;

    const submitCustody = () => {
        if (!isCheckedOut && !custodyTo.trim()) return;
        if (!custodySignature) return;
        setCustodyProcessing(true);
        const url = isCheckedOut
            ? `/archive/documents/${doc.id}/custody/checkin`
            : `/archive/documents/${doc.id}/custody/checkout`;
        const payload = isCheckedOut
            ? { notes: custodyNotes || null, signature: custodySignature }
            : { to_person: custodyTo, notes: custodyNotes || null, signature: custodySignature };

        router.post(url, payload, {
            preserveScroll: true,
            onFinish: () => setCustodyProcessing(false),
            onSuccess: () => {
                setCustodyOpen(false);
                setCustodyTo('');
                setCustodyNotes('');
                setCustodySignature('');
            },
        });
    };

    return (
        <tr className={`${isCheckedOut ? 'bg-red-50 text-red-900' : ''} hover:bg-gray-50 transition-colors`}>
            <td className="px-4 py-3 text-sm text-gray-600 font-mono" dir="ltr">
                {isDeleted ? (
                    <span className="text-red-600 line-through">
                        {doc.serial_number ?? '—'}
                    </span>
                ) : (
                    doc.serial_number ?? '—'
                )}
            </td>
            {isDeleted ? (
                <>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                    <td className="px-4 py-3 text-sm text-gray-400"></td>
                </>
            ) : (
                <>
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-amber-50' : 'bg-blue-50'}`}>
                                <FileText size={16} className={isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-blue-500'} />
                            </div>
                            <div>
                                <p className="font-medium text-gray-800 text-sm">{doc.title}</p>
                                {doc.document_number && (
                                    <p className="text-xs text-gray-500">{doc.document_number}</p>
                                )}
                                {doc.folder_path && (
                                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                        <FolderOpen size={12} className="shrink-0" />
                                        <span>{doc.folder_path}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.sector?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.document_type?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            doc.upload_source === 'scanner'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-700'
                        }`}>
                            {sourceLabel}
                        </span>
                    </td>
                    <td className="px-4 py-3">
                        {doc.expiry_date ? (
                            <div className="flex items-center gap-1">
                                {isExpired && <AlertTriangle size={14} className="text-red-500" />}
                                {isExpiringSoon && !isExpired && <Clock size={14} className="text-amber-500" />}
                                <span className={`text-xs ${isExpired ? 'text-red-600 font-medium' : isExpiringSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                                    {doc.expiry_date}
                                </span>
                            </div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}`}>
                            {statusLabels[doc.status]}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{doc.uploader?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                            {canCustodyAction && (
                                <button
                                    onClick={() => {
                                        setCustodyOpen(true);
                                        setCustodyTo('');
                                        setCustodyNotes('');
                                        setCustodySignature('');
                                    }}
                                    className={`p-1.5 rounded transition-colors ${
                                        isCheckedOut
                                            ? 'hover:bg-emerald-50 text-emerald-700'
                                            : 'hover:bg-red-50 text-red-700'
                                    }`}
                                    title={isCheckedOut ? 'استلام عهدة' : 'تسليم عهدة'}
                                >
                                    {isCheckedOut ? <Hand size={16} /> : <Handshake size={16} />}
                                </button>
                            )}
                            <Link
                                href={`/archive/documents/${doc.id}`}
                                className="p-1.5 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                                title="عرض"
                            >
                                <Eye size={16} />
                            </Link>
                            <Link
                                href={`/archive/documents/${doc.id}/download`}
                                className="p-1.5 rounded hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors"
                                title="تحميل"
                            >
                                <Download size={16} />
                            </Link>
                            {can['documents.create'] && (
                                <>
                                    <button
                                        onClick={() => setMoveOpen(true)}
                                        className="p-1.5 rounded hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 transition-colors"
                                        title="نقل إلى مجلد آخر"
                                    >
                                        <FolderOpen size={16} />
                                    </button>
                                    <Link
                                        href={`/archive/documents/${doc.id}/edit`}
                                        className="p-1.5 rounded hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-colors"
                                        title="تعديل"
                                    >
                                        <Edit2 size={16} />
                                    </Link>
                                </>
                            )}
                            {can['documents.delete'] && (
                                <button
                                    onClick={() => {
                                        if (confirm('هل أنت متأكد من حذف هذا المستند؟')) {
                                            router.delete(`/archive/documents/${doc.id}`);
                                        }
                                    }}
                                    className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                                    title="حذف"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        <MoveDocumentModal
                            document={doc}
                            folders={folders}
                            open={moveOpen}
                            onClose={() => setMoveOpen(false)}
                        />

                        {custodyOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCustodyOpen(false)}>
                                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-gray-800 text-sm">
                                            {isCheckedOut ? 'استلام عهدة مستند' : 'تسليم عهدة مستند'}: {doc.title}
                                        </h3>
                                        <button onClick={() => setCustodyOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                                    </div>

                                    {isCheckedOut ? (
                                        <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 mb-3">
                                            تم تسليمه إلى: <span className="font-bold">{doc.checked_out_to ?? '—'}</span>
                                            {doc.checked_out_at ? <span className="text-gray-500"> — {doc.checked_out_at}</span> : null}
                                        </div>
                                    ) : (
                                        <div className="mb-3">
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">تم تسليمه إلى</label>
                                            <input
                                                value={custodyTo}
                                                onChange={(e) => setCustodyTo(e.target.value)}
                                                className="w-full rounded-lg border-gray-200 focus:border-red-500 focus:ring-red-500"
                                                placeholder="اسم الشخص/الجهة"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظات (اختياري)</label>
                                        <textarea
                                            value={custodyNotes}
                                            onChange={(e) => setCustodyNotes(e.target.value)}
                                            className="w-full rounded-lg border-gray-200 focus:ring-amber-500 focus:border-amber-500"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="mt-3">
                                        <SignaturePad
                                            value={custodySignature}
                                            onChange={setCustodySignature}
                                            label={isCheckedOut ? 'توقيع المستلم عند الاستلام' : 'توقيع المستلم عند التسليم'}
                                        />
                                    </div>

                                    <button
                                        onClick={submitCustody}
                                        disabled={custodyProcessing || (!isCheckedOut && !custodyTo.trim()) || !custodySignature}
                                        className={`mt-4 w-full inline-flex items-center justify-center gap-2 font-bold rounded-lg py-2.5 disabled:opacity-50 ${
                                            isCheckedOut ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                                        }`}
                                    >
                                        {isCheckedOut ? <Hand size={16} /> : <Handshake size={16} />}
                                        {custodyProcessing ? '...' : (isCheckedOut ? 'تأكيد الاستلام' : 'تأكيد التسليم')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </td>
                </>
            )}
        </tr>
    );
}

export default function DocumentsIndex({ documents, sectors, folders, documentTypes, filters }) {
    const { auth } = usePage().props;
    const can = auth?.can ?? {};
    const [search, setSearch] = useState(filters.search ?? '');
    const [showFilters, setShowFilters] = useState(false);

    const applySearch = (e) => {
        e.preventDefault();
        router.get('/archive/documents', { ...filters, search }, { preserveState: true });
    };

    const applyFilter = (key, value) => {
        router.get('/archive/documents', { ...filters, [key]: value }, { preserveState: true });
    };

    const clearFilters = () => {
        router.get('/archive/documents', {});
    };

    const stats = [
        { label: 'إجمالي المستندات', value: documents.total, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'المستندات النشطة', value: documents.data?.filter(d => !d.deleted_at && d.status === 'active').length, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'منتهية الصلاحية', value: documents.data?.filter(d => !d.deleted_at && d.is_expired).length, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'تنتهي قريباً', value: documents.data?.filter(d => !d.deleted_at && d.is_expiring_soon).length, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];

    return (
        <>
            <Head title="المستندات" />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((s) => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                        <p className="text-sm text-gray-600 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Search & Filter bar */}
            <div className="bg-white rounded-xl border border-gray-200 mb-4">
                <div className="flex items-center gap-3 p-3">
                    <form onSubmit={applySearch} className="flex-1 flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="بحث بالاسم، رقم الوثيقة، المحتوى..."
                                className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            بحث
                        </button>
                    </form>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${showFilters ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Filter size={16} />
                        <span>فلتر</span>
                    </button>
                    {Object.values(filters).some(Boolean) && (
                        <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700">
                            مسح الفلاتر
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="border-t border-gray-100 p-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <select
                            value={filters.sector_id ?? ''}
                            onChange={e => applyFilter('sector_id', e.target.value)}
                            className="border border-gray-200 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">كل القطاعات</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select
                            value={filters.type_id ?? ''}
                            onChange={e => applyFilter('type_id', e.target.value)}
                            className="border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">كل الأنواع</option>
                            {documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <select
                            value={filters.status ?? ''}
                            onChange={e => applyFilter('status', e.target.value)}
                            className="border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">كل الحالات</option>
                            <option value="active">نشط</option>
                            <option value="expired">منتهي</option>
                            <option value="archived">مؤرشف</option>
                            <option value="pending_review">قيد المراجعة</option>
                        </select>
                        <div className="flex gap-2">
                            <button
                                onClick={() => applyFilter('expired', filters.expired === 'true' ? '' : 'true')}
                                className={`flex-1 text-sm py-2 px-3 rounded-lg border transition-colors ${filters.expired === 'true' ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                منتهية فقط
                            </button>
                            <button
                                onClick={() => applyFilter('expiring_soon', filters.expiring_soon === 'true' ? '' : 'true')}
                                className={`flex-1 text-sm py-2 px-3 rounded-lg border transition-colors ${filters.expiring_soon === 'true' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                تنتهي قريباً
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <p className="text-sm text-gray-600">
                        {documents.total} مستند
                    </p>
                    <Link
                        href="/archive/documents/create"
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Upload size={16} />
                        <span>رفع مستندات</span>
                    </Link>
                </div>

	                <div className="overflow-x-auto">
	                    <table className="w-full">
	                        <thead className="bg-gray-50 border-b border-gray-100">
	                            <tr>
	                                {['#', 'المستند', 'القطاع', 'النوع', 'المصدر', 'انتهاء الصلاحية', 'الحالة', 'الرافع', 'الإجراءات'].map(h => (
	                                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
	                                        {h}
	                                    </th>
	                                ))}
	                            </tr>
	                        </thead>
		                        <tbody className="divide-y divide-gray-50">
		                            {documents.data?.length > 0 ? (
		                                documents.data.map(doc => <DocumentRow key={doc.id} doc={doc} can={can} folders={folders} />)
		                            ) : (
		                                <tr>
	                                    <td colSpan={9} className="px-4 py-16 text-center">
	                                        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
	                                        <p className="text-gray-500 font-medium">لا توجد مستندات</p>
                                        <p className="text-gray-400 text-sm mt-1">ابدأ برفع أول مستند</p>
                                        <Link
                                            href="/archive/documents/create"
                                            className="inline-flex items-center gap-2 mt-4 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                        >
                                            <Upload size={16} />
                                            رفع مستند
                                        </Link>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {documents.last_page > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                            صفحة {documents.current_page} من {documents.last_page}
                        </p>
                        <div className="flex gap-2">
                            {documents.prev_page_url && (
                                <Link href={documents.prev_page_url} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                                    <ChevronRight size={16} />
                                </Link>
                            )}
                            {documents.next_page_url && (
                                <Link href={documents.next_page_url} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                                    <ChevronLeft size={16} />
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

DocumentsIndex.layout = page => <ArchiveLayout title="المستندات" children={page} />;
