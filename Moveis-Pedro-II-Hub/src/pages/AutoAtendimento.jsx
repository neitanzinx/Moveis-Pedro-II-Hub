import React, { useState, useRef, useEffect } from 'react';
import { supabase, base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Search, ArrowRight, CheckCircle, RefreshCcw, Loader2, Trash2, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const TIPOS_ASSISTENCIA = [
    { value: "Devolução", label: "Devolução" },
    { value: "Troca", label: "Troca" },
    { value: "Peça Faltante", label: "Peça Faltante" },
    { value: "Conserto", label: "Conserto" },
    { value: "Outros", label: "Outros" }
];

export default function AutoAtendimento() {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Identification
    const [searchTerm, setSearchTerm] = useState("");
    const [pedido, setPedido] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    // Details
    const [tipo, setTipo] = useState("Conserto");
    const [descricao, setDescricao] = useState("");

    // Camera
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [photos, setPhotos] = useState([]);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Step 1: Find Order
    const handleSearch = async () => {
        setErrorMsg("");
        if (!searchTerm.trim()) {
            const msg = "Digite o número do pedido ou CPF";
            setErrorMsg(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);
        try {
            const cleanSearch = searchTerm.replace(/\D/g, ''); // Remove non-digits for CPF

            // First try by numero_pedido
            let { data, error } = await supabase
                .from('vendas')
                .select('*')
                .eq('numero_pedido', searchTerm)
                .limit(1)
                .maybeSingle();

            // If not found by pedido, try by CPF/CNPJ or telefone via clientes table
            if (!data && cleanSearch.length >= 10) {
                // Try to find client by CPF/CNPJ or telefone
                const { data: cliente } = await supabase
                    .from('clientes')
                    .select('id')
                    .or(`cpf_cnpj.eq.${cleanSearch},telefone.ilike.%${cleanSearch}%`)
                    .maybeSingle();

                if (cliente) {
                    const { data: vendaByCliente } = await supabase
                        .from('vendas')
                        .select('*')
                        .eq('cliente_id', cliente.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    data = vendaByCliente;
                }

                // Also try directly by cliente_telefone in vendas
                if (!data) {
                    const { data: vendaByTel } = await supabase
                        .from('vendas')
                        .select('*')
                        .ilike('cliente_telefone', `%${cleanSearch}%`)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    data = vendaByTel;
                }
            }

            if (error) throw error;

            if (data) {
                setPedido(data);
                toast.success("Pedido encontrado!");
                setStep(1);
            } else {
                const msg = "Pedido não encontrado. Verifique os dados.";
                setErrorMsg(msg);
                toast.error(msg);
            }
        } catch (err) {
            console.error(err);
            const msg = "Erro ao buscar pedido. Tente novamente.";
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Camera Logic
    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setCameraActive(true);
        } catch (err) {
            console.error("Erro ao acessar câmera:", err);
            toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCameraActive(false);
    };

    const takePhoto = () => {
        if (!videoRef.current || !canvasRef.current || !pedido) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Add Watermark
        const date = new Date().toLocaleString('pt-BR');
        const text = `PEDIDO #${pedido.numero_pedido} - ${date} - MÓVEIS PEDRO II`;

        context.font = 'bold 24px Arial';
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.shadowColor = 'black';
        context.shadowBlur = 4;
        context.fillText(text, 20, canvas.height - 30);

        // Convert to blob
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            setPhotos(prev => [...prev, { blob, url, name: `foto_${Date.now()}.jpg` }]);
            toast.success("Foto capturada!");
        }, 'image/jpeg', 0.85);
    };

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    // Final Submission
    const handleSubmit = async () => {
        if (photos.length === 0) {
            toast.error("Por favor, tire pelo menos uma foto do problema.");
            return;
        }
        if (!descricao.trim()) {
            toast.error("Por favor, descreva o problema.");
            return;
        }

        setLoading(true);
        try {
            // Upload Photos
            const uploadedFiles = [];
            for (const photo of photos) {
                const file = new File([photo.blob], photo.name, { type: 'image/jpeg' });
                const result = await base44.integrations.Core.UploadFile({ file });
                uploadedFiles.push({
                    nome: photo.name,
                    url: result.file_url,
                    tipo: 'image/jpeg',
                    data: new Date().toISOString()
                });
            }

            // Create Assistance Record
            const { error } = await supabase.from('assistencias_tecnicas').insert({
                venda_id: pedido.id,
                numero_pedido: pedido.numero_pedido,
                cliente_nome: pedido.cliente_nome,
                cliente_telefone: pedido.cliente_telefone,
                tipo: tipo,
                descricao_problema: descricao,
                status: 'Aberta',
                prioridade: 'Normal',
                data_abertura: new Date().toISOString(),
                arquivos: uploadedFiles,
                observacoes: 'Solicitação via Autoatendimento'
            });

            if (error) throw error;

            setStep(3); // Success Step
            toast.success("Solicitação enviada com sucesso!");

        } catch (err) {
            console.error(err);
            toast.error("Erro ao enviar solicitação.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full">

                {/* Header Logo */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-green-800">Móveis Pedro II</h1>
                    <p className="text-gray-500">Autoatendimento Assistência Técnica</p>
                </div>

                {/* STEPS */}
                {step === 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Identificação</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Para iniciar, digite o número do seu pedido ou seu CPF (apenas números).
                            </p>
                            <div className="space-y-2">
                                <Label>Número do Pedido ou CPF</Label>
                                <Input
                                    placeholder="Ex: 12345 ou CPF"
                                    value={searchTerm}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setErrorMsg("");
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    className={errorMsg ? "border-red-500" : ""}
                                />
                                {errorMsg && (
                                    <p className="text-sm text-red-600 flex items-center mt-1">
                                        <AlertTriangle className="w-4 h-4 mr-1" />
                                        {errorMsg}
                                    </p>
                                )}
                            </div>
                            <Button className="w-full bg-green-700 hover:bg-green-800 text-white" onClick={handleSearch} disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar Pedido"}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalhes do Problema</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-sm mb-2">
                                <p><strong>Pedido:</strong> #{pedido?.numero_pedido}</p>
                                <p><strong>Cliente:</strong> {pedido?.cliente_nome}</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Solicitação</Label>
                                <Select value={tipo} onValueChange={setTipo}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIPOS_ASSISTENCIA.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição do Problema</Label>
                                <Textarea
                                    placeholder="Descreva o que aconteceu..."
                                    value={descricao}
                                    onChange={e => setDescricao(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <Button className="w-full" onClick={() => setStep(2)}>
                                Próximo: Fotos <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                Fotos do Problema
                                <span className="text-sm font-normal text-gray-500">{photos.length} fotos</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                            <p className="text-center text-sm text-gray-600">
                                Tire fotos claras do defeito. A câmera será ativada e a data será registrada automaticamente na foto.
                            </p>

                            {/* Camera View */}
                            {cameraActive ? (
                                <div className="space-y-4">
                                    <div className="aspect-[3/4] bg-black rounded-lg overflow-hidden relative">
                                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                                        <canvas ref={canvasRef} className="hidden"></canvas>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" onClick={stopCamera} className="w-full">
                                            Cancelar
                                        </Button>
                                        <Button onClick={takePhoto} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                            <Camera className="w-4 h-4 mr-2" /> Capturar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button className="w-full py-8 text-lg bg-blue-600 hover:bg-blue-700 text-white" onClick={startCamera}>
                                    <Camera className="w-6 h-6 mr-2" /> Abrir Câmera
                                </Button>
                            )}

                            {/* Gallery of captured photos */}
                            {photos.length > 0 && !cameraActive && (
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    {photos.map((photo, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                                            <img src={photo.url} alt="Evidencia" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => removePhoto(idx)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-md"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!cameraActive && (
                                <div className="flex gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                        Voltar
                                    </Button>
                                    <Button
                                        className="flex-1 bg-green-700 hover:bg-green-800 text-white"
                                        onClick={handleSubmit}
                                        disabled={loading || photos.length === 0}
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Solicitação"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {step === 3 && (
                    <Card className="border-t-4 border-t-green-600 text-center p-6">
                        <CardContent className="space-y-4">
                            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                            <h2 className="text-2xl font-bold text-gray-900">Solicitação Enviada!</h2>
                            <p className="text-gray-600">
                                Recebemos seu pedido de assistência. Nossa equipe analisará as fotos e entrará em contato em breve.
                            </p>
                            <p className="text-sm text-gray-500">
                                Protocolo gerado para o pedido #{pedido?.numero_pedido}
                            </p>
                            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
                                Voltar ao Início
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
