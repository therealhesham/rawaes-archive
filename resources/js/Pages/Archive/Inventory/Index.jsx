import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import SignaturePad from '@/Components/SignaturePad';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Camera, FolderPlus, Search, XCircle, ClipboardList, Hand, Handshake, RefreshCcw, ScrollText, Printer, Pencil, Trash2, PackageCheck, Pause, Play, Flag, FileDown } from 'lucide-react';
import { Combobox } from '@headlessui/react';

function formatDate(value) {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return String(value);
    }
}

function buildFolderPathMap(documentFolders) {
    const byId = new Map((documentFolders ?? []).map(f => [String(f.id), f]));
    const cache = new Map();

    const getPath = (id) => {
        const key = String(id);
        if (cache.has(key)) return cache.get(key);
        const node = byId.get(key);
        if (!node) return '';
        const parts = [];
        let cur = node;
        const guard = new Set();
        while (cur && !guard.has(String(cur.id))) {
            guard.add(String(cur.id));
            parts.unshift(cur.name);
            cur = cur.parent_id ? byId.get(String(cur.parent_id)) : null;
        }
        const path = parts.join(' / ');
        cache.set(key, path);
        return path;
    };

    return { getPath };
}

function classNames(...xs) {
    return xs.filter(Boolean).join(' ');
}

function Modal({ open, title, children, onClose }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50 text-gray-500">
                        <XCircle size={18} />
                    </button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

export default function InventoryIndex({ sectors, physicalFolders, documentFolders, canManage }) {
    const [tab, setTab] = useState('inventory'); // inventory | custody | archive_inventory
    const [folders, setFolders] = useState(physicalFolders ?? []);
    const [loadingList, setLoadingList] = useState(false);

    const [createData, setCreateData] = useState({
        sector_id: '',
        document_folder_id: '',
        name: '',
        description: '',
        location: '',
    });
    const [creating, setCreating] = useState(false);
    const [createdFolder, setCreatedFolder] = useState(null); // for print preview
    const [createError, setCreateError] = useState(null);

    const classificationOptions = useMemo(() => {
        const { getPath } = buildFolderPathMap(documentFolders);
        const sectorId = String(createData.sector_id || '');
        const list = documentFolders ?? [];
        const filtered = sectorId ? list.filter(f => String(f.sector_id) === sectorId) : [];
        return filtered
            .map(f => ({ id: f.id, name: getPath(f.id) || f.name, raw: f }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }, [documentFolders, createData.sector_id]);

    const selectedClassification = useMemo(() => {
        if (!createData.document_folder_id) return null;
        return classificationOptions.find(o => String(o.id) === String(createData.document_folder_id)) ?? null;
    }, [classificationOptions, createData.document_folder_id]);

    const [folderQuery, setFolderQuery] = useState('');
    const filteredClassificationOptions = useMemo(() => {
        const q = folderQuery.trim().toLowerCase();
        if (!q) return classificationOptions;
        return classificationOptions.filter(o => (o.name ?? '').toLowerCase().includes(q));
    }, [classificationOptions, folderQuery]);

    const [sectorFilter, setSectorFilter] = useState('');
    const [folderFilter, setFolderFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | available | checkedout
    const [search, setSearch] = useState('');

    const filteredFolders = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (folders ?? []).filter(f => {
            if (sectorFilter && String(f.sector_id) !== String(sectorFilter)) return false;
            if (folderFilter && String(f.document_folder_id) !== String(folderFilter)) return false;
            if (statusFilter === 'available' && f.is_checked_out) return false;
            if (statusFilter === 'checkedout' && !f.is_checked_out) return false;
            if (!q) return true;
            const hay = [
                f.name,
                f.inventory_code,
                f.qr_code,
                f.checked_out_to,
                f.sector?.name,
                f.location,
                f.description,
                f.document_folder?.name,
            ].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [folders, sectorFilter, folderFilter, statusFilter, search]);

    const [code, setCode] = useState('');
    const [lookup, setLookup] = useState({ loading: false, result: null, error: null });

    const videoRef = useRef(null);
    const readerRef = useRef(null);
    const controlsRef = useRef(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState(null);

    const [checkoutModal, setCheckoutModal] = useState({ open: false, folder: null });
    const [checkinModal, setCheckinModal] = useState({ open: false, folder: null });
    const [editModal, setEditModal] = useState({ open: false, folder: null });
    const [deleteModal, setDeleteModal] = useState({ open: false, folder: null });
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState(null);
    const [checkoutForm, setCheckoutForm] = useState({ to_person: '', notes: '', signature: '' });
    const [checkinForm, setCheckinForm] = useState({ notes: '', signature: '' });
    const [editForm, setEditForm] = useState({ sector_id: '', document_folder_id: '', name: '', description: '', location: '', is_active: true });
    const [stickerToPrint, setStickerToPrint] = useState(null); // { name, code }

    const refreshList = async () => {
        setLoadingList(true);
        try {
            const res = await axios.get('/archive/api/inventory/folders');
            setFolders(res.data.folders ?? []);
        } finally {
            setLoadingList(false);
        }
    };

    // Custody log (movements)
    const [movements, setMovements] = useState([]);
    const [movementsMeta, setMovementsMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 50 });
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [movementsQuery, setMovementsQuery] = useState('');
    const [movementsAction, setMovementsAction] = useState('');

    const loadMovements = async (page = 1) => {
        setMovementsLoading(true);
        try {
            const res = await axios.get('/archive/api/inventory/movements', {
                params: {
                    q: movementsQuery || undefined,
                    action: movementsAction || undefined,
                    page,
                    per_page: 50,
                }
            });
            const p = res.data.movements;
            setMovements(p?.data ?? []);
            setMovementsMeta({
                current_page: p?.current_page ?? 1,
                last_page: p?.last_page ?? 1,
                total: p?.total ?? 0,
                per_page: p?.per_page ?? 50,
            });
        } finally {
            setMovementsLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'custody') loadMovements(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    // Archive stocktaking audits
    const [auditList, setAuditList] = useState([]);
    const [auditListLoading, setAuditListLoading] = useState(false);
    const [activeAudit, setActiveAudit] = useState(null);
    const [auditSummary, setAuditSummary] = useState(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [startAuditModal, setStartAuditModal] = useState(false);
    const [startAuditForm, setStartAuditForm] = useState({ title: '', notes: '', include_inactive: false });
    const [auditActionError, setAuditActionError] = useState(null);
    const [auditScanCode, setAuditScanCode] = useState('');
    const [auditScanNotes, setAuditScanNotes] = useState('');
    const [auditScanResult, setAuditScanResult] = useState(null);
    const [auditItems, setAuditItems] = useState([]);
    const [auditItemsMeta, setAuditItemsMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 50 });
    const [auditItemsLoading, setAuditItemsLoading] = useState(false);
    const [auditItemsStatus, setAuditItemsStatus] = useState(''); // ''=all
    const [auditItemsQuery, setAuditItemsQuery] = useState('');

    const loadAudits = async () => {
        setAuditListLoading(true);
        try {
            const res = await axios.get('/archive/api/inventory/audits', { params: { per_page: 20 } });
            setAuditList(res.data.audits?.data ?? []);
        } finally {
            setAuditListLoading(false);
        }
    };

    const loadAudit = async (id) => {
        setAuditLoading(true);
        try {
            const res = await axios.get(`/archive/api/inventory/audits/${id}`);
            setActiveAudit(res.data.audit);
            setAuditSummary(res.data.summary);
        } finally {
            setAuditLoading(false);
        }
    };

    const loadAuditItems = async (page = 1) => {
        if (!activeAudit?.id) return;
        setAuditItemsLoading(true);
        try {
            const res = await axios.get(`/archive/api/inventory/audits/${activeAudit.id}/items`, {
                params: {
                    status: auditItemsStatus || undefined,
                    q: auditItemsQuery || undefined,
                    per_page: 50,
                    page,
                }
            });
            const p = res.data.items;
            setAuditItems(p?.data ?? []);
            setAuditItemsMeta({
                current_page: p?.current_page ?? 1,
                last_page: p?.last_page ?? 1,
                total: p?.total ?? 0,
                per_page: p?.per_page ?? 50,
            });
        } finally {
            setAuditItemsLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'archive_inventory') loadAudits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => {
        if (tab !== 'archive_inventory') return;
        if (activeAudit?.id) loadAuditItems(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAudit?.id, auditItemsStatus]);

    const startAudit = async () => {
        setAuditActionError(null);
        setAuditLoading(true);
        try {
            const res = await axios.post('/archive/api/inventory/audits', startAuditForm);
            setStartAuditModal(false);
            setStartAuditForm({ title: '', notes: '', include_inactive: false });
            await loadAudits();
            await loadAudit(res.data.audit.id);
            setAuditItemsStatus('');
        } catch (e) {
            setAuditActionError(e?.response?.data?.message ?? 'فشل بدء الجرد');
        } finally {
            setAuditLoading(false);
        }
    };

    const pauseAudit = async () => {
        if (!activeAudit?.id) return;
        setAuditActionError(null);
        await axios.post(`/archive/api/inventory/audits/${activeAudit.id}/pause`);
        await loadAudit(activeAudit.id);
    };
    const resumeAudit = async () => {
        if (!activeAudit?.id) return;
        setAuditActionError(null);
        await axios.post(`/archive/api/inventory/audits/${activeAudit.id}/resume`);
        await loadAudit(activeAudit.id);
    };
    const finishAudit = async () => {
        if (!activeAudit?.id) return;
        setAuditActionError(null);
        await axios.post(`/archive/api/inventory/audits/${activeAudit.id}/finish`, { mark_pending_missing: true });
        await loadAudit(activeAudit.id);
        await loadAuditItems(1);
    };

    const scanAudit = async () => {
        if (!activeAudit?.id) return;
        setAuditActionError(null);
        setAuditScanResult(null);
        const c = auditScanCode.trim();
        if (!c) return;
        try {
            const res = await axios.post(`/archive/api/inventory/audits/${activeAudit.id}/scan`, { code: c, notes: auditScanNotes || null });
            setAuditScanResult(res.data);
            setAuditScanCode('');
            setAuditScanNotes('');
            await loadAudit(activeAudit.id);
            await loadAuditItems(1);
        } catch (e) {
            setAuditActionError(e?.response?.data?.message ?? 'فشل المسح');
        }
    };

    const setAuditItemStatus = async (itemId, status) => {
        if (!activeAudit?.id) return;
        setAuditActionError(null);
        try {
            await axios.post(`/archive/api/inventory/audits/${activeAudit.id}/items/${itemId}/status`, { status });
            await loadAudit(activeAudit.id);
            await loadAuditItems(auditItemsMeta.current_page || 1);
        } catch (e) {
            setAuditActionError(e?.response?.data?.message ?? 'فشل تحديث الحالة');
        }
    };

    useEffect(() => {
        const handler = () => setStickerToPrint(null);
        window.addEventListener('afterprint', handler);
        return () => window.removeEventListener('afterprint', handler);
    }, []);

    const doLookup = async (nextCode) => {
        const finalCode = (nextCode ?? code ?? '').trim();
        if (!finalCode) return;

        setLookup({ loading: true, result: null, error: null });
        try {
            const res = await axios.get('/archive/api/inventory/lookup', { params: { code: finalCode } });
            setLookup({ loading: false, result: res.data, error: null });
        } catch (e) {
            setLookup({ loading: false, result: null, error: e?.response?.data?.message ?? 'فشل البحث' });
        }
    };

    const stopCamera = () => {
        try {
            controlsRef.current?.stop?.();
        } catch {}
        controlsRef.current = null;
        setCameraOpen(false);
    };

    const startCamera = async () => {
        setCameraError(null);
        setLookup({ loading: false, result: null, error: null });

        if (!readerRef.current) readerRef.current = new BrowserQRCodeReader();

        try {
            setCameraOpen(true);
            controlsRef.current = await readerRef.current.decodeFromVideoDevice(
                undefined,
                videoRef.current,
                (result, err) => {
                    if (result?.getText) {
                        const text = result.getText();
                        if (!text) return;
                        setCode(text);
                        stopCamera();
                        doLookup(text);
                    }
                    // ignore decode errors (no QR in frame)
                }
            );
        } catch (e) {
            stopCamera();
            setCameraError('تعذر فتح الكاميرا. تأكد من السماح للمتصفح باستخدام الكاميرا.');
        }
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    const createFolder = async (e) => {
        e.preventDefault();
        setCreateError(null);
        setCreatedFolder(null);
        setCreating(true);
        try {
            const res = await axios.post('/archive/inventory/folders', createData);
            setCreatedFolder(res.data.folder);
            await refreshList();
            setCreateData(prev => ({ ...prev, name: '', description: '' }));
        } catch (err) {
            setCreateError(err?.response?.data?.message ?? 'فشل إنشاء المجلد');
        } finally {
            setCreating(false);
        }
    };

    const openCheckout = (folder) => {
        setActionError(null);
        setCheckoutForm({ to_person: '', notes: '', signature: '' });
        setCheckoutModal({ open: true, folder });
    };

    const openCheckin = (folder) => {
        setActionError(null);
        setCheckinForm({ notes: '', signature: '' });
        setCheckinModal({ open: true, folder });
    };

    const openEdit = (folder) => {
        setActionError(null);
        setEditForm({
            sector_id: folder?.sector_id ?? '',
            document_folder_id: folder?.document_folder_id ?? '',
            name: folder?.name ?? '',
            description: folder?.description ?? '',
            location: folder?.location ?? '',
            is_active: folder?.is_active ?? true,
        });
        setEditModal({ open: true, folder });
    };

    const openDelete = (folder) => {
        setActionError(null);
        setDeleteModal({ open: true, folder });
    };

    const confirmDelete = async () => {
        if (!deleteModal.folder) return;
        setActionLoading(true);
        setActionError(null);
        try {
            const res = await axios.delete(`/archive/api/inventory/folders/${deleteModal.folder.id}`);
            const deletedId = res?.data?.deleted_id ?? deleteModal.folder.id;
            setFolders(prev => (prev ?? []).filter(x => x.id !== deletedId));
            setDeleteModal({ open: false, folder: null });
        } catch (e) {
            setActionError(e?.response?.data?.message ?? 'فشل الحذف');
        } finally {
            setActionLoading(false);
        }
    };

    const submitCheckout = async () => {
        if (!checkoutModal.folder) return;
        setActionLoading(true);
        setActionError(null);
        try {
            await axios.post(`/archive/api/inventory/folders/${checkoutModal.folder.id}/checkout`, checkoutForm);
            setCheckoutModal({ open: false, folder: null });
            await refreshList();
        } catch (e) {
            setActionError(e?.response?.data?.message ?? 'فشل التسليم');
        } finally {
            setActionLoading(false);
        }
    };

    const submitCheckin = async () => {
        if (!checkinModal.folder) return;
        setActionLoading(true);
        setActionError(null);
        try {
            await axios.post(`/archive/api/inventory/folders/${checkinModal.folder.id}/checkin`, checkinForm);
            setCheckinModal({ open: false, folder: null });
            await refreshList();
        } catch (e) {
            setActionError(e?.response?.data?.message ?? 'فشل الاستلام');
        } finally {
            setActionLoading(false);
        }
    };

    const submitEdit = async () => {
        if (!editModal.folder) return;
        setActionLoading(true);
        setActionError(null);
        try {
            await axios.put(`/archive/api/inventory/folders/${editModal.folder.id}`, {
                ...editForm,
                sector_id: editForm.sector_id || null,
                document_folder_id: editForm.document_folder_id || null,
            });
            setEditModal({ open: false, folder: null });
            await refreshList();
        } catch (e) {
            setActionError(e?.response?.data?.message ?? 'فشل التعديل');
        } finally {
            setActionLoading(false);
        }
    };

    const printSticker = (folder) => {
        const codeValue = folder?.inventory_code ?? folder?.qr_code;
        if (!codeValue) return;
        setStickerToPrint({ name: folder?.name ?? '', code: codeValue });
        setTimeout(() => window.print(), 250);
    };

    return (
        <>
            <Head title="الجرد" />

            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-sticker, .print-sticker * { visibility: visible !important; }
                    .print-sticker { position: fixed !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: white !important; }
                }
            `}</style>

            {stickerToPrint && (
                <div className="print-sticker hidden print:flex">
                    <div className="flex flex-col items-center gap-2 p-2">
                        {stickerToPrint.name && (
                            <div className="text-[12px] font-bold text-gray-900 text-center max-w-[240px]">{stickerToPrint.name}</div>
                        )}
                        <div className="border border-gray-300 rounded-xl p-2">
                            <QRCodeSVG value={stickerToPrint.code} size={140} />
                        </div>
                        <div className="font-mono text-[14px] font-extrabold tracking-wider" dir="ltr">{stickerToPrint.code}</div>
                    </div>
                </div>
            )}

            <div className="bg-gradient-to-l from-blue-50 via-amber-50 to-blue-50 border border-amber-200 rounded-2xl p-5 mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 rounded-xl">
                        <ClipboardList size={22} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="font-bold text-gray-900 text-lg">إدارة الأرشيف</h2>
                        <p className="text-sm text-gray-700">ترميز الملفات الورقية + العهد + جرد الأرشيف</p>
                    </div>
                    <button
                        onClick={refreshList}
                        disabled={loadingList}
                        className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-amber-200 bg-white hover:bg-amber-50 disabled:opacity-50"
                    >
                        <RefreshCcw size={14} />
                        تحديث
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-2 mb-5 flex gap-2">
                <button
                    onClick={() => setTab('inventory')}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                        tab === 'inventory' ? 'bg-amber-500 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <ClipboardList size={16} />
                    الترميز
                </button>
                <button
                    onClick={() => setTab('custody')}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                        tab === 'custody' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <ScrollText size={16} />
                    العهد
                </button>
                <button
                    onClick={() => setTab('archive_inventory')}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                        tab === 'archive_inventory' ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <PackageCheck size={16} />
                    جرد الأرشيف
                </button>
            </div>

            {tab === 'archive_inventory' ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 xl:col-span-1">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-gray-800">جرودات الأرشيف</h3>
                                <p className="text-xs text-gray-500">بدء/إيقاف/استئناف/إنهاء + تقرير</p>
                            </div>
                            {canManage && (
                                <button
                                    onClick={() => { setAuditActionError(null); setStartAuditModal(true); }}
                                    className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <PackageCheck size={14} />
                                    بدء جرد
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {auditListLoading ? (
                                <div className="text-sm text-gray-400 p-4">جاري التحميل...</div>
                            ) : auditList.length === 0 ? (
                                <div className="text-sm text-gray-400 p-4">لا يوجد جرودات بعد</div>
                            ) : (
                                auditList.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => loadAudit(a.id)}
                                        className={`w-full text-right p-3 rounded-xl border transition-colors ${
                                            String(activeAudit?.id) === String(a.id) ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-bold text-gray-800 text-sm truncate">{a.title ?? `جرد #${a.id}`}</div>
                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                                                a.status === 'completed' ? 'bg-gray-200 text-gray-700' : a.status === 'paused' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                            }`}>{a.status === 'completed' ? 'منتهي' : a.status === 'paused' ? 'متوقف' : 'نشط'}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            بدء: {formatDate(a.started_at)}
                                            {a.ended_at ? ` — نهاية: ${formatDate(a.ended_at)}` : ''}
                                        </div>
                                        {a.starter?.name && (
                                            <div className="text-xs text-gray-500 mt-1">بواسطة: {a.starter.name}</div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-5 xl:col-span-2">
                        {!activeAudit ? (
                            <div className="text-center text-gray-400 p-16">اختر جرداً من القائمة أو ابدأ جرد جديد</div>
                        ) : (
                            <>
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-800">{activeAudit.title ?? `جرد #${activeAudit.id}`}</h3>
                                        <p className="text-xs text-gray-500">
                                            الحالة: {activeAudit.status === 'completed' ? 'منتهي' : activeAudit.status === 'paused' ? 'متوقف مؤقتاً' : 'نشط'}
                                            {' — '}بدء: {formatDate(activeAudit.started_at)}
                                            {activeAudit.ended_at ? ` — نهاية: ${formatDate(activeAudit.ended_at)}` : ''}
                                        </p>
                                    </div>

                                    {canManage && (
                                        <div className="flex gap-2 flex-wrap">
                                            {activeAudit.status === 'running' && (
                                                <button onClick={pauseAudit} className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50">
                                                    <Pause size={14} /> إيقاف مؤقت
                                                </button>
                                            )}
                                            {activeAudit.status === 'paused' && (
                                                <button onClick={resumeAudit} className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50">
                                                    <Play size={14} /> استئناف
                                                </button>
                                            )}
                                            {activeAudit.status !== 'completed' && (
                                                <button onClick={finishAudit} className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white">
                                                    <Flag size={14} /> إنهاء الجرد
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {auditActionError && (
                                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-4">{auditActionError}</div>
                                )}

                                {auditSummary && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                            <div className="text-xs text-gray-500">الإجمالي</div>
                                            <div className="text-lg font-extrabold text-gray-800">{auditSummary.total}</div>
                                        </div>
                                        <div className="rounded-xl border border-gray-100 bg-amber-50 p-3">
                                            <div className="text-xs text-amber-700">بانتظار</div>
                                            <div className="text-lg font-extrabold text-amber-900">{auditSummary.pending}</div>
                                        </div>
                                        <div className="rounded-xl border border-gray-100 bg-emerald-50 p-3">
                                            <div className="text-xs text-emerald-700">تم العثور</div>
                                            <div className="text-lg font-extrabold text-emerald-900">{auditSummary.found}</div>
                                        </div>
                                        <div className="rounded-xl border border-gray-100 bg-red-50 p-3">
                                            <div className="text-xs text-red-700">مفقود</div>
                                            <div className="text-lg font-extrabold text-red-900">{auditSummary.missing}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">مسح ملف داخل الجرد</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={auditScanCode}
                                                onChange={(e) => setAuditScanCode(e.target.value)}
                                                className="flex-1 rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 font-mono"
                                                placeholder="امسح QR أو الصق الكود"
                                                dir="ltr"
                                                disabled={activeAudit.status !== 'running'}
                                            />
                                            <button
                                                onClick={scanAudit}
                                                disabled={activeAudit.status !== 'running'}
                                                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg px-4"
                                            >
                                                <Search size={16} /> تسجيل
                                            </button>
                                        </div>
                                        <textarea
                                            value={auditScanNotes}
                                            onChange={(e) => setAuditScanNotes(e.target.value)}
                                            className="mt-2 w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                                            rows={2}
                                            placeholder="ملاحظات (اختياري)"
                                            disabled={activeAudit.status !== 'running'}
                                        />
                                        {auditScanResult && (
                                            <div className={`mt-2 text-xs rounded-lg p-3 border ${
                                                auditScanResult.found ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-700'
                                            }`}>
                                                {auditScanResult.found
                                                    ? `تم تسجيل: ${auditScanResult.folder?.name ?? ''} (${auditScanResult.folder?.inventory_code ?? ''})`
                                                    : 'الكود غير موجود في النظام أو خارج نطاق الجرد'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5">فلترة عناصر الجرد</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {[
                                                { key: '', label: `الكل (${auditSummary?.total ?? '—'})` },
                                                { key: 'pending', label: `بانتظار (${auditSummary?.pending ?? '—'})` },
                                                { key: 'found', label: `تم العثور (${auditSummary?.found ?? '—'})` },
                                                { key: 'missing', label: `مفقود (${auditSummary?.missing ?? '—'})` },
                                            ].map(t => (
                                                <button
                                                    key={t.key || 'all'}
                                                    type="button"
                                                    onClick={() => setAuditItemsStatus(t.key)}
                                                    className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${
                                                        auditItemsStatus === t.key
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                                                    }`}
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                        <input
                                            value={auditItemsQuery}
                                            onChange={(e) => setAuditItemsQuery(e.target.value)}
                                            className="w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                                            placeholder="بحث داخل العناصر..."
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => loadAuditItems(1)}
                                                className="flex-1 inline-flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                                            >
                                                <Search size={14} /> تطبيق
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!activeAudit?.id) return;
                                                    window.location.href = `/archive/api/inventory/audits/${activeAudit.id}/report.csv`;
                                                }}
                                                className="inline-flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                title="تصدير تقرير CSV"
                                            >
                                                <FileDown size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-600">
                                            <tr>
                                                <th className="text-right p-3 font-bold">الملف</th>
                                                <th className="text-right p-3 font-bold">الكود</th>
                                                <th className="text-right p-3 font-bold">الموقع</th>
                                                <th className="text-right p-3 font-bold">الحالة</th>
                                                <th className="text-right p-3 font-bold">آخر مسح</th>
                                                <th className="text-right p-3 font-bold">المستخدم</th>
                                                <th className="text-right p-3 font-bold">ملاحظات</th>
                                                <th className="text-right p-3 font-bold">إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {auditItemsLoading ? (
                                                <tr><td colSpan={8} className="p-8 text-center text-gray-400">جاري التحميل...</td></tr>
                                            ) : auditItems.length === 0 ? (
                                                <tr><td colSpan={8} className="p-8 text-center text-gray-400">لا يوجد عناصر</td></tr>
                                            ) : auditItems.map(i => (
                                                <tr key={i.id} className="border-t bg-white hover:bg-gray-50">
                                                    <td className="p-3">
                                                        <div className="font-bold text-gray-800">{i.folder?.name ?? '—'}</div>
                                                        {i.folder?.sector?.name && <div className="text-xs text-gray-500 mt-1">القطاع: {i.folder.sector.name}</div>}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-mono text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 inline-block" dir="ltr">
                                                            {i.folder?.inventory_code ?? i.expected_code}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-gray-700">{i.folder?.location ?? '—'}</td>
                                                    <td className="p-3">
                                                        {i.status === 'found' ? (
                                                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">تم العثور</span>
                                                        ) : i.status === 'missing' ? (
                                                            <div className="space-y-1">
                                                                <span className="inline-flex text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">مفقود</span>
                                                                {i.folder?.is_checked_out && i.folder?.checked_out_to ? (
                                                                    <div className="text-[11px] font-bold text-red-700">
                                                                        مسلّمة عهدة لـ: {i.folder.checked_out_to}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">بانتظار</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-gray-700">{formatDate(i.scanned_at)}</td>
                                                    <td className="p-3 text-gray-700">{i.scanner?.name ?? '—'}</td>
                                                    <td className="p-3 text-gray-600 text-xs max-w-[320px] truncate">{i.notes ?? '—'}</td>
                                                    <td className="p-3">
                                                        {canManage && activeAudit.status !== 'completed' ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAuditItemStatus(i.id, 'found')}
                                                                    className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                                                                    disabled={auditItemsLoading || i.status === 'found'}
                                                                >
                                                                    موجود
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAuditItemStatus(i.id, 'missing')}
                                                                    className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                                    disabled={auditItemsLoading || i.status === 'missing'}
                                                                >
                                                                    مفقود
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                                    <div>الإجمالي: {auditItemsMeta.total}</div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => loadAuditItems(Math.max(1, auditItemsMeta.current_page - 1))}
                                            disabled={auditItemsLoading || auditItemsMeta.current_page <= 1}
                                            className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            السابق
                                        </button>
                                        <div className="px-2">
                                            صفحة {auditItemsMeta.current_page} / {auditItemsMeta.last_page}
                                        </div>
                                        <button
                                            onClick={() => loadAuditItems(Math.min(auditItemsMeta.last_page, auditItemsMeta.current_page + 1))}
                                            disabled={auditItemsLoading || auditItemsMeta.current_page >= auditItemsMeta.last_page}
                                            className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            التالي
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : tab === 'custody' ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">بحث</label>
                                <input
                                    value={movementsQuery}
                                    onChange={(e) => setMovementsQuery(e.target.value)}
                                    className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    placeholder="ملف/كود/مستلم/مُسلم/ملاحظات..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">العملية</label>
                                <select
                                    value={movementsAction}
                                    onChange={(e) => setMovementsAction(e.target.value)}
                                    className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="">الكل</option>
                                    <option value="checkout">تسليم</option>
                                    <option value="checkin">استلام</option>
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={() => loadMovements(1)}
                            disabled={movementsLoading}
                            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg px-4 py-2.5"
                        >
                            <Search size={16} />
                            {movementsLoading ? '...' : 'تحديث'}
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-right p-3 font-bold">النوع</th>
                                    <th className="text-right p-3 font-bold">العنصر</th>
                                    <th className="text-right p-3 font-bold">الكود</th>
                                    <th className="text-right p-3 font-bold">العملية</th>
                                    <th className="text-right p-3 font-bold">تم تسليمه إلى</th>
                                    <th className="text-right p-3 font-bold">من قام</th>
                                    <th className="text-right p-3 font-bold">التاريخ</th>
                                    <th className="text-right p-3 font-bold">التوقيع</th>
                                    <th className="text-right p-3 font-bold">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movementsLoading ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-400">جاري التحميل...</td></tr>
                                ) : movements.length === 0 ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-400">لا يوجد سجل</td></tr>
                                ) : (
                                    movements.map(m => (
                                        <tr key={m.id} className="border-t bg-white hover:bg-gray-50 transition-colors">
                                            <td className="p-3">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                    m.type === 'document' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {m.type === 'document' ? 'مستند' : 'ملف ورقي'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800">{m.subject?.name ?? '—'}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {m.subject?.sector?.name ? `القطاع: ${m.subject.sector.name}` : ''}
                                                    {m.subject?.location ? ` — موقع: ${m.subject.location}` : ''}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-mono text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 inline-block" dir="ltr">
                                                    {m.subject?.code ?? '—'}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {m.action === 'checkout' ? (
                                                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">تسليم</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">استلام</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-gray-700">{m.to_person ?? '—'}</td>
                                            <td className="p-3 text-gray-700">{m.created_by?.name ?? '—'}</td>
                                            <td className="p-3 text-gray-700">{formatDate(m.created_at)}</td>
                                            <td className="p-3">
                                                {m.signature_url ? (
                                                    <a
                                                        href={m.signature_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs font-bold text-blue-700 hover:underline"
                                                    >
                                                        عرض
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-gray-600 text-xs max-w-[340px] truncate">{m.notes ?? '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                        <div>الإجمالي: {movementsMeta.total}</div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => loadMovements(Math.max(1, movementsMeta.current_page - 1))}
                                disabled={movementsLoading || movementsMeta.current_page <= 1}
                                className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                            >
                                السابق
                            </button>
                            <div className="px-2">
                                صفحة {movementsMeta.current_page} / {movementsMeta.last_page}
                            </div>
                            <button
                                onClick={() => loadMovements(Math.min(movementsMeta.last_page, movementsMeta.current_page + 1))}
                                disabled={movementsLoading || movementsMeta.current_page >= movementsMeta.last_page}
                                className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                            >
                                التالي
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Left: Create folder */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 xl:col-span-1 xl:sticky xl:top-5 h-fit">
                    <div className="flex items-start justify-between gap-3 mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-amber-500 rounded-xl text-white">
                                <FolderPlus size={18} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-gray-900">ترميز ملف ورقي</h3>
                                <p className="text-xs text-gray-500">اختيار القطاع + المجلد ثم إنشاء كود و QR</p>
                            </div>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1">QR = Code</div>
                    </div>

                    {!canManage && (
                        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
                            لا تملك صلاحية إنشاء/تسليم/استلام (تحتاج: <span className="font-mono">inventory.manage</span>)
                        </div>
                    )}

                    <form onSubmit={createFolder} className="space-y-4">
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5">القطاع</label>
                                <select
                                    value={createData.sector_id}
                                    onChange={(e) => { setCreateData(d => ({ ...d, sector_id: e.target.value, document_folder_id: '' })); setFolderQuery(''); }}
                                    className="w-full rounded-xl border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                                    disabled={!canManage}
                                >
                                    <option value="">اختر القطاع</option>
                                    {sectors?.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5">المجلد (رئيسي/فرعي)</label>
                                <Combobox
                                    value={selectedClassification}
                                    onChange={(opt) => setCreateData(d => ({ ...d, document_folder_id: opt?.id ? String(opt.id) : '' }))}
                                    disabled={!canManage || !createData.sector_id}
                                >
                                    <div className="relative">
                                        <Combobox.Input
                                            className="w-full rounded-xl border-gray-200 focus:border-amber-500 focus:ring-amber-500 pr-3 pl-10 py-2 text-sm disabled:bg-gray-50"
                                            displayValue={(opt) => opt?.name ?? ''}
                                            onChange={(event) => setFolderQuery(event.target.value)}
                                            placeholder={createData.sector_id ? 'ابحث واختر المجلد...' : 'اختر القطاع أولاً'}
                                        />
                                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <Search size={16} />
                                        </div>

                                        <Combobox.Options className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl bg-white p-1 shadow-xl border border-gray-100 focus:outline-none">
                                            {filteredClassificationOptions.length === 0 ? (
                                                <div className="px-3 py-3 text-sm text-gray-500">لا توجد نتائج</div>
                                            ) : (
                                                filteredClassificationOptions.slice(0, 200).map((opt) => (
                                                    <Combobox.Option
                                                        key={opt.id}
                                                        value={opt}
                                                        className={({ active }) =>
                                                            classNames(
                                                                'cursor-pointer select-none rounded-xl px-3 py-2 text-sm',
                                                                active ? 'bg-amber-50 text-amber-900' : 'text-gray-800'
                                                            )
                                                        }
                                                    >
                                                        <div className="font-medium">{opt.name}</div>
                                                    </Combobox.Option>
                                                ))
                                            )}
                                        </Combobox.Options>
                                    </div>
                                </Combobox>
                                {createData.sector_id && classificationOptions.length > 200 && (
                                    <div className="text-[11px] text-gray-400 mt-1">يتم عرض أول 200 نتيجة — استخدم البحث</div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold text-gray-700 mb-1.5">اسم الترميز (اختياري)</label>
                            <input
                                value={createData.name}
                                onChange={(e) => setCreateData(d => ({ ...d, name: e.target.value }))}
                                className="w-full rounded-xl border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                                placeholder="اتركه فارغاً ليأخذ مسار المجلد تلقائياً"
                                disabled={!canManage}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold text-gray-700 mb-1.5">الموقع (اختياري)</label>
                            <input
                                value={createData.location}
                                onChange={(e) => setCreateData(d => ({ ...d, location: e.target.value }))}
                                className="w-full rounded-xl border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                                placeholder="مثال: غرفة 2 / رف A / صندوق 7"
                                disabled={!canManage}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold text-gray-700 mb-1.5">ملاحظات (اختياري)</label>
                            <textarea
                                value={createData.description}
                                onChange={(e) => setCreateData(d => ({ ...d, description: e.target.value }))}
                                className="w-full rounded-xl border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                                rows={2}
                                placeholder="ماذا يحتوي هذا الملف؟"
                                disabled={!canManage}
                            />
                        </div>

                        {createError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                {createError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={creating || !canManage || !createData.sector_id || !createData.document_folder_id}
                            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold rounded-xl py-3 transition-colors shadow-sm"
                        >
                            <FolderPlus size={16} />
                            {creating ? 'جاري الإنشاء...' : 'إنشاء'}
                        </button>
                    </form>

                    {createdFolder?.inventory_code && (
                        <div className="mt-5 border-t border-gray-100 pt-5">
                            <div className="flex items-start gap-4">
                                <div className="bg-white border border-gray-200 rounded-xl p-3">
                                    <QRCodeSVG value={createdFolder.inventory_code} size={140} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-gray-800">{createdFolder.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">الكود القصير (للصق/طباعة)</p>
                                    <p className="text-xs text-gray-400 mt-2 font-mono" dir="ltr">{createdFolder.inventory_code}</p>
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="mt-3 inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                                    >
                                        طباعة
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Table + Scan */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 xl:col-span-2">
                    <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">بحث</label>
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    placeholder="اسم/كود/مستلم/موقع..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">القطاع</label>
                                <select
                                    value={sectorFilter}
                                    onChange={(e) => { setSectorFilter(e.target.value); setFolderFilter(''); }}
                                    className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="">الكل</option>
                                    {sectors?.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">المجلد</label>
                                <select
                                    value={folderFilter}
                                    onChange={(e) => setFolderFilter(e.target.value)}
                                    className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                    disabled={!sectorFilter}
                                >
                                    <option value="">الكل</option>
                                    {(() => {
                                        const { getPath } = buildFolderPathMap(documentFolders);
                                        return (documentFolders ?? [])
                                            .filter(f => String(f.sector_id) === String(sectorFilter))
                                            .map(f => ({ id: f.id, name: getPath(f.id) || f.name }))
                                            .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                                            .map(f => <option key={f.id} value={f.id}>{f.name}</option>);
                                    })()}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">الحالة</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="all">الكل</option>
                                    <option value="available">متاح</option>
                                    <option value="checkedout">مُسلّم</option>
                                </select>
                            </div>
                        </div>

                        {/* Scan quick verify */}
                        <div className="lg:w-[420px]">
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">تحقق سريع (QR/كود)</label>
                            <div className="flex gap-2">
                                <input
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="flex-1 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
                                    placeholder="امسح بالكاميرا أو الصق الكود"
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => doLookup()}
                                    disabled={lookup.loading}
                                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg px-3"
                                >
                                    <Search size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => (cameraOpen ? stopCamera() : startCamera())}
                                    className={`inline-flex items-center justify-center font-bold rounded-lg px-3 border transition-colors ${
                                        cameraOpen ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                    title={cameraOpen ? 'إيقاف الكاميرا' : 'فتح الكاميرا'}
                                >
                                    {cameraOpen ? <XCircle size={18} /> : <Camera size={18} />}
                                </button>
                            </div>

                            {cameraError && (
                                <div className="text-xs text-red-600 mt-2">{cameraError}</div>
                            )}

                            {cameraOpen && (
                                <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 bg-black">
                                    <video ref={videoRef} className="w-full h-44 object-cover" muted playsInline />
                                </div>
                            )}

                            {lookup.result?.found === false && (
                                <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
                                    غير موجود
                                </div>
                            )}
                            {lookup.result?.found === true && (
                                <div className="mt-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                    موجود: {lookup.result.folder?.name}
                                    {lookup.result.folder?.document_folder?.name && (
                                        <span className="text-emerald-900"> — تصنيف: {lookup.result.folder.document_folder.name}</span>
                                    )}
                                    {lookup.result.folder?.location && (
                                        <span className="text-emerald-900"> — موقع: {lookup.result.folder.location}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-right p-3 font-bold">الملف الورقي</th>
                                    <th className="text-right p-3 font-bold">القطاع</th>
                                    <th className="text-right p-3 font-bold">تصنيف النظام</th>
                                    <th className="text-right p-3 font-bold">الموقع</th>
                                    <th className="text-right p-3 font-bold">الكود</th>
                                    <th className="text-right p-3 font-bold">QR</th>
                                    <th className="text-right p-3 font-bold">الحالة</th>
                                    <th className="text-right p-3 font-bold">التسليم</th>
                                    <th className="text-right p-3 font-bold">طباعة</th>
                                    <th className="text-right p-3 font-bold">تعديل</th>
                                    <th className="text-right p-3 font-bold">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFolders.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-gray-400">لا توجد نتائج</td>
                                    </tr>
                                ) : (
                                    filteredFolders.map(f => (
                                        <tr
                                            key={f.id}
                                            className={`border-t ${f.is_checked_out ? 'bg-red-50' : 'bg-white'} hover:bg-gray-50 transition-colors`}
                                        >
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800">{f.name}</div>
                                                {f.description && (
                                                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{f.description}</div>
                                                )}
                                            </td>
                                            <td className="p-3 text-gray-700">{f.sector?.name ?? '—'}</td>
                                            <td className="p-3 text-gray-700">{f.document_folder?.name ?? '—'}</td>
                                            <td className="p-3 text-gray-700">{f.location ?? '—'}</td>
                                            <td className="p-3">
                                                <div className="font-mono text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 inline-block" dir="ltr">
                                                    {f.inventory_code ?? f.qr_code ?? '—'}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="bg-white border border-gray-200 rounded-lg p-2 inline-block">
                                                    <QRCodeSVG value={f.inventory_code ?? f.qr_code ?? ''} size={56} />
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {f.is_checked_out ? (
                                                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">مُسلّم</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">متاح</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {f.is_checked_out ? (
                                                    <div className="text-xs text-gray-700">
                                                        <div>إلى: <span className="font-bold">{f.checked_out_to ?? '—'}</span></div>
                                                        <div className="text-gray-500 mt-1">{formatDate(f.checked_out_at)}</div>
                                                        {f.checked_out_notes && (
                                                            <div className="text-gray-500 mt-1 line-clamp-2">{f.checked_out_notes}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-2">
                                                    {canManage ? (
                                                        f.is_checked_out ? (
                                                            <button
                                                                onClick={() => openCheckin(f)}
                                                                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            >
                                                                <Hand size={14} />
                                                                استلام
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => openCheckout(f)}
                                                                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                                                            >
                                                                <Handshake size={14} />
                                                                تسليم
                                                            </button>
                                                        )
                                                    ) : (
                                                        <span className="text-xs text-gray-400">بدون صلاحية</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => printSticker(f)}
                                                    className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                >
                                                    <Printer size={14} />
                                                    طباعة
                                                </button>
                                            </td>
                                            <td className="p-3">
                                                {canManage ? (
                                                    <button
                                                        onClick={() => openEdit(f)}
                                                        className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                                                    >
                                                        <Pencil size={14} />
                                                        تعديل
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {canManage ? (
                                                    <button
                                                        onClick={() => openDelete(f)}
                                                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                                                        title="حذف الترميز"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            )}

            <Modal
                open={deleteModal.open}
                title={`حذف ترميز: ${deleteModal.folder?.name ?? ''}`}
                onClose={() => setDeleteModal({ open: false, folder: null })}
            >
                {actionError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
                        {actionError}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="text-sm text-gray-700">
                        سيتم حذف هذا الترميز نهائياً. (لن يؤثر على مجلدات النظام، فقط هذا السجل الخاص بالترميز)
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setDeleteModal({ open: false, folder: null })}
                            className="flex-1 inline-flex items-center justify-center rounded-xl border border-gray-200 py-2.5 font-bold text-gray-700 hover:bg-gray-50"
                            disabled={actionLoading}
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="flex-1 inline-flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 py-2.5 font-bold text-white disabled:opacity-50"
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'جاري الحذف...' : 'حذف'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={startAuditModal}
                title="بدء جرد أرشيف جديد"
                onClose={() => setStartAuditModal(false)}
            >
                {auditActionError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-3">{auditActionError}</div>
                )}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">عنوان الجرد (اختياري)</label>
                        <input
                            value={startAuditForm.title}
                            onChange={(e) => setStartAuditForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                            placeholder="مثال: جرد نهاية الشهر"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظات البداية (اختياري)</label>
                        <textarea
                            value={startAuditForm.notes}
                            onChange={(e) => setStartAuditForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                            rows={3}
                        />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={!!startAuditForm.include_inactive}
                            onChange={(e) => setStartAuditForm(f => ({ ...f, include_inactive: e.target.checked }))}
                        />
                        تضمين الملفات غير النشطة
                    </label>
                    <button
                        onClick={startAudit}
                        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg py-2.5"
                    >
                        <PackageCheck size={16} /> بدء
                    </button>
                </div>
            </Modal>

            <Modal
                open={checkoutModal.open}
                title={`تسليم ملف: ${checkoutModal.folder?.name ?? ''}`}
                onClose={() => setCheckoutModal({ open: false, folder: null })}
            >
                {actionError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
                        {actionError}
                    </div>
                )}

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">تم تسليمه إلى</label>
                        <input
                            value={checkoutForm.to_person}
                            onChange={(e) => setCheckoutForm(f => ({ ...f, to_person: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-red-500 focus:ring-red-500"
                            placeholder="اسم الشخص/الجهة"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظات (اختياري)</label>
                        <textarea
                            value={checkoutForm.notes}
                            onChange={(e) => setCheckoutForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-red-500 focus:ring-red-500"
                            rows={3}
                            placeholder="مثال: للاطلاع/مراجعة عقد..."
                        />
                    </div>
                    <SignaturePad
                        value={checkoutForm.signature}
                        onChange={(sig) => setCheckoutForm(f => ({ ...f, signature: sig }))}
                        label="توقيع المستلم عند التسليم"
                    />
                    <button
                        onClick={submitCheckout}
                        disabled={actionLoading || !checkoutForm.to_person.trim() || !checkoutForm.signature}
                        className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg py-2.5"
                    >
                        <Handshake size={16} />
                        {actionLoading ? '...' : 'تأكيد التسليم'}
                    </button>
                </div>
            </Modal>

            <Modal
                open={checkinModal.open}
                title={`استلام ملف: ${checkinModal.folder?.name ?? ''}`}
                onClose={() => setCheckinModal({ open: false, folder: null })}
            >
                {actionError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
                        {actionError}
                    </div>
                )}

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4 text-sm">
                    <div className="text-gray-700">
                        تم تسليمه إلى: <span className="font-bold">{checkinModal.folder?.checked_out_to ?? '—'}</span>
                    </div>
                    <div className="text-gray-500 mt-1">التاريخ: {formatDate(checkinModal.folder?.checked_out_at)}</div>
                    {checkinModal.folder?.checked_out_notes && (
                        <div className="text-gray-500 mt-2">ملاحظات التسليم: {checkinModal.folder.checked_out_notes}</div>
                    )}
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظات الاستلام (اختياري)</label>
                        <textarea
                            value={checkinForm.notes}
                            onChange={(e) => setCheckinForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                            rows={3}
                            placeholder="مثال: تم الاستلام بحالة جيدة..."
                        />
                    </div>
                    <SignaturePad
                        value={checkinForm.signature}
                        onChange={(sig) => setCheckinForm(f => ({ ...f, signature: sig }))}
                        label="توقيع المستلم عند الاستلام"
                    />
                    <button
                        onClick={submitCheckin}
                        disabled={actionLoading || !checkinForm.signature}
                        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg py-2.5"
                    >
                        <Hand size={16} />
                        {actionLoading ? '...' : 'تأكيد الاستلام'}
                    </button>
                </div>
            </Modal>

            <Modal
                open={editModal.open}
                title={`تعديل ملف: ${editModal.folder?.name ?? ''}`}
                onClose={() => setEditModal({ open: false, folder: null })}
            >
                {actionError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
                        {actionError}
                    </div>
                )}

                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">القطاع</label>
                            <select
                                value={editForm.sector_id}
                                onChange={(e) => setEditForm(f => ({ ...f, sector_id: e.target.value, document_folder_id: '' }))}
                                className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            >
                                <option value="">بدون</option>
                                {sectors?.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">تصنيف النظام (اختياري)</label>
                            <select
                                value={editForm.document_folder_id}
                                onChange={(e) => setEditForm(f => ({ ...f, document_folder_id: e.target.value }))}
                                className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            >
                                <option value="">بدون</option>
                                {(editForm.sector_id
                                    ? (documentFolders ?? []).filter(d => String(d.sector_id) === String(editForm.sector_id))
                                    : (documentFolders ?? [])
                                ).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">اسم الملف</label>
                        <input
                            value={editForm.name}
                            onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">الموقع</label>
                        <input
                            value={editForm.location}
                            onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="غرفة/رف/صندوق..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">الوصف</label>
                        <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                            rows={3}
                        />
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={!!editForm.is_active}
                            onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                        />
                        نشط
                    </label>

                    <button
                        onClick={submitEdit}
                        disabled={actionLoading || !editForm.name.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg py-2.5"
                    >
                        <Pencil size={16} />
                        {actionLoading ? '...' : 'حفظ التعديل'}
                    </button>
                </div>
            </Modal>
        </>
    );
}

InventoryIndex.layout = page => <ArchiveLayout title="الجرد" children={page} />;
