import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, Plus, Trash2, MapPin, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/api/base44Client";

/**
 * Componente para captura de fotos da entrega com:
 * - Múltiplas fotos (até 3)
 * - Captura de GPS
 * - Upload para Supabase Storage
 * - Preview das fotos
 */
export default function FotoEntregaCapture({
    onComplete,
    onCancel,
    entregaId,
    numeroPedido,
    minFotos = 1,
    maxFotos = 3
}) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    const [fotos, setFotos] = useState([]);
    const [stream, setStream] = useState(null);
    const [cameraAtiva, setCameraAtiva] = useState(false);
    const [erro, setErro] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [geolocalizacao, setGeolocalizacao] = useState(null);

    // Capturar GPS ao iniciar
    React.useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGeolocalizacao({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date().toISOString()
                    });
                },
                (error) => console.warn("GPS não disponível:", error),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, []);

    const iniciarCamera = async () => {
        try {
            setErro(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setStream(mediaStream);
                setCameraAtiva(true);
            }
        } catch (err) {
            console.error("Erro ao acessar câmera:", err);
            setErro("Não foi possível acessar a câmera. Tente selecionar uma imagem da galeria.");
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
        if (fotos.length >= maxFotos) {
            toast.warning(`Máximo de ${maxFotos} fotos permitidas`);
            return;
        }

        const canvas = canvasRef.current;
        const video = videoRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Adicionar marca d'água com data/hora
        const agora = new Date();
        const dataHora = agora.toLocaleString('pt-BR');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText(`${dataHora} - Pedido #${numeroPedido || 'N/A'}`, 10, canvas.height - 10);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        setFotos(prev => [...prev, {
            id: Date.now(),
            dataUrl,
            timestamp: agora.toISOString(),
            tipo: fotos.length === 0 ? 'principal' : 'adicional'
        }]);

        toast.success(`Foto ${fotos.length + 1} capturada!`);
    };

    const selecionarArquivo = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        files.forEach(file => {
            if (fotos.length >= maxFotos) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                setFotos(prev => {
                    if (prev.length >= maxFotos) return prev;
                    return [...prev, {
                        id: Date.now() + Math.random(),
                        dataUrl: event.target.result,
                        timestamp: new Date().toISOString(),
                        tipo: prev.length === 0 ? 'principal' : 'adicional'
                    }];
                });
            };
            reader.readAsDataURL(file);
        });
    };

    const removerFoto = (id) => {
        setFotos(prev => prev.filter(f => f.id !== id));
    };

    const uploadFotos = async () => {
        if (fotos.length < minFotos) {
            toast.error(`Tire pelo menos ${minFotos} foto(s)`);
            return;
        }

        setUploading(true);
        const fotosUploadadas = [];

        try {
            for (let i = 0; i < fotos.length; i++) {
                const foto = fotos[i];

                // Converter base64 para blob
                const response = await fetch(foto.dataUrl);
                const blob = await response.blob();

                // Nome do arquivo
                const fileName = `entregas/${entregaId}/${Date.now()}_foto_${i + 1}.jpg`;

                // Upload para Supabase Storage
                const { data, error } = await supabase.storage
                    .from('comprovantes')
                    .upload(fileName, blob, {
                        contentType: 'image/jpeg',
                        cacheControl: '3600'
                    });

                if (error) {
                    console.error('Erro upload:', error);
                    throw error;
                }

                // Obter URL pública
                const { data: urlData } = supabase.storage
                    .from('comprovantes')
                    .getPublicUrl(fileName);

                fotosUploadadas.push({
                    url: urlData.publicUrl,
                    tipo: foto.tipo,
                    timestamp: foto.timestamp
                });
            }

            pararCamera();

            // Retornar dados para o componente pai
            onComplete({
                fotos: fotosUploadadas,
                geolocalizacao,
                dataHoraEntrega: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro ao fazer upload:', error);
            toast.error('Erro ao enviar fotos. Tente novamente.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header com GPS */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-gray-900">Foto dos Móveis Entregues</h3>
                    <p className="text-xs text-gray-500">
                        Tire {minFotos === maxFotos ? minFotos : `${minFotos} a ${maxFotos}`} foto(s) dos móveis no local
                    </p>
                </div>
                {geolocalizacao && (
                    <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <MapPin className="w-3 h-3" />
                        GPS OK
                    </div>
                )}
            </div>

            {/* Preview das fotos já tiradas */}
            {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    {fotos.map((foto, index) => (
                        <div key={foto.id} className="relative aspect-square rounded-lg overflow-hidden border-2 border-green-500">
                            <img
                                src={foto.dataUrl}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => removerFoto(foto.id)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 text-center">
                                {index === 0 ? 'Principal' : `Foto ${index + 1}`}
                            </div>
                        </div>
                    ))}

                    {/* Botão para adicionar mais */}
                    {fotos.length < maxFotos && (
                        <button
                            onClick={iniciarCamera}
                            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-green-500 hover:text-green-500 transition-colors"
                        >
                            <Plus className="w-6 h-6" />
                            <span className="text-xs">Adicionar</span>
                        </button>
                    )}
                </div>
            )}

            {/* Área de câmera */}
            {(fotos.length === 0 || cameraAtiva) && (
                <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
                    {cameraAtiva ? (
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
                            <p className="text-sm">Toque para abrir a câmera</p>
                        </div>
                    )}

                    {/* Guia de enquadramento */}
                    {cameraAtiva && (
                        <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none">
                            <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-white" />
                            <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-white" />
                            <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-white" />
                            <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-white" />
                        </div>
                    )}

                    {erro && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-4 text-center">
                            <p className="text-sm">{erro}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Canvas oculto */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controles */}
            {cameraAtiva ? (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={pararCamera}
                        className="flex-1"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={capturarFoto}
                        disabled={fotos.length >= maxFotos}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                        <Camera className="w-4 h-4 mr-2" />
                        Capturar
                    </Button>
                </div>
            ) : fotos.length === 0 ? (
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
            ) : (
                <Button
                    onClick={uploadFotos}
                    disabled={fotos.length < minFotos || uploading}
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-lg"
                >
                    {uploading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Enviando...
                        </>
                    ) : (
                        <>
                            <Check className="w-5 h-5 mr-2" />
                            Confirmar {fotos.length} Foto(s)
                        </>
                    )}
                </Button>
            )}

            {/* Input de arquivo oculto */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={selecionarArquivo}
                className="hidden"
            />

            {onCancel && (
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="w-full"
                    disabled={uploading}
                >
                    Voltar
                </Button>
            )}
        </div>
    );
}
