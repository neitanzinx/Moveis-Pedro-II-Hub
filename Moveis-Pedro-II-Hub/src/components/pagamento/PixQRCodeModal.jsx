import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    QrCode,
    Copy,
    Check,
    X,
    RefreshCw,
    MessageCircle,
    Clock,
    CheckCircle,
    AlertCircle,
    ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/api/base44Client";

/**
 * Modal para exibir QR Code PIX Stone com:
 * - QR Code visual
 * - Código Pix Copia-Cola
 * - Timer de expiração
 * - Status em tempo real
 * - Envio via WhatsApp
 */
export default function PixQRCodeModal({
    open,
    onClose,
    valor,
    vendaId,
    entregaId,
    numeroPedido,
    clienteNome,
    clienteTelefone,
    clienteDocumento,
    descricao,
    onPaymentConfirmed
}) {
    const [loading, setLoading] = useState(false);
    const [pixData, setPixData] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const [tempoRestante, setTempoRestante] = useState(null);
    const [status, setStatus] = useState('gerando'); // gerando | ativo | pago | expirado
    const [numeroAlternativo, setNumeroAlternativo] = useState("");

    // Gerar PIX ao abrir modal
    useEffect(() => {
        if (open && valor > 0) {
            gerarPix();
        }
    }, [open]);

    // Timer de expiração
    useEffect(() => {
        if (!pixData?.expiracao) return;

        const interval = setInterval(() => {
            const agora = new Date().getTime();
            const expiracao = new Date(pixData.expiracao).getTime();
            const diff = expiracao - agora;

            if (diff <= 0) {
                setTempoRestante(null);
                setStatus('expirado');
                clearInterval(interval);
            } else {
                const horas = Math.floor(diff / (1000 * 60 * 60));
                const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((diff % (1000 * 60)) / 1000);
                setTempoRestante(`${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [pixData?.expiracao]);

    // Polling para verificar status do pagamento
    useEffect(() => {
        if (!pixData?.cobranca_id || status !== 'ativo') return;

        const checkPaymentStatus = async () => {
            try {
                const { data, error } = await supabase
                    .from('cobrancas_pix')
                    .select('status')
                    .eq('id', pixData.cobranca_id)
                    .single();

                if (data?.status === 'CONCLUIDA') {
                    setStatus('pago');
                    toast.success('Pagamento PIX confirmado! ✅');
                    onPaymentConfirmed?.();
                }
            } catch (e) {
                console.error('Error checking payment:', e);
            }
        };

        const interval = setInterval(checkPaymentStatus, 5000); // A cada 5 segundos
        return () => clearInterval(interval);
    }, [pixData?.cobranca_id, status]);

    const gerarPix = async () => {
        setLoading(true);
        setStatus('gerando');

        try {
            const { data, error } = await supabase.functions.invoke('stone-pix-create', {
                body: {
                    valor,
                    venda_id: vendaId,
                    entrega_id: entregaId,
                    numero_pedido: numeroPedido,
                    cliente_nome: clienteNome,
                    cliente_documento: clienteDocumento,
                    descricao: descricao || `Pedido #${numeroPedido || 'N/A'} - Móveis Pedro II`
                }
            });

            if (error) throw new Error(error.message);
            if (data.error) throw new Error(data.error);

            setPixData(data);
            setStatus('ativo');
            toast.success('QR Code PIX gerado!');

        } catch (error) {
            console.error('Erro ao gerar PIX:', error);
            toast.error(error.message || 'Erro ao gerar QR Code PIX');
            setStatus('erro');
        } finally {
            setLoading(false);
        }
    };

    const copiarCodigo = async () => {
        if (!pixData?.pix_copia_cola) return;

        try {
            await navigator.clipboard.writeText(pixData.pix_copia_cola);
            setCopiado(true);
            toast.success('Código PIX copiado!');
            setTimeout(() => setCopiado(false), 3000);
        } catch (e) {
            toast.error('Erro ao copiar');
        }
    };

    const enviarWhatsApp = (telefone) => {
        if (!pixData?.pix_copia_cola || !telefone) return;

        const tel = telefone.replace(/\D/g, '');
        const telFormatado = tel.startsWith('55') ? tel : `55${tel}`;

        const mensagem = encodeURIComponent(
            `Olá ${clienteNome?.split(' ')[0] || 'Cliente'}! 👋\n\n` +
            `Segue o PIX para pagamento do seu pedido:\n\n` +
            `📦 Pedido: #${numeroPedido || 'N/A'}\n` +
            `💰 Valor: R$ ${valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
            `📱 *PIX Copia e Cola:*\n${pixData.pix_copia_cola}\n\n` +
            `⏰ Válido por 24 horas\n\n` +
            `Móveis Pedro II 🧡💚`
        );

        window.open(`https://wa.me/${telFormatado}?text=${mensagem}`, '_blank');
    };

    const getStatusBadge = () => {
        switch (status) {
            case 'gerando':
                return <Badge className="bg-blue-100 text-blue-800"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Gerando...</Badge>;
            case 'ativo':
                return <Badge className="bg-orange-100 text-orange-800"><Clock className="w-3 h-3 mr-1" /> Aguardando Pagamento</Badge>;
            case 'pago':
                return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Pago ✅</Badge>;
            case 'expirado':
                return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" /> Expirado</Badge>;
            case 'erro':
                return <Badge className="bg-red-100 text-red-800"><X className="w-3 h-3 mr-1" /> Erro</Badge>;
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
            <DialogContent className="max-w-md mx-4">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-green-600" />
                            PIX Stone
                        </span>
                        {getStatusBadge()}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Valor */}
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white text-center">
                        <p className="text-sm opacity-90">Valor a Pagar</p>
                        <p className="text-3xl font-bold">
                            R$ {valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {numeroPedido && (
                            <p className="text-sm opacity-80 mt-1">Pedido #{numeroPedido}</p>
                        )}
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4" />
                            <p className="text-gray-500">Gerando QR Code PIX...</p>
                        </div>
                    )}

                    {/* QR Code */}
                    {pixData && status !== 'pago' && (
                        <>
                            <div className="flex justify-center">
                                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-sm">
                                    <img
                                        src={pixData.qr_code_image}
                                        alt="QR Code PIX"
                                        className="w-48 h-48"
                                    />
                                </div>
                            </div>

                            {/* Timer */}
                            {tempoRestante && status === 'ativo' && (
                                <div className="flex items-center justify-center gap-2 text-orange-600">
                                    <Clock className="w-4 h-4" />
                                    <span className="font-mono font-bold">{tempoRestante}</span>
                                    <span className="text-sm">restantes</span>
                                </div>
                            )}

                            {/* Código Copia-Cola */}
                            <div className="bg-gray-50 rounded-lg p-3 border">
                                <p className="text-xs text-gray-500 mb-2 font-medium">PIX Copia e Cola</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={pixData.pix_copia_cola}
                                        readOnly
                                        className="flex-1 bg-white border rounded px-2 py-1.5 text-xs font-mono text-gray-600 truncate"
                                    />
                                    <Button
                                        size="sm"
                                        variant={copiado ? "default" : "outline"}
                                        onClick={copiarCodigo}
                                        className={copiado ? "bg-green-600 hover:bg-green-700" : ""}
                                    >
                                        {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>

                            {/* WhatsApp */}
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-3">
                                <p className="text-sm font-semibold text-green-800 flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" />
                                    Enviar via WhatsApp
                                </p>

                                {clienteTelefone && (
                                    <Button
                                        size="sm"
                                        onClick={() => enviarWhatsApp(clienteTelefone)}
                                        className="w-full bg-green-600 hover:bg-green-700 justify-start gap-2"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        Enviar para {clienteNome?.split(' ')[0] || 'Cliente'}
                                    </Button>
                                )}

                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Input
                                            type="tel"
                                            placeholder="Outro número"
                                            value={numeroAlternativo}
                                            onChange={(e) => setNumeroAlternativo(e.target.value.replace(/\D/g, ''))}
                                            className="h-9 text-sm pl-10"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">+55</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={numeroAlternativo.length < 10}
                                        onClick={() => enviarWhatsApp(numeroAlternativo)}
                                        className="shrink-0"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Status Pago */}
                    {status === 'pago' && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle className="w-12 h-12 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-green-700">Pagamento Confirmado!</h3>
                            <p className="text-gray-500 mt-2">O PIX foi recebido com sucesso.</p>
                            <Button
                                onClick={onClose}
                                className="mt-6 bg-green-600 hover:bg-green-700"
                            >
                                Fechar
                            </Button>
                        </div>
                    )}

                    {/* Status Expirado */}
                    {status === 'expirado' && (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
                            <p className="text-gray-600">QR Code expirado</p>
                            <Button
                                onClick={gerarPix}
                                variant="outline"
                                className="mt-4"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Gerar Novo
                            </Button>
                        </div>
                    )}

                    {/* Status Erro */}
                    {status === 'erro' && !loading && (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <X className="w-12 h-12 text-red-500 mb-3" />
                            <p className="text-gray-600">Erro ao gerar PIX</p>
                            <Button
                                onClick={gerarPix}
                                variant="outline"
                                className="mt-4"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Tentar Novamente
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
