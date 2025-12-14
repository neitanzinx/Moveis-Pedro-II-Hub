import React, { useRef, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, Check } from "lucide-react";

export default function AssinaturaDigital({ entrega, onConfirmar, onCancelar }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Configurar canvas em modo horizontal
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const confirmar = () => {
    const canvas = canvasRef.current;
    const assinaturaBase64 = canvas.toDataURL('image/png');
    onConfirmar(assinaturaBase64);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <Card className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirmar Entrega</h2>
            <p className="text-sm text-gray-600">Pedido #{entrega.numero_pedido} - {entrega.cliente_nome}</p>
            <p className="text-xs text-orange-600 mt-2">
              Por favor, vire o celular na horizontal e peça ao cliente para assinar abaixo
            </p>
          </div>

          {/* Canvas de Assinatura */}
          <div className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg mb-4" style={{ height: '300px' }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-sm">Assine aqui com o dedo</p>
            </div>
          </div>

          {/* Botões */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={onCancelar}
              className="h-12"
            >
              <X className="w-5 h-5 mr-2" />
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={limpar}
              className="h-12"
              disabled={!hasSignature}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Limpar
            </Button>
            <Button
              onClick={confirmar}
              disabled={!hasSignature}
              className="h-12 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-5 h-5 mr-2" />
              Confirmar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}