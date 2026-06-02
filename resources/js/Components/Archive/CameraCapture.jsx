import { useState, useRef, useEffect } from 'react';
import { Camera, X, RotateCw, Check, RefreshCw, Loader2 } from 'lucide-react';

export default function CameraCapture({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [error, setError] = useState(null);
    const [facingMode, setFacingMode] = useState('environment');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [facingMode]);

    const startCamera = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!window.isSecureContext) {
                throw new Error('INSECURE_CONTEXT');
            }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('UNSUPPORTED');
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            const name = err?.name;
            const message = err?.message ?? String(err);

            if (message === 'INSECURE_CONTEXT') {
                setError('ميزة الكاميرا تحتاج اتصال HTTPS (أو localhost). افتح النظام عبر https:// ثم أعد المحاولة.');
            } else if (message === 'UNSUPPORTED') {
                setError('المتصفح لا يدعم تشغيل الكاميرا (getUserMedia). جرّب Chrome/Edge أو استخدم رفع ملف بدلاً من الكاميرا.');
            } else if (name === 'NotAllowedError') {
                setError('لم يتم السماح بالوصول للكاميرا. فعّل الإذن من إعدادات المتصفح ثم أعد المحاولة.');
            } else {
                setError('لا يمكن الوصول للكاميرا: ' + message);
            }
        } finally {
            setLoading(false);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const capture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            setCapturedImage({ blob, url });
        }, 'image/jpeg', 0.92);
    };

    const accept = () => {
        if (!capturedImage) return;
        const timestamp = Date.now();
        const file = new File(
            [capturedImage.blob],
            `scan-${timestamp}.jpg`,
            { type: 'image/jpeg' }
        );
        onCapture(file);
        onClose();
    };

    const retake = () => {
        if (capturedImage) {
            URL.revokeObjectURL(capturedImage.url);
            setCapturedImage(null);
        }
    };

    const switchCamera = () => {
        stopCamera();
        setFacingMode(m => m === 'environment' ? 'user' : 'environment');
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden max-w-3xl w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur">
                    <div className="flex items-center gap-2 text-white">
                        <Camera size={20} />
                        <h3 className="font-bold">{capturedImage ? 'مراجعة المسح' : 'مسح مستند'}</h3>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="relative aspect-video bg-black flex items-center justify-center">
                    {error ? (
                        <div className="text-white text-center p-8">
                            <Camera size={48} className="mx-auto mb-4 text-white/40" />
                            <p className="mb-2 font-medium">⚠️ {error}</p>
                            <button
                                onClick={startCamera}
                                className="mt-4 px-4 py-2 bg-amber-500 rounded-lg text-sm font-medium"
                            >
                                إعادة المحاولة
                            </button>
                        </div>
                    ) : capturedImage ? (
                        <img src={capturedImage.url} alt="Captured" className="max-w-full max-h-full" />
                    ) : (
                        <>
                            {loading && (
                                <div className="absolute z-10 text-white flex flex-col items-center gap-2">
                                    <Loader2 size={32} className="animate-spin" />
                                    <p className="text-sm">جاري تشغيل الكاميرا...</p>
                                </div>
                            )}
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-contain"
                            />
                            {/* Overlay guide */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="border-2 border-amber-400/60 w-[70%] h-[80%] rounded-lg"></div>
                            </div>
                        </>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 p-4 bg-gray-900/80">
                    {capturedImage ? (
                        <>
                            <button
                                onClick={retake}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                            >
                                <RefreshCw size={18} />
                                إعادة المسح
                            </button>
                            <button
                                onClick={accept}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                            >
                                <Check size={18} />
                                استخدام الصورة
                            </button>
                        </>
                    ) : !error && !loading ? (
                        <>
                            <button
                                onClick={switchCamera}
                                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full"
                                title="قلب الكاميرا"
                            >
                                <RotateCw size={20} />
                            </button>
                            <button
                                onClick={capture}
                                className="w-16 h-16 bg-white hover:bg-gray-100 rounded-full border-4 border-amber-400 transition-all hover:scale-105 flex items-center justify-center"
                                title="التقاط"
                            >
                                <div className="w-12 h-12 bg-amber-500 rounded-full" />
                            </button>
                            <div className="w-12"></div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
