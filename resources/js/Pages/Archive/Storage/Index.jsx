import { useEffect, useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import {
    HardDrive, Cloud, Search, Loader2, AlertTriangle, CheckCircle, XCircle,
    ArrowRightLeft, X, ChevronRight, ChevronLeft, FileText,
} from 'lucide-react';

function formatSize(bytes) {
    if (!bytes) return '—';
    const units = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function xsrfToken() {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

const DISK_LABEL = { local: 'القرص المحلي', spaces: 'DigitalOcean' };

function DiskBadge({ disk }) {
    const isSpaces = disk === 'spaces';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
            isSpaces ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
            {isSpaces ? <Cloud size={11} /> : <HardDrive size={11} />}
            {DISK_LABEL[disk] ?? disk}
        </span>
    );
}

function TransferModal({ open, onClose, items, targetDisk, onDone }) {
    const [transferring, setTransferring] = useState(false);
    const [results, setResults] = useState(null);

    if (!open) return null;

    const submit = async () => {
        if (transferring) return;
        setTransferring(true);
        setResults(null);
        try {
            const res = await fetch('/archive/api/storage/transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body: JSON.stringify({ ids: items.map(i => i.id), to: targetDisk }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `خطأ ${res.status}`);
            setResults(data);
            if (data.transferred > 0) onDone?.(data);
        } catch (e) {
            setResults({ error: e.message });
        } finally {
            setTransferring(false);
        }
    };

    const resultFor = (id) => results?.results?.find(r => r.id === id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <ArrowRightLeft size={18} className="text-gray-700" />
                        نقل {items.length} ملف إلى {DISK_LABEL[targetDisk]}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-3">
                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-50 max-h-80 overflow-y-auto">
                        {items.map(item => {
                            const r = resultFor(item.id);
                            return (
                                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                                    <FileText size={14} className="text-gray-300 shrink-0" />
                                    <span className="flex-1 text-sm text-gray-700 truncate">{item.title}</span>
                                    <span className="text-[11px] text-gray-400 shrink-0">{formatSize(item.file_size)}</span>
                                    {r?.status === 'ok' && <CheckCircle size={16} className="text-emerald-500 shrink-0" />}
                                    {r?.status === 'skipped' && <span className="text-[11px] text-gray-400 shrink-0">{r.message}</span>}
                                    {r?.status === 'error' && (
                                        <span className="flex items-center gap-1 text-red-500 text-[11px] shrink-0" title={r.message}>
                                            <XCircle size={14} />
                                            {r.message}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {results?.error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-center gap-2">
                            <AlertTriangle size={15} />
                            {results.error}
                        </div>
                    )}

                    {results && !results.error && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 flex items-center gap-2">
                            <CheckCircle size={15} />
                            تم نقل {results.transferred} من {items.length} بنجاح
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                        {results ? 'إغلاق' : 'إلغاء'}
                    </button>
                    <button
                        onClick={submit}
                        disabled={transferring || (results && !results.error)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold"
                    >
                        {transferring ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                        {transferring ? 'جاري النقل...' : 'بدء النقل'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function StorageIndex({ spacesConfigured, counts }) {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [diskFilter, setDiskFilter] = useState('local');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [page, setPage] = useState(1);
    const [perPage] = useState(25);
    const [modalOpen, setModalOpen] = useState(false);

    const loadDocs = () => {
        setLoading(true);
        setError(null);
        fetch('/archive/api/storage/documents', { headers: { Accept: 'application/json' } })
            .then(async r => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(data.error || `خطأ ${r.status}`);
                setDocs(data.documents ?? []);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadDocs(); }, []);

    const q = search.trim();
    const filtered = useMemo(() => {
        return docs
            .filter(d => diskFilter === 'all' || d.storage_disk === diskFilter)
            .filter(d => !q || d.title.includes(q) || d.file_name?.includes(q));
    }, [docs, diskFilter, q]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const safePage = Math.min(page, totalPages);
    const pagedDocs = useMemo(
        () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
        [filtered, safePage, perPage]
    );

    useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [diskFilter, q]);

    const allSelected = pagedDocs.length > 0 && pagedDocs.every(d => selectedIds.has(d.id));
    const toggleRow = (id) => setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(pagedDocs.map(d => d.id)));

    // اتجاه النقل يتحدد بالتبويب النشط: من محلي إلى DigitalOcean، أو العكس
    const targetDisk = diskFilter === 'spaces' ? 'local' : 'spaces';
    const selectedItems = docs.filter(d => selectedIds.has(d.id));

    const handleDone = () => {
        setSelectedIds(new Set());
        loadDocs();
    };

    return (
        <>
            <Head title="إدارة التخزين" />

            <TransferModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                items={selectedItems}
                targetDisk={targetDisk}
                onDone={handleDone}
            />

            <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                        <HardDrive size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-800">إدارة التخزين</h2>
                        <p className="text-xs text-gray-400">اختر مستندات وانقلها بين القرص المحلي وDigitalOcean Spaces</p>
                    </div>
                </div>

                <div className="flex-1" />

                {selectedIds.size > 0 && (
                    <button
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                    >
                        <ArrowRightLeft size={15} />
                        نقل إلى {DISK_LABEL[targetDisk]} ({selectedIds.size})
                    </button>
                )}

                <div className="relative">
                    <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ابحث بالاسم..."
                        className="w-56 border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                </div>
            </div>

            {!spacesConfigured && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 mb-4">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-900">
                        لم يتم ضبط بيانات اعتماد DigitalOcean Spaces بعد (<code className="bg-amber-100 px-1 rounded">DO_SPACES_KEY</code> وما يتبعها في ملف البيئة). النقل إلى DigitalOcean لن يعمل حتى تُضبط.
                    </p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 mb-4">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {/* تبويبات القرص */}
            <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 mb-4 w-fit">
                {[
                    { key: 'local', label: 'القرص المحلي', icon: HardDrive, count: counts.local },
                    { key: 'spaces', label: 'DigitalOcean', icon: Cloud, count: counts.spaces },
                    { key: 'all', label: 'الكل', icon: null, count: counts.local + counts.spaces },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setDiskFilter(tab.key)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                            diskFilter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.icon && <tab.icon size={14} />}
                        {tab.label}
                        <span className="text-[11px] text-gray-400">({tab.count})</span>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading && (
                    <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
                        <Loader2 size={18} className="animate-spin" />
                        جاري التحميل...
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="py-16 text-center text-gray-400 text-sm">
                        <HardDrive size={36} className="mx-auto text-gray-200 mb-3" />
                        لا توجد مستندات على هذا القرص
                    </div>
                )}

                {!loading && pagedDocs.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 text-gray-500 text-xs">
                                    <th className="px-4 py-3 w-10">
                                        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-gray-900 cursor-pointer" />
                                    </th>
                                    <th className="text-right font-semibold px-4 py-3">المستند</th>
                                    <th className="text-right font-semibold px-4 py-3">القطاع / المجلد</th>
                                    <th className="text-right font-semibold px-4 py-3">الحجم</th>
                                    <th className="text-right font-semibold px-4 py-3">القرص الحالي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {pagedDocs.map(doc => {
                                    const checked = selectedIds.has(doc.id);
                                    return (
                                        <tr
                                            key={doc.id}
                                            onClick={() => toggleRow(doc.id)}
                                            className={`cursor-pointer transition-colors ${checked ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}
                                        >
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleRow(doc.id)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-4 h-4 accent-gray-900 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 max-w-[260px] truncate" title={doc.title}>
                                                {doc.title}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">
                                                {[doc.sector, doc.folder].filter(Boolean).join(' / ') || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">{formatSize(doc.file_size)}</td>
                                            <td className="px-4 py-3"><DiskBadge disk={doc.storage_disk} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && filtered.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-gray-50 flex flex-wrap items-center gap-3">
                        <span className="text-[11px] text-gray-400">
                            عرض {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)} من {filtered.length}
                        </span>
                        {selectedIds.size > 0 && <span className="text-[11px] text-gray-700 font-medium">{selectedIds.size} محدد</span>}
                        <span className="flex-1" />
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                            >
                                <ChevronRight size={13} />
                            </button>
                            <span className="text-xs text-gray-500 px-2">{safePage} / {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage === totalPages}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                            >
                                <ChevronLeft size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

StorageIndex.layout = page => <ArchiveLayout title="إدارة التخزين" children={page} />;
