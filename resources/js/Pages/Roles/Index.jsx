import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Shield, Plus, Trash2, Save, X, Users, Lock, CheckCircle } from 'lucide-react';

const roleColors = {
    'super-admin': 'bg-purple-100 text-purple-700 border-purple-200',
    'archive-manager': 'bg-blue-100 text-blue-700 border-blue-200',
    'employee': 'bg-gray-100 text-gray-700 border-gray-200',
    'auditor': 'bg-amber-100 text-amber-700 border-amber-200',
};

const roleLabels = {
    'super-admin': 'مدير عام',
    'archive-manager': 'مدير أرشيف',
    'employee': 'موظف',
    'auditor': 'مدقق',
};

const groupLabels = {
    'documents': 'المستندات',
    'folders': 'المجلدات',
    'sectors': 'القطاعات',
    'users': 'المستخدمون',
    'audit': 'سجل التدقيق',
    'reports': 'التقارير',
    'inventory': 'الجرد',
};

const permissionLabels = {
    'documents.view': 'عرض المستندات',
    'documents.create': 'إنشاء ورفع',
    'documents.edit': 'تعديل',
    'documents.delete': 'حذف',
    'documents.download': 'تحميل',
    'documents.print': 'طباعة',
    'documents.custody.checkout': 'تسليم عهدة',
    'documents.custody.checkin': 'استلام عهدة',
    'documents.trash.view': 'عرض سلة المحذوفات',
    'documents.restore': 'استرجاع من سلة المحذوفات',
    'documents.force_delete': 'حذف نهائي من سلة المحذوفات',
    'folders.manage': 'إدارة المجلدات',
    'sectors.manage': 'إدارة القطاعات وأنواع المستندات',
    'users.manage': 'إدارة المستخدمين',
    'audit.view': 'عرض سجل التدقيق',
    'reports.view': 'عرض التقارير',
    'inventory.view': 'عرض الجرد',
    'inventory.manage': 'إدارة الجرد',
};

function RoleCard({ role, permissionGroups, isSystem }) {
    const [editing, setEditing] = useState(false);
    const [selected, setSelected] = useState(new Set(role.permissions.map(p => p.name)));

    const toggle = (name) => {
        const next = new Set(selected);
        next.has(name) ? next.delete(name) : next.add(name);
        setSelected(next);
    };

    const save = () => {
        router.put(`/roles/${role.id}/permissions`, { permissions: [...selected] }, {
            onSuccess: () => setEditing(false),
        });
    };

    const cancel = () => {
        setSelected(new Set(role.permissions.map(p => p.name)));
        setEditing(false);
    };

    const del = () => {
        if (confirm(`حذف الدور "${roleLabels[role.name] ?? role.name}"؟`)) {
            router.delete(`/roles/${role.id}`);
        }
    };

    return (
        <div className={`bg-white rounded-xl border p-5 ${roleColors[role.name] ?? 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold">{roleLabels[role.name] ?? role.name}</h3>
                        <p className="text-xs flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1"><Users size={11} /> {role.users_count} مستخدم</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Lock size={11} /> {selected.size} صلاحية</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-1">
                    {editing ? (
                        <>
                            <button onClick={cancel} className="p-1.5 rounded bg-white hover:bg-gray-100">
                                <X size={15} />
                            </button>
                            <button onClick={save} className="p-1.5 rounded bg-green-500 hover:bg-green-600 text-white">
                                <Save size={15} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setEditing(true)}
                                className="px-3 py-1 text-xs rounded bg-white hover:bg-gray-100 font-medium"
                            >
                                تعديل
                            </button>
                            {!isSystem && (
                                <button onClick={del} className="p-1.5 rounded bg-white hover:bg-red-50 hover:text-red-500">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Permissions tree */}
            <div className="space-y-3 max-h-72 overflow-y-auto">
                {Object.entries(permissionGroups).map(([group, perms]) => (
                    <div key={group} className="bg-white/60 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">
                            {groupLabels[group] ?? group}
                        </p>
                        <div className="space-y-1.5">
                            {perms.map(p => (
                                <label
                                    key={p.id}
                                    className={`flex items-center gap-2 text-xs ${editing ? 'cursor-pointer' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(p.name)}
                                        onChange={() => toggle(p.name)}
                                        disabled={!editing}
                                        className="w-3.5 h-3.5 accent-amber-500 disabled:opacity-50"
                                    />
                                    <span className={selected.has(p.name) ? 'text-gray-800' : 'text-gray-400'}>
                                        {permissionLabels[p.name] ?? p.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function RolesIndex({ roles, permissionGroups }) {
    const [newRole, setNewRole] = useState({ open: false, name: '', permissions: new Set() });
    const systemRoles = ['super-admin', 'archive-manager', 'employee', 'auditor'];

    const createRole = () => {
        router.post('/roles', {
            name: newRole.name,
            permissions: [...newRole.permissions],
        }, {
            onSuccess: () => setNewRole({ open: false, name: '', permissions: new Set() }),
        });
    };

    return (
        <>
            <Head title="الأدوار والصلاحيات" />

            <div className="flex items-center justify-between mb-5">
                <div>
                    <p className="text-sm text-gray-500">
                        إدارة أدوار المستخدمين والتحكم في الصلاحيات لكل دور
                    </p>
                </div>
                <button
                    onClick={() => setNewRole(v => ({ ...v, open: true }))}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    <Plus size={16} /> دور جديد
                </button>
            </div>

            {newRole.open && (
                <div className="bg-white rounded-xl border border-amber-300 p-5 mb-5">
                    <h3 className="font-bold text-gray-800 mb-3">دور جديد</h3>
                    <input
                        type="text"
                        value={newRole.name}
                        onChange={e => setNewRole(v => ({ ...v, name: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                        placeholder="اسم الدور (مثال: content-manager)"
                        dir="ltr"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-xs text-gray-500 mb-2">اختر الصلاحيات:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 max-h-60 overflow-y-auto">
                        {Object.entries(permissionGroups).map(([group, perms]) =>
                            perms.map(p => (
                                <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded hover:bg-gray-50">
                                    <input
                                        type="checkbox"
                                        checked={newRole.permissions.has(p.name)}
                                        onChange={() => {
                                            const next = new Set(newRole.permissions);
                                            next.has(p.name) ? next.delete(p.name) : next.add(p.name);
                                            setNewRole(v => ({ ...v, permissions: next }));
                                        }}
                                        className="accent-amber-500"
                                    />
                                    <span>{permissionLabels[p.name] ?? p.name}</span>
                                </label>
                            ))
                        )}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setNewRole({ open: false, name: '', permissions: new Set() })} className="px-4 py-2 border rounded-lg text-sm text-gray-600">
                            إلغاء
                        </button>
                        <button onClick={createRole} disabled={!newRole.name} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium">
                            إنشاء
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {roles.map(role => (
                    <RoleCard
                        key={role.id}
                        role={role}
                        permissionGroups={permissionGroups}
                        isSystem={systemRoles.includes(role.name)}
                    />
                ))}
            </div>
        </>
    );
}

RolesIndex.layout = page => <ArchiveLayout title="الأدوار والصلاحيات" children={page} />;
