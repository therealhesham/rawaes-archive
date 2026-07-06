import { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { FolderInput, Loader2, Search } from 'lucide-react';

export default function MoveDocumentModal({ document: doc, folders, open, onClose }) {
    const [folderId, setFolderId] = useState('');
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState(false);

    const options = useMemo(() => {
        const byId = new Map((folders ?? []).map(f => [f.id, f]));
        const pathOf = (folder) => {
            const parts = [];
            let current = folder;
            let guard = 0;
            while (current && guard++ < 20) {
                parts.unshift(current.name);
                current = current.parent_id ? byId.get(current.parent_id) : null;
            }
            return parts.join(' / ');
        };
        return (folders ?? [])
            .map(f => ({ id: f.id, label: pathOf(f) }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
    }, [folders]);

    if (!open) return null;

    const filtered = search.trim()
        ? options.filter(o => o.label.includes(search.trim()))
        : options;

    const submit = () => {
        if (!folderId || processing) return;
        setProcessing(true);
        router.post(`/archive/documents/${doc.id}/move`, { folder_id: folderId }, {
            preserveScroll: true,
            onSuccess: () => {
                onClose();
                setFolderId('');
                setSearch('');
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <FolderInput size={16} className="text-amber-500" />
                        نقل المستند: {doc.title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="relative mb-2">
                    <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ابحث عن المجلد..."
                        className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {filtered.length === 0 && (
                        <p className="p-4 text-center text-xs text-gray-400">لا توجد مجلدات مطابقة</p>
                    )}
                    {filtered.map(o => {
                        const isCurrent = o.id === doc.folder_id;
                        return (
                            <button
                                key={o.id}
                                type="button"
                                disabled={isCurrent}
                                onClick={() => setFolderId(o.id)}
                                className={`w-full text-right px-3 py-2 text-sm transition-colors ${
                                    isCurrent
                                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                                        : folderId === o.id
                                            ? 'bg-amber-50 text-amber-800 font-medium'
                                            : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                {o.label}
                                {isCurrent && <span className="text-xs mr-2">(المجلد الحالي)</span>}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={submit}
                    disabled={!folderId || processing}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-bold rounded-lg py-2.5 text-sm"
                >
                    {processing ? <Loader2 size={16} className="animate-spin" /> : <FolderInput size={16} />}
                    {processing ? 'جاري النقل...' : 'نقل المستند'}
                </button>
            </div>
        </div>
    );
}
