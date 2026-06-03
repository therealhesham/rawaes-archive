import { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    Mail, Lock, Loader2, Eye, EyeOff, ArrowLeft,
    Shield, Archive, FileSearch, Sparkles, CheckCircle2
} from 'lucide-react';

export default function Login({ status, canResetPassword }) {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <>
            <Head title="تسجيل الدخول — روائس" />

            <div dir="rtl" className="min-h-screen flex font-sans bg-white overflow-hidden">

                {/* ─────────────  LEFT BRAND PANEL ───────────── */}
                <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1e2a4a] via-[#243561] to-[#0f1729] flex-col justify-between p-12 text-white">

                    {/* Animated gradient blobs */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-0 -right-32 w-96 h-96 bg-amber-500/20 rounded-full blur-[100px] animate-pulse"></div>
                        <div className="absolute bottom-0 -left-32 w-[500px] h-[500px] bg-amber-400/10 rounded-full blur-[120px]"></div>
                        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-[100px]"></div>
                    </div>

                    {/* Grid pattern overlay */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                        }}
                    ></div>

                    {/* Logo header */}
                    <div className="relative z-10 flex items-center gap-3">
                        <img
                            src="/images/logo.png"
                            alt="روائس"
                            className="w-12 h-12 object-contain drop-shadow-2xl"
                            onError={(e) => e.target.style.display = 'none'}
                        />
                        <div>
                            <p className="text-xl font-bold">روائس</p>
                            <p className="text-xs text-amber-300/80">RAWAES</p>
                        </div>
                    </div>

                    {/* Hero content */}
                    <div className="relative z-10 max-w-md">
                        <div className="flex items-center gap-2 mb-4 text-amber-300 text-sm">
                            <Sparkles size={16} />
                            <span>نظام الأرشفة الإلكترونية</span>
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-bold mb-4 leading-tight">
                            أرشفة ذكية،<br />
                            <span className="text-amber-300">قرارات أسرع</span>
                        </h1>
                        <p className="text-white/70 leading-relaxed mb-8">
                            منصّة موحدة لإدارة المستندات والوثائق الرسمية، تمنحك التحكم الكامل والأمان والوصول السريع لكل ملف.
                        </p>

                        {/* Feature pills */}
                        <div className="space-y-3">
                            {[
                                { icon: Shield, text: 'حماية متعددة المستويات وصلاحيات مرنة' },
                                { icon: FileSearch, text: 'بحث فوري داخل محتوى المستندات (OCR)' },
                                { icon: Archive, text: 'تنبيهات ذكية لانتهاء الصلاحية' },
                            ].map((f, i) => {
                                const Icon = f.icon;
                                return (
                                    <div key={i} className="flex items-center gap-3 group">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                            <Icon size={18} className="text-amber-300" />
                                        </div>
                                        <span className="text-sm text-white/80">{f.text}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="relative z-10 flex items-center justify-between text-xs text-white/40">
                        <span>© 2026 شركة رواس لتأجير السيارات</span>
                        <span>المدينة المنورة 🇸🇦</span>
                    </div>
                </div>

                {/* ─────────────  RIGHT FORM PANEL ───────────── */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative bg-gradient-to-bl from-gray-50 via-white to-amber-50/30">

                    <div className="w-full max-w-md">

                        {/* Mobile logo (visible only on small screens) */}
                        <div className="lg:hidden text-center mb-8">
                            <img
                                src="/images/logo.png"
                                alt="روائس"
                                className="w-16 h-16 mx-auto mb-3 object-contain"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                            <h1 className="text-2xl font-bold text-gray-800">روائس</h1>
                            <p className="text-amber-600 text-sm">نظام الأرشفة الإلكترونية</p>
                        </div>

                        {/* Form Card */}
                        <div className="bg-white rounded-3xl shadow-xl shadow-amber-500/5 border border-gray-100 p-8 lg:p-10">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                    مرحباً بعودتك 👋
                                </h2>
                                <p className="text-sm text-gray-500">
                                    سجّل دخولك للوصول إلى نظام الأرشفة
                                </p>
                            </div>

                            {status && (
                                <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                                    <CheckCircle2 size={16} />
                                    {status}
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-5">
                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        البريد الإلكتروني
                                    </label>
                                    <div className="relative group">
                                        <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                                        <input
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            autoComplete="username"
                                            required
                                            autoFocus
                                            dir="ltr"
                                            className="w-full pr-11 pl-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all placeholder:text-gray-400 text-right"
                                            placeholder="admin@rawaes.com"
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                                            <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                            {errors.email}
                                        </p>
                                    )}
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        كلمة المرور
                                    </label>
                                    <div className="relative group">
                                        <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            autoComplete="current-password"
                                            required
                                            className="w-full pr-11 pl-11 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all placeholder:text-gray-400"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-amber-500 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                                            <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                            {errors.password}
                                        </p>
                                    )}
                                </div>

                                {/* Remember + Forgot */}
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={data.remember}
                                                onChange={(e) => setData('remember', e.target.checked)}
                                                className="peer sr-only"
                                            />
                                            <div className="w-4 h-4 border-2 border-gray-300 rounded peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-colors flex items-center justify-center">
                                                <CheckCircle2 size={10} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity hidden peer-checked:block" />
                                            </div>
                                        </div>
                                        <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">تذكرني</span>
                                    </label>

                                    {canResetPassword && (
                                        <Link
                                            href={route('password.request')}
                                            className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 group"
                                        >
                                            نسيت كلمة المرور؟
                                            <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                                        </Link>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="relative w-full bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-amber-300 disabled:to-amber-400 text-white py-3.5 rounded-xl font-bold text-sm transition-all hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 overflow-hidden group"
                                >
                                    <span className="absolute inset-0 bg-gradient-to-l from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                                    {processing
                                        ? <><Loader2 size={16} className="animate-spin" /> جاري التحقق...</>
                                        : <>دخول <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" /></>
                                    }
                                </button>
                            </form>

                            {/* Divider + footer */}
                            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                                <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
                                    <Shield size={12} />
                                    اتصال آمن ومشفّر · جميع الأنشطة موثّقة
                                </p>
                            </div>
                        </div>

                        {/* Mobile footer */}
                        <p className="lg:hidden text-center text-xs text-gray-400 mt-6">
            جميع الحقوق محفوظة © مجموعة روائس 2026
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
