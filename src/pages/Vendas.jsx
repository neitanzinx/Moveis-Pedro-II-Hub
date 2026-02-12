import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Plus, Search, Filter, FileText, Loader2, Archive, ShoppingCart, Receipt, CheckCircle, XCircle, MessageCircle, CreditCard, Link2, Truck, Package, Wrench, Clock, MapPin, UserCheck, ClipboardList, Info, CalendarX, Settings, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { abrirNotaPedidoPDF } from "../components/vendas/NotaPedidoPDF";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import ArquivoTab from "../components/vendas/ArquivoTab";
import EmitirNFeModal from "../components/vendas/EmitirNFeModal";
import TransferirMontagemModal from "../components/vendas/TransferirMontagemModal";

export default function Vendas() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [activeTab, setActiveTab] = useState("vendas");
    const [nfeModalOpen, setNfeModalOpen] = useState(false);
    const [vendaParaNfe, setVendaParaNfe] = useState(null);
    const [clienteParaNfe, setClienteParaNfe] = useState(null);
    // Estados para reagendamento
    const [modalReagendamento, setModalReagendamento] = useState(null); // { vendaId, entregaId, dataAgendada, turno }
    const [motivoReagendamento, setMotivoReagendamento] = useState("");

    // Estados para Preferências de Entrega
    const [modalPreferencias, setModalPreferencias] = useState(null); // { entregaId, preferencias }
    const [preferenciasTemp, setPreferenciasTemp] = useState({ dias: [], turnos: [], obs: "" });
    const [modalTransferencia, setModalTransferencia] = useState(null); // { vendaId }
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

    // Query para buscar entregas (para mostrar status operacional)
    const { data: entregas = [] } = useQuery({
        queryKey: ['entregas'],
        queryFn: () => base44.entities.Entrega.list('-created_date'),
        refetchInterval: 10000
    });

    // Query para buscar montagens
    const { data: montagens = [] } = useQuery({
        queryKey: ['montagens'],
        queryFn: () => base44.entities.MontagemItem.list(),
        refetchInterval: 10000
    });

    // Query para buscar usuários (para exibir nome do vendedor)
    const { data: users = [] } = useQuery({
        queryKey: ['users_list'],
        queryFn: () => base44.entities.User.list()
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

    // Mutation para solicitar reagendamento
    const reagendarMutation = useMutation({
        mutationFn: async ({ entregaId, motivo, dataOriginal, turnoOriginal }) => {
            // 1. Buscar entrega atual para pegar histórico
            const entregaAtual = entregas.find(e => e.id === entregaId);
            const historicoAtual = entregaAtual?.historico_reagendamentos || [];

            const novoEvento = {
                data: dataOriginal,
                turno: turnoOriginal,
                motivo: motivo,
                data_registro: new Date().toISOString(),
                usuario: user?.email || 'vendedor'
            };

            return await base44.entities.Entrega.update(entregaId, {
                status: 'Pendente',
                data_agendada: null,
                turno: null,
                caminhao_id: null,
                ordem_rota: null,
                // Registrar a restrição
                data_restricao: dataOriginal,
                turno_restricao: turnoOriginal,
                motivo_restricao: motivo,
                historico_reagendamentos: [...historicoAtual, novoEvento]
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entregas'] });
            queryClient.invalidateQueries({ queryKey: ['vendas'] }); // Atualizar badges
            toast.success("Solicitação de reagendamento enviada para Logística!");
            setModalReagendamento(null);
            setMotivoReagendamento("");
        },
        onError: () => toast.error("Erro ao solicitar reagendamento")
    });

    // Mutation para salvar preferências
    const salvarPreferenciasMutation = useMutation({
        mutationFn: async ({ entregaId, preferencias }) => {
            return await base44.entities.Entrega.update(entregaId, {
                preferencias_entrega: preferencias
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entregas'] });
            toast.success("Preferências de entrega atualizadas!");
            setModalPreferencias(null);
        },
        onError: () => toast.error("Erro ao salvar preferências")
    });

    const confirmarReagendamento = () => {
        if (!modalReagendamento || !motivoReagendamento.trim()) {
            toast.error("Informe o motivo");
            return;
        }
        reagendarMutation.mutate({
            entregaId: modalReagendamento.entregaId,
            motivo: motivoReagendamento,
            dataOriginal: modalReagendamento.dataAgendada,
            turnoOriginal: modalReagendamento.turno
        });
    };

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
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Situação</TableHead>

                                    <TableHead>
                                        <div className="flex items-center gap-2">
                                            Andamento
                                            <HoverCard>
                                                <HoverCardTrigger asChild>
                                                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                                                </HoverCardTrigger>
                                                <HoverCardContent className="w-80">
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold">Legenda de Status</h4>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Clock className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">A Agendar (Sem data definida)</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-orange-100 text-orange-700 border-orange-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <ClipboardList className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Pendente Triagem (Sem data)</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Truck className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Aguardando Entrega</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Wrench className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Montagem Pendente</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-teal-100 text-teal-700 border-teal-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Wrench className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Entregue, aguardando montador</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-green-100 text-green-700 border-green-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <CheckCircle className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Concluído / Pronto p/ Entrega</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Truck className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Em Rota de Entrega</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Carregando vendas...
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-8 text-gray-500">
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
                                            <TableCell>
                                                <span
                                                    className="text-sm text-gray-600 dark:text-gray-400 cursor-help"
                                                    title={`ID: ${venda.responsavel_id}`}
                                                >
                                                    {(() => {
                                                        if (!venda.responsavel_id) return '-';

                                                        // Debug para encontrar o erro
                                                        // console.log('Procurando vendedor:', venda.responsavel_id);
                                                        // console.log('Lista de usuários:', users);

                                                        const responsavelId = String(venda.responsavel_id).toLowerCase();
                                                        const user = users.find(u =>
                                                            String(u.id).toLowerCase() === responsavelId ||
                                                            String(u.email).toLowerCase() === responsavelId
                                                        );

                                                        return user?.full_name || user?.email || '-';
                                                    })()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-bold text-gray-900 dark:text-white">
                                                R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={venda.status} />
                                            </TableCell>

                                            <TableCell>
                                                <OrderStatusBadge
                                                    venda={venda}
                                                    entregas={entregas}
                                                    montagens={montagens}
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

                                                        // Resolver nome do vendedor
                                                        let nomeVendedor = venda.responsavel_nome;
                                                        if (venda.responsavel_id) {
                                                            const u = users.find(user => user.id === venda.responsavel_id);
                                                            if (u && u.full_name) nomeVendedor = u.full_name;
                                                        }

                                                        abrirNotaPedidoPDF(venda, clienteCompleto, nomeVendedor || user?.full_name);
                                                    }}>
                                                        <FileText className="w-4 h-4 text-blue-600" />
                                                    </Button>

                                                    {/* Botão de Cancelar */}
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

                                                    {/* Botão de Reagendamento (Vendedor solicita) */}
                                                    {(() => {
                                                        const entregaAgendada = entregas.find(e => e.numero_pedido === venda.numero_pedido && e.data_agendada && e.status !== 'Entregue');
                                                        if (entregaAgendada) {
                                                            return (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        setModalReagendamento({
                                                                            vendaId: venda.id,
                                                                            entregaId: entregaAgendada.id,
                                                                            dataAgendada: entregaAgendada.data_agendada,
                                                                            turno: entregaAgendada.turno
                                                                        });
                                                                        setMotivoReagendamento("");
                                                                    }}
                                                                    title="Solicitar Reagendamento (Cliente não pode receber)"
                                                                >
                                                                    <CalendarX className="w-4 h-4 text-red-500" />
                                                                </Button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}

                                                    {/* Botão de Preferências de Entrega */}
                                                    {(() => {
                                                        const entrega = entregas.find(e => e.numero_pedido === venda.numero_pedido && e.status !== 'Entregue');
                                                        if (entrega) {
                                                            return (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        const prefs = entrega.preferencias_entrega || { dias: [], turnos: [], obs: "" };
                                                                        setPreferenciasTemp(prefs);
                                                                        setModalPreferencias({ entregaId: entrega.id });
                                                                    }}
                                                                    title="Preferências de Entrega / Restrições"
                                                                >
                                                                    <Settings className="w-4 h-4 text-gray-500" />
                                                                </Button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}

                                                    {/* Botão de Transferir Montagem (Wrench com seta) */}
                                                    {(() => {
                                                        // Verificar se tem itens de montagem INTERNA pendentes
                                                        const itensInternosPendentes = montagens.some(m =>
                                                            m.venda_id === venda.id &&
                                                            m.tipo_montagem === 'interna' &&
                                                            m.status !== 'concluida'
                                                        );

                                                        if (itensInternosPendentes) {
                                                            return (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => setModalTransferencia(venda)}
                                                                    title="Transferir Montagem para Externo"
                                                                >
                                                                    <div className="relative">
                                                                        <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                                                                    </div>
                                                                </Button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
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

            {/* Modal Solicitar Reagendamento */}
            <Dialog open={!!modalReagendamento} onOpenChange={() => setModalReagendamento(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <CalendarX className="w-5 h-5" />
                            Solicitar Reagendamento
                        </DialogTitle>
                        <DialogDescription>
                            Motivo pelo qual o cliente não pode receber na data agendada:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="Ex: Cliente estará viajando, pediu para entregar próxima semana..."
                            value={motivoReagendamento}
                            onChange={(e) => setMotivoReagendamento(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalReagendamento(null)}>Cancelar</Button>
                        <Button
                            onClick={confirmarReagendamento}
                            disabled={reagendarMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {reagendarMutation.isPending ? <Loader2 className="animate-spin" /> : "Confirmar Reagendamento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* Modal de Preferências de Entrega */}
            <Dialog open={!!modalPreferencias} onOpenChange={(open) => !open && setModalPreferencias(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Preferências de Entrega</DialogTitle>
                        <DialogDescription>
                            Defina restrições ou preferências de horário para esta entrega.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-3">
                            <Label>Dias da Semana Permitidos</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => (
                                    <div key={idx} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`venda-dia-${idx}`}
                                            checked={preferenciasTemp.dias?.includes(idx + 1)}
                                            onCheckedChange={(checked) => {
                                                setPreferenciasTemp(prev => ({
                                                    ...prev,
                                                    dias: checked
                                                        ? [...(prev.dias || []), idx + 1]
                                                        : (prev.dias || []).filter(d => d !== idx + 1)
                                                }));
                                            }}
                                        />
                                        <label htmlFor={`venda-dia-${idx}`} className="text-sm font-medium leading-none cursor-pointer">
                                            {dia}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Turnos Permitidos</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Manhã', 'Tarde', 'Comercial'].map((turno) => (
                                    <div key={turno} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`venda-turno-${turno}`}
                                            checked={preferenciasTemp.turnos?.includes(turno)}
                                            onCheckedChange={(checked) => {
                                                setPreferenciasTemp(prev => ({
                                                    ...prev,
                                                    turnos: checked
                                                        ? [...(prev.turnos || []), turno]
                                                        : (prev.turnos || []).filter(t => t !== turno)
                                                }));
                                            }}
                                        />
                                        <label htmlFor={`venda-turno-${turno}`} className="text-sm font-medium leading-none cursor-pointer">
                                            {turno}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Observação</Label>
                            <Textarea
                                placeholder="Ex: Ligar antes..."
                                value={preferenciasTemp.obs || ""}
                                onChange={(e) => setPreferenciasTemp(prev => ({ ...prev, obs: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalPreferencias(null)}>Cancelar</Button>
                        <Button
                            onClick={() => salvarPreferenciasMutation.mutate({
                                entregaId: modalPreferencias.entregaId,
                                preferencias: preferenciasTemp
                            })}
                            disabled={salvarPreferenciasMutation.isPending}
                        >
                            {salvarPreferenciasMutation.isPending ? <Loader2 className="animate-spin" /> : "Salvar Preferências"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Modal de Transferência de Montagem */}
            <TransferirMontagemModal
                isOpen={!!modalTransferencia}
                onClose={() => setModalTransferencia(null)}
                venda={modalTransferencia}
                user={user}
            />
        </div >
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

// Componente para status operacional do pedido
function OrderStatusBadge({ venda, entregas, montagens }) {
    // Se a venda foi cancelada, mostrar isso
    if (venda.status === 'Cancelado') {
        return (
            <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1 w-fit">
                <XCircle className="w-3 h-3" />
                Cancelado
            </Badge>
        );
    }

    const badges = [];

    // 1. Verificação de Triagem
    if (!venda.triagem_realizada) {
        badges.push(
            <Badge key="triagem" className="bg-orange-100 text-orange-700 border border-orange-200 gap-1 w-fit">
                <ClipboardList className="w-3 h-3" />
                Pendente Triagem
            </Badge>
        );
    }

    // 2. Verificação de Entrega
    const entregasVenda = entregas.filter(e => e.numero_pedido === venda.numero_pedido);

    // Se não tem entregas criadas
    if (entregasVenda.length === 0) {
        // Verificar se todos os itens são do tipo 'retira' (Cliente Retira)
        const todosRetira = venda.itens?.every(item => item.tipo_montagem === 'retira');

        if (todosRetira && venda.itens?.length > 0) {
            badges.push(
                <Badge key="retira" className="bg-purple-100 text-purple-700 border border-purple-200 gap-1 w-fit">
                    <UserCheck className="w-3 h-3" />
                    Cliente Retira
                </Badge>
            );
        } else if (venda.status === 'Pagamento Pendente') {
            badges.push(
                <Badge key="pgto" className="bg-gray-100 text-gray-600 border border-gray-200 gap-1 w-fit">
                    <Clock className="w-3 h-3" />
                    Aguardando Pgto
                </Badge>
            );
        } else {
            badges.push(
                <Badge key="processando" className="bg-yellow-100 text-yellow-700 border border-yellow-200 gap-1 w-fit">
                    <Package className="w-3 h-3" />
                    Aguardando Entrega
                </Badge>
            );
        }
    } else {
        // Tem entregas
        const entrega = entregasVenda[0]; // Pega a principal (simplificação)
        const dataEntrega = entrega.data_agendada ? new Date(entrega.data_agendada).toLocaleDateString('pt-BR') : null;

        if (entrega.tipo_entrega === 'Retirada') {
            if (entrega.status === 'Entregue') {
                badges.push(
                    <Badge key="retirado" className="bg-green-100 text-green-700 border border-green-200 gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Retirado
                    </Badge>
                );
            } else {
                badges.push(
                    <Badge key="retirada_pendente" className="bg-purple-100 text-purple-700 border border-purple-200 gap-1 w-fit">
                        <UserCheck className="w-3 h-3" />
                        Aguardando Retirada
                    </Badge>
                );
            }
        } else {
            // Entrega Comum
            if (entrega.status === 'Entregue') {
                badges.push(
                    <Badge key="entregue" className="bg-green-100 text-green-700 border border-green-200 gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Entregue
                    </Badge>
                );
            } else if (entrega.status === 'Em Rota') {
                badges.push(
                    <Badge key="em_rota" className="bg-blue-100 text-blue-700 border border-blue-200 gap-1 w-fit">
                        <Truck className="w-3 h-3" />
                        Em Rota
                    </Badge>
                );
            } else {
                badges.push(
                    <Badge key="ent_pendente" className="bg-amber-100 text-amber-700 border border-amber-200 gap-1 w-fit">
                        <Truck className="w-3 h-3" />
                        Entrega: {dataEntrega || 'A Agendar'}
                    </Badge>
                );
            }
        }
    }

    // 3. Verificação de Montagem
    const temMontagem = venda.itens?.some(i => ['Montado', 'Montagem Externa', 'Montagem no Local', 'interna', 'terceirizada'].includes(i.tipo_entrega) || ['interna', 'terceirizada', 'Montagem Externa'].includes(i.tipo_montagem));

    if (temMontagem) {
        const montagensVenda = montagens.filter(m => m.numero_pedido === venda.numero_pedido);
        const todasConcluidas = montagensVenda.length > 0 && montagensVenda.every(m => m.status === 'concluida');

        if (todasConcluidas) {
            badges.push(
                <Badge key="montado" className="bg-green-100 text-green-700 border border-green-200 gap-1 w-fit">
                    <Wrench className="w-3 h-3" />
                    Montado
                </Badge>
            );
        } else {
            // Se tem itens de montagem criados ou se a venda requer montagem
            badges.push(
                <Badge key="mont_pendente" className="bg-amber-100 text-amber-700 border border-amber-200 gap-1 w-fit">
                    <Wrench className="w-3 h-3" />
                    Montagem Pendente
                </Badge>
            );
        }
    }

    return (
        <div className="flex flex-col gap-1 items-start">
            {badges}
        </div>
    );
}