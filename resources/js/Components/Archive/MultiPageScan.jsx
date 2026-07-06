import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
    ScanLine, X, Plus, FileText, Trash2, Loader2, Check,
    AlertCircle, RefreshCw, Image as ImageIcon
} from 'lucide-react';

const SCAN_BRIDGE_URL = 'http://localhost:9999';

export default function MultiPageScan({ open, onClose, onComplete, scanToken }) {
    const [pages, setPages] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [defaultName, setDefaultName] = useState('scan');
    const [source, setSource] = useState('feeder');  // 'feeder' | 'flatbed' | 'auto'
    const [color, setColor] = useState('gray');      // 'color' | 'gray' | 'bw'
    const [dpi, setDpi] = useState(150);             // 100 | 150 | 200 | 300
    const [duplex, setDuplex] = useState(false);
    const [maxPages, setMaxPages] = useState(100);

    useEffect(() => {
        if (!open) {
            // Cleanup when closed
            pages.forEach(p => URL.revokeObjectURL(p.dataUrl));
            setPages([]);
            setError(null);
            return;
        }

        const loadBridgeSettings = async () => {
            try {
                const res = await fetch(`${SCAN_BRIDGE_URL}/settings`, {
                    headers: { 'X-Scan-Token': scanToken },
                });
                if (!res.ok) return;
                const settings = await res.json();
                if (settings.source) setSource(settings.source);
                if (settings.color) setColor(settings.color);
                if (settings.dpi) setDpi(Number(settings.dpi));
                if (typeof settings.duplex === 'boolean') setDuplex(settings.duplex);
                if (settings.max_pages) setMaxPages(Number(settings.max_pages));
            } catch {
            }
        };

        loadBridgeSettings();
    }, [open]);

    // Convert base64 to Blob
    const base64ToBlob = (base64, mime = 'image/jpeg') => {
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        return new Blob([arr], { type: mime });
    };

    // Scan from local bridge
    const scanPage = async () => {
        setScanning(true);
        setError(null);
        try {
            const healthRes = await fetch(`${SCAN_BRIDGE_URL}/health`).catch(() => null);
            if (!healthRes || !healthRes.ok) throw new Error('CONNECTION');

            const isFlatbed = source === 'flatbed';
            const endpoint = isFlatbed ? '/scan' : '/scan-batch';
            const res = await fetch(`${SCAN_BRIDGE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Scan-Token': scanToken,
                },
                body: JSON.stringify({ color, dpi, source, duplex, max_pages: maxPages }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || `فشل المسح (${res.status})`);
            }

            let newPages = [];
            if (isFlatbed) {
                const blob = await res.blob();
                if (!blob || blob.size === 0) {
                    throw new Error('لم يتم مسح أي صفحة من الزجاج. تأكد أن السكانر جاهز وأن الورقة موضوعة على الزجاج.');
                }

                newPages = [{
                    blob,
                    dataUrl: URL.createObjectURL(blob),
                    id: Date.now() + Math.random(),
                }];
            } else {
                const result = await res.json();
                if (!result.pages || result.pages.length === 0) {
                    throw new Error('لم يتم مسح أي صفحة. تأكد من وجود ورق في الدرج وأن السكانر جاهز.');
                }

                newPages = result.pages.map(p => {
                    const blob = base64ToBlob(p.data, p.mime);
                    return {
                        blob,
                        dataUrl: URL.createObjectURL(blob),
                        id: Date.now() + Math.random(),
                    };
                });
            }

            setPages(prev => [...prev, ...newPages]);
        } catch (err) {
            setError(
                err.message === 'CONNECTION'
                    ? 'لا يمكن الاتصال بجهاز الكمبيوتر. تأكد من تشغيل برنامج "روائس - مراقب السكانر"'
                    : err.message
            );
        } finally {
            setScanning(false);
        }
    };

    const removePage = (id) => {
        const page = pages.find(p => p.id === id);
        if (page) URL.revokeObjectURL(page.dataUrl);
        setPages(prev => prev.filter(p => p.id !== id));
    };

    const generatePdf = async () => {
        if (pages.length === 0) return;
        setGenerating(true);
        try {
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true,
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];

                // Convert blob to data URL
                const reader = new FileReader();
                const dataUrl = await new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(page.blob);
                });

                // Get image dimensions to fit page
                const img = new Image();
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.src = dataUrl;
                });

                // Calculate dimensions to fit A4 with margin
                const margin = 5;
                const maxWidth = pageWidth - margin * 2;
                const maxHeight = pageHeight - margin * 2;
                const ratio = Math.min(maxWidth / (img.width * 0.264583), maxHeight / (img.height * 0.264583));
                const w = (img.width * 0.264583) * ratio;
                const h = (img.height * 0.264583) * ratio;
                const x = (pageWidth - w) / 2;
                const y = (pageHeight - h) / 2;

                if (i > 0) pdf.addPage();
                pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
            }

            // Generate PDF blob
            const pdfBlob = pdf.output('blob');
            const fileName = `${defaultName}-${Date.now()}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            onComplete(file);
            onClose();
        } catch (err) {
            console.error(err);
            setError('فشل إنشاء PDF: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-gradient-to-l from-[#1e2a4a] to-[#2c3e6e] text-white p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 rounded-xl">
                            <ScanLine size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold">مسح ضوئي متعدد الصفحات</h3>
                            <p className="text-xs text-white/70">
                                اختر الدرج لمسح عدة صفحات أو الزجاج لمسح صفحة واحدة
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg" disabled={generating}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50">

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-red-700 text-sm">{error}</p>
                            </div>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Pages grid */}
                    {/* Settings panel */}
                    {pages.length === 0 && !scanning && !error && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
                            <p className="text-sm font-medium text-gray-700 mb-3">إعدادات المسح</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">الجارور / المصدر</label>
                                    <select value={source} onChange={e => setSource(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                                        <option value="feeder">ADF / الدرج</option>
                                        <option value="flatbed">الزجاج</option>
                                        <option value="auto">تلقائي</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">اللون</label>
                                    <select value={color} onChange={e => setColor(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                                        <option value="gray">أبيض وأسود (أسرع)</option>
                                        <option value="color">ملوّن</option>
                                        <option value="bw">ثنائي (نص فقط)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">الجودة (DPI)</label>
                                    <select value={dpi} onChange={e => setDpi(parseInt(e.target.value))}
                                        className="w-full border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                                        <option value="100">منخفضة (100) - سريع جداً</option>
                                        <option value="150">متوسطة (150) - موصى به</option>
                                        <option value="200">عالية (200)</option>
                                        <option value="300">عالية جداً (300) - بطيء</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">أقصى عدد صفحات</label>
                                    <select value={maxPages} onChange={e => setMaxPages(parseInt(e.target.value))}
                                        className="w-full border border-gray-200 rounded-lg  py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                        <option value="150">150</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2">
                                        <input type="checkbox" checked={duplex} onChange={e => setDuplex(e.target.checked)} />
                                        وجهين (Duplex)
                                    </label>
                                </div>
                            </div>
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                                <span className="text-amber-500 shrink-0">📌</span>
                                <p className="text-xs text-amber-800">
                                    ضع كل الأوراق في درج السكانر، ثم اضغط <strong>"ابدأ المسح"</strong>.
                                    سيمسح كل الأوراق دفعة واحدة.
                                </p>
                            </div>
                        </div>
                    )}

                    {pages.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                            {pages.map((page, idx) => (
                                <div key={page.id} className="relative bg-white rounded-xl border-2 border-gray-200 overflow-hidden group hover:border-amber-300 transition-colors">
                                    <div className="aspect-[3/4] bg-gray-100">
                                        <img
                                            src={page.dataUrl}
                                            alt={`صفحة ${idx + 1}`}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        صفحة {idx + 1}
                                    </div>
                                    <button
                                        onClick={() => removePage(page.id)}
                                        disabled={generating}
                                        className="absolute top-2 left-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                        title="حذف هذه الصفحة"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : !scanning && !error && (
                        <div className="text-center py-12">
                            <ImageIcon size={48} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 text-sm">لم يتم مسح أي صفحة بعد</p>
                        </div>
                    )}

                    {scanning && (
                        <div className="flex flex-col items-center justify-center py-10 bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl">
                            <Loader2 size={36} className="animate-spin text-amber-500 mb-3" />
                            <p className="font-medium text-amber-700">جاري المسح من الدرج...</p>
                            <p className="text-xs text-amber-600 mt-1">يتم سحب الأوراق ومسحها — قد يستغرق دقائق حسب العدد</p>
                        </div>
                    )}

                    {/* PDF Name */}
                    {pages.length > 0 && !scanning && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <label className="block text-xs text-gray-500 mb-1">اسم الملف</label>
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-amber-500 shrink-0" />
                                <input
                                    type="text"
                                    value={defaultName}
                                    onChange={e => setDefaultName(e.target.value)}
                                    placeholder="scan"
                                    className="flex-1 border-0 outline-none text-sm font-medium text-gray-800"
                                />
                                <span className="text-xs text-gray-400">.pdf</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-100 p-4 bg-white flex items-center gap-3">
                    <button
                        onClick={onClose}
                        disabled={generating}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        إلغاء
                    </button>

                    <button
                        onClick={scanPage}
                        disabled={scanning || generating}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl text-sm font-medium"
                    >
                        {scanning
                            ? <><Loader2 size={15} className="animate-spin" /> جاري المسح...</>
                            : pages.length === 0
                                ? <><ScanLine size={15} /> ابدأ المسح</>
                                : <><Plus size={15} /> مسح أوراق إضافية</>
                        }
                    </button>

                    <div className="flex-1"></div>

                    {pages.length > 0 && (
                        <button
                            onClick={generatePdf}
                            disabled={scanning || generating}
                            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold"
                        >
                            {generating
                                ? <><Loader2 size={15} className="animate-spin" /> جاري الإنشاء...</>
                                : <><Check size={15} /> حفظ ({pages.length} صفحة) PDF</>
                            }
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
