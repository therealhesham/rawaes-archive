import { Head, Link, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Archive, Plus, Edit2, Trash2, FileText, CheckCircle, XCircle } from 'lucide-react';

export default function SectorsIndex({ sectors }) {
    return (
        <>
            <Head title="القطاعات" />

            <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-500">{sectors.length} قطاع</p>
                <Link
                    href="/archive/sectors/create"
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    <Plus size={16} />
                    قطاع جديد
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sectors.map(sector => (
                    <div key={sector.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-amber-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 rounded-lg">
                                    <Archive size={20} className="text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">{sector.name}</h3>
                                    {sector.name_en && <p className="text-xs text-gray-500">{sector.name_en}</p>}
                                </div>
                            </div>
                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {sector.code}
                            </span>
                        </div>
                        {sector.description && (
                            <p className="text-sm text-gray-500 mb-3">{sector.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={14} className="text-gray-400" />
                                <span className="text-sm text-gray-500">{sector.documents_count} مستند</span>
                                {sector.is_active
                                    ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> نشط</span>
                                    : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={12} /> غير نشط</span>
                                }
                            </div>
                            <div className="flex gap-1">
                                <Link href={`/archive/sectors/${sector.id}/edit`} className="p-1.5 rounded hover:bg-amber-50 text-gray-500 hover:text-amber-600">
                                    <Edit2 size={15} />
                                </Link>
                                <button
                                    onClick={() => {
                                        if (confirm('حذف هذا القطاع؟')) router.delete(`/archive/sectors/${sector.id}`);
                                    }}
                                    className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

SectorsIndex.layout = page => <ArchiveLayout title="القطاعات" children={page} />;
