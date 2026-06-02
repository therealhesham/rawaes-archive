import { Head, Link, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Bell, AlertTriangle, Clock, Trash2, FileText, CheckCheck } from 'lucide-react';

const typeIcons = {
    expired: { icon: AlertTriangle, color: 'text-red-500 bg-red-50' },
    expiring: { icon: Clock, color: 'text-amber-500 bg-amber-50' },
};

export default function NotificationsIndex({ notifications }) {
    return (
        <>
            <Head title="الإشعارات" />

            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{notifications.total} إشعار</p>
                {notifications.total > 0 && (
                    <button
                        onClick={() => router.post('/notifications/read-all')}
                        className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700"
                    >
                        <CheckCheck size={16} />
                        تحديد الكل كمقروء
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {notifications.data?.length > 0 ? notifications.data.map(n => {
                    const cfg = typeIcons[n.data?.type] ?? { icon: Bell, color: 'text-gray-500 bg-gray-50' };
                    const Icon = cfg.icon;
                    const isUnread = !n.read_at;

                    return (
                        <div
                            key={n.id}
                            className={`flex items-start gap-3 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${isUnread ? 'bg-amber-50/30' : ''}`}
                        >
                            <div className={`p-2 rounded-lg ${cfg.color.split(' ')[1]}`}>
                                <Icon size={18} className={cfg.color.split(' ')[0]} />
                            </div>
                            <Link
                                href={n.data?.url ?? '#'}
                                className="flex-1 min-w-0"
                            >
                                <p className="text-sm font-medium text-gray-800">{n.data?.title}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    <FileText size={12} className="inline ml-1" />
                                    {n.data?.document_title}
                                    {n.data?.document_number && <span className="text-gray-400 mr-2">#{n.data.document_number}</span>}
                                </p>
                                {n.data?.sector_name && (
                                    <p className="text-xs text-gray-500 mt-0.5">{n.data.sector_name}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    {new Date(n.created_at).toLocaleString('en-GB')}
                                </p>
                            </Link>
                            <button
                                onClick={() => router.delete(`/notifications/${n.id}`)}
                                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            >
                                <Trash2 size={14} />
                            </button>
                            {isUnread && <span className="w-2 h-2 bg-amber-500 rounded-full mt-2"></span>}
                        </div>
                    );
                }) : (
                    <div className="p-16 text-center">
                        <Bell size={40} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400">لا توجد إشعارات</p>
                    </div>
                )}
            </div>
        </>
    );
}

NotificationsIndex.layout = page => <ArchiveLayout title="الإشعارات" children={page} />;
