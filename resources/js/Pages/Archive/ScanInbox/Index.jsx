import { Head, Link, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { ScanLine, FileText, Trash2, Eye, ArrowLeft, Inbox, Calendar, Monitor } from 'lucide-react';

export default function ScanInboxIndex({ scans, count }) {
    const handleDelete = (scan) => {
        if (confirm(`حذف هذا المسح "${scan.original_name}"؟`)) {
            router.delete(`/archive/scans/${scan.id}`);
        }
    };

    return (
        <>
            <Head title="المسح الضوئي" />

            {/* Header banner */}
            <div className="bg-gradient-to-l from-blue-50 via-amber-50 to-blue-50 border border-amber-200 rounded-2xl p-5 mb-5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-amber-500 rounded-xl">
                        <ScanLine size={22} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="font-bold text-gray-800 text-lg">صندوق المسح الضوئي</h2>
                        <p className="text-sm text-gray-600">المستندات التي وصلت من جهاز الماسح وتنتظر التصنيف</p>
                    </div>
                    {count > 0 && (
                        <div className="bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-full">
                            {count} مسح جديد
                        </div>
                    )}
                </div>
            </div>

            {/* Grid */}
            {scans.data?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scans.data.map(scan => {
                        const isImage = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'bmp'].includes(scan.file_extension?.toLowerCase());
                        return (
                            <div key={scan.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                                {/* Preview */}
                                <Link
                                    href={`/archive/scans/${scan.id}`}
                                    className="block bg-gray-50 h-44 flex items-center justify-center overflow-hidden border-b border-gray-100 group"
                                >
                                    {isImage ? (
                                        <img
                                            src={`/archive/scans/${scan.id}/preview`}
                                            alt={scan.original_name}
                                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                        />
                                    ) : (
                                        <div className="text-center">
                                            <FileText size={48} className="mx-auto text-red-400 mb-2" />
                                            <p className="text-xs font-bold text-gray-600 uppercase">{scan.file_extension}</p>
                                        </div>
                                    )}
                                </Link>

                                {/* Info */}
                                <div className="p-4">
                                    <p className="font-medium text-gray-800 text-sm truncate mb-2">{scan.original_name}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={11} />
                                            {new Date(scan.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                        <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded" dir="ltr">{scan.file_size_formatted}</span>
                                    </div>
                                    {scan.source_device && (
                                        <p className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                                            <Monitor size={11} />
                                            {scan.source_device}
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/archive/scans/${scan.id}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            <ArrowLeft size={13} />
                                            تصنيف وحفظ
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(scan)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="حذف"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                    <Inbox size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-500 font-medium mb-2">لا توجد مسحات جديدة</p>
                    <p className="text-gray-400 text-sm">المستندات الممسوحة من السكانر ستظهر هنا تلقائياً</p>
                </div>
            )}
        </>
    );
}

ScanInboxIndex.layout = page => <ArchiveLayout title="المسح الضوئي" children={page} />;
