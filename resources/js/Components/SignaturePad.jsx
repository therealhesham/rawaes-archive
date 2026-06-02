import { useEffect, useRef, useState } from 'react';

export default function SignaturePad({
    value,
    onChange,
    heightClass = 'h-40',
    label = 'التوقيع',
}) {
    const canvasRef = useRef(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef({ x: 0, y: 0 });
    const [isEmpty, setIsEmpty] = useState(true);

    const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111827'; // gray-900
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
        onChange?.('');
    };

    const loadValue = async (dataUrl) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!dataUrl) {
            setIsEmpty(true);
            return;
        }

        const img = new Image();
        img.onload = () => {
            // draw in CSS pixel units (canvas was scaled already in resizeCanvas)
            ctx.drawImage(img, 0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
            setIsEmpty(false);
        };
        img.src = dataUrl;
    };

    const toDataUrl = () => {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        // export at pixel size (still ok)
        return canvas.toDataURL('image/png');
    };

    const getPoint = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return { x, y };
    };

    const startDraw = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        drawingRef.current = true;
        canvas.setPointerCapture?.(e.pointerId);
        lastPointRef.current = getPoint(e);
    };

    const draw = (e) => {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const next = getPoint(e);
        const prev = lastPointRef.current;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
        lastPointRef.current = next;
        setIsEmpty(false);
    };

    const endDraw = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        const data = toDataUrl();
        onChange?.(data);
    };

    useEffect(() => {
        resizeCanvas();
        loadValue(value);
        const onResize = () => {
            // keep current drawing if possible
            const current = isEmpty ? '' : toDataUrl();
            resizeCanvas();
            loadValue(current);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // external value change (opening modal / reset)
        loadValue(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700">{label}</label>
                <button
                    type="button"
                    onClick={clear}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                    مسح التوقيع
                </button>
            </div>

            <div className={`w-full ${heightClass} rounded-lg border border-gray-200 bg-white overflow-hidden`}>
                <canvas
                    ref={canvasRef}
                    className="w-full h-full touch-none"
                    onPointerDown={startDraw}
                    onPointerMove={draw}
                    onPointerUp={endDraw}
                    onPointerCancel={endDraw}
                />
            </div>

            <div className="mt-1 text-[11px] text-gray-500">
                وقّع بالماوس أو باللمس.
            </div>
        </div>
    );
}

