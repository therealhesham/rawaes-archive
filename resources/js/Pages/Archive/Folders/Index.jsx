import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import {
    FolderOpen, Folder, FolderPlus, ChevronDown, ChevronLeft,
    Edit2, Trash2, FileText, Image as ImageIcon, File as LucideFile,
    HardDrive, Loader2, Palette, ExternalLink, Lock, Archive,
    Scissors, Copy, ClipboardPaste, X, Search, Plus, Upload,
    Eye, Download, MoreVertical, LayoutGrid, List, RefreshCw, Info,
} from 'lucide-react';

/* ---------- Helpers ---------- */

function flattenFolders(sectors) {
    const map = new Map();
    const walk = (folder, sectorId) => {
        map.set(folder.id, { ...folder, sector_id: folder.sector_id ?? sectorId });
        (folder.children ?? []).forEach(c => walk(c, sectorId));
    };
    sectors.forEach(s => (s.folders ?? []).forEach(f => walk(f, s.id)));
    return map;
}

function docIconStyle(ext) {
    const e = ext?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e)) return { Icon: ImageIcon, tile: 'bg-green-50', color: 'text-green-500' };
    if (e === 'pdf') return { Icon: FileText, tile: 'bg-red-50', color: 'text-red-500' };
    if (['doc', 'docx'].includes(e)) return { Icon: FileText, tile: 'bg-blue-50', color: 'text-blue-500' };
    if (['xls', 'xlsx'].includes(e)) return { Icon: FileText, tile: 'bg-emerald-50', color: 'text-emerald-600' };
    return { Icon: LucideFile, tile: 'bg-gray-50', color: 'text-gray-400' };
}

function formatBytes(bytes) {
    const n = Number(bytes);
    if (!n) return '0 B';
    if (n >= 1073741824) return (n / 1073741824).toFixed(1) + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
}

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = (new Date(dateStr).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 2592000) return rtf.format(Math.round(diff / 86400), 'day');
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function folderStats(folder) {
    const parts = [];
    if (folder.documents_count) parts.push(`${folder.documents_count} ملف`);
    if (folder.children?.length) parts.push(`${folder.children.length} مجلد`);
    if (Number(folder.documents_size)) parts.push(formatBytes(folder.documents_size));
    return parts.length ? parts.join(' · ') : 'فارغ';
}

/* ---------- Tree (شجرة المجلدات) ---------- */

function TreeFolder({ folder, depth, location, expanded, onToggle, onNavigate }) {
    const hasChildren = folder.children?.length > 0;
    const isOpen = expanded.has(folder.id);
    const isCurrent = location.type === 'folder' && location.folderId === folder.id;

    return (
        <div>
            <div
                className={`flex items-center gap-1.5 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                    isCurrent ? 'bg-emerald-100 text-emerald-900 font-semibold' : 'hover:bg-gray-50 text-gray-700'
                }`}
                style={{ paddingRight: `${6 + depth * 14}px` }}
                onClick={() => onNavigate({ type: 'folder', sectorId: folder.sector_id, folderId: folder.id })}
            >
                <button
                    onClick={e => { e.stopPropagation(); onToggle(folder.id); }}
                    className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600"
                >
                    {hasChildren
                        ? (isOpen ? <ChevronDown size={12} /> : <ChevronLeft size={12} />)
                        : <span className="inline-block w-3" />}
                </button>
                <span className="shrink-0" style={{ color: folder.color ?? '#22C55E' }}>
                    {isCurrent || (isOpen && hasChildren) ? <FolderOpen size={16} /> : <Folder size={16} />}
                </span>
                <span className="truncate flex-1">{folder.name}</span>
            </div>
            {isOpen && hasChildren && folder.children.map(c => (
                <TreeFolder
                    key={c.id}
                    folder={c}
                    depth={depth + 1}
                    location={location}
                    expanded={expanded}
                    onToggle={onToggle}
                    onNavigate={onNavigate}
                />
            ))}
        </div>
    );
}

/* ---------- Properties modal ---------- */

function PropertiesModal({ folder, onClose }) {
    const [name, setName] = useState(folder?.name ?? '');
    const [nameEn, setNameEn] = useState(folder?.name_en ?? '');
    const [color, setColor] = useState(folder?.color ?? '#22C55E');

    if (!folder) return null;

    const submit = (e) => {
        e.preventDefault();
        router.put(`/archive/folders/${folder.id}`, { name, name_en: nameEn, color }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Folder size={18} style={{ color }} />
                    خصائص المجلد
                </h3>
                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">الاسم</label>
                        <input
                            type="text" value={name} onChange={e => setName(e.target.value)} required
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">الاسم بالإنجليزية</label>
                        <input
                            type="text" value={nameEn ?? ''} onChange={e => setNameEn(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">اللون:</label>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-gray-200" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">إلغاء</button>
                        <button type="submit" className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ---------- Main page ---------- */

export default function FoldersIndex({ sectors }) {
    const [location, setLocation] = useState({ type: 'root' });
    const [expanded, setExpanded] = useState(() => new Set());
    const [selected, setSelected] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [savingNew, setSavingNew] = useState(false);
    const [propsFolder, setPropsFolder] = useState(null);
    const [docs, setDocs] = useState([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [dropTargetId, setDropTargetId] = useState(null);
    const [menu, setMenu] = useState(null);
    const [clipboard, setClipboard] = useState(null);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // grid | list
    const [newMenuOpen, setNewMenuOpen] = useState(false);
    const newInputRef = useRef(null);
    const renameInputRef = useRef(null);

    const foldersById = useMemo(() => flattenFolders(sectors), [sectors]);
    const sectorsById = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);

    const currentFolder = location.type === 'folder' ? foldersById.get(location.folderId) : null;
    const currentSector = location.type !== 'root' ? sectorsById.get(location.sectorId) : null;

    useEffect(() => {
        if (location.type === 'folder' && !foldersById.get(location.folderId)) {
            setLocation({ type: 'sector', sectorId: location.sectorId });
        }
    }, [foldersById, location]);

    const breadcrumb = useMemo(() => {
        const chain = [];
        if (location.type === 'root') return chain;
        if (currentSector) chain.push({ kind: 'sector', id: currentSector.id, name: currentSector.name });
        if (location.type === 'folder') {
            const parts = [];
            let f = foldersById.get(location.folderId);
            let guard = 0;
            while (f && guard++ < 20) {
                parts.unshift({ kind: 'folder', id: f.id, name: f.name });
                f = f.parent_id ? foldersById.get(f.parent_id) : null;
            }
            chain.push(...parts);
        }
        return chain;
    }, [location, currentSector, foldersById]);

    const childFolders = useMemo(() => {
        if (location.type === 'root') return [];
        if (location.type === 'sector') return currentSector?.folders ?? [];
        return currentFolder?.children ?? [];
    }, [location, currentSector, currentFolder]);

    const refreshDocs = (folderId) => {
        if (!folderId) { setDocs([]); return; }
        setDocsLoading(true);
        fetch(`/archive/api/folders/${folderId}/documents`, { headers: { Accept: 'application/json' } })
            .then(r => (r.ok ? r.json() : []))
            .then(setDocs)
            .catch(() => {})
            .finally(() => setDocsLoading(false));
    };

    useEffect(() => {
        setDocs([]);
        setSelected(null);
        setCreating(false);
        setMenu(null);
        setSearch('');
        if (location.type !== 'folder') return;
        refreshDocs(location.folderId);
    }, [location]);

    useEffect(() => {
        if (!menu && !newMenuOpen) return;
        const close = () => { setMenu(null); setNewMenuOpen(false); };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [menu, newMenuOpen]);

    const navigate = (loc) => {
        setLocation(loc);
        if (loc.type === 'folder') {
            setExpanded(prev => {
                const next = new Set(prev);
                let f = foldersById.get(loc.folderId);
                let guard = 0;
                while (f && guard++ < 20) {
                    next.add(f.id);
                    f = f.parent_id ? foldersById.get(f.parent_id) : null;
                }
                return next;
            });
        }
    };

    const goUp = () => {
        if (location.type === 'folder') {
            const f = foldersById.get(location.folderId);
            if (f?.parent_id) navigate({ type: 'folder', sectorId: location.sectorId, folderId: f.parent_id });
            else navigate({ type: 'sector', sectorId: location.sectorId });
        } else if (location.type === 'sector') {
            navigate({ type: 'root' });
        }
    };

    const toggleTree = (id) => setExpanded(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const refreshAll = () => {
        router.reload({ only: ['sectors'] });
        if (location.type === 'folder') refreshDocs(location.folderId);
    };

    const uploadHref = location.type === 'folder'
        ? `/archive/documents/create?sector_id=${location.sectorId}&folder_id=${location.folderId}`
        : '/archive/documents/create';

    /* ----- create / rename / delete ----- */

    const startCreate = () => {
        if (location.type === 'root') return;
        setCreating(true);
        setViewMode('grid');
        setNewName('');
        setTimeout(() => newInputRef.current?.focus(), 30);
    };

    const submitCreate = () => {
        const name = newName.trim();
        if (!name || savingNew) return;
        setSavingNew(true);
        router.post('/archive/folders', {
            sector_id: location.sectorId,
            parent_id: location.type === 'folder' ? location.folderId : null,
            name,
            color: currentFolder?.color ?? '#22C55E',
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => { setCreating(false); setNewName(''); },
            onFinish: () => setSavingNew(false),
        });
    };

    const startRename = (folder) => {
        setRenamingId(folder.id);
        setViewMode('grid');
        setRenameValue(folder.name);
        setTimeout(() => renameInputRef.current?.select(), 30);
    };

    const submitRename = () => {
        const name = renameValue.trim();
        const folder = foldersById.get(renamingId);
        if (!name || !folder || name === folder.name) { setRenamingId(null); return; }
        router.put(`/archive/folders/${folder.id}`, { name }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => setRenamingId(null),
        });
    };

    const deleteFolder = (folder) => {
        if (confirm(`حذف المجلد "${folder.name}"؟`)) {
            router.delete(`/archive/folders/${folder.id}`, { preserveState: true, preserveScroll: true });
        }
    };

    const moveDocument = (docId, folderId) => {
        router.post(`/archive/documents/${docId}/move`, { folder_id: folderId }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => setDocs(prev => prev.filter(d => d.id !== docId)),
        });
    };

    /* ----- clipboard ----- */

    const isDescendantOf = (targetId, ancestorId) => {
        let f = foldersById.get(targetId);
        let guard = 0;
        while (f && guard++ < 30) {
            if (f.parent_id === ancestorId) return true;
            f = f.parent_id ? foldersById.get(f.parent_id) : null;
        }
        return false;
    };

    const canPasteAt = (target) => {
        if (!clipboard) return false;
        if (clipboard.kind === 'doc') return !!target.folderId;
        if (target.folderId === clipboard.item.id) return false;
        if (target.folderId && isDescendantOf(target.folderId, clipboard.item.id)) return false;
        return true;
    };

    const currentTarget = location.type === 'folder'
        ? { folderId: location.folderId, sectorId: location.sectorId }
        : location.type === 'sector'
            ? { folderId: null, sectorId: location.sectorId }
            : null;

    const cutItem = (kind, item) => setClipboard({ mode: 'cut', kind, item: { id: item.id, name: kind === 'doc' ? item.title : item.name } });
    const copyItem = (kind, item) => setClipboard({ mode: 'copy', kind, item: { id: item.id, name: kind === 'doc' ? item.title : item.name } });

    const paste = (target) => {
        if (!target || !canPasteAt(target)) return;
        const opts = { preserveState: true, preserveScroll: true };

        if (clipboard.kind === 'doc') {
            const url = clipboard.mode === 'cut'
                ? `/archive/documents/${clipboard.item.id}/move`
                : `/archive/documents/${clipboard.item.id}/copy`;
            router.post(url, { folder_id: target.folderId }, {
                ...opts,
                onSuccess: () => {
                    if (location.type === 'folder') refreshDocs(location.folderId);
                    if (clipboard.mode === 'cut') setClipboard(null);
                },
            });
        } else {
            const url = clipboard.mode === 'cut'
                ? `/archive/folders/${clipboard.item.id}/move`
                : `/archive/folders/${clipboard.item.id}/copy`;
            router.post(url, {
                parent_id: target.folderId,
                sector_id: target.sectorId,
            }, {
                ...opts,
                onSuccess: () => { if (clipboard.mode === 'cut') setClipboard(null); },
            });
        }
    };

    useEffect(() => {
        const onKey = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.key === 'Escape') { setClipboard(null); setMenu(null); return; }
            if (e.key === 'Backspace') { e.preventDefault(); goUp(); return; }
            if (!(e.ctrlKey || e.metaKey)) return;

            const key = e.key.toLowerCase();
            if (key === 'v') { e.preventDefault(); paste(currentTarget); return; }
            if (key !== 'x' && key !== 'c') return;
            if (!selected) return;

            if (selected.startsWith('d-')) {
                const doc = docs.find(d => `d-${d.id}` === selected);
                if (!doc) return;
                e.preventDefault();
                key === 'x' ? cutItem('doc', doc) : copyItem('doc', doc);
            } else if (selected.startsWith('f-')) {
                const folder = foldersById.get(Number(selected.slice(2)));
                if (!folder) return;
                e.preventDefault();
                key === 'x' ? cutItem('folder', folder) : copyItem('folder', folder);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const isCut = (kind, id) => clipboard?.mode === 'cut' && clipboard.kind === kind && clipboard.item.id === id;

    /* ----- filtered views ----- */

    const q = search.trim();
    const visibleFolders = useMemo(
        () => (q ? childFolders.filter(f => f.name.includes(q)) : childFolders),
        [childFolders, q]
    );
    const visibleDocs = useMemo(() => (q ? docs.filter(d => d.title.includes(q)) : docs), [docs, q]);

    const docsTotalSize = useMemo(() => docs.reduce((s, d) => s + (Number(d.file_size) || 0), 0), [docs]);

    const openFolderMenuAt = (e, folder) => {
        e.preventDefault();
        e.stopPropagation();
        setSelected(`f-${folder.id}`);
        setMenu({ x: e.clientX, y: e.clientY, kind: 'folder', target: folder });
    };

    const openDocMenuAt = (e, doc) => {
        e.preventDefault();
        e.stopPropagation();
        setSelected(`d-${doc.id}`);
        setMenu({ x: e.clientX, y: e.clientY, kind: 'doc', target: doc });
    };

    /* ----- render ----- */

    return (
        <>
            <Head title="المجلدات" />

            <PropertiesModal key={propsFolder?.id ?? 'none'} folder={propsFolder} onClose={() => setPropsFolder(null)} />

            <div className="flex gap-5 items-start">
                {/* ===== شجرة المجلدات (right pane) ===== */}
                <div className="w-60 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 hidden lg:block sticky top-4">
                    <div
                        className={`flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer text-sm font-bold transition-colors ${
                            location.type === 'root' ? 'bg-emerald-100 text-emerald-900' : 'hover:bg-gray-50 text-gray-800'
                        }`}
                        onClick={() => navigate({ type: 'root' })}
                    >
                        <Archive size={16} className="text-emerald-600" />
                        الأرشيف
                    </div>
                    {sectors.map(sector => (
                        <div key={sector.id} className="mt-0.5">
                            <div
                                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${
                                    location.type === 'sector' && location.sectorId === sector.id
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'hover:bg-gray-50 text-gray-700'
                                }`}
                                onClick={() => navigate({ type: 'sector', sectorId: sector.id })}
                            >
                                <HardDrive size={15} className="text-blue-500 shrink-0" />
                                <span className="truncate">{sector.name}</span>
                            </div>
                            {(sector.folders ?? []).map(f => (
                                <TreeFolder
                                    key={f.id}
                                    folder={f}
                                    depth={1}
                                    location={location}
                                    expanded={expanded}
                                    onToggle={toggleTree}
                                    onNavigate={navigate}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* ===== Main ===== */}
                <div className="flex-1 min-w-0">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        {/* Breadcrumb + refresh */}
                        <div className="flex items-center gap-1 text-sm">
                            <button
                                onClick={() => navigate({ type: 'root' })}
                                className={`hover:text-emerald-600 ${location.type === 'root' ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}
                            >
                                الأرشيف
                            </button>
                            {breadcrumb.map((part, i) => (
                                <span key={`${part.kind}-${part.id}`} className="flex items-center gap-1">
                                    <ChevronLeft size={13} className="text-gray-300" />
                                    <button
                                        onClick={() => navigate(part.kind === 'sector'
                                            ? { type: 'sector', sectorId: part.id }
                                            : { type: 'folder', sectorId: location.sectorId, folderId: part.id })}
                                        className={i === breadcrumb.length - 1
                                            ? 'text-emerald-700 font-bold'
                                            : 'text-gray-500 hover:text-emerald-600'}
                                    >
                                        {part.name}
                                    </button>
                                </span>
                            ))}
                            <button onClick={refreshAll} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600 mr-1" title="تحديث">
                                <RefreshCw size={14} />
                            </button>
                        </div>

                        <div className="flex-1" />

                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="ابحث عن مجلد أو ملف..."
                                className="w-56 border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {/* View toggle */}
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}
                                title="عرض شبكي"
                            >
                                <LayoutGrid size={15} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}
                                title="عرض قائمة"
                            >
                                <List size={15} />
                            </button>
                        </div>

                        {/* Clipboard chip */}
                        {clipboard && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1.5 rounded-xl text-xs">
                                {clipboard.mode === 'cut' ? <Scissors size={12} /> : <Copy size={12} />}
                                <span className="max-w-[110px] truncate">{clipboard.item.name}</span>
                                <button
                                    onClick={() => paste(currentTarget)}
                                    disabled={!canPasteAt(currentTarget ?? {})}
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-2 py-0.5 rounded-lg font-medium"
                                    title="لصق هنا (Ctrl+V)"
                                >
                                    <ClipboardPaste size={11} />
                                    لصق
                                </button>
                                <button onClick={() => setClipboard(null)} className="text-emerald-400 hover:text-emerald-700" title="إفراغ (Esc)">
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* + جديد dropdown */}
                        <div className="relative">
                            <button
                                onClick={e => { e.stopPropagation(); setNewMenuOpen(v => !v); }}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                            >
                                <Plus size={16} />
                                جديد
                                <ChevronDown size={14} />
                            </button>
                            {newMenuOpen && (
                                <div className="absolute left-0 top-full mt-2 z-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-48 text-sm" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => { setNewMenuOpen(false); startCreate(); }}
                                        disabled={location.type === 'root'}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-right text-gray-700 hover:bg-gray-50 disabled:text-gray-300"
                                    >
                                        <FolderPlus size={15} className="text-emerald-600" />
                                        مجلد
                                    </button>
                                    <Link
                                        href={uploadHref}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-right text-gray-700 hover:bg-gray-50"
                                        onClick={() => setNewMenuOpen(false)}
                                    >
                                        <Upload size={15} className="text-emerald-600" />
                                        رفع ملفات
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* شريط معلومات المجلد */}
                    {location.type === 'folder' && currentFolder && (
                        <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl px-5 py-4 mb-4 flex flex-wrap items-center gap-x-8 gap-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                    <Folder size={22} style={{ color: currentFolder.color ?? '#22C55E' }} fill={currentFolder.color ?? '#22C55E'} fillOpacity={0.2} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-gray-800">{currentFolder.name}</h2>
                                    {currentFolder.description && (
                                        <p className="text-xs text-gray-500 mt-0.5">{currentFolder.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-8 mr-auto text-center">
                                <div>
                                    <p className="font-bold text-gray-800">{formatBytes(docsTotalSize)}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">الحجم</p>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">{docs.length}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">ملف</p>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">{childFolders.length}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">مجلدات</p>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{timeAgo(currentFolder.updated_at)}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">آخر تعديل</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content area */}
                    <div
                        className="min-h-[300px]"
                        onClick={() => setSelected(null)}
                        onContextMenu={e => {
                            e.preventDefault();
                            setMenu({ x: e.clientX, y: e.clientY, kind: 'blank' });
                        }}
                    >
                        {/* ===== ROOT: sectors ===== */}
                        {location.type === 'root' && (
                            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                                {sectors.map(sector => (
                                    <div
                                        key={sector.id}
                                        onClick={e => { e.stopPropagation(); navigate({ type: 'sector', sectorId: sector.id }); }}
                                        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 p-6 flex flex-col items-center gap-2.5 cursor-pointer transition-all select-none"
                                    >
                                        <HardDrive size={44} className="text-emerald-500" />
                                        <span className="font-semibold text-gray-800 text-sm text-center leading-snug line-clamp-2">{sector.name}</span>
                                        <span className="text-xs text-gray-400">{sector.folders?.length ?? 0} مجلد</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ===== GRID VIEW ===== */}
                        {location.type !== 'root' && viewMode === 'grid' && (
                            <>
                                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                                    {creating && (
                                        <div className="bg-white rounded-2xl border-2 border-dashed border-emerald-300 p-5 flex flex-col items-center gap-2.5">
                                            <FolderPlus size={44} className="text-emerald-400" />
                                            {savingNew ? (
                                                <Loader2 size={15} className="animate-spin text-emerald-500" />
                                            ) : (
                                                <input
                                                    ref={newInputRef}
                                                    value={newName}
                                                    onChange={e => setNewName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') { e.preventDefault(); submitCreate(); }
                                                        if (e.key === 'Escape') setCreating(false);
                                                    }}
                                                    onBlur={() => { if (!newName.trim()) setCreating(false); else submitCreate(); }}
                                                    placeholder="مجلد جديد"
                                                    className="w-full text-center text-sm border border-emerald-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            )}
                                        </div>
                                    )}

                                    {visibleFolders.map(folder => (
                                        <div
                                            key={folder.id}
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (renamingId !== folder.id) navigate({ type: 'folder', sectorId: location.sectorId, folderId: folder.id });
                                            }}
                                            onContextMenu={e => openFolderMenuAt(e, folder)}
                                            onDragOver={e => { e.preventDefault(); setDropTargetId(folder.id); }}
                                            onDragLeave={() => setDropTargetId(prev => (prev === folder.id ? null : prev))}
                                            onDrop={e => {
                                                e.preventDefault();
                                                setDropTargetId(null);
                                                const docId = e.dataTransfer.getData('doc-id');
                                                if (docId) moveDocument(docId, folder.id);
                                            }}
                                            className={`relative bg-white rounded-2xl border p-5 flex flex-col items-center gap-2.5 cursor-pointer transition-all select-none group ${
                                                isCut('folder', folder.id) ? 'opacity-40' : ''
                                            } ${
                                                dropTargetId === folder.id
                                                    ? 'border-emerald-400 border-dashed bg-emerald-50/50 shadow-md'
                                                    : selected === `f-${folder.id}`
                                                        ? 'border-emerald-300 bg-emerald-50/40 shadow-sm'
                                                        : 'border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200'
                                            }`}
                                            title={folder.name}
                                        >
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    setSelected(`f-${folder.id}`);
                                                    setMenu({ x: r.left, y: r.bottom + 4, kind: 'folder', target: folder });
                                                }}
                                                className="absolute top-2.5 left-2.5 p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="خيارات"
                                            >
                                                <MoreVertical size={15} />
                                            </button>

                                            <Folder size={44} style={{ color: folder.color ?? '#22C55E' }} fill={folder.color ?? '#22C55E'} fillOpacity={0.25} />
                                            {renamingId === folder.id ? (
                                                <input
                                                    ref={renameInputRef}
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') { e.preventDefault(); submitRename(); }
                                                        if (e.key === 'Escape') setRenamingId(null);
                                                    }}
                                                    onBlur={submitRename}
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-full text-center text-sm border border-emerald-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            ) : (
                                                <span className="font-semibold text-gray-800 text-sm text-center leading-snug line-clamp-2 break-words w-full">{folder.name}</span>
                                            )}
                                            <span className="text-xs text-gray-400">{folderStats(folder)}</span>
                                        </div>
                                    ))}
                                </div>

                                {visibleFolders.length === 0 && !creating && (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center mb-4">
                                        <button
                                            onClick={e => { e.stopPropagation(); startCreate(); }}
                                            className="inline-flex flex-col items-center gap-2 text-gray-300 hover:text-emerald-500 transition-colors"
                                        >
                                            <FolderPlus size={36} />
                                            <span className="text-xs text-gray-400">{q ? 'لا توجد مجلدات مطابقة' : 'لا توجد مجلدات فرعية — اضغط للإنشاء'}</span>
                                        </button>
                                    </div>
                                )}

                                {/* Documents (grid mode: list section) */}
                                {location.type === 'folder' && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-4" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                                            <h3 className="font-bold text-gray-800">الملفات</h3>
                                            <Link
                                                href={`/archive/documents?folder_id=${location.folderId}`}
                                                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                                            >
                                                عرض الكل
                                            </Link>
                                        </div>

                                        {docsLoading && (
                                            <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
                                                <Loader2 size={16} className="animate-spin" />
                                                جاري التحميل...
                                            </div>
                                        )}

                                        {!docsLoading && visibleDocs.length === 0 && (
                                            <p className="py-8 text-center text-sm text-gray-400">
                                                {q ? 'لا توجد ملفات مطابقة' : 'لا توجد ملفات في هذا المجلد'}
                                            </p>
                                        )}

                                        <div className="divide-y divide-gray-50">
                                            {visibleDocs.map(doc => {
                                                const { Icon, tile, color } = docIconStyle(doc.file_extension);
                                                return (
                                                    <div
                                                        key={doc.id}
                                                        draggable
                                                        onDragStart={e => e.dataTransfer.setData('doc-id', String(doc.id))}
                                                        onClick={() => setSelected(`d-${doc.id}`)}
                                                        onDoubleClick={() => router.visit(`/archive/documents/${doc.id}`)}
                                                        onContextMenu={e => openDocMenuAt(e, doc)}
                                                        className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors ${
                                                            isCut('doc', doc.id) ? 'opacity-40' : ''
                                                        } ${selected === `d-${doc.id}` ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-xl ${tile} flex items-center justify-center shrink-0 relative`}>
                                                            <Icon size={19} className={color} />
                                                            {!!doc.is_confidential && (
                                                                <Lock size={11} className="absolute -bottom-1 -left-1 text-red-500 bg-white rounded-full" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-800 text-sm truncate">{doc.title}.{doc.file_extension}</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                {timeAgo(doc.created_at)}{doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <a
                                                                href={`/archive/documents/${doc.id}/download`}
                                                                onClick={e => e.stopPropagation()}
                                                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600"
                                                                title="تحميل"
                                                            >
                                                                <Download size={16} />
                                                            </a>
                                                            <Link
                                                                href={`/archive/documents/${doc.id}`}
                                                                onClick={e => e.stopPropagation()}
                                                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600"
                                                                title="عرض"
                                                            >
                                                                <Eye size={16} />
                                                            </Link>
                                                            <button
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    setSelected(`d-${doc.id}`);
                                                                    const r = e.currentTarget.getBoundingClientRect();
                                                                    setMenu({ x: r.left, y: r.bottom + 4, kind: 'doc', target: doc });
                                                                }}
                                                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                                                                title="خيارات"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ===== LIST VIEW ===== */}
                        {location.type !== 'root' && viewMode === 'list' && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50/70 text-gray-500 text-xs">
                                            <th className="text-right font-semibold px-5 py-3">الاسم</th>
                                            <th className="text-right font-semibold px-4 py-3 w-28">الحجم</th>
                                            <th className="text-right font-semibold px-4 py-3 w-32">آخر تعديل</th>
                                            <th className="text-right font-semibold px-4 py-3 w-24">النوع</th>
                                            <th className="px-3 py-3 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {visibleFolders.map(folder => (
                                            <tr
                                                key={`f-${folder.id}`}
                                                onClick={() => navigate({ type: 'folder', sectorId: location.sectorId, folderId: folder.id })}
                                                onContextMenu={e => openFolderMenuAt(e, folder)}
                                                onDragOver={e => { e.preventDefault(); setDropTargetId(folder.id); }}
                                                onDragLeave={() => setDropTargetId(prev => (prev === folder.id ? null : prev))}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    setDropTargetId(null);
                                                    const docId = e.dataTransfer.getData('doc-id');
                                                    if (docId) moveDocument(docId, folder.id);
                                                }}
                                                className={`cursor-pointer transition-colors ${
                                                    isCut('folder', folder.id) ? 'opacity-40' : ''
                                                } ${dropTargetId === folder.id ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <Folder size={18} style={{ color: folder.color ?? '#22C55E' }} fill={folder.color ?? '#22C55E'} fillOpacity={0.25} />
                                                        <span className="font-medium text-gray-800">{folder.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500" dir="ltr">{Number(folder.documents_size) ? formatBytes(folder.documents_size) : '—'}</td>
                                                <td className="px-4 py-3 text-gray-500">{timeAgo(folder.updated_at)}</td>
                                                <td className="px-4 py-3 text-gray-500">مجلد</td>
                                                <td className="px-3 py-3">
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            const r = e.currentTarget.getBoundingClientRect();
                                                            setSelected(`f-${folder.id}`);
                                                            setMenu({ x: r.left, y: r.bottom + 4, kind: 'folder', target: folder });
                                                        }}
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                                                    >
                                                        <MoreVertical size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {location.type === 'folder' && visibleDocs.map(doc => {
                                            const { Icon, color } = docIconStyle(doc.file_extension);
                                            return (
                                                <tr
                                                    key={`d-${doc.id}`}
                                                    draggable
                                                    onDragStart={e => e.dataTransfer.setData('doc-id', String(doc.id))}
                                                    onClick={() => setSelected(`d-${doc.id}`)}
                                                    onDoubleClick={() => router.visit(`/archive/documents/${doc.id}`)}
                                                    onContextMenu={e => openDocMenuAt(e, doc)}
                                                    className={`cursor-pointer transition-colors ${
                                                        isCut('doc', doc.id) ? 'opacity-40' : ''
                                                    } ${selected === `d-${doc.id}` ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                                                >
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <Icon size={18} className={color} />
                                                            <span className="font-medium text-gray-800">{doc.title}.{doc.file_extension}</span>
                                                            {!!doc.is_confidential && <Lock size={12} className="text-red-500" />}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500" dir="ltr">{formatBytes(doc.file_size)}</td>
                                                    <td className="px-4 py-3 text-gray-500">{timeAgo(doc.created_at)}</td>
                                                    <td className="px-4 py-3 text-gray-500 uppercase" dir="ltr">{doc.file_extension}</td>
                                                    <td className="px-3 py-3">
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                setSelected(`d-${doc.id}`);
                                                                const r = e.currentTarget.getBoundingClientRect();
                                                                setMenu({ x: r.left, y: r.bottom + 4, kind: 'doc', target: doc });
                                                            }}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                                                        >
                                                            <MoreVertical size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {visibleFolders.length === 0 && visibleDocs.length === 0 && !docsLoading && (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                                                    {q ? 'لا توجد نتائج مطابقة' : 'هذا المجلد فارغ'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Status bar */}
                    <div className="mt-4 flex items-center gap-3 text-[11px] text-gray-500 border-t border-gray-100 pt-3">
                        <span>
                            {location.type === 'root'
                                ? `${sectors.length} قطاع`
                                : `${visibleFolders.length} مجلدات · ${location.type === 'folder' ? visibleDocs.length : 0} ملفات`}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>نقرة لفتح المجلد · نقرتان لفتح الملف · كليك يمين للخيارات · سحب وإفلات أو Ctrl+X/C/V</span>
                    </div>
                </div>
            </div>

            {/* ===== Context menu ===== */}
            {menu && (
                <div
                    className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-56 text-sm"
                    style={{ top: Math.min(menu.y, window.innerHeight - 300), left: Math.min(menu.x, window.innerWidth - 230) }}
                    onClick={e => e.stopPropagation()}
                >
                    {menu.kind === 'folder' && (
                        <>
                            <MenuItem icon={FolderOpen} label="فتح" onClick={() => { navigate({ type: 'folder', sectorId: location.sectorId, folderId: menu.target.id }); setMenu(null); }} />
                            <MenuItem icon={FolderPlus} label="مجلد فرعي جديد" onClick={() => { navigate({ type: 'folder', sectorId: location.sectorId, folderId: menu.target.id }); setMenu(null); setTimeout(startCreate, 60); }} />
                            <MenuDivider />
                            <MenuItem icon={Edit2} label="إعادة تسمية" onClick={() => { startRename(menu.target); setMenu(null); }} />
                            <MenuItem icon={Copy} label="نسخ" shortcut="Ctrl+C" onClick={() => { copyItem('folder', menu.target); setMenu(null); }} />
                            <MenuItem icon={Scissors} label="نقل (قص)" shortcut="Ctrl+X" onClick={() => { cutItem('folder', menu.target); setMenu(null); }} />
                            <MenuItem
                                icon={ClipboardPaste}
                                label="لصق داخل المجلد"
                                disabled={!clipboard || !canPasteAt({ folderId: menu.target.id, sectorId: menu.target.sector_id ?? location.sectorId })}
                                onClick={() => { paste({ folderId: menu.target.id, sectorId: menu.target.sector_id ?? location.sectorId }); setMenu(null); }}
                            />
                            <MenuItem icon={Palette} label="خصائص" onClick={() => { setPropsFolder(menu.target); setMenu(null); }} />
                            <MenuDivider />
                            <MenuItem icon={Trash2} label="حذف" danger onClick={() => { deleteFolder(menu.target); setMenu(null); }} />
                        </>
                    )}
                    {menu.kind === 'doc' && (
                        <>
                            <MenuItem icon={ExternalLink} label="فتح الملف" onClick={() => router.visit(`/archive/documents/${menu.target.id}`)} />
                            <MenuItem icon={Download} label="تحميل" onClick={() => { window.location.href = `/archive/documents/${menu.target.id}/download`; setMenu(null); }} />
                            <MenuDivider />
                            <MenuItem icon={Scissors} label="نقل (قص)" shortcut="Ctrl+X" onClick={() => { cutItem('doc', menu.target); setMenu(null); }} />
                            <MenuItem icon={Copy} label="نسخ" shortcut="Ctrl+C" onClick={() => { copyItem('doc', menu.target); setMenu(null); }} />
                        </>
                    )}
                    {menu.kind === 'blank' && location.type !== 'root' && (
                        <>
                            <MenuItem icon={FolderPlus} label="مجلد جديد" onClick={() => { setMenu(null); startCreate(); }} />
                            <MenuItem icon={Upload} label="رفع ملفات" onClick={() => { setMenu(null); router.visit(uploadHref); }} />
                            <MenuDivider />
                            <MenuItem
                                icon={ClipboardPaste}
                                label="لصق"
                                shortcut="Ctrl+V"
                                disabled={!clipboard || !canPasteAt(currentTarget ?? {})}
                                onClick={() => { paste(currentTarget); setMenu(null); }}
                            />
                            <MenuItem icon={RefreshCw} label="تحديث" onClick={() => { setMenu(null); refreshAll(); }} />
                        </>
                    )}
                    {menu.kind === 'blank' && location.type === 'root' && (
                        <p className="px-3 py-2 text-xs text-gray-400">اختر قطاعاً أولاً</p>
                    )}
                </div>
            )}
        </>
    );
}

function MenuItem({ icon: Icon, label, onClick, danger = false, shortcut = null, disabled = false }) {
    return (
        <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-right transition-colors ${
                disabled
                    ? 'text-gray-300 cursor-default'
                    : danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
        >
            <Icon size={14} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {shortcut && <span className={`text-[10px] ${disabled ? 'text-gray-300' : 'text-gray-400'}`} dir="ltr">{shortcut}</span>}
        </button>
    );
}

function MenuDivider() {
    return <div className="my-1 border-t border-gray-100" />;
}

FoldersIndex.layout = page => <ArchiveLayout title="المجلدات" children={page} />;
