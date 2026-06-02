import { Head, Link, router, usePage } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Trash2, RotateCcw, XCircle } from 'lucide-react';

function formatDateTime(val) {
    if (!val) return '—';
    try {
        const d = new Date(val);
        return d.toLocaleString('en-GB');
    } catch {
        return val;
    }
}

export default function Trash({ documents }) {
    const { auth } = usePage().props;
    const can = auth?.can ?? {};

    return (
        <>
            <Head title="سلة المحذوفات" />

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <p className="text-sm text-gray-600">{documents.total} مستند محذوف</p>
                    <Link href="/archive/documents" className="text-sm text-amber-700 hover:text-amber-800">
                        ← العودة للمستندات
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['#', 'المستند', 'القطاع', 'تاريخ الحذف', 'الإجراءات'].map(h => (
                                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {documents.data?.length > 0 ? documents.data.map(doc => (
                                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-sm text-gray-600 font-mono" dir="ltr">
                                        {doc.serial_number ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-800">
                                        {doc.title ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {doc.sector?.name ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600" dir="ltr">
                                        {formatDateTime(doc.deleted_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {can['documents.restore'] && (
                                                <button
                                                    onClick={() => router.put(`/archive/trash/documents/${doc.id}/restore`)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 text-sm text-gray-700 hover:text-green-700 transition-colors"
                                                >
                                                    <RotateCcw size={16} />
                                                    استرجاع
                                                </button>
                                            )}
                                            {can['documents.force_delete'] && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('حذف نهائي؟ لا يمكن التراجع.')) {
                                                            router.delete(`/archive/trash/documents/${doc.id}`);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 text-sm text-red-600 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                    حذف نهائي
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-16 text-center">
                                        <XCircle size={40} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-500 font-medium">لا توجد مستندات في سلة المحذوفات</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {documents.last_page > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                            صفحة {documents.current_page} من {documents.last_page}
                        </p>
                        <div className="flex gap-2">
                            {documents.prev_page_url && (
                                <Link href={documents.prev_page_url} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                                    السابق
                                </Link>
                            )}
                            {documents.next_page_url && (
                                <Link href={documents.next_page_url} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                                    التالي
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

Trash.layout = page => <ArchiveLayout title="سلة المحذوفات" children={page} />;

