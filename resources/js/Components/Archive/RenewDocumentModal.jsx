import { useState } from 'react';
import { router } from '@inertiajs/react';
import { CalendarClock, Loader2 } from 'lucide-react';

export default function RenewDocumentModal({ document: doc, open, onClose }) {
    const [expiryDate, setExpiryDate] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    if (!open) return null;

    const minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const submit = () => {
        if (!expiryDate || processing) return;
        setProcessing(true);
        setError('');
        router.post(`/archive/documents/${doc.id}/renew`, { expiry_date: expiryDate }, {
            preserveScroll: true,
            onSuccess: () => {
                onClose();
                setExpiryDate('');
            },
            onError: (errors) => setError(errors.expiry_date ?? 'تعذر تجديد الصلاحية'),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <CalendarClock size={16} className="text-emerald-600" />
                        تجديد صلاحية المستند: {doc.title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                {doc.expiry_date && (
                    <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 mb-3">
                        تاريخ الانتهاء الحالي: <span className="font-bold text-red-600">{doc.expiry_date}</span>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        تاريخ الانتهاء الجديد <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        value={expiryDate}
                        min={minDate}
                        onChange={e => setExpiryDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>

                <button
                    onClick={submit}
                    disabled={!expiryDate || processing}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold rounded-lg py-2.5 text-sm"
                >
                    {processing ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
                    {processing ? 'جاري التجديد...' : 'تجديد الصلاحية'}
                </button>
            </div>
        </div>
    );
}
