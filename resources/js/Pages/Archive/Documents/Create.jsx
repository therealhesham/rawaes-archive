import { useState, useCallback } from 'react';
import { Head, useForm, Link, router, usePage } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Upload, X, FileText, File as LucideFile, Image, AlertCircle, ChevronDown, Camera, ScanLine, Loader2 } from 'lucide-react';
import CameraCapture from '@/Components/Archive/CameraCapture';
import MultiPageScan from '@/Components/Archive/MultiPageScan';

function FileIcon({ ext }) {
    if (['jpg', 'jpeg', 'png'].includes(ext?.toLowerCase())) return <Image size={20} className="text-green-500" />;
    if (ext?.toLowerCase() === 'pdf') return <FileText size={20} className="text-red-500" />;
    return <LucideFile size={20} className="text-blue-500" />;
}

function formatBytes(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function FolderSelect({ folders, value, onChange, sectorId, disabled }) {
    const filtered = sectorId
        ? folders.filter(f => String(f.sector_id) === String(sectorId))
        : [];

    // Build hierarchy from flat list using parent_id
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

    const options = sectorId ? renderTree() : [];

    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled || !sectorId}
            className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
            required
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

export default function CreateDocument({ sectors, folders, documentTypes }) {
    const [files, setFiles] = useState([]);
    const [dragging, setDragging] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanModalOpen, setScanModalOpen] = useState(false);

    const SCAN_TOKEN = usePage().props.scanBridge?.token || '';


    // دعم التحديد المسبق للمجلد من صفحة المستكشف (?sector_id=&folder_id=)
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});
    const [data, setDataState] = useState({
        sector_id: urlParams?.get('sector_id') ?? '',
        folder_id: urlParams?.get('folder_id') ?? '',
        document_type_id: '',
        issuing_entity: '',
        issue_date: '',
        expiry_date: '',
        no_expiry_date: false,
        notes: '',
        is_confidential: false,
    });
    const setData = (key, value) => setDataState(prev => ({ ...prev, [key]: value }));

    const handleFiles = useCallback((newFiles, source = 'web') => {
        const added = Array.from(newFiles).map(f => ({
            id: Math.random().toString(36).slice(2),
            file: f,
            title: f.name.replace(/\.[^/.]+$/, ''),
            document_number: '',
            ext: f.name.split('.').pop(),
            size: f.size,
            source,
        }));
        setFiles(prev => [...prev, ...added]);
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

    const updateFile = (id, key, value) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f));
    };

    const submit = (e) => {
        e.preventDefault();
        if (files.length === 0) return;

        setProcessing(true);
        setErrors({});

        const payload = {
            ...data,
            is_confidential: data.is_confidential ? 1 : 0,
        };
        files.forEach((f, i) => {
            payload[`files[${i}]`] = f.file;
            payload[`titles[${f.file.name}]`] = f.title;
            payload[`document_numbers[${f.file.name}]`] = f.document_number;
            payload[`sources[${f.file.name}]`] = f.source || 'web';
        });

        router.post('/archive/documents', payload, {
            forceFormData: true,
            onError: (errs) => {
                setErrors(errs);
                setProcessing(false);
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <>
            <Head title="رفع مستندات" />

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/archive/documents" className="text-gray-500 hover:text-gray-700">
                        المستندات
                    </Link>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-800 font-medium">رفع مستندات</span>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    {/* Drop zone + Camera */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={onDrop}
                            className={`md:col-span-2 border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
                                ${dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-gray-50 hover:border-amber-400 hover:bg-amber-50/50'}`}
                            onClick={() => document.getElementById('file-input').click()}
                        >
                            <input
                                id="file-input"
                                type="file"
                                multiple
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                                onChange={e => handleFiles(e.target.files)}
                            />
                            <Upload size={40} className="mx-auto text-amber-400 mb-3" />
                            <p className="text-gray-700 font-medium">اسحب الملفات هنا أو اضغط للاختيار</p>
                            <p className="text-gray-400 text-sm mt-1">PDF, JPG, PNG, Word, Excel — حد أقصى 50MB</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => setScanModalOpen(true)}
                                className="flex-1 border-2 border-dashed border-amber-300 rounded-xl p-4 text-center transition-colors bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 group"
                            >
                                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-500 group-hover:bg-amber-600 flex items-center justify-center transition-colors">
                                    <ScanLine size={22} className="text-white" />
                                </div>
                                <p className="text-gray-700 font-medium text-sm">مسح ضوئي</p>
                                <p className="text-gray-400 text-xs mt-0.5">PDF متعدد الصفحات</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCameraOpen(true)}
                                className="flex-1 border-2 border-dashed border-blue-300 rounded-xl p-3 text-center transition-colors bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 group"
                            >
                                <Camera size={18} className="mx-auto text-blue-500 mb-1" />
                                <p className="text-gray-700 font-medium text-xs">كاميرا</p>
                            </button>
                        </div>
                    </div>

                    <MultiPageScan
                        open={scanModalOpen}
                        onClose={() => setScanModalOpen(false)}
                        onComplete={(file) => handleFiles([file], 'scanner')}
                        scanToken={SCAN_TOKEN}
                    />

                    {cameraOpen && (
                        <CameraCapture
                            onCapture={(file) => handleFiles([file])}
                            onClose={() => setCameraOpen(false)}
                        />
                    )}

                    {/* Files list */}
                    {files.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-700">{files.length} ملف محدد</p>
                                <button type="button" onClick={() => setFiles([])} className="text-xs text-red-500 hover:text-red-700">
                                    مسح الكل
                                </button>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {files.map(f => (
                                    <div key={f.id} className="p-3 flex items-start gap-3">
                                        <FileIcon ext={f.ext} />
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                value={f.title}
                                                onChange={e => updateFile(f.id, 'title', e.target.value)}
                                                placeholder="عنوان المستند"
                                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                            <input
                                                type="text"
                                                value={f.document_number}
                                                onChange={e => updateFile(f.id, 'document_number', e.target.value)}
                                                placeholder="رقم الوثيقة (اختياري)"
                                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                f.source === 'scanner'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {f.source === 'scanner' ? 'ورقي' : 'إلكتروني'}
                                            </span>
                                            <p className="text-xs text-gray-500 mt-1" dir="ltr">{formatBytes(f.size)}</p>
                                            <button type="button" onClick={() => removeFile(f.id)} className="mt-1 text-gray-400 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-800 mb-4">بيانات المستندات</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    القطاع <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={data.sector_id}
                                    onChange={e => {
                                        setData('sector_id', e.target.value);
                                        setData('folder_id', ''); // reset folder when sector changes
                                    }}
                                    required
                                    className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="">اختر القطاع</option>
                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                {errors.sector_id && <p className="text-red-500 text-xs mt-1">{errors.sector_id}</p>}
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
                                    <option value="">اختر النوع</option>
                                    {documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {errors.document_type_id && <p className="text-red-500 text-xs mt-1">{errors.document_type_id}</p>}
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
                                {errors.folder_id && <p className="text-red-500 text-xs mt-1">{errors.folder_id}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">الجهة المصدرة</label>
                                <input
                                    type="text"
                                    value={data.issuing_entity}
                                    onChange={e => setData('issuing_entity', e.target.value)}
                                    placeholder="اسم الجهة المصدرة"
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
                                <label htmlFor="no_expiry_date" className="text-sm font-medium text-gray-700">
                                    لا يوجد تاريخ انتهاء
                                </label>
                            </div>

                            <div className="flex items-center gap-3 py-2">
                                <input
                                    type="checkbox"
                                    id="confidential"
                                    checked={data.is_confidential}
                                    onChange={e => setData('is_confidential', e.target.checked)}
                                    className="w-4 h-4 accent-amber-500"
                                />
                                <label htmlFor="confidential" className="text-sm font-medium text-gray-700">
                                    مستند سري
                                </label>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
                                <textarea
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={3}
                                    placeholder="أي ملاحظات إضافية..."
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <Link
                            href="/archive/documents"
                            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            إلغاء
                        </Link>
                        <button
                            type="submit"
                            disabled={processing || files.length === 0}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Upload size={16} />
                            {processing ? 'جاري الرفع...' : `رفع ${files.length} مستند`}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

CreateDocument.layout = page => <ArchiveLayout title="رفع مستندات" children={page} />;