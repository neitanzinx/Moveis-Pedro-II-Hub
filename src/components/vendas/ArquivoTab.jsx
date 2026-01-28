import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Search, FileText, CheckCircle, Package, Calendar, User,
    MapPin, Camera, PenTool, AlertTriangle, Printer
} from "lucide-react";
import { gerarComprovanteEntregaPDF } from "./ComprovanteEntregaPDF";

export default function ArquivoTab() {
    const [search, setSearch] = useState("");
    const [detalhes, setDetalhes] = useState(null);

    // Buscar vendas
    const { data: vendas = [], isLoading: loadingVendas } = useQuery({
        queryKey: ['vendas-arquivo'],
        queryFn: () => base44.entities.Venda.list('-data_venda'),
        refetchOnMount: 'always',
        staleTime: 0
    });

    // Buscar entregas
    const { data: entregas = [], isLoading: loadingEntregas } = useQuery({
        queryKey: ['entregas-arquivo'],
        queryFn: () => base44.entities.Entrega.list('-data_realizada'),
        refetchOnMount: 'always',
        staleTime: 0
    });

    // Buscar usuários para resolver nomes
    const { data: users = [] } = useQuery({
        queryKey: ['users-arquivo'],
        queryFn: () => base44.entities.User.list(),
        refetchOnMount: 'always',
        staleTime: 0
    });

    // Filtrar entregas finalizadas (Entregue ou Retirada)
    const entregasFinalizadas = entregas.filter(e =>
        e.status === 'Entregue' || e.tipo_entrega === 'Retirada'
    );

    // Combinar com dados da venda
    const pedidosArquivados = entregasFinalizadas.map(entrega => {
        const venda = vendas.find(v => v.id === entrega.venda_id);
        return { ...entrega, venda };
    }).filter(p => {
        if (!search) return true;
        const termo = search.toLowerCase();
        return (
            p.cliente_nome?.toLowerCase().includes(termo) ||
            p.numero_pedido?.toString().includes(termo) ||
            p.endereco_entrega?.toLowerCase().includes(termo)
        );
    });

    const formatarData = (dataStr) => {
        if (!dataStr) return "-";
        return new Date(dataStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loadingVendas || loadingEntregas) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Barra de Busca */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    placeholder="Buscar por cliente, pedido ou endereço..."
                    className="pl-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Contador */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    {pedidosArquivados.length} pedido(s) arquivado(s)
                </p>
            </div>

            {/* Lista de Pedidos */}
            <div className="grid gap-3">
                {pedidosArquivados.length === 0 ? (
                    <Card className="p-8 text-center">
                        <Package className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">Nenhum pedido arquivado encontrado</p>
                    </Card>
                ) : (
                    pedidosArquivados.map(pedido => (
                        <Card key={pedido.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    {/* Info Principal */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-gray-900">#{pedido.numero_pedido}</span>
                                            <Badge className="bg-green-100 text-green-800 border-0">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                {pedido.tipo_entrega === 'Retirada' ? 'Retirado' : 'Entregue'}
                                            </Badge>
                                            {pedido.tentativas > 0 && (
                                                <Badge className="bg-amber-100 text-amber-800 border-0">
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    {pedido.tentativas} tentativa(s)
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="space-y-1 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3 h-3" />
                                                <span className="font-medium">{pedido.cliente_nome}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3 h-3" />
                                                <span className="truncate">{pedido.endereco_entrega || "Retirada na loja"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3" />
                                                <span>{formatarData(pedido.data_realizada)}</span>
                                            </div>
                                        </div>

                                        {/* Indicadores */}
                                        <div className="flex items-center gap-2 mt-3">
                                            {pedido.assinatura_url && (
                                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                    <PenTool className="w-3 h-3 mr-1" />
                                                    Assinatura
                                                </Badge>
                                            )}
                                            {pedido.comprovante_pagamento_url && (
                                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                    <Camera className="w-3 h-3 mr-1" />
                                                    Comprovante
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDetalhes(pedido)}
                                        >
                                            <FileText className="w-4 h-4 mr-1" />
                                            Detalhes
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => gerarComprovanteEntregaPDF(pedido, pedido.venda)}
                                        >
                                            <Printer className="w-4 h-4 mr-1" />
                                            PDF
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal de Detalhes */}
            <Dialog open={!!detalhes} onOpenChange={() => setDetalhes(null)}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Pedido #{detalhes?.numero_pedido}
                        </DialogTitle>
                    </DialogHeader>

                    {detalhes && (
                        <div className="space-y-4">
                            {/* Informações da Venda */}
                            {detalhes.venda && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Dados da Venda
                                    </h4>
                                    <div className="text-sm text-blue-700 space-y-1">
                                        <p><strong>Data/Hora:</strong> {formatarData(detalhes.venda.data_venda)}</p>
                                        <p><strong>Vendedor:</strong> {(() => {
                                            const id = detalhes.venda.responsavel_id;
                                            const nomeLegacy = detalhes.venda.responsavel_nome;
                                            if (id) {
                                                const u = users.find(user => user.id === id);
                                                if (u && u.full_name) return u.full_name;
                                            }
                                            return nomeLegacy || "Não informado";
                                        })()}</p>
                                        <p><strong>Loja:</strong> {detalhes.venda.loja || "Não informada"}</p>
                                        <p><strong>Valor Total:</strong> R$ {detalhes.venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || "0,00"}</p>
                                        {detalhes.venda.desconto > 0 && (
                                            <p><strong>Desconto:</strong> R$ {detalhes.venda.desconto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        )}
                                        <p><strong>Status Pagamento:</strong> {detalhes.venda.status || "Não informado"}</p>
                                    </div>
                                    {/* Formas de Pagamento */}
                                    {detalhes.venda.pagamentos?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-blue-200">
                                            <p className="font-medium text-blue-800 mb-1">Pagamentos:</p>
                                            {detalhes.venda.pagamentos.map((pag, idx) => (
                                                <p key={idx} className="text-xs text-blue-600">
                                                    • {pag.forma}: R$ {pag.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    {pag.parcelas > 1 && ` (${pag.parcelas}x)`}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tipo de Entrega/Montagem */}
                            <div className="bg-purple-50 rounded-lg p-4">
                                <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    Tipo de Entrega
                                </h4>
                                <div className="text-sm text-purple-700">
                                    {detalhes.tipo_entrega === 'Retirada' ? (
                                        <Badge className="bg-gray-100 text-gray-700">🏪 Cliente Retirou na Loja</Badge>
                                    ) : detalhes.venda?.itens?.some(i => i.tipo_montagem === 'montado') ? (
                                        <Badge className="bg-orange-100 text-orange-700">🔧 Entrega Montado (montagem interna)</Badge>
                                    ) : detalhes.venda?.itens?.some(i => i.tipo_montagem === 'montagem_cliente') ? (
                                        <Badge className="bg-blue-100 text-blue-700">🚚 Montagem no Local (montador externo)</Badge>
                                    ) : (
                                        <Badge className="bg-green-100 text-green-700">📦 Entrega Normal</Badge>
                                    )}
                                </div>
                            </div>

                            {/* Dados da Entrega */}
                            <div className="bg-green-50 rounded-lg p-4">
                                <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    {detalhes.tipo_entrega === 'Retirada' ? 'Retirada Realizada' : 'Entrega Realizada'}
                                </h4>
                                <div className="text-sm text-green-700 space-y-1">
                                    <p><strong>Data:</strong> {formatarData(detalhes.data_realizada)}</p>
                                    <p><strong>Cliente:</strong> {detalhes.cliente_nome}</p>
                                    <p><strong>Endereço:</strong> {detalhes.endereco_entrega || "Retirada na loja"}</p>
                                </div>
                            </div>


                            {/* Assinatura Digital */}
                            {detalhes.assinatura_url && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                        <PenTool className="w-4 h-4" />
                                        Assinatura do Cliente
                                    </h4>
                                    <div className="bg-white rounded border p-2">
                                        <img
                                            src={detalhes.assinatura_url}
                                            alt="Assinatura do cliente"
                                            className="max-h-32 mx-auto"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Comprovante de Pagamento */}
                            {detalhes.comprovante_pagamento_url && (
                                <div className="bg-green-50 rounded-lg p-4">
                                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                                        <Camera className="w-4 h-4" />
                                        Comprovante de Pagamento
                                    </h4>
                                    <img
                                        src={detalhes.comprovante_pagamento_url}
                                        alt="Comprovante"
                                        className="rounded max-h-48 mx-auto"
                                    />
                                </div>
                            )}

                            {/* Histórico de Tentativas */}
                            {detalhes.tentativas > 0 && (
                                <div className="bg-amber-50 rounded-lg p-4">
                                    <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Tentativas Anteriores ({detalhes.tentativas})
                                    </h4>
                                    <div className="text-sm text-amber-700">
                                        <p><strong>Observação:</strong> {detalhes.observacoes_entrega || "Sem detalhes"}</p>
                                        {detalhes.foto_tentativa_url && (
                                            <div className="mt-2">
                                                <p className="font-medium mb-1">Foto da tentativa:</p>
                                                <img
                                                    src={detalhes.foto_tentativa_url}
                                                    alt="Foto da tentativa"
                                                    className="rounded max-h-32"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Itens do Pedido */}
                            {detalhes.venda?.itens && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-bold text-gray-800 mb-2">Itens do Pedido</h4>
                                    <div className="space-y-1 text-sm">
                                        {detalhes.venda.itens.map((item, idx) => (
                                            <div key={idx} className="flex justify-between">
                                                <span>{item.quantidade}x {item.produto_nome}</span>
                                                <span className="text-gray-600">
                                                    R$ {(item.preco_unitario * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Botão PDF */}
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700"
                                onClick={() => gerarComprovanteEntregaPDF(detalhes, detalhes.venda)}
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                Gerar Comprovante PDF
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
