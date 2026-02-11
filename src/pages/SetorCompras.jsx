import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import PedidoCompraModal from "@/components/estoque/PedidoCompraModal";
import SugestaoComprasTab from "@/components/compras/SugestaoComprasTab";
import PedidosList from "@/components/compras/PedidosList";
import {
    Plus, FileText, Smartphone, LayoutDashboard, ShoppingCart,
    Building2, Tag, TrendingDown
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import RecebimentoPedido from "@/components/estoque/RecebimentoPedido";
import { format } from "date-fns";

import Fornecedores from "./Fornecedores";
import DashboardComprasTab from "@/components/compras/DashboardComprasTab";

export default function SetorCompras() {
    const [modalNovo, setModalNovo] = useState(false);
    const [modalEditar, setModalEditar] = useState(null);
    const [modalReceber, setModalReceber] = useState(null);
    const [modalDetalhes, setModalDetalhes] = useState(null);
    const [activeTab, setActiveTab] = useState("dashboard");

    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Buscar fornecedores (Necessário para o Modal de Novo Pedido)
    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list()
    });

    // Mutation para deletar
    const deletarPedido = useMutation({
        mutationFn: (id) => base44.entities.PedidoCompra.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-counts'] }); // Atualizar contadores
            toast.success('Pedido excluído');
        }
    });

    // Status badges config (para modal detalhes)
    const statusConfig = {
        'Rascunho': { cor: 'bg-gray-100 text-gray-800' },
        'Enviado': { cor: 'bg-blue-100 text-blue-800' },
        'Confirmado': { cor: 'bg-purple-100 text-purple-800' },
        'Parcialmente Recebido': { cor: 'bg-orange-100 text-orange-800' },
        'Recebido': { cor: 'bg-green-100 text-green-800' },
        'Cancelado': { cor: 'bg-red-100 text-red-800' }
    };

    const handleExcluir = async (pedido) => {
        const confirmado = await confirm({
            title: 'Excluir Pedido',
            message: `Tem certeza que deseja excluir o pedido ${pedido.numero_pedido}?`,
            confirmText: 'Excluir',
            variant: 'destructive'
        });
        if (confirmado) {
            deletarPedido.mutate(pedido.id);
        }
    };

    // Navegação entre abas
    const handleNavigate = (tab) => {
        setActiveTab(tab);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <LayoutDashboard className="w-7 h-7 text-green-600" />
                            Setor de Compras
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Central de controle de compras, estoque e fornecedores
                        </p>
                    </div>
                    {activeTab === 'pedidos' && (
                        <Button onClick={() => setModalNovo(true)} className="gap-2 bg-green-600 hover:bg-green-700">
                            <Plus className="w-4 h-4" />
                            Novo Pedido
                        </Button>
                    )}
                </div>

                {/* Tabs principais */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full max-w-lg grid-cols-4 h-12">
                        <TabsTrigger value="dashboard" className="gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="hidden md:inline">Dashboard</span>
                        </TabsTrigger>
                        <TabsTrigger value="pedidos" className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4" />
                            <span className="hidden md:inline">Pedidos</span>
                        </TabsTrigger>
                        <TabsTrigger value="sugestoes" className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4" />
                            <span className="hidden md:inline">Sugestões (Smart)</span>
                        </TabsTrigger>
                        <TabsTrigger value="fornecedores" className="gap-2">
                            <Building2 className="w-4 h-4" />
                            <span className="hidden md:inline">Fornecedores</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab Dashboard */}
                    <TabsContent value="dashboard" className="mt-6">
                        <DashboardComprasTab onNavigate={handleNavigate} />
                    </TabsContent>

                    {/* Tab Pedidos - Refatorado para usar PedidosList */}
                    <TabsContent value="pedidos" className="space-y-6 mt-6">
                        <PedidosList
                            onEdit={setModalEditar}
                            onView={setModalDetalhes}
                            onDelete={handleExcluir}
                            onReceber={setModalReceber}
                        />
                    </TabsContent>

                    <TabsContent value="sugestoes">
                        <SugestaoComprasTab />
                    </TabsContent>

                    {/* Tab Fornecedores */}
                    <TabsContent value="fornecedores" className="mt-6">
                        <Fornecedores />
                    </TabsContent>
                </Tabs>

                {/* Modal Novo Pedido */}
                {
                    modalNovo && (
                        <PedidoCompraModal
                            open={modalNovo}
                            onClose={() => setModalNovo(false)}
                            fornecedores={fornecedores}
                        />
                    )
                }

                {/* Modal Editar Pedido */}
                {
                    modalEditar && (
                        <PedidoCompraModal
                            open={!!modalEditar}
                            onClose={() => setModalEditar(null)}
                            pedido={modalEditar}
                            fornecedores={fornecedores}
                        />
                    )
                }

                {/* Modal Receber Pedido */}
                {
                    modalReceber && (
                        <RecebimentoPedido
                            open={!!modalReceber}
                            onClose={() => setModalReceber(null)}
                            pedido={modalReceber}
                        />
                    )
                }

                {/* Modal Detalhes */}
                <Dialog open={!!modalDetalhes} onOpenChange={() => setModalDetalhes(null)}>
                    <DialogContent className="max-w-2xl text-left">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Pedido {modalDetalhes?.numero_pedido}
                            </DialogTitle>
                        </DialogHeader>
                        {modalDetalhes && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Fornecedor</p>
                                        <p className="font-medium">{modalDetalhes.fornecedor_nome}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Status</p>
                                        <Badge className={(statusConfig[modalDetalhes.status] || statusConfig['Rascunho']).cor}>
                                            {modalDetalhes.status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Data do Pedido</p>
                                        <p className="font-medium">
                                            {modalDetalhes.data_pedido ? format(new Date(modalDetalhes.data_pedido), 'dd/MM/yyyy') : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Previsão de Entrega</p>
                                        <p className="font-medium">
                                            {modalDetalhes.data_previsao_entrega ? format(new Date(modalDetalhes.data_previsao_entrega), 'dd/MM/yyyy') : '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* Info de promoção */}
                                {modalDetalhes.tipo_preco === 'promocional' && (
                                    <Card className="bg-amber-50 border-amber-200">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                                                <Tag className="w-4 h-4" />
                                                Compra com Preço Promocional
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                {modalDetalhes.promocao_inicio && (
                                                    <div>
                                                        <p className="text-gray-500">Início</p>
                                                        <p className="font-medium">{format(new Date(modalDetalhes.promocao_inicio), 'dd/MM/yyyy')}</p>
                                                    </div>
                                                )}
                                                {modalDetalhes.promocao_fim && (
                                                    <div>
                                                        <p className="text-gray-500">Fim</p>
                                                        <p className="font-medium">{format(new Date(modalDetalhes.promocao_fim), 'dd/MM/yyyy')}</p>
                                                    </div>
                                                )}
                                                {modalDetalhes.economia_total > 0 && (
                                                    <div>
                                                        <p className="text-gray-500">Economia</p>
                                                        <p className="font-bold text-green-600">
                                                            R$ {modalDetalhes.economia_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            {modalDetalhes.promocao_observacao && (
                                                <p className="text-sm text-gray-600 mt-2">
                                                    📝 {modalDetalhes.promocao_observacao}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                <div>
                                    <p className="text-sm text-gray-500 mb-2">Itens do Pedido</p>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Produto</TableHead>
                                                    <TableHead className="text-center">Qtd</TableHead>
                                                    {modalDetalhes.tipo_preco === 'promocional' && (
                                                        <TableHead className="text-right">Preço Tabela</TableHead>
                                                    )}
                                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(modalDetalhes.itens || []).map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{item.produto_nome}</span>
                                                                {item.detalhes && (
                                                                    <span className="text-xs text-gray-500">
                                                                        {item.detalhes.modelo && `Ref: ${item.detalhes.modelo} | `}
                                                                        {item.detalhes.cor && `Cor: ${item.detalhes.cor} | `}
                                                                        {item.detalhes.dimensoes && `Dim: ${item.detalhes.dimensoes}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">{item.quantidade_pedida}</TableCell>
                                                        {modalDetalhes.tipo_preco === 'promocional' && (
                                                            <TableCell className="text-right text-gray-500">
                                                                R$ {(item.preco_tabela || item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="text-right">
                                                            R$ {(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            R$ {((item.quantidade_pedida || 0) * (item.preco_unitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t">
                                    <span className="text-lg font-bold">Total do Pedido</span>
                                    <span className="text-2xl font-bold text-green-600">
                                        R$ {(modalDetalhes.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {modalDetalhes.observacoes && (
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-sm text-gray-500">Observações</p>
                                        <p className="mt-1">{modalDetalhes.observacoes}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
