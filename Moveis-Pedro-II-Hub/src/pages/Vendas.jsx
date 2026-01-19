import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, FileText, Loader2, Archive, ShoppingCart, Receipt, CheckCircle, XCircle, MessageCircle, CreditCard, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { abrirNotaPedidoPDF } from "../components/vendas/NotaPedidoPDF";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import ArquivoTab from "../components/vendas/ArquivoTab";
import EmitirNFeModal from "../components/vendas/EmitirNFeModal";

export default function Vendas() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [activeTab, setActiveTab] = useState("vendas");
    const [nfeModalOpen, setNfeModalOpen] = useState(false);
    const [vendaParaNfe, setVendaParaNfe] = useState(null);
    const [clienteParaNfe, setClienteParaNfe] = useState(null);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const confirm = useConfirm();

    // Hook de Autenticação e Controle de Acesso
    const { user, filterData, can } = useAuth();

    const { data: vendas = [], isLoading } = useQuery({
        queryKey: ['vendas'],
        queryFn: () => base44.entities.Venda.list('-data_venda')
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ['clientes'],
        queryFn: () => base44.entities.Cliente.list()
    });

    // Query para buscar lançamentos (para poder cancelar os vinculados)
    const { data: lancamentos = [] } = useQuery({
        queryKey: ['lancamentos-financeiros'],
        queryFn: () => base44.entities.LancamentoFinanceiro.list()
    });

    // Mutation para cancelar venda
    const cancelarVendaMutation = useMutation({
        mutationFn: async (venda) => {
            // 1. Atualizar status da venda para Cancelado
            await base44.entities.Venda.update(venda.id, { status: 'Cancelado' });

            // 2. Buscar e cancelar todos os lançamentos vinculados
            const lancamentosVenda = lancamentos.filter(l =>
                l.venda_id === venda.id || l.numero_pedido === venda.numero_pedido
            );

            for (const lanc of lancamentosVenda) {
                await base44.entities.LancamentoFinanceiro.update(lanc.id, {
                    status: 'Cancelado',
                    observacao: (lanc.observacao || '') + ' [VENDA CANCELADA]'
                });
            }

            // 3. Retornar itens ao estoque
            if (venda.itens && venda.itens.length > 0) {
                for (const item of venda.itens) {
                    if (item.produto_id) {
                        try {
                            // Buscar produto atual
                            const produtos = await base44.entities.Produto.list();
                            const produto = produtos.find(p => p.id === item.produto_id);

                            if (produto) {
                                const novaQuantidade = (produto.quantidade || 0) + (item.quantidade || 1);
                                await base44.entities.Produto.update(item.produto_id, {
                                    quantidade: novaQuantidade
                                });
                            }
                        } catch (err) {
                            console.error(`Erro ao retornar estoque do produto ${item.produto_id}:`, err);
                        }
                    }
                }
            }

            return { vendaId: venda.id, lancamentosCancelados: lancamentosVenda.length };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendas'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            toast.success("Venda cancelada e estoque retornado!");
        }
    });

    const handleCancelarVenda = async (venda) => {
        const confirmed = await confirm({
            title: "Cancelar Venda",
            message: `Tem certeza que deseja CANCELAR a venda #${venda.numero_pedido}?\n\nIsso também cancelará todos os lançamentos financeiros vinculados.`,
            confirmText: "Cancelar Venda",
            variant: "destructive"
        });
        if (!confirmed) return;

        cancelarVendaMutation.mutate(venda);
    };

    const abrirModalNfe = (venda) => {
        const cliente = clientes.find(c => c.id === venda.cliente_id);
        setVendaParaNfe(venda);
        setClienteParaNfe(cliente);
        setNfeModalOpen(true);
    };

    // 1. Filtra pelo Escopo do Usuário (Dono / Loja / Tudo)
    const vendasPermitidas = filterData(vendas, { userField: 'responsavel_id' });

    // 2. Filtros de Busca e Status da Tela
    const filtered = vendasPermitidas.filter(v => {
        if (statusFilter !== 'all' && v.status !== statusFilter) return false;
        if (search && !v.cliente_nome?.toLowerCase().includes(search.toLowerCase()) && !v.numero_pedido?.includes(search)) return false;
        return true;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendas</h1>
                    <p className="text-sm text-gray-500">Gerencie suas vendas e pedidos</p>
                </div>

                {/* Só mostra botão se puder criar vendas */}
                {can('create_vendas') && (
                    <Button
                        onClick={() => navigate('/PDV')}
                        className="bg-green-700 hover:bg-green-800 text-white font-medium"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Nova Venda (PDV)
                    </Button>
                )}
            </div>

            {/* Sistema de Abas */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="vendas" className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Vendas
                    </TabsTrigger>
                    <TabsTrigger value="arquivo" className="flex items-center gap-2">
                        <Archive className="w-4 h-4" />
                        Arquivo
                    </TabsTrigger>
                </TabsList>

                {/* Aba Vendas */}
                <TabsContent value="vendas" className="space-y-4">
                    <div className="flex gap-4 items-center bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por cliente ou nº do pedido..."
                                className="pl-9 border-gray-200 dark:border-neutral-700"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[200px] border-gray-200 dark:border-neutral-700">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Filter className="w-4 h-4" />
                                    <SelectValue placeholder="Status" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os status</SelectItem>
                                <SelectItem value="Pagamento Pendente">Pendente</SelectItem>
                                <SelectItem value="Pago">Pago</SelectItem>
                                <SelectItem value="Cancelado">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                                <TableRow>
                                    <TableHead className="w-[100px]">Pedido</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Produtos</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Loja</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Pagamento</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Carregando vendas...
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                            Nenhuma venda encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map(venda => (
                                        <TableRow key={venda.id}>
                                            <TableCell className="font-medium">#{venda.numero_pedido}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white">{venda.cliente_nome}</span>
                                                    <span className="text-xs text-gray-500">{venda.cliente_telefone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-[200px]">
                                                    {(venda.itens || []).slice(0, 2).map((item, idx) => (
                                                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                                            {item.quantidade}x {item.produto_nome || item.nome}
                                                        </div>
                                                    ))}
                                                    {(venda.itens || []).length > 2 && (
                                                        <span className="text-[10px] text-gray-400">+{(venda.itens || []).length - 2} mais...</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-neutral-800">
                                                    {venda.loja}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-bold text-gray-900 dark:text-white">
                                                R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={venda.status} />
                                            </TableCell>
                                            <TableCell>
                                                <PaymentStatusBadge
                                                    status={venda.status_pagamento}
                                                    linkPagamento={venda.link_pagamento}
                                                    cliente={{ nome: venda.cliente_nome, telefone: venda.cliente_telefone }}
                                                    numeroPedido={venda.numero_pedido}
                                                    valorTotal={venda.valor_total}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {/* Botão Emitir NFe */}
                                                    {venda.status === "Pago" && can('manage_vendas') && (
                                                        venda.nfe_emitida ? (
                                                            <Badge className="bg-green-100 text-green-800 border-green-200">
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                NFe {venda.nfe_numero}
                                                            </Badge>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => abrirModalNfe(venda)}
                                                                title="Emitir NFe"
                                                            >
                                                                <Receipt className="w-4 h-4 text-green-600" />
                                                            </Button>
                                                        )
                                                    )}

                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        const clienteCompleto = clientes.find(c => c.id === venda.cliente_id) || { nome_completo: venda.cliente_nome, telefone: venda.cliente_telefone };
                                                        abrirNotaPedidoPDF(venda, clienteCompleto, user?.full_name);
                                                    }}>
                                                        <FileText className="w-4 h-4 text-blue-600" />
                                                    </Button>

                                                    {/* Botão de cancelar - só mostra se não estiver cancelado */}
                                                    {venda.status !== 'Cancelado' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleCancelarVenda(venda)}
                                                            disabled={cancelarVendaMutation.isPending}
                                                            title="Cancelar Venda"
                                                        >
                                                            <XCircle className="w-4 h-4 text-orange-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* Aba Arquivo */}
                <TabsContent value="arquivo">
                    <ArquivoTab />
                </TabsContent>
            </Tabs>

            {/* Modal de Emissão de NFe */}
            <EmitirNFeModal
                isOpen={nfeModalOpen}
                onClose={() => setNfeModalOpen(false)}
                venda={vendaParaNfe}
                cliente={clienteParaNfe}
                user={user}
            />
        </div>
    );
}

function StatusBadge({ status }) {
    const styles = {
        "Pago": "bg-green-100 text-green-800 border-green-200",
        "Pagamento Pendente": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Cancelado": "bg-red-100 text-red-800 border-red-200"
    };
    return (
        <Badge className={`${styles[status] || "bg-gray-100 text-gray-800"} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>
            {status}
        </Badge>
    );
}

function PaymentStatusBadge({ status, linkPagamento, cliente, numeroPedido, valorTotal }) {
    const enviarCobranca = () => {
        if (!linkPagamento || !cliente?.telefone) return;
        const telefone = cliente.telefone.replace(/\D/g, '');
        const telefoneFormatado = telefone.startsWith('55') ? telefone : `55${telefone}`;
        const mensagem = encodeURIComponent(
            `Olá ${cliente?.nome?.split(' ')[0] || 'Cliente'}! \ud83d\udc4b\n\n` +
            `Notamos que o pagamento do seu pedido #${numeroPedido} ainda está pendente.\n\n` +
            `\ud83d\udcb0 Valor: R$ ${valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
            `\ud83d\udd17 Pague agora: ${linkPagamento}\n\n` +
            `Qualquer dúvida, estamos \u00e0 disposi\u00e7\u00e3o! \ud83d\uded4\ufe0f`
        );
        window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, '_blank');
    };

    if (!status) {
        return <span className="text-xs text-gray-400">-</span>;
    }

    const statusStyles = {
        'PAGO': 'bg-green-100 text-green-800 border-green-200',
        'DISPONIVEL': 'bg-green-100 text-green-800 border-green-200',
        'AGUARDANDO_PAGAMENTO': 'bg-orange-100 text-orange-800 border-orange-200',
        'PENDENTE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'EM_ANALISE': 'bg-blue-100 text-blue-800 border-blue-200',
        'RECUSADO': 'bg-red-100 text-red-800 border-red-200',
        'CANCELADO': 'bg-red-100 text-red-800 border-red-200'
    };

    const statusLabels = {
        'PAGO': 'Pago',
        'DISPONIVEL': 'Pago',
        'AGUARDANDO_PAGAMENTO': 'Aguardando',
        'PENDENTE': 'Pendente',
        'EM_ANALISE': 'Em Análise',
        'RECUSADO': 'Recusado',
        'CANCELADO': 'Cancelado'
    };

    const isPending = ['AGUARDANDO_PAGAMENTO', 'PENDENTE'].includes(status);

    return (
        <div className="flex items-center gap-2">
            <Badge className={`${statusStyles[status] || 'bg-gray-100 text-gray-800'} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>
                {statusLabels[status] || status}
            </Badge>
            {isPending && linkPagamento && cliente?.telefone && (
                <Button variant="ghost" size="icon" onClick={enviarCobranca} title="Cobrar via WhatsApp" className="h-6 w-6">
                    <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                </Button>
            )}
            {linkPagamento && (
                <Button variant="ghost" size="icon" onClick={() => window.open(linkPagamento, '_blank')} title="Ver Link de Pagamento" className="h-6 w-6">
                    <Link2 className="w-3.5 h-3.5 text-blue-600" />
                </Button>
            )}
        </div>
    );
}