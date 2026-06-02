import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { FolderOpen, Folder, Plus, ChevronDown, ChevronLeft, Edit2, Trash2, FileText } from 'lucide-react';

function FolderNode({ folder, depth = 0, onAdd, onEdit, onDelete }) {
    const [open, setOpen] = useState(depth === 0);
    const hasChildren = folder.children?.length > 0;

    return (
        <div>
            <div
                className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group cursor-pointer
                    ${depth === 0 ? 'font-medium' : ''}`}
                style={{ paddingRight: `${12 + depth * 20}px` }}
            >
                <button onClick={() => setOpen(!open)} className="shrink-0">
                    {hasChildren
                        ? (open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronLeft size={14} className="text-gray-400" />)
                        : <span className="w-3.5" />
                    }
                </button>
                <div className="shrink-0" style={{ color: folder.color ?? '#F59E0B' }}>
                    {open && hasChildren ? <FolderOpen size={18} /> : <Folder size={18} />}
                </div>
                <span className="flex-1 text-sm text-gray-700">{folder.name}</span>
                <div className="hidden group-hover:flex items-center gap-1">
                    <button
                        onClick={() => onAdd(folder)}
                        className="p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"
                        title="إضافة مجلد فرعي"
                    >
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={() => onEdit(folder)}
                        className="p-1 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
                    >
                        <Edit2 size={13} />
                    </button>
                    <button
                        onClick={() => onDelete(folder)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>
            {open && hasChildren && (
                <div>
                    {folder.children.map(child => (
                        <FolderNode
                            key={child.id}
                            folder={child}
                            depth={depth + 1}
                            onAdd={onAdd}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function FolderModal({ open, onClose, sector, parentFolder, editFolder }) {
    const [name, setName] = useState(editFolder?.name ?? '');
    const [nameEn, setNameEn] = useState(editFolder?.name_en ?? '');
    const [color, setColor] = useState(editFolder?.color ?? '#F59E0B');

    const submit = (e) => {
        e.preventDefault();
        if (editFolder) {
            router.put(`/archive/folders/${editFolder.id}`, { name, name_en: nameEn, color }, {
                onSuccess: onClose,
            });
        } else {
            router.post('/archive/folders', {
                sector_id: sector.id,
                parent_id: parentFolder?.id ?? null,
                name, name_en: nameEn, color,
            }, { onSuccess: onClose });
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-gray-800 mb-4">
                    {editFolder ? 'تعديل المجلد' : 'مجلد جديد'}
                </h3>
                {parentFolder && !editFolder && (
                    <p className="text-sm text-gray-500 mb-3">داخل: {parentFolder.name}</p>
                )}
                <form onSubmit={submit} className="space-y-3">
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="اسم المجلد"
                        required
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                        type="text"
                        value={nameEn}
                        onChange={e => setNameEn(e.target.value)}
                        placeholder="Folder name (English)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">اللون:</label>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-gray-200" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            إلغاء
                        </button>
                        <button type="submit" className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
                            {editFolder ? 'حفظ التعديل' : 'إنشاء'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function FoldersIndex({ sectors }) {
    const [modal, setModal] = useState({ open: false, sector: null, parent: null, edit: null });

    const openAdd = (sector, parent = null) => setModal({ open: true, sector, parent, edit: null });
    const openEdit = (folder, sector) => setModal({ open: true, sector, parent: null, edit: folder });
    const closeModal = () => setModal({ open: false, sector: null, parent: null, edit: null });

    const handleDelete = (folder) => {
        if (confirm(`حذف المجلد "${folder.name}"؟`)) {
            router.delete(`/archive/folders/${folder.id}`);
        }
    };

    return (
        <>
            <Head title="المجلدات" />

            <FolderModal
                open={modal.open}
                onClose={closeModal}
                sector={modal.sector}
                parentFolder={modal.parent}
                editFolder={modal.edit}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {sectors.map(sector => (
                    <div key={sector.id} className="bg-white rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <div>
                                <h3 className="font-semibold text-gray-800">{sector.name}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{sector.folders?.length ?? 0} مجلد رئيسي</p>
                            </div>
                            <button
                                onClick={() => openAdd(sector)}
                                className="flex items-center gap-1.5 text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            >
                                <Plus size={14} />
                                إضافة
                            </button>
                        </div>
                        <div className="p-2 max-h-72 overflow-y-auto">
                            {sector.folders?.length > 0 ? (
                                sector.folders.map(folder => (
                                    <FolderNode
                                        key={folder.id}
                                        folder={folder}
                                        onAdd={(parent) => openAdd(sector, parent)}
                                        onEdit={(f) => openEdit(f, sector)}
                                        onDelete={handleDelete}
                                    />
                                ))
                            ) : (
                                <div className="py-8 text-center">
                                    <Folder size={28} className="mx-auto text-gray-200 mb-2" />
                                    <p className="text-xs text-gray-400">لا توجد مجلدات</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

FoldersIndex.layout = page => <ArchiveLayout title="المجلدات" children={page} />;
