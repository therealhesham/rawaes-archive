import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, RadialBarChart, RadialBar, Sector,
} from 'recharts';
import {
    FileText, Download, Calendar, TrendingUp, HardDrive,
    AlertTriangle, Clock, Archive, Users, Activity, Filter,
    Sparkles, BarChart3, PieChart as PieIcon
} from 'lucide-react';

// ─────── Color palette ───────
const COLORS = {
    amber: '#F59E0B',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    green: '#10B981',
    red: '#EF4444',
    pink: '#EC4899',
    indigo: '#6366F1',
    teal: '#14B8A6',
};
const CHART_COLORS = [COLORS.amber, COLORS.blue, COLORS.purple, COLORS.green, COLORS.pink, COLORS.indigo, COLORS.teal, COLORS.red];

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

const actionLabels = {
    upload: 'رفع مستند',
    view: 'استعراض',
    download: 'تحميل',
    update: 'تعديل',
    delete: 'حذف',
    login: 'تسجيل دخول',
    logout: 'تسجيل خروج',
    login_failed: 'دخول فاشل',
    create_user: 'إنشاء مستخدم',
    update_user: 'تعديل مستخدم',
    delete_user: 'حذف مستخدم',
    create_sector: 'إنشاء قطاع',
    update_sector: 'تعديل قطاع',
    delete_sector: 'حذف قطاع',
    create_folder: 'إنشاء مجلد',
    update_folder: 'تعديل مجلد',
    delete_folder: 'حذف مجلد',
    create_type: 'إنشاء نوع مستند',
    update_type: 'تعديل نوع مستند',
    delete_type: 'حذف نوع مستند',
    scan_received: 'مسح ضوئي جديد',
    scan_assigned: 'تصنيف مسح ضوئي',
    scan_deleted: 'حذف مسح ضوئي',
    document_emailed: 'إرسال بالبريد',
    audit_export: 'تصدير سجل التدقيق',
};

// ─────── Custom tooltip ───────
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3" dir="rtl">
            {label && <p className="text-xs font-bold text-gray-700 mb-1">{label}</p>}
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.fill }}></span>
                    <span className="text-gray-600">{p.name}:</span>
                    <span className="font-bold text-gray-900">{p.value?.toLocaleString('en-GB')}</span>
                </div>
            ))}
        </div>
    );
}

// ─────── Stat Card ───────
function StatCard({ icon: Icon, label, value, color, accent, change }) {
    return (
        <div className={`relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all`}>
            <div className={`absolute -top-8 -left-8 w-24 h-24 ${accent} rounded-full opacity-50 blur-2xl`}></div>
            <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${accent}`}>
                        <Icon size={20} className={color} />
                    </div>
                    {change && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            +{change}
                        </span>
                    )}
                </div>
                <p className={`text-3xl font-bold ${color}`} dir="ltr" style={{textAlign: 'right'}}>{value}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
        </div>
    );
}

// ─────────────────────────────
export default function ReportsIndex({ filters, totals, uploadsTrend, bySector, byType, topUploaders, activityCounts, sectors, documentTypes, uploaders, departments }) {
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [sectorId, setSectorId] = useState(filters.sector_id ?? '');
    const [typeId, setTypeId] = useState(filters.type_id ?? '');
    const [uploaderId, setUploaderId] = useState(filters.uploader_id ?? '');
    const [department, setDepartment] = useState(filters.department ?? '');

    const applyFilters = () => router.get('/reports', {
        from,
        to,
        sector_id: sectorId || undefined,
        type_id: typeId || undefined,
        uploader_id: uploaderId || undefined,
        department: department || undefined,
    }, { preserveState: true });

    const exportUrl = `/reports/export?from=${filters.from}&to=${filters.to}`
        + (filters.sector_id ? `&sector_id=${encodeURIComponent(filters.sector_id)}` : '')
        + (filters.type_id ? `&type_id=${encodeURIComponent(filters.type_id)}` : '')
        + (filters.uploader_id ? `&uploader_id=${encodeURIComponent(filters.uploader_id)}` : '')
        + (filters.department ? `&department=${encodeURIComponent(filters.department)}` : '');

    // Quick presets
    const setPreset = (days) => {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - days);
        const f = past.toISOString().split('T')[0];
        const t = today.toISOString().split('T')[0];
        setFrom(f); setTo(t);
        router.get('/reports', {
            from: f,
            to: t,
            sector_id: sectorId || undefined,
            type_id: typeId || undefined,
            uploader_id: uploaderId || undefined,
            department: department || undefined,
        }, { preserveState: true });
    };

    // Format trend data for chart
    const trendData = uploadsTrend.map(d => ({
        date: d.date?.slice(5),
        count: parseInt(d.count),
        size: parseInt(d.total_size) || 0,
    }));

    // Activity for pie chart
    const activityData = activityCounts.map((a, i) => ({
        name: actionLabels[a.action] ?? a.action,
        value: parseInt(a.count),
        fill: CHART_COLORS[i % CHART_COLORS.length],
    }));

    return (
        <>
            <Head title="التقارير والإحصائيات" />

            {/* Hero Header */}
            <div className="relative overflow-hidden bg-gradient-to-l from-[#1e2a4a] via-[#243561] to-[#2c3e6e] rounded-2xl p-6 mb-6 text-white">
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-amber-400/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl"></div>

                <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-amber-300 text-sm mb-2">
                            <Sparkles size={14} />
                            <span>تقارير وتحليلات</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-1">إحصائيات الأرشيف</h2>
                        <p className="text-white/70 text-sm">
                            من <strong className="text-amber-300">{filters.from}</strong> إلى <strong className="text-amber-300">{filters.to}</strong>
                        </p>
                    </div>
                    <a
                        href={exportUrl}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 px-5 py-3 rounded-xl text-sm font-bold transition-all hover:shadow-lg hover:scale-105"
                    >
                        <Download size={16} />
                        تصدير CSV
                    </a>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2 text-gray-600 text-sm font-medium">
                        <Filter size={16} className="text-amber-500" />
                        <span>الفلاتر:</span>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">من</label>
                        <input
                            type="date" value={from} onChange={e => setFrom(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">إلى</label>
                        <input
                            type="date" value={to} onChange={e => setTo(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">القطاع</label>
                        <select
                            value={sectorId}
                            onChange={(e) => setSectorId(e.target.value)}
                            className="border border-gray-200 rounded-xl  py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        >
                            <option value="">كل القطاعات</option>
                            {sectors?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">نوع المستند</label>
                        <select
                            value={typeId}
                            onChange={(e) => setTypeId(e.target.value)}
                            className="border border-gray-200 rounded-xl  py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        >
                            <option value="">كل الأنواع</option>
                            {documentTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">المستخدم</label>
                        <select
                            value={uploaderId}
                            onChange={(e) => setUploaderId(e.target.value)}
                            className="border border-gray-200 rounded-xl  py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        >
                            <option value="">كل المستخدمين</option>
                            {uploaders?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">القسم</label>
                        <select
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="border border-gray-200 rounded-xl  py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        >
                            <option value="">كل الأقسام</option>
                            {departments?.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={applyFilters}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-bold"
                    >
                        تطبيق
                    </button>

                    <div className="flex gap-1 mr-auto">
                        {[7, 30, 90].map(d => (
                            <button
                                key={d}
                                onClick={() => setPreset(d)}
                                className="text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
                            >
                                آخر {d} يوم
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon={FileText}        label="مستندات الفترة" value={totals.documents.toLocaleString('en-GB')} color="text-blue-600"   accent="bg-blue-50" />
                <StatCard icon={HardDrive}       label="حجم المستندات" value={formatBytes(totals.size)}                  color="text-purple-600" accent="bg-purple-50" />
                <StatCard icon={AlertTriangle}   label="منتهية (إجمالي)" value={totals.expired.toLocaleString('en-GB')}    color="text-red-600"    accent="bg-red-50" />
                <StatCard icon={Clock}           label="تنتهي قريباً" value={totals.expiring.toLocaleString('en-GB')}      color="text-amber-600"  accent="bg-amber-50" />
            </div>

            {/* Trend Area Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6" dir="ltr">
                <div className="flex items-center justify-between mb-5" dir="rtl">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp size={18} className="text-green-500" />
                            تطور رفع المستندات
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">رسم بياني يومي لعدد المستندات المرفوعة</p>
                    </div>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#e2e8f0" />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#e2e8f0" />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone" dataKey="count" name="المستندات"
                                stroke={COLORS.amber} strokeWidth={2.5}
                                fillOpacity={1} fill="url(#colorCount)"
                                dot={{ r: 3, fill: COLORS.amber }}
                                activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Two charts: Sector + Type — Both use horizontal bars + legend list (best for Arabic) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                {/* Sector chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 size={18} className="text-amber-500" />
                            المستندات حسب القطاع
                        </h3>
                        <span className="text-xs text-gray-400">{bySector.length} قطاع</span>
                    </div>
                    {bySector.length > 0 ? (
                        <div className="space-y-3">
                            {bySector.map((s, i) => {
                                const max = Math.max(...bySector.map(x => parseInt(x.count)), 1);
                                const pct = (parseInt(s.count) / max) * 100;
                                const color = CHART_COLORS[i % CHART_COLORS.length];
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                            <span className="text-xs font-bold text-gray-800 bg-gray-50 px-2 py-0.5 rounded">{s.count}</span>
                                        </div>
                                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-center text-gray-400 text-sm py-12">لا توجد بيانات</p>}
                </div>

                {/* Type Donut chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2">
                        <PieIcon size={18} className="text-blue-500" />
                        المستندات حسب النوع
                    </h3>
                    {byType.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 items-center">
                            <div className="h-52" dir="ltr">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={byType.map((t, i) => ({ ...t, value: parseInt(t.count), fill: CHART_COLORS[i % CHART_COLORS.length] }))}
                                            cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                                            paddingAngle={2} dataKey="value"
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-2 max-h-52 overflow-y-auto">
                                {byType.map((t, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}></span>
                                            <span className="text-gray-700 truncate">{t.name}</span>
                                        </div>
                                        <span className="font-bold text-gray-900 bg-gray-50 px-1.5 py-0.5 rounded">{t.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : <p className="text-center text-gray-400 text-sm py-12">لا توجد بيانات</p>}
                </div>
            </div>

            {/* Top Uploaders + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Top Uploaders - ranked list with avatars */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Users size={18} className="text-purple-500" />
                            الأكثر رفعاً
                        </h3>
                        <span className="text-xs text-gray-400">أفضل {topUploaders.length}</span>
                    </div>
                    {topUploaders.length > 0 ? (
                        <div className="space-y-2.5">
                            {topUploaders.map((u, i) => {
                                const max = Math.max(...topUploaders.map(x => parseInt(x.count)), 1);
                                const pct = (parseInt(u.count) / max) * 100;
                                const ranks = ['🥇', '🥈', '🥉'];
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 text-center text-base shrink-0">
                                            {i < 3 ? ranks[i] : <span className="text-xs text-gray-400">#{i + 1}</span>}
                                        </div>
                                        <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                            {u.name?.[0] ?? '؟'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-gray-700 truncate">{u.name}</span>
                                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{u.count}</span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-l from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-center text-gray-400 text-sm py-12">لا توجد بيانات</p>}
                </div>

                {/* Activity summary - clean list */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Activity size={18} className="text-green-500" />
                            ملخص النشاط
                        </h3>
                        <span className="text-xs text-gray-400">{activityData.reduce((s, a) => s + a.value, 0)} حدث</span>
                    </div>
                    {activityData.length > 0 ? (
                        <div className="space-y-2">
                            {activityData.map((a, i) => {
                                const total = activityData.reduce((s, x) => s + x.value, 0);
                                const pct = total > 0 ? (a.value / total) * 100 : 0;
                                return (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: a.fill }}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-gray-700">{a.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                                                    <span className="text-sm font-bold text-gray-800">{a.value.toLocaleString('en-GB')}</span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%`, background: a.fill }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-center text-gray-400 text-sm py-12">لا يوجد نشاط</p>}
                </div>
            </div>
        </>
    );
}

ReportsIndex.layout = page => <ArchiveLayout title="التقارير" children={page} />;
