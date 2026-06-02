import { Head, Link, useForm } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Save, ArrowLeft, ScanLine, FileText, Calendar, Monitor } from 'lucide-react';

function FolderSelect({ folders, value, onChange, sectorId }) {
    // Build a hierarchical tree from flat list using parent_id
    const filtered = sectorId
        ? folders.filter(f => String(f.sector_id) === String(sectorId))
        : [];

    const childrenOf = (parentId) =>
        filtered.filter(f => (f.parent_id ?? null) === (parentId ?? null));

    const renderTree = (parentId = null, depth = 0) => {
        const nodes = childrenOf(parentId);
        const result = [];
        for (const f of nodes) {
            result.push(
                <option key={f.id} value={f.id}>
                    {'— '.repeat(depth) + f.name}
                </option>
            );
            const sub = renderTree(f.id, depth + 1);
            result.push(...sub);
        }
        return result;
    };

    const options = sectorId ? renderTree(null, 0) : [];

    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={!sectorId}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
        >
            <option value="">
                {!sectorId
                    ? 'اختر القطاع أولاً'
                    : options.length === 0
                        ? 'لا توجد مجلدات لهذا القطاع'
                        : 'اختر المجلد'}
            </option>
            {options}
        </select>
    );
}

export default function AssignScan({ scan, sectors, folders, documentTypes }) {
    const isImage = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'bmp'].includes(scan.file_extension?.toLowerCase());
    const isPdf = scan.file_extension?.toLowerCase() === 'pdf';

    const { data, setData, post, processing, errors } = useForm({
        title: scan.original_name?.replace(/\.[^/.]+$/, '') ?? '',
        document_number: '',
        sector_id: '',
        document_type_id: '',
        folder_id: '',
        issuing_entity: '',
        issue_date: '',
        expiry_date: '',
        notes: '',
        is_confidential: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(`/archive/scans/${scan.id}/assign`);
    };

    return (
        <>
            <Head title="تصنيف مسح" />

            <div className="flex items-center gap-2 mb-4 text-sm">
                <Link href="/archive/scans" className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    <ArrowLeft size={14} /> المسح الضوئي
                </Link>
                <span className="text-gray-300">/</span>
                <span className="text-gray-800 font-medium">تصنيف</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Preview */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-l from-blue-50 to-amber-50 p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500 rounded-xl">
                                <ScanLine size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-800 text-sm truncate">{scan.original_name}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                    <span dir="ltr">{scan.file_size_formatted}</span>
                                    <span>·</span>
                                    <span className="font-mono">{scan.file_extension?.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isImage ? (
                        <img
                            src={`/archive/scans/${scan.id}/preview`}
                            alt={scan.original_name}
                            className="w-full max-h-[600px] object-contain bg-gray-50"
                        />
                    ) : isPdf ? (
                        <object
                            data={`/archive/scans/${scan.id}/preview`}
                            type="application/pdf"
                            className="w-full h-[600px]"
                        >
                            <div className="p-10 text-center text-gray-500">المتصفح لا يدعم عرض PDF</div>
                        </object>
                    ) : (
                        <div className="p-16 text-center">
                            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-sm text-gray-500">لا يمكن المعاينة</p>
                        </div>
                    )}

                    <div className="p-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(scan.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        {scan.source_device && (
                            <span className="flex items-center gap-1">
                                <Monitor size={11} />
                                {scan.source_device}
                            </span>
                        )}
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={submit} className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="font-bold text-gray-800 mb-4">بيانات المستند</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    العنوان <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text" value={data.title}
                                    onChange={e => setData('title', e.target.value)} required
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الوثيقة</label>
                                <input
                                    type="text" value={data.document_number}
                                    onChange={e => setData('document_number', e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">القطاع <span className="text-red-500">*</span></label>
                                    <select
                                        value={data.sector_id}
                                        onChange={e => { setData('sector_id', e.target.value); setData('folder_id', ''); }}
                                        required
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        <option value="">اختر</option>
                                        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">النوع <span className="text-red-500">*</span></label>
                                    <select
                                        value={data.document_type_id}
                                        onChange={e => setData('document_type_id', e.target.value)} required
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        <option value="">اختر</option>
                                        {documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">المجلد <span className="text-red-500">*</span></label>
                                <FolderSelect folders={folders} value={data.folder_id} onChange={v => setData('folder_id', v)} sectorId={data.sector_id} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار</label>
                                    <input type="date" value={data.issue_date} onChange={e => setData('issue_date', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الانتهاء</label>
                                    <input type="date" value={data.expiry_date} onChange={e => setData('expiry_date', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">الجهة المصدرة</label>
                                <input type="text" value={data.issuing_entity} onChange={e => setData('issuing_entity', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="conf" checked={data.is_confidential} onChange={e => setData('is_confidential', e.target.checked)} className="w-4 h-4 accent-amber-500" />
                                <label htmlFor="conf" className="text-sm text-gray-700">مستند سري</label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                                <textarea value={data.notes} onChange={e => setData('notes', e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Link href="/archive/scans" className="flex-1 text-center px-5 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                            إلغاء
                        </Link>
                        <button type="submit" disabled={processing} className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white px-5 py-3 rounded-xl text-sm font-bold">
                            <Save size={16} />
                            {processing ? 'جاري الحفظ...' : 'حفظ المستند'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

AssignScan.layout = page => <ArchiveLayout title="تصنيف مسح" children={page} />;
