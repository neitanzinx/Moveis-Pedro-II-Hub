import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check, RotateCcw } from "lucide-react";

export default function AssinaturaCanvas({ onSave, onCancel }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Configurar canvas responsivo
        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

            // Configurar estilo do traço
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Fundo branco
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, rect.width, rect.height);

            // Linha de assinatura
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, rect.height - 40);
            ctx.lineTo(rect.width - 20, rect.height - 40);
            ctx.stroke();

            // Resetar estilo para desenho
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const getCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        if (e.touches) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const coords = getCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const coords = getCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = (e) => {
        e?.preventDefault();
        setIsDrawing(false);
    };

    const limpar = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Redesenhar linha
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, rect.height - 40);
        ctx.lineTo(rect.width - 20, rect.height - 40);
        ctx.stroke();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        setHasDrawn(false);
    };

    const salvar = () => {
        if (!hasDrawn) {
            alert("Por favor, assine antes de confirmar.");
            return;
        }

        const canvas = canvasRef.current;
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="space-y-4">
            <div className="text-center mb-2">
                <p className="text-sm text-gray-500">Assine com o dedo na área abaixo</p>
            </div>

            <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white touch-none">
                <canvas
                    ref={canvasRef}
                    className="w-full h-[200px] cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>

            <div className="flex gap-2">
                <Button
                    variant="outline"
                    onClick={limpar}
                    className="flex-1"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Limpar
                </Button>
                <Button
                    onClick={salvar}
                    disabled={!hasDrawn}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                >
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar Assinatura
                </Button>
            </div>

            {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="w-full">
                    Cancelar
                </Button>
            )}
        </div>
    );
}
