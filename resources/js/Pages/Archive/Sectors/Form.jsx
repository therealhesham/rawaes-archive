import { Head, Link, useForm } from '@inertiajs/react';
import ArchiveLayout from '@/Layouts/ArchiveLayout';
import { Save, ArrowLeft, Archive } from 'lucide-react';

export default function SectorForm({ sector }) {
    const isEdit = Boolean(sector);

    const { data, setData, post, put, processing, errors } = useForm({
        name: sector?.name ?? '',
        name_en: sector?.name_en ?? '',
        code: sector?.code ?? '',
        description: sector?.description ?? '',
        is_active: sector?.is_active ?? true,
    });

    const submit = (e) => {
        e.preventDefault();
        isEdit
            ? put(`/archive/sectors/${sector.id}`)
            : post('/archive/sectors');
    };

    return (
        <>
            <Head title={isEdit ? `تعديل - ${sector.name}` : 'قطاع جديد'} />

            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4 text-sm">
                    <Link href="/archive/sectors" className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
                        <ArrowLeft size={14} /> القطاعات
                    </Link>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-800 font-medium">{isEdit ? 'تعديل' : 'جديد'}</span>
                </div>

                <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-amber-50 rounded-lg">
                            <Archive size={22} className="text-amber-500" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-800">{isEdit ? 'تعديل قطاع' : 'قطاع جديد'}</h2>
                            <p className="text-xs text-gray-500">القطاعات تُستخدم لتصنيف المستندات والمجلدات</p>
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                الرمز <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.code}
                                onChange={e => setData('code', e.target.value.toUpperCase())}
                                required
                                maxLength={20}
                                dir="ltr"
                                placeholder="HTL, RNT, FIN..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
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
                                    قطاع نشط
                                </label>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">الوصف</label>
                        <textarea
                            value={data.description}
                            onChange={e => setData('description', e.target.value)}
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <Link href="/archive/sectors" className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
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

SectorForm.layout = page => <ArchiveLayout title={page.props.sector ? 'تعديل قطاع' : 'قطاع جديد'} children={page} />;
