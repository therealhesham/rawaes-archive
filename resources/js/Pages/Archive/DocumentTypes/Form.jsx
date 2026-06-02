import { Head, Link, useForm } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Save, ArrowLeft, Settings } from 'lucide-react';

export default function DocumentTypeForm({ type }) {
    const isEdit = Boolean(type);

    const { data, setData, post, put, processing, errors } = useForm({
        name: type?.name ?? '',
        name_en: type?.name_en ?? '',
        code: type?.code ?? '',
        requires_expiry: type?.requires_expiry ?? false,
        is_active: type?.is_active ?? true,
    });

    const submit = (e) => {
        e.preventDefault();
        isEdit
            ? put(`/archive/document-types/${type.id}`)
            : post('/archive/document-types');
    };

    return (
        <>
            <Head title={isEdit ? `تعديل - ${type.name}` : 'نوع مستند جديد'} />

            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4 text-sm">
                    <Link href="/archive/document-types" className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
                        <ArrowLeft size={14} /> أنواع المستندات
                    </Link>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-800 font-medium">{isEdit ? 'تعديل' : 'جديد'}</span>
                </div>

                <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-blue-50 rounded-lg">
                            <Settings size={22} className="text-blue-500" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-800">{isEdit ? 'تعديل نوع المستند' : 'نوع مستند جديد'}</h2>
                            <p className="text-xs text-gray-500">أنواع المستندات تُحدد فئة كل ملف في الأرشيف</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                الاسم <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={e => setData('name', e.target.value)}
                                required
                                placeholder="مثال: عقد، فاتورة، ترخيص..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name (English)</label>
                            <input
                                type="text"
                                value={data.name_en}
                                onChange={e => setData('name_en', e.target.value)}
                                dir="ltr"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                الرمز <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.code}
                                onChange={e => setData('code', e.target.value.toUpperCase())}
                                required
                                maxLength={30}
                                dir="ltr"
                                placeholder="CONTRACT, INVOICE, LICENSE..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={data.requires_expiry}
                                onChange={e => setData('requires_expiry', e.target.checked)}
                                className="w-4 h-4 mt-0.5 accent-amber-500"
                            />
                            <div>
                                <p className="text-sm font-medium text-gray-800">يتطلب تاريخ انتهاء</p>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    عند رفع مستند من هذا النوع، سيطلب النظام تاريخ الانتهاء وسيرسل تنبيهات قبل انقضائه
                                </p>
                            </div>
                        </label>
                    </div>

                    {isEdit && (
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={data.is_active}
                                onChange={e => setData('is_active', e.target.checked)}
                                className="w-4 h-4 accent-amber-500"
                            />
                            <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                                نوع نشط
                            </label>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <Link href="/archive/document-types" className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            إلغاء
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
                        >
                            <Save size={16} />
                            {processing ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

DocumentTypeForm.layout = page => <ArchiveLayout title={page.props.type ? 'تعديل نوع' : 'نوع جديد'} children={page} />;
