import { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import {
    Database, RefreshCw, Search, Loader2, AlertTriangle, ExternalLink,
    Settings, Paperclip, FolderInput, CheckCircle, XCircle, X,
    ChevronRight, ChevronLeft,
} from 'lucide-react';

function cellValue(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.join('، ') || '—';
    if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
    return String(v);
}

function xsrfToken() {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

function FolderSelect({ folders, value, onChange, sectorId }) {
    const filtered = sectorId
        ? folders.filter(f => String(f.sector_id) === String(sectorId))
        : [];

    const renderTree = (parentId = null, depth = 0) => {
        const result = [];
        for (const f of filtered.filter(x => (x.parent_id ?? null) === (parentId ?? null))) {
            result.push(
                <option key={f.id} value={f.id}>{'— '.repeat(depth) + f.name}</option>
            );
            result.push(...renderTree(f.id, depth + 1));
        }
        return result;
    };

    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={!sectorId}
            required
            className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
        >
            <option value="">{sectorId ? 'اختر المجلد' : 'اختر القطاع أولاً'}</option>
            {sectorId && renderTree()}
        </select>
    );
}

function ImportModal({ open, onClose, items, setItems, sectors, folders, documentTypes, onDone }) {
    const [sectorId, setSectorId] = useState('');
    const [folderId, setFolderId] = useState('');
    const [typeId, setTypeId] = useState('');
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null);

    if (!open) return null;

    const updateName = (pageId, name) => {
        setItems(prev => prev.map(it => (it.page_id === pageId ? { ...it, name } : it)));
    };

    const submit = async () => {
        if (!folderId || !typeId || importing) return;
        setImporting(true);
        setResults(null);
        try {
            const res = await fetch('/archive/api/notion/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body: JSON.stringify({
                    items: items.map(({ page_id, name }) => ({ page_id, name })),
                    folder_id: folderId,
                    document_type_id: typeId,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || data.message || `خطأ ${res.status}`);
            setResults(data);
            if (data.imported > 0) onDone?.(data);
        } catch (e) {
            setResults({ error: e.message });
        } finally {
            setImporting(false);
        }
    };

    const resultFor = (pageId) => results?.results?.find(r => r.page_id === pageId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FolderInput size={18} className="text-emerald-600" />
                        نسخ {items.length} ملف إلى الأرشيف
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {/* الوجهة */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">القطاع <span className="text-red-500">*</span></label>
                            <select
                                value={sectorId}
                                onChange={e => { setSectorId(e.target.value); setFolderId(''); }}
                                className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                                <option value="">اختر القطاع</option>
                                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">المجلد <span className="text-red-500">*</span></label>
                            <FolderSelect folders={folders} value={folderId} onChange={setFolderId} sectorId={sectorId} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">نوع المستند <span className="text-red-500">*</span></label>
                            <select
                                value={typeId}
                                onChange={e => setTypeId(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg  py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                                <option value="">اختر النوع</option>
                                {documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* التسمية قبل النسخ */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">أسماء المستندات (عدّلها قبل النسخ)</label>
                        <div className="border border-gray-200 rounded-xl divide-y divide-gray-50 max-h-72 overflow-y-auto">
                            {items.map(item => {
                                const r = resultFor(item.page_id);
                                return (
                                    <div key={item.page_id} className="flex items-center gap-3 px-3 py-2.5">
                                        <Paperclip size={14} className="text-gray-300 shrink-0" />
                                        <input
                                            value={item.name}
                                            onChange={e => updateName(item.page_id, e.target.value)}
                                            disabled={importing || r?.status === 'ok'}
                                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                                            placeholder="اسم المستند"
                                        />
                                        <span className="text-[10px] text-gray-400 shrink-0">{item.filesCount} ملف</span>
                                        {r?.status === 'ok' && <CheckCircle size={16} className="text-emerald-500 shrink-0" />}
                                        {r?.status === 'error' && (
                                            <span className="flex items-center gap-1 text-red-500 text-[10px] shrink-0" title={r.message}>
                                                <XCircle size={14} />
                                                {r.message}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {results?.error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-center gap-2">
                            <AlertTriangle size={15} />
                            {results.error}
                        </div>
                    )}

                    {results?.imported > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <CheckCircle size={15} />
                                تم نسخ {results.imported} من {items.length} بنجاح
                            </span>
                            <Link href={`/archive/documents?folder_id=${folderId}`} className="font-bold hover:underline">
                                عرض المستندات ←
                            </Link>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                        {results?.imported > 0 ? 'إغلاق' : 'إلغاء'}
                    </button>
                    <button
                        onClick={submit}
                        disabled={importing || !folderId || !typeId || items.some(i => !i.name.trim()) || results?.imported === items.length}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold"
                    >
                        {importing ? <Loader2 size={16} className="animate-spin" /> : <FolderInput size={16} />}
                        {importing ? 'جاري النسخ من Notion...' : 'نسخ إلى الأرشيف'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function NotionIndex({ configured, databaseId, sectors = [], folders = [], documentTypes = [] }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [customDb, setCustomDb] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [importOpen, setImportOpen] = useState(false);
    const [importItems, setImportItems] = useState([]);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);

    const fetchRows = (db = null) => {
        setLoading(true);
        setError(null);
        setSelectedIds(new Set());
        const url = '/archive/api/notion/rows' + (db ? `?database_id=${encodeURIComponent(db)}` : '');
        fetch(url, { headers: { Accept: 'application/json' } })
            .then(async r => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(data.error || `خطأ ${r.status}`);
                setRows(data.rows ?? []);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (configured && databaseId) fetchRows();
    }, []);

    const columns = useMemo(() => {
        const keys = new Set();
        rows.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
        const hidden = ['notion_id', 'url', 'created_time', 'last_edited_time', '_files', '_title'];
        return [...keys].filter(k => !hidden.includes(k) && !k.startsWith('_'));
    }, [rows]);

    const q = search.trim();
    const visibleRows = useMemo(() => {
        if (!q) return rows;
        return rows.filter(r => Object.values(r).some(v => !Array.isArray(v) || typeof v[0] !== 'object' ? cellValue(v).includes(q) : false));
    }, [rows, q]);

    // ترقيم الصفحات (من جهة الواجهة — البيانات كلها محمّلة)
    const totalPages = Math.max(1, Math.ceil(visibleRows.length / perPage));
    const safePage = Math.min(page, totalPages);
    const pagedRows = useMemo(
        () => visibleRows.slice((safePage - 1) * perPage, safePage * perPage),
        [visibleRows, safePage, perPage]
    );

    useEffect(() => { setPage(1); }, [q, perPage, rows]);

    const selectableRows = useMemo(() => pagedRows.filter(r => (r._files?.length ?? 0) > 0), [pagedRows]);
    const allSelected = selectableRows.length > 0 && selectableRows.every(r => selectedIds.has(r.notion_id));

    // أرقام الصفحات المعروضة: الأولى والأخيرة وما حول الحالية
    const pageNumbers = useMemo(() => {
        const nums = new Set([1, totalPages, safePage - 1, safePage, safePage + 1]);
        const list = [...nums].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
        const out = [];
        for (let i = 0; i < list.length; i++) {
            if (i > 0 && list[i] - list[i - 1] > 1) out.push('…');
            out.push(list[i]);
        }
        return out;
    }, [safePage, totalPages]);

    const toggleRow = (id) => setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(selectableRows.map(r => r.notion_id)));

    const defaultName = (row) => {
        if (row._title) return row._title;
        // أول قيمة نصية غير فارغة من الأعمدة
        for (const c of columns) {
            const v = row[c];
            if (typeof v === 'string' && v.trim()) return v.trim();
        }
        const fileName = row._files?.[0]?.name ?? '';
        return fileName.replace(/\.[^/.]+$/, '') || 'مستند Notion';
    };

    const openImport = () => {
        const items = rows
            .filter(r => selectedIds.has(r.notion_id))
            .map(r => ({
                page_id: r.notion_id,
                name: defaultName(r),
                filesCount: r._files?.length ?? 0,
            }));
        if (items.length === 0) return;
        setImportItems(items);
        setImportOpen(true);
    };

    return (
        <>
            <Head title="بيانات Notion" />

            <ImportModal
                open={importOpen}
                onClose={() => setImportOpen(false)}
                items={importItems}
                setItems={setImportItems}
                sectors={sectors}
                folders={folders}
                documentTypes={documentTypes}
                onDone={() => setSelectedIds(new Set())}
            />

            <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                        <Database size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-800">بيانات Notion</h2>
                        <p className="text-xs text-gray-400">قراءة مباشرة من قاعدة بيانات Notion</p>
                    </div>
                </div>

                <div className="flex-1" />

                {selectedIds.size > 0 && (
                    <button
                        onClick={openImport}
                        className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                    >
                        <FolderInput size={15} />
                        نسخ الملفات إلى الأرشيف ({selectedIds.size})
                    </button>
                )}

                <div className="relative">
                    <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ابحث في النتائج..."
                        className="w-48 border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                <input
                    value={customDb}
                    onChange={e => setCustomDb(e.target.value)}
                    placeholder="معرف قاعدة أخرى (اختياري)"
                    dir="ltr"
                    className="w-52 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />

                <button
                    onClick={() => fetchRows(customDb.trim() || null)}
                    disabled={loading || !configured}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    جلب البيانات
                </button>
            </div>

            {!configured && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <Settings size={22} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900 space-y-2">
                        <p className="font-bold">تكامل Notion غير مفعّل بعد</p>
                        <p>أضف <code className="bg-amber-100 px-1.5 py-0.5 rounded" dir="ltr">NOTION_API_TOKEN</code> و<code className="bg-amber-100 px-1.5 py-0.5 rounded" dir="ltr">NOTION_DATABASE_ID</code> في ملف البيئة ثم أعد إنشاء الحاوية.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 mb-4">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {configured && !error && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
                            <Loader2 size={18} className="animate-spin" />
                            جاري الجلب من Notion...
                        </div>
                    )}

                    {!loading && rows.length === 0 && (
                        <div className="py-16 text-center text-gray-400 text-sm">
                            <Database size={36} className="mx-auto text-gray-200 mb-3" />
                            لا توجد صفوف
                        </div>
                    )}

                    {!loading && visibleRows.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/70 text-gray-500 text-xs">
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={toggleAll}
                                                className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                                title="تحديد صفوف الصفحة الحالية التي فيها ملفات"
                                            />
                                        </th>
                                        <th className="text-right font-semibold px-3 py-3 w-20">الملفات</th>
                                        {columns.map(c => (
                                            <th key={c} className="text-right font-semibold px-4 py-3 whitespace-nowrap">{c}</th>
                                        ))}
                                        <th className="px-3 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {pagedRows.map(row => {
                                        const filesCount = row._files?.length ?? 0;
                                        const checked = selectedIds.has(row.notion_id);
                                        return (
                                            <tr
                                                key={row.notion_id}
                                                onClick={() => filesCount > 0 && toggleRow(row.notion_id)}
                                                className={`transition-colors ${filesCount > 0 ? 'cursor-pointer' : ''} ${checked ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-4 py-3">
                                                    {filesCount > 0 && (
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleRow(row.notion_id)}
                                                            onClick={e => e.stopPropagation()}
                                                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {filesCount > 0 ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-medium">
                                                            <Paperclip size={11} />
                                                            {filesCount}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-[11px]">—</span>
                                                    )}
                                                </td>
                                                {columns.map(c => (
                                                    <td key={c} className="px-4 py-3 text-gray-700 max-w-[260px] truncate" title={cellValue(row[c])}>
                                                        {cellValue(row[c])}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-3">
                                                    <a
                                                        href={row.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600 inline-block"
                                                        title="فتح في Notion"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && rows.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-gray-50 flex flex-wrap items-center gap-3">
                            <span className="text-[11px] text-gray-400">
                                عرض {visibleRows.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, visibleRows.length)} من {visibleRows.length}
                            </span>
                            {selectedIds.size > 0 && (
                                <span className="text-[11px] text-emerald-600 font-medium">{selectedIds.size} محدد</span>
                            )}

                            <span className="flex-1" />

                            <select
                                value={perPage}
                                onChange={e => setPerPage(Number(e.target.value))}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-500 bg-white focus:outline-none"
                            >
                                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / صفحة</option>)}
                            </select>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={safePage === 1}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
                                    title="السابق"
                                >
                                    <ChevronRight size={13} />
                                </button>
                                {pageNumbers.map((n, i) => n === '…' ? (
                                    <span key={`e${i}`} className="px-1.5 text-gray-300 text-xs">…</span>
                                ) : (
                                    <button
                                        key={n}
                                        onClick={() => setPage(n)}
                                        className={`min-w-[28px] px-1.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                            n === safePage
                                                ? 'bg-emerald-600 text-white'
                                                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safePage === totalPages}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
                                    title="التالي"
                                >
                                    <ChevronLeft size={13} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

NotionIndex.layout = page => <ArchiveLayout title="بيانات Notion" children={page} />;
