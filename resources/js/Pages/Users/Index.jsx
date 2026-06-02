import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { UserPlus, Search, Edit2, Trash2, User, Mail, Briefcase, CheckCircle, XCircle, Shield } from 'lucide-react';

const roleColors = {
    'super-admin': 'bg-purple-100 text-purple-700',
    'archive-manager': 'bg-blue-100 text-blue-700',
    'employee': 'bg-gray-100 text-gray-700',
    'auditor': 'bg-amber-100 text-amber-700',
};

const roleLabels = {
    'super-admin': 'مدير عام',
    'archive-manager': 'مدير أرشيف',
    'employee': 'موظف',
    'auditor': 'مدقق',
};

export default function UsersIndex({ users, sectors, filters }) {
    const [search, setSearch] = useState(filters.search ?? '');

    const applySearch = (e) => {
        e.preventDefault();
        router.get('/users', { ...filters, search }, { preserveState: true });
    };

    const handleDelete = (user) => {
        if (confirm(`حذف المستخدم "${user.name}"؟`)) {
            router.delete(`/users/${user.id}`);
        }
    };

    return (
        <>
            <Head title="المستخدمون" />

            <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex gap-3 flex-wrap">
                <form onSubmit={applySearch} className="flex gap-2 flex-1 min-w-48">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="بحث بالاسم، البريد، الرقم الوظيفي..."
                            className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                    <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm">بحث</button>
                </form>
                <select
                    value={filters.sector_id ?? ''}
                    onChange={e => router.get('/users', { ...filters, sector_id: e.target.value }, { preserveState: true })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                    <option value="">كل القطاعات</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Link
                    href="/users/create"
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    <UserPlus size={16} /> مستخدم جديد
                </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {['المستخدم', 'الوظيفة', 'القطاع', 'الدور', 'الحالة', 'الإجراءات'].map(h => (
                                <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.data?.length > 0 ? users.data.map(user => {
                            const role = user.roles?.[0]?.name;
                            return (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                                                {user.name?.[0] ?? '?'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{user.name}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Mail size={11} /> {user.email}
                                                </p>
                                                {user.employee_id && (
                                                    <p className="text-xs text-gray-400 font-mono mt-0.5">#{user.employee_id}</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.job_title ? (
                                            <div className="text-sm text-gray-700">{user.job_title}</div>
                                        ) : <span className="text-gray-300 text-sm">—</span>}
                                        {user.department && (
                                            <p className="text-xs text-gray-400">{user.department}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{user.sector?.name ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        {role && (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[role] ?? 'bg-gray-100 text-gray-700'}`}>
                                                <Shield size={10} className="inline ml-0.5" />
                                                {roleLabels[role] ?? role}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.is_active
                                            ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> نشط</span>
                                            : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={12} /> موقوف</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <Link href={`/users/${user.id}/edit`} className="p-1.5 rounded hover:bg-amber-50 text-gray-500 hover:text-amber-600">
                                                <Edit2 size={15} />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                    <User size={32} className="mx-auto mb-2 opacity-30" />
                                    لا يوجد مستخدمون
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}

UsersIndex.layout = page => <ArchiveLayout title="المستخدمون" children={page} />;
