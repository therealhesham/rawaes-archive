import { Head, Link, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Settings, Plus, Edit2, Trash2, FileText, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function DocumentTypesIndex({ types }) {
    return (
        <>
            <Head title="أنواع المستندات" />

            <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-500">{types.length} نوع</p>
                <Link
                    href="/archive/document-types/create"
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    <Plus size={16} />
                    نوع جديد
                </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {['النوع', 'الرمز', 'يحتاج انتهاء', 'عدد المستندات', 'الحالة', 'الإجراءات'].map(h => (
                                <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {types.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-blue-50 rounded-lg">
                                            <Settings size={14} className="text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{t.name}</p>
                                            {t.name_en && <p className="text-xs text-gray-400">{t.name_en}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <code className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{t.code}</code>
                                </td>
                                <td className="px-4 py-3">
                                    {t.requires_expiry
                                        ? <span className="flex items-center gap-1 text-amber-600 text-xs"><Clock size={12} /> نعم</span>
                                        : <span className="text-gray-400 text-xs">لا</span>}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                        <FileText size={12} className="text-gray-400" />
                                        {t.documents_count}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {t.is_active
                                        ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> نشط</span>
                                        : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={12} /> غير نشط</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                        <Link href={`/archive/document-types/${t.id}/edit`} className="p-1.5 rounded hover:bg-amber-50 text-gray-500 hover:text-amber-600">
                                            <Edit2 size={15} />
                                        </Link>
                                        <button
                                            onClick={() => {
                                                if (confirm(`حذف "${t.name}"؟`)) router.delete(`/archive/document-types/${t.id}`);
                                            }}
                                            className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {types.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                    <Settings size={32} className="mx-auto mb-2 opacity-30" />
                                    لا توجد أنواع
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}

DocumentTypesIndex.layout = page => <ArchiveLayout title="أنواع المستندات" children={page} />;
