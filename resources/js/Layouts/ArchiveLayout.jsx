import { useState, useEffect, useRef } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import {
    FolderOpen, FileText, Settings, Users, BarChart3,
    ChevronLeft, ChevronRight, Bell, Search, LogOut,
    LayoutDashboard, Shield, Archive, Menu, X, ScanLine, Trash2, ClipboardList
} from 'lucide-react';

const allNavItems = [
    { label: 'لوحة البيانات', href: '/dashboard', icon: LayoutDashboard, match: '/dashboard' },
    { label: 'المستندات', href: '/archive/documents', icon: FileText, match: '/archive/documents' },
    { label: 'سلة المحذوفات', href: '/archive/trash/documents', icon: Trash2, match: '/archive/trash/documents', requires: 'documents.trash.view' },
    { label: 'المجلدات', href: '/archive/folders', icon: FolderOpen, match: '/archive/folders', requires: 'folders.manage' },
    { label: 'الجرد', href: '/archive/inventory', icon: ClipboardList, match: '/archive/inventory', requires: 'inventory.view' },
    { label: 'القطاعات', href: '/archive/sectors', icon: Archive, match: '/archive/sectors', requires: 'sectors.manage' },
    { label: 'أنواع المستندات', href: '/archive/document-types', icon: Settings, match: '/archive/document-types', requires: 'sectors.manage' },
    { label: 'سجل التدقيق', href: '/archive/audit-logs', icon: Shield, match: '/archive/audit-logs', requires: 'audit.view' },
    { label: 'المستخدمون', href: '/users', icon: Users, match: '/users', requires: 'users.manage' },
    { label: 'الأدوار والصلاحيات', href: '/roles', icon: Shield, match: '/roles', requires: 'users.manage' },
    { label: 'التقارير', href: '/reports', icon: BarChart3, match: '/reports', requires: 'reports.view' },
    { label: 'المسح الضوئي', href: '/archive/scans', icon: ScanLine, match: '/archive/scans', badge: 'pendingScansCount' },
    { label: 'الإشعارات', href: '/notifications', icon: Bell, match: '/notifications' },
];

export default function ArchiveLayout({ children, title = '' }) {
    const { auth, notifications, flash, pendingScansCount } = usePage().props;
    const can = auth?.can ?? {};
    const navItems = allNavItems.filter(item => !item.requires || can[item.requires]);
    const badges = { pendingScansCount: pendingScansCount ?? 0 };
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const notifRef = useRef(null);

    const currentPath = window.location.pathname;

    useEffect(() => {
        if (flash?.success) setToast({ type: 'success', message: flash.success });
        else if (flash?.error) setToast({ type: 'error', message: flash.error });

        if (toast || flash?.success || flash?.error) {
            const timer = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(timer);
        }
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    return (
        <div className="flex h-screen bg-gray-50 font-sans" dir="rtl">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 right-0 h-full z-30 bg-[#1e2a4a] text-white flex flex-col
                transition-all duration-300 ease-in-out
                ${sidebarOpen ? 'w-64' : 'w-16'}
                ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 h-16">
                    {sidebarOpen && (
                        <div className="flex items-center gap-2.5">
                            <img
                                src="/images/logo.png"
                                alt="روائس"
                                className="w-9 h-9 object-contain"
                                onError={(e) => e.target.style.display='none'}
                            />
                            <div>
                                <p className="font-bold text-base leading-none">روائس</p>
                                <p className="text-[11px] text-amber-400/80 leading-none mt-1">نظام الأرشفة الإلكترونية</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="hidden lg:flex p-1 rounded hover:bg-white/10 transition-colors"
                    >
                        {sidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPath.startsWith(item.match);
                        const badgeCount = item.badge ? badges[item.badge] : 0;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    relative flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1
                                    transition-colors duration-150
                                    ${isActive
                                        ? 'bg-amber-500 text-white'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }
                                    ${!sidebarOpen ? 'justify-center' : ''}
                                `}
                                title={!sidebarOpen ? item.label : ''}
                            >
                                <div className="relative shrink-0">
                                    <Icon size={18} />
                                    {!sidebarOpen && badgeCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                            {badgeCount > 9 ? '9+' : badgeCount}
                                        </span>
                                    )}
                                </div>
                                {sidebarOpen && (
                                    <>
                                        <span className="text-sm font-medium flex-1">{item.label}</span>
                                        {badgeCount > 0 && (
                                            <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                {badgeCount > 99 ? '99+' : badgeCount}
                                            </span>
                                        )}
                                    </>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User info */}
                {sidebarOpen && (
                    <div className="p-4 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold">
                                {auth?.user?.name?.[0] ?? 'م'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{auth?.user?.name}</p>
                                <p className="text-xs text-white/50 truncate">{auth?.user?.email}</p>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main content */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'lg:mr-64' : 'lg:mr-16'}`}>
                {/* Top bar */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
	                    <div className="flex items-center gap-3">
	                        <button
	                            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
	                            onClick={() => setMobileOpen(true)}
	                        >
	                            <Menu size={20} />
	                        </button>
	                        <h1 className="text-lg font-bold text-gray-800">{title}</h1>
	                    </div>
	                    <div className="flex items-center gap-2">
	                        <div className="relative" ref={notifRef}>
	                            <button
	                                onClick={() => setNotifOpen(!notifOpen)}
	                                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600"
	                            >
                                <Bell size={20} />
                                {notifications?.unread_count > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {notifications.unread_count > 99 ? '99+' : notifications.unread_count}
                                    </span>
                                )}
                            </button>

                            {notifOpen && (
                                <div className="absolute left-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                                    <div className="flex items-center justify-between p-3 border-b border-gray-100">
                                        <h3 className="font-bold text-gray-800 text-sm">الإشعارات</h3>
                                        {notifications?.unread_count > 0 && (
                                            <button
                                                onClick={() => router.post('/notifications/read-all', {}, { preserveScroll: true })}
                                                className="text-xs text-amber-600 hover:text-amber-700"
                                            >
                                                تحديد الكل كمقروء
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications?.recent?.length > 0 ? notifications.recent.map(n => (
                                            <Link
                                                key={n.id}
                                                href={n.data?.url ?? '#'}
                                                onClick={() => router.post(`/notifications/${n.id}/read`, {}, { preserveScroll: true, preserveState: true })}
                                                className="block p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                            >
                                                <p className="text-sm font-medium text-gray-800">{n.data?.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 truncate">{n.data?.document_title}</p>
                                                <p className="text-xs text-gray-400 mt-1">{n.created_at}</p>
                                            </Link>
                                        )) : (
                                            <div className="p-6 text-center">
                                                <Bell size={28} className="mx-auto text-gray-200 mb-2" />
                                                <p className="text-xs text-gray-400">لا توجد إشعارات جديدة</p>
                                            </div>
                                        )}
                                    </div>
                                    <Link
                                        href="/notifications"
                                        onClick={() => setNotifOpen(false)}
                                        className="block text-center text-xs text-amber-600 hover:text-amber-700 p-3 border-t border-gray-100"
                                    >
                                        عرض كل الإشعارات ←
                                    </Link>
                                </div>
                            )}
                        </div>
                        <Link
                            href="/logout"
                            method="post"
                            as="button"
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                            title="تسجيل الخروج"
                        >
                            <LogOut size={20} />
                        </Link>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 left-6 z-50 min-w-64 px-4 py-3 rounded-lg shadow-lg border
                    ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <p className="text-sm font-medium">{toast.message}</p>
                </div>
            )}
        </div>
    );
}
