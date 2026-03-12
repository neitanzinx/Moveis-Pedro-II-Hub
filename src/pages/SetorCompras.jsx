import React, { useState } from "react";
import { base44, supabase } from "@/api/base44Client";
import { comprasService } from "@/services/comprasService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import PedidoCompraModal from "@/components/estoque/PedidoCompraModal";
import CaixaDemandas from "@/components/compras/CaixaDemandas";
import PedidosKanban from "@/components/compras/PedidosKanban";
import { format } from "date-fns";
import { Copy, Plus, FileText, Smartphone, LayoutDashboard, ShoppingCart, Building2, Tag, TrendingDown, Inbox, KanbanSquare, CheckCircle, Package, Users, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import RecebimentoPedido from "@/components/estoque/RecebimentoPedido";
import Fornecedores from "./Fornecedores";
import DashboardComprasTab from "@/components/compras/DashboardComprasTab";

import AprovacoesDashboard from "@/components/compras/AprovacoesDashboard";
import OCDetailModal from "@/components/compras/OCDetailModal";
import DashboardComprador from "@/components/compras/DashboardComprador";
import DashboardFinanceiro from "@/components/compras/DashboardFinanceiro";
import PainelFinanceiroCompras from "@/components/compras/PainelFinanceiroCompras";
import { useAuth } from "@/hooks/useAuth";

export default function SetorCompras() {
    const [modalNovo, setModalNovo] = useState(false);
    const [modalEditar, setModalEditar] = useState(null);
    const [modalReceber, setModalReceber] = useState(null);
    const [modalDetalhes, setModalDetalhes] = useState(null);
    const [activeTab, setActiveTab] = useState("dashboard");
    const [pedidoEmFoco, setPedidoEmFoco] = useState(null);
    const [compradorFoco, setCompradorFoco] = useState(null);

    const { user } = useAuth();
    const isAprovador = user?.cargo === 'Financeiro' || user?.cargo === 'Administrador';

    // Fetch pending approvals count for the badge (only for approved roles)
    const { data: pendenciasCount = 0 } = useQuery({
        queryKey: ['aprovacoes-pendentes-count'],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('aprovacoes_oc')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'PENDENTE');
            if (error) return 0;
            return count || 0;
        },
        refetchInterval: 30000,
        enabled: isAprovador
    });
    const [kanbanFilter, setKanbanFilter] = useState({ type: 'all', value: null });

    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Buscar fornecedores (Necessário para o Modal de Novo Pedido)
    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list()
    });

    const { data: centrosCusto = [] } = useQuery({
        queryKey: ['centros-custo-compras'],
        queryFn: () => comprasService.getCentrosCusto()
    });

    const { data: ordensDashboard = [] } = useQuery({
        queryKey: ['pedidos-compra-dashboard-full'],
        queryFn: () => comprasService.getOrdens({ limit: 500 })
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos-estoque-dashboard'],
        queryFn: () => base44.entities.Produto.list()
    });

    const { data: aprovacoes = [] } = useQuery({
        queryKey: ['aprovacoes-pendentes-financeiro'],
        queryFn: async () => {
            const { data } = await supabase
                .from('compras_aprovacoes')
                .select('*, ordem:ordem_compra_id(*, centro_custo:centro_custo_id(nome))')
                .eq('status', 'pendente');
            return data || [];
        },
        enabled: user?.cargo === 'Financeiro' || user?.cargo === 'Administrador'
    });

    // Buscar pedidos em conferência para a pílula global (na nova tabela)
    const { data: pedidosEmConferencia = [] } = useQuery({
        queryKey: ['pedidos-em-conferencia-global'],
        queryFn: async () => {
            const { data } = await supabase
                .from('compras_ordens')
                .select('id')
                .eq('status', 'Em Conferência')
                .is('deleted_at', null);
            return data || [];
        },
        refetchInterval: 30000
    });

    const deletarPedido = useMutation({
        mutationFn: (id) => comprasService.softDeleteOrdem(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-em-conferencia-global'] });
            toast.success('Pedido excluído');
        }
    });



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



    const handlePillClick = (pedidoId) => {
        setKanbanFilter({ type: 'highlight', value: pedidoId });
        setActiveTab('pedidos');
        setPedidoEmFoco(pedidoId);
        // Remove o foco após 5 segundos
        setTimeout(() => {
            setPedidoEmFoco(null);
        }, 5000);
    };

    const handleDashboardFilter = (type, value) => {
        setKanbanFilter({ type, value });
        setActiveTab('pedidos');
    };

    const handleRespondApproval = async (aprovacao, decision) => {
        try {
            await comprasService.respondApproval(aprovacao.id, decision, '');
            queryClient.invalidateQueries({ queryKey: ['aprovacoes-pendentes-financeiro'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-kanban'] });
            toast.success(`Pedido ${decision === 'aprovado' ? 'aprovado' : 'rejeitado'} com sucesso`);
        } catch (error) {
            toast.error('Erro ao processar aprovação');
        }
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
                    <div className="flex items-center gap-4">
                        {activeTab === 'pedidos' && (
                            <Button onClick={() => setModalNovo(true)} className="gap-2 bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4" />
                                Novo Pedido
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs principais */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <TabsList className="flex w-full md:w-max h-auto p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm gap-1">
                            <TabsTrigger
                                value="dashboard"
                                className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-gray-200 hover:bg-white/50"
                            >
                                <LayoutDashboard className="w-4 h-4 transition-colors" />
                                <span className="font-semibold text-sm">Dashboard</span>
                            </TabsTrigger>
                            {isAprovador && (
                                <TabsTrigger
                                    value="aprovacoes"
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md group"
                                >
                                    <div className="relative">
                                        <Clock className="w-4 h-4 transition-colors group-data-[state=active]:text-amber-500" />
                                        {pendenciasCount > 0 && (
                                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce ring-2 ring-white">
                                                {pendenciasCount}
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-semibold text-sm">Minhas Aprovações</span>
                                </TabsTrigger>
                            )}
                            <TabsTrigger
                                value="pedidos"
                                className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-gray-200 hover:bg-white/50"
                            >
                                <KanbanSquare className="w-4 h-4 transition-colors" />
                                <span className="font-semibold text-sm">Quadro de Pedidos</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="sugestoes"
                                className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-gray-200 hover:bg-white/50"
                            >
                                <Inbox className="w-4 h-4 transition-colors" />
                                <span className="font-semibold text-sm">Caixa de Demandas</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="fornecedores"
                                className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-gray-200 hover:bg-white/50"
                            >
                                <Building2 className="w-4 h-4 transition-colors" />
                                <span className="font-semibold text-sm">Fornecedores</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="financeiro"
                                className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-emerald-200 hover:bg-white/50"
                            >
                                <Wallet className="w-4 h-4 transition-colors" />
                                <span className="font-semibold text-sm">Financeiro</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Pílula de Conferência (Alinhada com as abas) */}
                        {pedidosEmConferencia.length > 0 && (
                            <div
                                onClick={() => handlePillClick(pedidosEmConferencia[0].id)}
                                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full shadow-sm animate-pulse ml-auto cursor-pointer hover:bg-green-100 transition-colors"
                                title="Clique para destacar o pedido no Kanban"
                            >
                                <div className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </div>
                                <span className="text-sm font-medium text-green-700">
                                    {pedidosEmConferencia.length} pedido{pedidosEmConferencia.length > 1 ? 's' : ''} em conferência
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Tab Dashboard */}
                    <TabsContent value="dashboard" className="mt-6">
                        {user?.cargo === 'Administrador' ? (
                            <DashboardComprasTab onNavigate={handleNavigate} />
                        ) : user?.cargo === 'Estoque' || user?.cargo === 'Gerente Geral' || user?.cargo === 'Administrador' ? (
                            <DashboardComprador
                                pedidos={ordensDashboard}
                                produtos={produtos}
                                vendedores={centrosCusto}
                                onFilter={handleDashboardFilter}
                                onViewKanban={() => setActiveTab('pedidos')}
                            />
                        ) : user?.cargo === 'Financeiro' ? (
                            <DashboardFinanceiro
                                aprovacoes={aprovacoes}
                                onApprove={(a) => handleRespondApproval(a, 'aprovado')}
                                onReject={(a) => handleRespondApproval(a, 'rejeitado')}
                                onView={(a) => setModalDetalhes(a.ordem)}
                                onViewAll={() => setActiveTab('pedidos')}
                            />
                        ) : (
                            <DashboardComprasTab onNavigate={handleNavigate} />
                        )}
                    </TabsContent>

                    {/* Tab Aprovações */}
                    <TabsContent value="aprovacoes" className="space-y-6 mt-6">
                        <AprovacoesDashboard
                            onViewOC={(oc) => setModalDetalhes(oc)}
                        />
                    </TabsContent>

                    {/* Tab Pedidos - Usando Kanban */}
                    <TabsContent value="pedidos" className="space-y-6 mt-6">
                        {kanbanFilter.type !== 'all' && (
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg animate-in slide-in-from-top-2">
                                <span className="text-sm font-medium text-blue-700">
                                    Filtrando por: <span className="font-bold">{kanbanFilter.type === 'status' ? kanbanFilter.value : kanbanFilter.type === 'sem_resposta' ? 'Sem Resposta > 24h' : 'Destaque'}</span>
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => setKanbanFilter({ type: 'all', value: null })} className="text-blue-600 h-7 hover:bg-blue-100">
                                    Limpar Filtro
                                </Button>
                            </div>
                        )}
                        <PedidosKanban
                            onEdit={setModalEditar}
                            onView={setModalDetalhes}
                            onDelete={handleExcluir}
                            onReceber={setModalReceber}
                            pedidoEmFoco={pedidoEmFoco}
                            filter={kanbanFilter}
                        />
                    </TabsContent>

                    {/* Caixa de Demandas (Antiga Sugestões) */}
                    <TabsContent value="sugestoes" className="mt-6">
                        <CaixaDemandas onPedidoCriado={() => setActiveTab('pedidos')} />
                    </TabsContent>

                    {/* Tab Fornecedores */}
                    <TabsContent value="fornecedores" className="mt-6">
                        <Fornecedores />
                    </TabsContent>

                    {/* Tab Financeiro (Endividamento, Break-Even, Capacidade) */}
                    <TabsContent value="financeiro" className="mt-6">
                        <PainelFinanceiroCompras />
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
                <OCDetailModal
                    open={!!modalDetalhes}
                    onClose={() => setModalDetalhes(null)}
                    pedido={modalDetalhes}
                    fornecedores={fornecedores}
                />
            </div>
        </div>
    );
}
