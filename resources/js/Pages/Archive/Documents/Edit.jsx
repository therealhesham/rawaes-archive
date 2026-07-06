import { Head, Link, useForm } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Save, ArrowLeft, FileText } from 'lucide-react';

function FolderSelect({ folders, value, onChange, sectorId }) {
    const filtered = sectorId
        ? folders.filter(f => String(f.sector_id) === String(sectorId))
        : folders;

    const renderTree = (parentId = null, depth = 0) => {
        const result = [];
        const nodes = filtered.filter(f => (f.parent_id ?? null) === (parentId ?? null));
        for (const f of nodes) {
            result.push(
                <option key={f.id} value={f.id}>
                    {'— '.repeat(depth) + f.name}
                </option>
            );
            result.push(...renderTree(f.id, depth + 1));
        }
        return result;
    };

    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
            <option value="">اختر المجلد</option>
            {renderTree()}
        </select>
    );
}

export default function EditDocument({ document, sectors, folders, documentTypes }) {
    const { data, setData, put, processing, errors } = useForm({
        title: document.title ?? '',
        document_number: document.document_number ?? '',
        folder_id: document.folder_id ?? '',
        document_type_id: document.document_type_id ?? '',
        sector_id: document.sector_id ?? '',
        issuing_entity: document.issuing_entity ?? '',
        issue_date: document.issue_date ?? '',
        expiry_date: document.expiry_date ?? '',
        no_expiry_date: Boolean(document.no_expiry_date),
        physical_location: document.physical_location ?? '',
        notes: document.notes ?? '',
        is_confidential: Boolean(document.is_confidential),
        status: document.status ?? 'active',
    });

    const submit = (e) => {
        e.preventDefault();
        put(`/archive/documents/${document.id}`);
    };

    return (
        <>
            <Head title={`تعديل - ${document.title}`} />

            <div className="max-w-3xl mx-auto">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-4 text-sm">
                    <Link href="/archive/documents" className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
                        <ArrowLeft size={14} /> المستندات
                    </Link>
                    <span className="text-gray-300">/</span>
                    <Link href={`/archive/documents/${document.id}`} className="text-gray-500 hover:text-gray-700 truncate max-w-xs">
                        {document.title}
                    </Link>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-800 font-medium">تعديل</span>
                </div>

                {/* Header */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg">
                        <FileText size={20} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{document.file_name}</p>
                        <p className="text-xs text-gray-500">
                            {document.file_extension?.toUpperCase()} — لا يمكن استبدال الملف، فقط تعديل البيانات
                        </p>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-800 mb-4">البيانات الأساسية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    عنوان المستند <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={data.title}
                                    onChange={e => setData('title', e.target.value)}
                                    required
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الوثيقة</label>
                                <input
                                    type="text"
                                    value={data.document_number}
                                    onChange={e => setData('document_number', e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
                                <select
                                    value={data.status}
                                    onChange={e => setData('status', e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="active">نشط</option>
                                    <option value="expired">منتهي</option>
                                    <option value="archived">مؤرشف</option>
                                    <option value="pending_review">قيد المراجعة</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    القطاع <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={data.sector_id}
                                    onChange={e => {
                                        setData('sector_id', e.target.value);
                                        setData('folder_id', '');
                                    }}
                                    required
                                    className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    نوع المستند <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={data.document_type_id}
                                    onChange={e => setData('document_type_id', e.target.value)}
                                    required
                                    className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    {documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    المجلد <span className="text-red-500">*</span>
                                </label>
                                <FolderSelect
                                    folders={folders}
                                    value={data.folder_id}
                                    onChange={v => setData('folder_id', v)}
                                    sectorId={data.sector_id}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-800 mb-4">التواريخ والجهة</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">الجهة المصدرة</label>
                                <input
                                    type="text"
                                    value={data.issuing_entity}
                                    onChange={e => setData('issuing_entity', e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">الموقع الفعلي</label>
                                <input
                                    type="text"
                                    value={data.physical_location}
                                    onChange={e => setData('physical_location', e.target.value)}
                                    placeholder="مثال: خزانة A3 - درج 2"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الإصدار</label>
                                <input
                                    type="date"
                                    value={data.issue_date}
                                    onChange={e => setData('issue_date', e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ الانتهاء</label>
                                <input
                                    type="date"
                                    value={data.expiry_date}
                                    onChange={e => {
                                        const value = e.target.value;
                                        setData('expiry_date', value);
                                        if (value) {
                                            setData('no_expiry_date', false);
                                        }
                                    }}
                                    disabled={data.no_expiry_date}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:text-gray-400"
                                />
                                {errors.expiry_date && <p className="text-red-500 text-xs mt-1">{errors.expiry_date}</p>}
                            </div>
                            <div className="flex items-center gap-3 py-2">
                                <input
                                    type="checkbox"
                                    id="no_expiry_date"
                                    checked={data.no_expiry_date}
                                    disabled={Boolean(data.expiry_date)}
                                    onChange={e => {
                                        const checked = e.target.checked;
                                        setData('no_expiry_date', checked);
                                        if (checked) {
                                            setData('expiry_date', '');
                                        }
                                    }}
                                    className="w-4 h-4 accent-amber-500 disabled:opacity-50"
                                />
                                <label htmlFor="no_expiry_date" className="text-sm font-medium text-gray-700 cursor-pointer">
                                    لا يوجد تاريخ انتهاء
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-center gap-3 py-2 mb-3">
                            <input
                                type="checkbox"
                                id="confidential"
                                checked={data.is_confidential}
                                onChange={e => setData('is_confidential', e.target.checked)}
                                className="w-4 h-4 accent-amber-500"
                            />
                            <label htmlFor="confidential" className="text-sm font-medium text-gray-700 cursor-pointer">
                                مستند سري (يظهر للمصرح لهم فقط)
                            </label>
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                        <textarea
                            value={data.notes}
                            onChange={e => setData('notes', e.target.value)}
                            rows={4}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Link
                            href={`/archive/documents/${document.id}`}
                            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            إلغاء
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Save size={16} />
                            {processing ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

EditDocument.layout = page => <ArchiveLayout title="تعديل المستند" children={page} />;