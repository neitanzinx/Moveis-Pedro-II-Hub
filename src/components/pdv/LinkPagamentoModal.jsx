import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Loader2, Copy, Check, Download, ExternalLink, MessageCircle,
    QrCode, Link2, AlertCircle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/api/base44Client";

export default function LinkPagamentoModal({
    isOpen,
    onClose,
    venda,
    cliente,
    onLinkGenerated
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [linkData, setLinkData] = useState(null);
    const [copied, setCopied] = useState(false);

    const gerarLink = async () => {
        setLoading(true);
        setError(null);

        try {
            // Payload para Stone Payment Link
            const payload = {
                venda_id: venda.id,
                valor: venda.valor_total || 0,
                descricao: `Pedido #${venda.numero_pedido} - Móveis Pedro II`,
                cliente_nome: cliente?.nome_completo || "Cliente",
                cliente_email: cliente?.email || null,
                cliente_documento: cliente?.cpf || null,
                payment_methods: ['pix', 'credit_card', 'boleto'],
                max_installments: 12,
                expires_in_days: 7
            };

            const { data, error: fnError } = await supabase.functions.invoke('stone-payment-link', {
                body: payload
            });

            if (fnError) {
                throw new Error(fnError.message || "Erro ao chamar função");
            }

            if (data.error) {
                throw new Error(data.error + (data.details ? `: ${data.details}` : ""));
            }

            // Normalizar resposta da Stone para o formato esperado
            const normalizedData = {
                link_pagamento: data.payment_url,
                qr_code_url: data.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.payment_url)}`,
                payment_link_id: data.id,
                stone_id: data.stone_id,
                expires_at: data.expires_at
            };

            setLinkData(normalizedData);

            if (onLinkGenerated) {
                onLinkGenerated(normalizedData);
            }

            toast.success("Link de pagamento gerado!");
        } catch (err) {
            console.error("Error generating link:", err);
            setError(err.message || "Erro ao gerar link de pagamento");
        } finally {
            setLoading(false);
        }
    };

    const copiarLink = async () => {
        if (!linkData?.link_pagamento) return;

        try {
            await navigator.clipboard.writeText(linkData.link_pagamento);
            setCopied(true);
            toast.success("Link copiado!");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Erro ao copiar link");
        }
    };

    const downloadQrCode = async () => {
        if (!linkData?.qr_code_url) return;

        try {
            const response = await fetch(linkData.qr_code_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qrcode_pedido_${venda?.numero_pedido || 'pagamento'}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("QR Code baixado!");
        } catch (err) {
            toast.error("Erro ao baixar QR Code");
        }
    };

    const enviarWhatsApp = () => {
        if (!linkData?.link_pagamento || !cliente?.telefone) {
            toast.error("Telefone do cliente não disponível");
            return;
        }

        const telefone = cliente.telefone.replace(/\D/g, '');
        const telefoneFormatado = telefone.startsWith('55') ? telefone : `55${telefone}`;

        const mensagem = encodeURIComponent(
            `Olá ${cliente?.nome_completo?.split(' ')[0] || 'Cliente'}! 👋\n\n` +
            `Segue o link para pagamento do seu pedido #${venda?.numero_pedido}:\n\n` +
            `💰 Valor: R$ ${venda?.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
            `🔗 Link: ${linkData.link_pagamento}\n\n` +
            `Você pode pagar com Pix, Cartão de Crédito, Débito ou Boleto.\n\n` +
            `Qualquer dúvida, estamos à disposição! 🛋️\n` +
            `- Móveis Pedro II`
        );

        window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, '_blank');
    };

    const handleClose = () => {
        setLinkData(null);
        setError(null);
        setCopied(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-green-600" />
                        Link de Pagamento
                    </DialogTitle>
                    <DialogDescription>
                        Pedido #{venda?.numero_pedido} • R$ {venda?.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <Alert className="border-red-200 bg-red-50">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <AlertDescription className="text-red-700 text-sm">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!linkData && !loading && (
                        <div className="text-center py-6">
                            <QrCode className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                            <p className="text-sm text-gray-500 mb-4">
                                Gere um link de pagamento para enviar ao cliente via WhatsApp ou exibir como QR Code.
                            </p>
                            <Button
                                onClick={gerarLink}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={loading}
                            >
                                <Link2 className="w-4 h-4 mr-2" />
                                Gerar Link de Pagamento
                            </Button>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center py-8">
                            <Loader2 className="w-12 h-12 mx-auto text-green-600 animate-spin mb-4" />
                            <p className="text-sm text-gray-500">Gerando link de pagamento...</p>
                        </div>
                    )}

                    {linkData && (
                        <div className="space-y-4">
                            {/* QR Code */}
                            <div className="bg-gray-50 rounded-xl p-6 text-center border">
                                <img
                                    src={linkData.qr_code_url}
                                    alt="QR Code de Pagamento"
                                    className="w-48 h-48 mx-auto rounded-lg shadow-sm"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Escaneie para pagar
                                </p>
                            </div>

                            {/* Link */}
                            <div className="bg-gray-50 rounded-lg p-3 border">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={linkData.link_pagamento}
                                        readOnly
                                        className="flex-1 text-xs bg-transparent border-none focus:outline-none text-gray-600 font-mono truncate"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={copiarLink}
                                        className="shrink-0"
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    onClick={downloadQrCode}
                                    className="gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Baixar QR
                                </Button>
                                <Button
                                    onClick={enviarWhatsApp}
                                    className="gap-2 bg-green-600 hover:bg-green-700"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    WhatsApp
                                </Button>
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(linkData.link_pagamento, '_blank')}
                                className="w-full text-gray-500 gap-2"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Abrir página de pagamento
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
