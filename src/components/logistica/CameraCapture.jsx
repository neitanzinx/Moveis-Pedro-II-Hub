import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, Upload, X } from "lucide-react";

export default function CameraCapture({ onCapture, onCancel, titulo = "Tirar Foto" }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [foto, setFoto] = useState(null);
    const [cameraAtiva, setCameraAtiva] = useState(false);
    const [erro, setErro] = useState(null);

    const iniciarCamera = async () => {
        try {
            setErro(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }, // Câmera traseira
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setStream(mediaStream);
                setCameraAtiva(true);
            }
        } catch (err) {
            console.error("Erro ao acessar câmera:", err);
            setErro("Não foi possível acessar a câmera. Tente selecionar uma imagem.");
        }
    };

    const pararCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCameraAtiva(false);
    };

    const capturarFoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFoto(dataUrl);
        pararCamera();
    };

    const selecionarArquivo = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setFoto(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const refazer = () => {
        setFoto(null);
        setErro(null);
    };

    const confirmar = () => {
        if (foto) {
            onCapture(foto);
        }
    };

    return (
        <div className="space-y-4">
            <div className="text-center mb-2">
                <p className="font-medium text-gray-700">{titulo}</p>
            </div>

            {/* Área de preview/câmera */}
            <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
                {foto ? (
                    <img
                        src={foto}
                        alt="Foto capturada"
                        className="w-full h-full object-cover"
                    />
                ) : cameraAtiva ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white/50">
                        <Camera className="w-12 h-12 mb-2" />
                        <p className="text-sm">Câmera não iniciada</p>
                    </div>
                )}

                {erro && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-4 text-center">
                        <p className="text-sm">{erro}</p>
                    </div>
                )}
            </div>

            {/* Canvas oculto para captura */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controles */}
            {foto ? (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={refazer}
                        className="flex-1"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Refazer
                    </Button>
                    <Button
                        onClick={confirmar}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Usar Foto
                    </Button>
                </div>
            ) : cameraAtiva ? (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={pararCamera}
                        className="flex-1"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                    </Button>
                    <Button
                        onClick={capturarFoto}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                        <Camera className="w-4 h-4 mr-2" />
                        Capturar
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <Button
                        onClick={iniciarCamera}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                        <Camera className="w-4 h-4 mr-2" />
                        Abrir Câmera
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Galeria
                    </Button>
                </div>
            )}

            {/* Input de arquivo oculto */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={selecionarArquivo}
                className="hidden"
            />

            {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="w-full">
                    Cancelar
                </Button>
            )}
        </div>
    );
}
