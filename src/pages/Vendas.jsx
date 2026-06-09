import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatarTelefone, formatarNome, capitalizar } from "@/utils/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Plus, Search, Filter, FileText, Loader2, Archive, ShoppingCart, Receipt, CheckCircle, XCircle, AlertTriangle, MessageCircle, CreditCard, Link2, Truck, Package, Wrench, Clock, MapPin, UserCheck, ClipboardList, Info, CalendarX, Settings, ArrowRightLeft, Unlock, ArrowUpDown, ArrowUp, ArrowDown, Percent } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useNavigate, useSearchParams } from "react-router-dom";
import { abrirNotaPedidoPDF } from "../components/vendas/NotaPedidoPDF";
import { useAuth } from "@/hooks/useAuth";
import { useLojas } from "@/hooks/useLojas";
import { useConfirm } from "@/hooks/useConfirm";
import ArquivoTab from "../components/vendas/ArquivoTab";
import EmitirNFeModal from "../components/vendas/EmitirNFeModal";
import TransferirMontagemModal from "../components/vendas/TransferirMontagemModal";
import { VendaDetalhesModal } from "@/components/vendas/VendaDetalhesModal";
import { getVendaFinanceiro, getVendaResumoLogistico, isStatusCancelado, isVendaCancelada } from "@/utils/vendaStatus";
import { buildProductDisplayName } from "@/utils/productReference";
import { MONEY_EPSILON, toMoneyNumber } from "@/utils/deliveryPayment";
import { isInstallmentPaymentMethod, validatePaymentSplit } from "@/services/paymentOrchestrator";
import { findCategoriaByNames } from "@/lib/financeiroRecorrencia";

const STATUS_ENTREGA_OPTIONS = [
    'Aguardando Liberação',
    'Pendente',
    'Agendada',
    'Em Rota',
    'Entregue',
    'Retirado'
];

const SALES_PAYMENT_OPTIONS = [
    'Dinheiro',
    'PIX',
    'Cartão de Débito',
    'Cartão de Crédito',
    'Boleto',
    'Transferência'
];

const createEmptyPagamentoItem = (defaults = {}) => ({
    forma_pagamento: defaults.forma_pagamento || '',
    valor: defaults.valor || '',
    parcelas: defaults.parcelas || 1,
});

const SORT_DEFAULT_DIRECTIONS = {
    cliente: 'asc',
    pedido: 'asc',
    data: 'desc',
    total: 'desc',
};

export default function Vendas() {
    const formatarValorMonetarioInput = (value) => {
        const digitsOnly = String(value ?? "").replace(/\D/g, "");
        if (!digitsOnly) return "";

        const valorNumerico = Number(digitsOnly) / 100;
        return valorNumerico.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });
    const [activeTab, setActiveTab] = useState("vendas");
    const [nfeModalOpen, setNfeModalOpen] = useState(false);
    const [vendaParaNfe, setVendaParaNfe] = useState(null);
    const [clienteParaNfe, setClienteParaNfe] = useState(null);
    const [selectedVendaDetalhes, setSelectedVendaDetalhes] = useState(null);
    const [isDetalhesModalOpen, setIsDetalhesModalOpen] = useState(false);
    const [modalPagamentoVenda, setModalPagamentoVenda] = useState(null);
    const [pagamentoForm, setPagamentoForm] = useState({
        pagamentos: [],
        data_pagamento: new Date().toISOString().slice(0, 10),
        observacao: ""
    });
    const [novoPagamentoItem, setNovoPagamentoItem] = useState(createEmptyPagamentoItem({ forma_pagamento: 'PIX' }));

    const liberarEntregaMutation = useMutation({
        mutationFn: (id) => base44.entities.Entrega.update(id, {
            status: 'Pendente',
            data_agendada: null,
            turno: null,
            observacoes: "Entrega liberada pelo vendedor/cliente."
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entregas'] });
            toast.success("Entrega liberada! O pedido voltou para a triagem da logística.");
        },
        onError: () => {
            toast.error("Erro ao liberar entrega.");
        }
    });

    // Filtros e Ordenação
    // Estados para reagendamento
    const [modalReagendamento, setModalReagendamento] = useState(null); // { vendaId, entregaId, dataAgendada, turno }
    const [motivoReagendamento, setMotivoReagendamento] = useState("");

    // Estados para Preferências de Entrega
    const [modalPreferencias, setModalPreferencias] = useState(null); // { entregaId, preferencias }
    const [preferenciasTemp, setPreferenciasTemp] = useState({ dias: [0, 1, 2, 3, 4, 5, 6], turnos: ['Manhã', 'Tarde', 'Comercial'], obs: "" });
    const [modalTransferencia, setModalTransferencia] = useState(null); // { vendaId }
    const [modalLiberarEntrega, setModalLiberarEntrega] = useState(null); // { entregaId, pedido }
    const [modalStatusEntregaVenda, setModalStatusEntregaVenda] = useState(null); // { venda, entrega }
    const [statusEntregaForm, setStatusEntregaForm] = useState({ status: 'Pendente', observacoes: '' });
    const [selectedVendaIds, setSelectedVendaIds] = useState([]);
    const [isBulkRunning, setIsBulkRunning] = useState(false);
    const [bulkTransferVendedorOpen, setBulkTransferVendedorOpen] = useState(false);
    const [bulkTransferLojaOpen, setBulkTransferLojaOpen] = useState(false);
    const [bulkPagamentoOpen, setBulkPagamentoOpen] = useState(false);
    const [bulkStatusEntregaOpen, setBulkStatusEntregaOpen] = useState(false);
    const [bulkVendedorId, setBulkVendedorId] = useState("");
    const [bulkLoja, setBulkLoja] = useState("");
    const [bulkPagamentoForm, setBulkPagamentoForm] = useState({
        forma_pagamento: "PIX",
        data_pagamento: new Date().toISOString().slice(0, 10),
        observacao: ""
    });
    const [bulkStatusEntregaForm, setBulkStatusEntregaForm] = useState({ status: 'Pendente', observacoes: '' });
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const confirm = useConfirm();

    // Hook de Autenticação e Controle de Acesso
    const { user, filterData, can, getUserLoja } = useAuth();
    const canCancelVendas = can('cancel_vendas');
    const canManagePayments = can('manage_financeiro') || can('manage_vendas');
    const canManageVendas = can('manage_vendas');
    const canManageDeliveryStatus = can('manage_entregas') || canManageVendas;
    const canUseBulkActions = user?.cargo === 'Administrador' || user?.cargo === 'Gerente Geral' || canManageDeliveryStatus;


    const { data: vendas = [], isLoading } = useQuery({
        queryKey: ['vendas'],
        queryFn: () => base44.entities.Venda.list('-data_venda')
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ['clientes'],
        queryFn: () => base44.entities.Cliente.list()
    });

    const { data: categoriasFinanceiras = [] } = useQuery({
        queryKey: ['categorias-financeiras'],
        queryFn: () => base44.entities.CategoriaFinanceira.list('nome')
    });

    // Smart Return Flow: Reabrir modal de emissão se solicitado via URL
    React.useEffect(() => {
        const emitirNfeId = searchParams.get('emitirNfe');
        if (emitirNfeId) {
            // Força atualização dos dados da venda e do cliente para garantir que edições sejam refletidas
            queryClient.invalidateQueries({ queryKey: ['vendas'] });
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
        }

        if (emitirNfeId && vendas.length > 0 && clientes.length > 0 && !isLoading) {
            const venda = vendas.find(v => v.id === emitirNfeId);
            if (venda) {
                const cliente = clientes.find(c => c.id === venda.cliente_id);
                // Mesmo se cliente não for encontrado na lista (ex: muitas páginas), tenta abrir
                // Idealmente buscaria o cliente individualmente, mas assumindo que está na lista recente

                if (cliente) {
                    setClienteParaNfe(cliente);
                } else {
                    // Fallback se não achar cliente na lista carregada
                    // Poderia fazer um fetch aqui, mas por simplicidade vamos tentar renderizar sem ou esperar refetch
                    // O componente EmitirNFeModal pode precisar do cliente. 
                    // Se user for admin, talvez não precise? Geralmente precisa.
                }

                setVendaParaNfe(venda);
                setClienteParaNfe(cliente);
                setNfeModalOpen(true);

                // Limpar URL para não reabrir ao dar F5
                setSearchParams(params => {
                    const newParams = new URLSearchParams(params);
                    newParams.delete('emitirNfe');
                    return newParams;
                }, { replace: true });
            }
        }
    }, [searchParams, vendas, clientes, isLoading, setSearchParams]);

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

    const { data: lojasAtivas = [] } = useLojas();

    // Mutation para cancelar venda
    const cancelarVendaMutation = useMutation({
        mutationFn: async (input) => {
            const venda = input?.venda || input;
            const silent = Boolean(input?.silent);
            if (!canCancelVendas) {
                throw new Error('Sem permissão para cancelar vendas.');
            }

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

            // 3. Cancelar entregas vinculadas
            const entregasVenda = entregas.filter(e =>
                e.venda_id === venda.id || e.numero_pedido === venda.numero_pedido
            );
            for (const entrega of entregasVenda) {
                if (!isStatusCancelado(entrega.status)) {
                    await base44.entities.Entrega.update(entrega.id, {
                        status: 'Cancelado',
                        observacoes: (entrega.observacoes || '') + ' [VENDA CANCELADA]'
                    });
                }
            }

            // 4. Cancelar montagens vinculadas (internas e externas)
            const montagensVenda = montagens.filter(m => m.venda_id === venda.id);
            for (const montagem of montagensVenda) {
                if (!isStatusCancelado(montagem.status)) {
                    await base44.entities.MontagemItem.update(montagem.id, {
                        status: 'cancelada',
                        observacoes: (montagem.observacoes || '') + ' [VENDA CANCELADA]'
                    });
                }
            }

            // 5. Cancelar assistências técnicas vinculadas
            try {
                const todasAssistencias = await base44.entities.AssistenciaTecnica.list();
                const assistenciasVenda = todasAssistencias.filter(a => a.venda_id === venda.id);
                for (const assistencia of assistenciasVenda) {
                    if (!isStatusCancelado(assistencia.status)) {
                        await base44.entities.AssistenciaTecnica.update(assistencia.id, {
                            status: 'Cancelada',
                            observacoes: (assistencia.observacoes || '') + ' [VENDA CANCELADA]'
                        });
                    }
                }
            } catch (err) {
                console.error('Erro ao cancelar assistências:');
            }

            // 6. Retornar itens ao estoque
            if (venda.itens && venda.itens.length > 0) {
                for (const item of venda.itens) {
                    if (item.produto_id) {
                        try {
                            const { data: produto } = await supabase
                                .from('produtos')
                                .select('quantidade_estoque')
                                .eq('id', item.produto_id)
                                .single();

                            if (produto) {
                                const novaQuantidade = (produto.quantidade_estoque || 0) + (item.quantidade || 1);
                                await base44.entities.Produto.update(item.produto_id, {
                                    quantidade_estoque: novaQuantidade
                                });
                            }
                        } catch (err) {
                            console.error(`Erro ao retornar estoque do produto ${item.produto_id}:`, err);
                        }
                    }
                }
            }

            // 7. Cancelar ou sinalizar pedidos de compra (encomendas)
            try {
                // 7.1 Cancelar solicitações pendentes
                const { data: solicitacoes } = await supabase
                    .from('solicitacoes_encomenda')
                    .select('*')
                    .or(`venda_id.eq.${venda.id},numero_pedido.eq.${venda.numero_pedido}`);

                if (solicitacoes && solicitacoes.length > 0) {
                    for (const sol of solicitacoes) {
                        const statusNormalizado = (sol.status || '').toLowerCase();
                        if (statusNormalizado === 'pendente' || statusNormalizado === 'aguardando_compra') {
                            await supabase
                                .from('solicitacoes_encomenda')
                                .update({ 
                                    status: 'cancelada', 
                                    observacoes: (sol.observacoes || '') + ' [VENDA CANCELADA]' 
                                })
                                .eq('id', sol.id);
                        } else {
                            await supabase
                                .from('solicitacoes_encomenda')
                                .update({ 
                                    status: 'cancelada_retida_cd', 
                                    observacoes: (sol.observacoes || '') + ' [VENDA CANCELADA - ENVIAR PARA CD]' 
                                })
                                .eq('id', sol.id);
                        }
                    }
                }

                // 7.2 Sinalizar itens nas ordens de compra e alertar o comprador
                const { data: itensCompra } = await supabase
                    .from('compras_oc_itens')
                    .select('id, ordem_compra_id, observacao_item')
                    .or(`pedido_origem_numero.eq.${venda.numero_pedido},descricao_personalizada.ilike.%${venda.numero_pedido}%`);

                if (itensCompra && itensCompra.length > 0) {
                    const ordensNotificadas = new Set();
                    for (const item of itensCompra) {
                        await supabase
                            .from('compras_oc_itens')
                            .update({ 
                                observacao_item: '[VENDA CANCELADA - ENVIAR PARA CD] ' + (item.observacao_item || '')
                            })
                            .eq('id', item.id);
                            
                        if (!ordensNotificadas.has(item.ordem_compra_id)) {
                            ordensNotificadas.add(item.ordem_compra_id);
                            await supabase
                                .from('compras_comunicacoes')
                                .insert([{
                                    ordem_compra_id: item.ordem_compra_id,
                                    tipo: 'SISTEMA',
                                    remetente: 'Sistema Vendas',
                                    destinatario: 'Setor de Compras',
                                    conteudo: { mensagem: `ATENÇÃO: A Venda #${venda.numero_pedido} foi CANCELADA. O item desta venda deve ser redirecionado para o CD quando chegar.` },
                                    data_envio: new Date().toISOString()
                                }]);
                        }
                    }
                }
            } catch (err) {
                console.error('Erro ao cancelar/sinalizar encomendas:', err);
            }

            return {
                vendaId: venda.id,
                lancamentosCancelados: lancamentosVenda.length,
                entregasCanceladas: entregasVenda.length,
                montagensCanceladas: montagensVenda.length,
                silent
            };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['vendas'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentos-venda'] });
            queryClient.invalidateQueries({ queryKey: ['entregas-venda'] });
            queryClient.invalidateQueries({ queryKey: ['montagens-venda'] });
            queryClient.invalidateQueries({ queryKey: ['assistencias-venda'] });
            queryClient.invalidateQueries({ queryKey: ['solicitacoes-pdv'] });
            queryClient.invalidateQueries({ queryKey: ['solicitacoes_encomenda'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['compras'] });
            if (!result?.silent) {
                toast.success("Venda cancelada! Entregas, montagens, assistências, lançamentos e encomendas vinculadas também foram sinalizados.");
            }
        }
    });

    const registrarPagamentoVenda = async ({ venda, valorRecebido, formaPagamento, dataPagamento, observacao }) => {
        if (!venda?.id) throw new Error('Venda inválida para registrar pagamento.');
        if (isVendaCancelada(venda)) throw new Error('Não é possível registrar pagamento em venda cancelada.');

        const financeiroAtual = venda.financeiro || getVendaFinanceiro(venda, { entregas, lancamentos });
        const saldoAtual = Math.max(toMoneyNumber(financeiroAtual.valorRestante), 0);
        const totalVenda = Math.max(toMoneyNumber(financeiroAtual.total || venda.valor_total), 0);
        const valorPagoAtual = Math.max(toMoneyNumber(financeiroAtual.valorPago || venda.valor_pago), 0);

        const rawPayments = Array.isArray(valorRecebido)
            ? valorRecebido
            : [{ forma_pagamento: formaPagamento, valor: valorRecebido, parcelas: 1 }];

        const paymentValidation = validatePaymentSplit({
            total: saldoAtual,
            payments: rawPayments.map((payment) => ({
                ...payment,
                valor: toMoneyNumber(payment?.valor),
                parcelas: Number(payment?.parcelas || 1),
            })),
        });

        if (!paymentValidation.ok) {
            throw new Error(paymentValidation.errors[0] || 'Não foi possível validar os pagamentos informados.');
        }

        const novosPagamentos = paymentValidation.pagamentos;
        const valorRecebidoNum = paymentValidation.totalPago;

        if (valorRecebidoNum <= MONEY_EPSILON) {
            throw new Error('Informe um valor de pagamento maior que zero.');
        }

        const novoValorPago = Math.min(totalVenda, valorPagoAtual + valorRecebidoNum);
        const novoValorRestante = Math.max(totalVenda - novoValorPago, 0);
        const quitada = novoValorRestante <= MONEY_EPSILON;
        const statusVenda = quitada ? 'Pago' : 'Pagamento Pendente';
        const pagamentosExistentes = Array.isArray(venda.pagamentos) ? venda.pagamentos : [];
        const pagamentosAtualizados = [...pagamentosExistentes, ...novosPagamentos];
        const formaPagamentoResumo = pagamentosAtualizados.length === 1
            ? pagamentosAtualizados[0].forma_pagamento
            : 'Múltiplos';

        const vendaUpdatePayload = {
            valor_pago: novoValorPago,
            valor_restante: novoValorRestante,
            status: statusVenda,
            forma_pagamento: formaPagamentoResumo,
            pagamentos: pagamentosAtualizados,
            pagamento_entrega_observacao: observacao || null,
        };

        try {
            await base44.entities.Venda.update(venda.id, vendaUpdatePayload);
        } catch (error) {
            const mensagem = String(error?.message || '').toLowerCase();
            const colunaAusente = mensagem.includes('pagamento_entrega_observacao') && mensagem.includes('schema cache');

            if (!colunaAusente) {
                throw error;
            }

            const { pagamento_entrega_observacao, ...fallbackPayload } = vendaUpdatePayload;
            await base44.entities.Venda.update(venda.id, fallbackPayload);
        }

        const categoriaRecebimento = findCategoriaByNames(categoriasFinanceiras, [
            'Recebimento de Parcela',
            'Venda de Produtos',
            'Vendas',
        ]);

        for (const pagamento of novosPagamentos) {
            const descricaoParcelas = pagamento.parcelas > 1 ? ` (${pagamento.parcelas}x)` : '';
            await base44.entities.LancamentoFinanceiro.create({
                descricao: `Pagamento na loja - Venda #${venda.numero_pedido} - ${pagamento.forma_pagamento}${descricaoParcelas}`,
                valor: pagamento.valor,
                tipo: 'receita',
                data_lancamento: dataPagamento,
                data_vencimento: dataPagamento,
                pago: true,
                categoria_id: categoriaRecebimento?.id || null,
                categoria_nome: categoriaRecebimento?.nome || 'Recebimento de Parcela',
                forma_pagamento: pagamento.forma_pagamento,
                status: 'Pago',
                observacao: observacao || 'Pagamento antecipado registrado na listagem de vendas.',
                venda_id: venda.id,
                numero_pedido: venda.numero_pedido,
            });
        }

        if (quitada) {
            const pendentesVenda = (lancamentos || []).filter((l) =>
                l.venda_id === venda.id &&
                String(l.tipo || '').toLowerCase() === 'receita' &&
                String(l.status || '').toLowerCase() === 'pendente'
            );

            for (const lancamento of pendentesVenda) {
                await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
                    status: 'Pago',
                    pago: true,
                    data_lancamento_real: dataPagamento,
                    observacao: `${lancamento.observacao || ''} [Quitado na loja antes da entrega]`.trim(),
                });
            }
        }

        return { valorRecebidoNum, novoValorRestante, quitada };
    };

    const registrarPagamentoMutation = useMutation({
        mutationFn: registrarPagamentoVenda,
        onSuccess: ({ valorRecebidoNum, novoValorRestante, quitada }) => {
            queryClient.invalidateQueries({ queryKey: ['vendas'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
            queryClient.invalidateQueries({ queryKey: ['entregas'] });
            queryClient.invalidateQueries({ queryKey: ['vendas-financeiro'] });

            toast.success(
                `Pagamento de R$ ${valorRecebidoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} registrado. ${quitada ? 'Venda quitada.' : `Saldo restante: R$ ${novoValorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`}`
            );
            setModalPagamentoVenda(null);
            setPagamentoForm({
                pagamentos: [],
                data_pagamento: new Date().toISOString().slice(0, 10),
                observacao: ""
            });
            setNovoPagamentoItem(createEmptyPagamentoItem({ forma_pagamento: 'PIX' }));
        },
        onError: (error) => {
            toast.error(error?.message || 'Não foi possível registrar o pagamento.');
        }
    });

    const abrirModalPagamento = (venda) => {
        const financeiro = venda.financeiro || getVendaFinanceiro(venda, { entregas, lancamentos });
        const saldoAtual = Math.max(toMoneyNumber(financeiro.valorRestante), 0);
        const formaPagamentoPadrao = venda.forma_pagamento_entrega || venda.forma_pagamento || 'PIX';

        setPagamentoForm({
            pagamentos: [],
            data_pagamento: new Date().toISOString().slice(0, 10),
            observacao: ""
        });
        setNovoPagamentoItem(createEmptyPagamentoItem({
            forma_pagamento: formaPagamentoPadrao,
            valor: saldoAtual > 0 ? formatarValorMonetarioInput(saldoAtual.toFixed(2)) : '',
        }));
        setModalPagamentoVenda(venda);
    };

    const saldoModalPagamento = modalPagamentoVenda
        ? Math.max(
            toMoneyNumber((modalPagamentoVenda.financeiro || getVendaFinanceiro(modalPagamentoVenda, { entregas, lancamentos })).valorRestante),
            0
        )
        : 0;

    const totalPagamentoInformado = pagamentoForm.pagamentos.reduce((total, pagamento) => total + toMoneyNumber(pagamento.valor), 0);
    const saldoAposSplit = Math.max(saldoModalPagamento - totalPagamentoInformado, 0);

    const adicionarPagamentoAoModal = () => {
        const pagamentosCandidatos = [
            ...pagamentoForm.pagamentos,
            {
                ...novoPagamentoItem,
                valor: toMoneyNumber(novoPagamentoItem.valor),
                parcelas: Number(novoPagamentoItem.parcelas || 1),
            }
        ];

        const validation = validatePaymentSplit({
            total: saldoModalPagamento,
            payments: pagamentosCandidatos,
        });

        if (!validation.ok) {
            toast.error(validation.errors[0] || 'Não foi possível adicionar essa forma de pagamento.');
            return;
        }

        setPagamentoForm((prev) => ({
            ...prev,
            pagamentos: validation.pagamentos,
        }));
        const saldoRestanteAtualizado = Math.max(saldoModalPagamento - validation.totalPago, 0);
        setNovoPagamentoItem(createEmptyPagamentoItem({
            forma_pagamento: novoPagamentoItem.forma_pagamento || 'PIX',
            valor: saldoRestanteAtualizado > 0 ? formatarValorMonetarioInput(saldoRestanteAtualizado.toFixed(2)) : '',
        }));
    };

    const removerPagamentoDoModal = (index) => {
        setPagamentoForm((prev) => ({
            ...prev,
            pagamentos: prev.pagamentos.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const confirmarPagamentoAntecipado = () => {
        if (!modalPagamentoVenda) return;

        if (!pagamentoForm.pagamentos.length) {
            toast.error('Adicione pelo menos uma forma de pagamento.');
            return;
        }

        registrarPagamentoMutation.mutate({
            venda: modalPagamentoVenda,
            valorRecebido: pagamentoForm.pagamentos,
            dataPagamento: pagamentoForm.data_pagamento,
            observacao: pagamentoForm.observacao,
        });
    };

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

    const confirmarLiberarEntrega = () => {
        if (!modalLiberarEntrega) return;
        liberarEntregaMutation.mutate(modalLiberarEntrega.entregaId);
        setModalLiberarEntrega(null);
    };

    const handleCancelarVenda = async (venda) => {
        if (!canCancelVendas) {
            toast.error('Você não tem permissão para cancelar vendas.');
            return;
        }

        const confirmed = await confirm({
            title: "Cancelar Venda",
            message: `Tem certeza que deseja CANCELAR a venda #${venda.numero_pedido}?\n\nIsso também cancelará todos os lançamentos financeiros, entregas, montagens e assistências vinculadas.`,
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

    // 1. Filtra pelo escopo do usuário, sempre respeitando a loja atribuída.
    const vendasPermitidas = filterData(vendas, {
        userField: 'responsavel_id',
        lojaField: 'loja'
    });
    const vendasComResumo = vendasPermitidas.map((venda) => ({
        ...venda,
        financeiro: getVendaFinanceiro(venda, { entregas, lancamentos }),
        resumoLogistico: getVendaResumoLogistico(venda, { entregas, montagens })
    }));

    // 2. Filtros de Busca e Status da Tela (exclui cancelados da aba principal)
    const filtered = vendasComResumo.filter(v => {
        if (isVendaCancelada(v)) return false;
        if (statusFilter !== 'all' && v.financeiro.displayStatus !== statusFilter) return false;
        if (search && !v.cliente_nome?.toLowerCase().includes(search.toLowerCase()) && !v.numero_pedido?.includes(search)) return false;
        return true;
    });

    // 3. Filtro para aba de cancelados
    const filteredCancelados = vendasComResumo.filter(v => {
        if (!isVendaCancelada(v)) return false;
        if (search && !v.cliente_nome?.toLowerCase().includes(search.toLowerCase()) && !v.numero_pedido?.includes(search)) return false;
        return true;
    });

    const getSortValue = React.useCallback((venda, sortKey) => {
        switch (sortKey) {
            case 'cliente':
                return String(venda.cliente_nome || '').trim().toLocaleLowerCase('pt-BR');
            case 'pedido': {
                const numeroPedido = String(venda.numero_pedido || '').trim();
                const parsedPedido = Number(numeroPedido.replace(/\D/g, ''));
                return Number.isNaN(parsedPedido) ? numeroPedido.toLocaleLowerCase('pt-BR') : parsedPedido;
            }
            case 'data':
                return new Date(venda.data_venda || 0).getTime();
            case 'total':
                return toMoneyNumber(venda.valor_total);
            default:
                return '';
        }
    }, []);

    const sortVendas = React.useCallback((lista) => {
        const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

        return [...lista].sort((vendaA, vendaB) => {
            const valorA = getSortValue(vendaA, sortConfig.key);
            const valorB = getSortValue(vendaB, sortConfig.key);

            if (typeof valorA === 'string' && typeof valorB === 'string') {
                return valorA.localeCompare(valorB, 'pt-BR', { sensitivity: 'base', numeric: true }) * directionMultiplier;
            }

            if (valorA < valorB) return -1 * directionMultiplier;
            if (valorA > valorB) return 1 * directionMultiplier;

            return 0;
        });
    }, [getSortValue, sortConfig.direction, sortConfig.key]);

    const sortedFiltered = React.useMemo(() => sortVendas(filtered), [filtered, sortVendas]);
    const sortedFilteredCancelados = React.useMemo(() => sortVendas(filteredCancelados), [filteredCancelados, sortVendas]);

    const selectedVendas = sortedFiltered.filter((v) => selectedVendaIds.includes(v.id));
    const selectedIdsSet = new Set(selectedVendaIds);
    const showBulkSelectionColumn = canUseBulkActions && activeTab === 'vendas';
    const allVisibleSelected = sortedFiltered.length > 0 && selectedVendaIds.length === sortedFiltered.length;
    const someVisibleSelected = selectedVendaIds.length > 0 && !allVisibleSelected;
    const tableColSpanVendas = showBulkSelectionColumn ? 12 : 11;
    const vendedoresDisponiveis = users.filter((u) => u?.id);
    const lojasDisponiveis = React.useMemo(() => {
        const normalizarNomeLoja = (value) => String(value || '').trim();

        const lojasCadastradas = lojasAtivas
            .map((loja) => normalizarNomeLoja(loja?.nome))
            .filter(Boolean);

        const lojaAtuacaoAtual = normalizarNomeLoja(getUserLoja?.()).toLowerCase();

        return lojasCadastradas
            .filter((nome, index, arr) => arr.findIndex((item) => item.toLowerCase() === nome.toLowerCase()) === index)
            .filter((nome) => nome.toLowerCase() !== lojaAtuacaoAtual);
    }, [getUserLoja, lojasAtivas]);

    React.useEffect(() => {
        if (bulkLoja && !lojasDisponiveis.some((loja) => loja === bulkLoja)) {
            setBulkLoja("");
        }
    }, [bulkLoja, lojasDisponiveis]);

    React.useEffect(() => {
        if (!showBulkSelectionColumn) {
            setSelectedVendaIds((prev) => (prev.length ? [] : prev));
            return;
        }

        const visibleIds = new Set(sortedFiltered.map((v) => v.id));
        setSelectedVendaIds((prev) => {
            const next = prev.filter((id) => visibleIds.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [showBulkSelectionColumn, sortedFiltered]);

    const handleToggleSelectVenda = (vendaId, checked) => {
        setSelectedVendaIds((prev) => {
            if (checked) {
                return prev.includes(vendaId) ? prev : [...prev, vendaId];
            }
            return prev.filter((id) => id !== vendaId);
        });
    };

    const handleSelectAllVendas = (checked) => {
        setSelectedVendaIds(checked ? sortedFiltered.map((v) => v.id) : []);
    };

    const handleSortChange = (key) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return {
                    key,
                    direction: prev.direction === 'asc' ? 'desc' : 'asc',
                };
            }

            return {
                key,
                direction: SORT_DEFAULT_DIRECTIONS[key] || 'asc',
            };
        });
    };

    const renderSortableHeader = (label, key, className = '') => {
        const isActive = sortConfig.key === key;
        const Icon = !isActive ? ArrowUpDown : (sortConfig.direction === 'asc' ? ArrowUp : ArrowDown);

        return (
            <TableHead className={className}>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => handleSortChange(key)}
                >
                    <span>{label}</span>
                    <Icon className={`ml-2 h-4 w-4 ${isActive ? 'text-foreground' : 'text-muted-foreground/70'}`} />
                </Button>
            </TableHead>
        );
    };

    const isEntregaFinalizadaStatus = (status) => {
        const normalized = String(status || '').toLowerCase();
        return normalized === 'entregue' || normalized === 'retirado';
    };

    const getEntregaAlvoVenda = (venda) => {
        const entregasVenda = (entregas || []).filter((e) =>
            e.numero_pedido === venda.numero_pedido && !isStatusCancelado(e.status)
        );

        if (!entregasVenda.length) return null;

        const naoFinalizada = entregasVenda.find((e) => !isEntregaFinalizadaStatus(e.status));
        return naoFinalizada || entregasVenda[0];
    };

    const atualizarStatusEntrega = async ({ entrega, status, observacoes }) => {
        if (!entrega?.id) {
            throw new Error('Entrega não encontrada para este pedido.');
        }

        const novoStatus = String(status || '').trim();
        if (!novoStatus) {
            throw new Error('Selecione um status de entrega válido.');
        }

        const payload = {
            status: novoStatus,
            observacoes: observacoes?.trim() || null,
        };

        if (novoStatus === 'Entregue' || novoStatus === 'Retirado') {
            payload.data_realizada = new Date().toISOString().slice(0, 10);
        } else if (entrega?.data_realizada) {
            payload.data_realizada = null;
        }

        await base44.entities.Entrega.update(entrega.id, payload);
    };

    const abrirModalStatusEntrega = (venda) => {
        const entrega = getEntregaAlvoVenda(venda);
        if (!entrega) {
            toast.warning('Este pedido não possui entrega elegível para atualização de status.');
            return;
        }

        setStatusEntregaForm({
            status: entrega.status || 'Pendente',
            observacoes: entrega.observacoes || ''
        });
        setModalStatusEntregaVenda({ venda, entrega });
    };

    const executarAcaoEmLote = async ({ itens, acao }) => {
        if (!itens.length) {
            toast.warning('Selecione ao menos uma venda para continuar.');
            return;
        }

        setIsBulkRunning(true);
        try {
            const results = await Promise.allSettled(itens.map((venda) => acao(venda)));
            const sucessos = [];
            const falhas = [];

            results.forEach((result, index) => {
                const venda = itens[index];
                if (result.status === 'fulfilled') {
                    sucessos.push(venda.id);
                } else {
                    falhas.push({
                        venda,
                        motivo: result.reason?.message || 'Erro ao processar venda'
                    });
                }
            });

            if (sucessos.length > 0) {
                queryClient.invalidateQueries({ queryKey: ['vendas'] });
                queryClient.invalidateQueries({ queryKey: ['entregas'] });
                queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
            }

            setSelectedVendaIds((prev) => prev.filter((id) => !sucessos.includes(id)));

            if (falhas.length === 0) {
                toast.success(`${sucessos.length} venda(s) processada(s) com sucesso.`);
                return;
            }

            const resumoFalhas = falhas
                .slice(0, 3)
                .map((item) => `#${item.venda.numero_pedido}: ${item.motivo}`)
                .join(' | ');

            toast.warning(
                `Lote concluído com falhas. Sucesso: ${sucessos.length}. Falha: ${falhas.length}. ${resumoFalhas}`
            );
        } finally {
            setIsBulkRunning(false);
        }
    };

    const handleBulkCancelar = async () => {
        const elegiveis = selectedVendas.filter((v) => !isVendaCancelada(v));
        if (!elegiveis.length) {
            toast.warning('Nenhuma venda elegível para cancelamento.');
            return;
        }

        const confirmed = await confirm({
            title: 'Cancelar vendas em lote',
            message: `Tem certeza que deseja cancelar ${elegiveis.length} venda(s)? Esta ação também cancelará entregas, montagens, lançamentos e assistências vinculadas.`,
            confirmText: 'Cancelar vendas',
            variant: 'destructive'
        });
        if (!confirmed) return;

        await executarAcaoEmLote({
            itens: elegiveis,
            acao: (venda) => cancelarVendaMutation.mutateAsync({ venda, silent: true })
        });
    };

    const handleBulkLiberarEntrega = async () => {
        const elegiveis = selectedVendas.filter((venda) => {
            const entregaAguardando = entregas.find((e) =>
                e.numero_pedido === venda.numero_pedido && e.status === 'Aguardando Liberação'
            );
            const podeLiberar = user?.cargo === 'Administrador' || user?.cargo === 'Gerente Geral' || venda.responsavel_id === user?.id;
            return Boolean(entregaAguardando && podeLiberar);
        });

        if (!elegiveis.length) {
            toast.warning('Nenhuma venda selecionada está aguardando liberação.');
            return;
        }

        const confirmed = await confirm({
            title: 'Liberar entregas em lote',
            message: `Deseja liberar ${elegiveis.length} entrega(s) para a logística?`,
            confirmText: 'Liberar entregas'
        });
        if (!confirmed) return;

        await executarAcaoEmLote({
            itens: elegiveis,
            acao: async (venda) => {
                const entregaAguardando = entregas.find((e) =>
                    e.numero_pedido === venda.numero_pedido && e.status === 'Aguardando Liberação'
                );
                if (!entregaAguardando) {
                    throw new Error('Entrega não está aguardando liberação.');
                }
                await base44.entities.Entrega.update(entregaAguardando.id, {
                    status: 'Pendente',
                    data_agendada: null,
                    turno: null,
                    observacoes: 'Entrega liberada pelo vendedor/cliente.'
                });
            }
        });
    };

    const handleBulkTransferirVendedor = async () => {
        if (!bulkVendedorId) {
            toast.error('Selecione o vendedor de destino.');
            return;
        }

        const vendedorDestino = vendedoresDisponiveis.find((u) => String(u.id) === bulkVendedorId);
        if (!vendedorDestino) {
            toast.error('Vendedor selecionado não encontrado.');
            return;
        }

        const elegiveis = selectedVendas.filter((v) => !isVendaCancelada(v));
        await executarAcaoEmLote({
            itens: elegiveis,
            acao: (venda) => base44.entities.Venda.update(venda.id, {
                responsavel_id: vendedorDestino.id,
                responsavel_nome: vendedorDestino.full_name || vendedorDestino.email || venda.responsavel_nome
            })
        });

        setBulkTransferVendedorOpen(false);
        setBulkVendedorId("");
    };

    const handleBulkTransferirLoja = async () => {
        if (!bulkLoja) {
            toast.error('Selecione a loja de destino.');
            return;
        }

        const elegiveis = selectedVendas.filter((v) => !isVendaCancelada(v));
        await executarAcaoEmLote({
            itens: elegiveis,
            acao: (venda) => base44.entities.Venda.update(venda.id, { loja: bulkLoja })
        });

        setBulkTransferLojaOpen(false);
        setBulkLoja("");
    };

    const handleBulkRegistrarPagamento = async () => {
        const elegiveis = selectedVendas.filter((venda) => {
            const financeiro = venda.financeiro || getVendaFinanceiro(venda, { entregas, lancamentos });
            return !isVendaCancelada(venda) && toMoneyNumber(financeiro.valorRestante) > MONEY_EPSILON;
        });

        if (!elegiveis.length) {
            toast.warning('Nenhuma venda com saldo pendente foi selecionada.');
            return;
        }

        await executarAcaoEmLote({
            itens: elegiveis,
            acao: (venda) => {
                const financeiro = venda.financeiro || getVendaFinanceiro(venda, { entregas, lancamentos });
                const saldoRestante = Math.max(toMoneyNumber(financeiro.valorRestante), 0);
                return registrarPagamentoVenda({
                    venda,
                    valorRecebido: saldoRestante,
                    formaPagamento: bulkPagamentoForm.forma_pagamento,
                    dataPagamento: bulkPagamentoForm.data_pagamento,
                    observacao: bulkPagamentoForm.observacao || 'Pagamento em lote na tela de vendas.'
                });
            }
        });

        setBulkPagamentoOpen(false);
        setBulkPagamentoForm({
            forma_pagamento: 'PIX',
            data_pagamento: new Date().toISOString().slice(0, 10),
            observacao: ''
        });
    };

    const handleConfirmarStatusEntrega = async () => {
        if (!modalStatusEntregaVenda) return;

        try {
            await atualizarStatusEntrega({
                entrega: modalStatusEntregaVenda.entrega,
                status: statusEntregaForm.status,
                observacoes: statusEntregaForm.observacoes,
            });

            queryClient.invalidateQueries({ queryKey: ['entregas'] });
            queryClient.invalidateQueries({ queryKey: ['vendas'] });
            toast.success('Status da entrega atualizado com sucesso.');

            setModalStatusEntregaVenda(null);
            setStatusEntregaForm({ status: 'Pendente', observacoes: '' });
        } catch (error) {
            toast.error(error?.message || 'Não foi possível atualizar o status da entrega.');
        }
    };

    const handleBulkAtualizarStatusEntrega = async () => {
        const novoStatus = String(bulkStatusEntregaForm.status || '').trim();
        if (!novoStatus) {
            toast.error('Selecione o novo status da entrega.');
            return;
        }

        const elegiveis = selectedVendas.filter((venda) => Boolean(getEntregaAlvoVenda(venda)));
        if (!elegiveis.length) {
            toast.warning('Nenhuma venda selecionada possui entrega elegível para atualização.');
            return;
        }

        const confirmed = await confirm({
            title: 'Alterar status de entrega em lote',
            message: `Deseja atualizar o status de ${elegiveis.length} entrega(s) para "${novoStatus}"?`,
            confirmText: 'Atualizar status'
        });
        if (!confirmed) return;

        await executarAcaoEmLote({
            itens: elegiveis,
            acao: async (venda) => {
                const entrega = getEntregaAlvoVenda(venda);
                await atualizarStatusEntrega({
                    entrega,
                    status: novoStatus,
                    observacoes: bulkStatusEntregaForm.observacoes,
                });
            }
        });

        setBulkStatusEntregaOpen(false);
        setBulkStatusEntregaForm({ status: 'Pendente', observacoes: '' });
    };

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
                        onClick={() => navigate('/admin/PDV')}
                        className="group w-10 hover:w-44 focus-visible:w-44 overflow-hidden border border-green-200 bg-green-100 text-green-800 hover:bg-green-200 shadow-none transition-all duration-300"
                        title="Aplicar desconto"
                        aria-label="Aplicar desconto"
                    >
                        <Percent className="h-4 w-4 shrink-0" />
                        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-[120px] group-hover:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:opacity-100">
                            Aplicar desconto
                        </span>
                    </Button>
                )}
            </div>

            {/* Sistema de Abas */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-lg grid-cols-3">
                    <TabsTrigger value="vendas" className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Vendas
                    </TabsTrigger>
                    <TabsTrigger value="cancelados" className="flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Cancelados
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
                            </SelectContent>
                        </Select>
                    </div>

                    {showBulkSelectionColumn && selectedVendaIds.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-semibold">{selectedVendaIds.length}</span> venda(s) selecionada(s)
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {canCancelVendas && (
                                    <Button size="sm" variant="destructive" onClick={handleBulkCancelar} disabled={isBulkRunning || cancelarVendaMutation.isPending}>
                                        {isBulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                                        Cancelar em lote
                                    </Button>
                                )}
                                {canManageVendas && (
                                    <>
                                        <Button size="sm" variant="outline" onClick={() => setBulkTransferVendedorOpen(true)} disabled={isBulkRunning}>
                                            Transferir vendedor
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setBulkTransferLojaOpen(true)} disabled={isBulkRunning}>
                                            Transferir loja
                                        </Button>
                                    </>
                                )}
                                {canManagePayments && (
                                    <Button size="sm" variant="outline" onClick={() => setBulkPagamentoOpen(true)} disabled={isBulkRunning}>
                                        Registrar pagamento
                                    </Button>
                                )}
                                {canManageDeliveryStatus && (
                                    <Button size="sm" variant="outline" onClick={() => setBulkStatusEntregaOpen(true)} disabled={isBulkRunning}>
                                        Status da entrega
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={handleBulkLiberarEntrega} disabled={isBulkRunning}>
                                    Liberar entrega
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedVendaIds([])} disabled={isBulkRunning}>
                                    Limpar seleção
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                                <TableRow>
                                    {showBulkSelectionColumn && (
                                        <TableHead className="w-[48px]">
                                            <Checkbox
                                                checked={allVisibleSelected ? true : (someVisibleSelected ? 'indeterminate' : false)}
                                                onCheckedChange={(checked) => handleSelectAllVendas(checked === true)}
                                                aria-label="Selecionar todas as vendas"
                                            />
                                        </TableHead>
                                    )}
                                    {renderSortableHeader('Pedido', 'pedido', 'w-[100px]')}
                                    {renderSortableHeader('Cliente', 'cliente')}
                                    {renderSortableHeader('Data', 'data')}
                                    {renderSortableHeader('Total', 'total')}
                                    <TableHead>Produtos</TableHead>
                                    <TableHead>Loja</TableHead>
                                    <TableHead>Vendedor</TableHead>
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
                                                                <Badge className="bg-orange-100 text-orange-700 border-orange-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <ClipboardList className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Pendente Triagem (Sem data)</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Package className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Aguardando Expedição</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Clock className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">A Agendar (Sem data definida)</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Truck className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Entrega Agendada / Pendente</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Truck className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Em Rota de Entrega</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-green-100 text-green-700 border-green-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <CheckCircle className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Entregue / Concluído</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-teal-100 text-teal-700 border-teal-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Wrench className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Entregue, aguardando montador</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 h-5 w-5 p-0 flex items-center justify-center shrink-0">
                                                                    <Wrench className="h-3 w-3" />
                                                                </Badge>
                                                                <span className="text-gray-600">Montagem Pendente</span>
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
                                        <TableCell colSpan={tableColSpanVendas} className="text-center py-8 text-gray-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Carregando vendas...
                                        </TableCell>
                                    </TableRow>
                                ) : sortedFiltered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={tableColSpanVendas} className="text-center py-8 text-gray-500">
                                            Nenhuma venda encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedFiltered.map(venda => {
                                        const financeiro = venda.financeiro;

                                        return (
                                        <TableRow
                                            key={venda.id}
                                            className={`cursor-pointer hover:bg-muted/50 transition-colors ${selectedIdsSet.has(venda.id) ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                                            onClick={() => {
                                                setSelectedVendaDetalhes(venda);
                                                setIsDetalhesModalOpen(true);
                                            }}
                                        >
                                            {showBulkSelectionColumn && (
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedIdsSet.has(venda.id)}
                                                        onCheckedChange={(checked) => handleToggleSelectVenda(venda.id, checked === true)}
                                                        aria-label={`Selecionar venda ${venda.numero_pedido}`}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="font-medium">#{venda.numero_pedido}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white">{formatarNome(venda.cliente_nome)}</span>
                                                    <span className="text-xs text-gray-500">{formatarTelefone(venda.cliente_telefone)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell className="font-bold text-gray-900 dark:text-white">
                                                R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-[200px]">
                                                    {(venda.itens || []).slice(0, 2).map((item, idx) => (
                                                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                                            {item.quantidade}x {buildProductDisplayName(item.produto_nome || item.nome, item.modelo_referencia)}
                                                        </div>
                                                    ))}
                                                    {(venda.itens || []).length > 2 && (
                                                        <span className="text-[10px] text-gray-400">+{(venda.itens || []).length - 2} mais...</span>
                                                    )}
                                                </div>
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
                                            <TableCell>
                                                <StatusBadge status={financeiro.displayStatus} />
                                            </TableCell>

                                            <TableCell>
                                                <OrderStatusBadge
                                                    venda={venda}
                                                    entregas={entregas}
                                                    montagens={montagens}
                                                    financeiro={financeiro}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {/* Botão Emitir NFe */}
                                                    {financeiro.isPaid && can('manage_vendas') && (
                                                        venda.nfe_emitida ? (
                                                            <Badge className="bg-green-100 text-green-800 border-green-200">
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                NFe {venda.nfe_numero}
                                                            </Badge>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    abrirModalNfe(venda);
                                                                }}
                                                                title="Emitir NFe"
                                                            >
                                                                <Receipt className="w-4 h-4 text-green-600" />
                                                            </Button>
                                                        )
                                                    )}

                                                    {canManagePayments && financeiro.valorRestante > MONEY_EPSILON && !isVendaCancelada(venda) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                abrirModalPagamento(venda);
                                                            }}
                                                            title="Atualizar Pagamento"
                                                        >
                                                            <CreditCard className="w-4 h-4 text-emerald-600" />
                                                        </Button>
                                                    )}

                                                    <Button variant="ghost" size="icon" onClick={(e) => {
                                                        e.stopPropagation();
                                                        const clienteCompleto = clientes.find(c => c.id === venda.cliente_id) || { nome_completo: venda.cliente_nome, telefone: venda.cliente_telefone };

                                                        // Resolver nome do vendedor
                                                        let nomeVendedor = venda.responsavel_nome;
                                                        if (venda.responsavel_id) {
                                                            const u = users.find(user => user.id === venda.responsavel_id);
                                                            if (u && u.full_name) nomeVendedor = u.full_name;
                                                        }
                                                        const lojaInfoPdf1 = lojasAtivas.find(l => String(l.nome).trim().toLowerCase() === String(venda.loja || '').trim().toLowerCase()) || null;
                                                        abrirNotaPedidoPDF(venda, clienteCompleto, nomeVendedor || user?.full_name, lojaInfoPdf1);
                                                    }}>
                                                        <FileText className="w-4 h-4 text-blue-600" />
                                                    </Button>

                                                    {/* Botão de Cancelar */}
                                                    {canCancelVendas && !isVendaCancelada(venda) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCancelarVenda(venda);
                                                            }}
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
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
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

                                                    {canManageDeliveryStatus && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                abrirModalStatusEntrega(venda);
                                                            }}
                                                            title="Alterar Status da Entrega"
                                                        >
                                                            <Truck className="w-4 h-4 text-sky-600" />
                                                        </Button>
                                                    )}

                                                    {/* Botão de Liberar Entrega (Vendedor libera se estiver aguardando) */}
                                                    {(() => {
                                                        const entregaAguardando = (entregas || []).find(e =>
                                                            e.numero_pedido === venda.numero_pedido &&
                                                            e.status === 'Aguardando Liberação'
                                                        );

                                                        // Apenas o vendedor da venda ou admin pode liberar
                                                        const podeLiberar = user?.cargo === 'Administrador' || venda.responsavel_id === user?.id;

                                                        if (entregaAguardando && podeLiberar) {
                                                            return (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        setModalLiberarEntrega({
                                                                            entregaId: entregaAguardando.id,
                                                                            pedido: venda.numero_pedido
                                                                        });
                                                                    }}
                                                                    disabled={liberarEntregaMutation.isPending}
                                                                    title="Liberar para Entrega"
                                                                >
                                                                    <Unlock className="w-4 h-4 text-amber-600" />
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
                                                                        const prefs = entrega.preferencias_entrega || { dias: [0, 1, 2, 3, 4, 5, 6], turnos: ['Manhã', 'Tarde', 'Comercial'], obs: "" };
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
                                    )})
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* Aba Cancelados */}
                <TabsContent value="cancelados" className="space-y-4">
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
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                                <TableRow>
                                    {renderSortableHeader('Pedido', 'pedido', 'w-[100px]')}
                                    {renderSortableHeader('Cliente', 'cliente')}
                                    {renderSortableHeader('Data', 'data')}
                                    {renderSortableHeader('Total', 'total')}
                                    <TableHead>Produtos</TableHead>
                                    <TableHead>Loja</TableHead>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead>Situação</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Carregando...
                                        </TableCell>
                                    </TableRow>
                                ) : sortedFilteredCancelados.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                                            <XCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">Nenhuma venda cancelada encontrada.</p>
                                            <p className="text-sm mt-1">As vendas canceladas aparecerão aqui.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedFilteredCancelados.map(venda => (
                                        <TableRow
                                            key={venda.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors opacity-75"
                                            onClick={() => {
                                                setSelectedVendaDetalhes(venda);
                                                setIsDetalhesModalOpen(true);
                                            }}
                                        >
                                            <TableCell className="font-medium">#{venda.numero_pedido}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-white">{formatarNome(venda.cliente_nome)}</span>
                                                    <span className="text-xs text-gray-500">{formatarTelefone(venda.cliente_telefone)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell className="font-bold text-gray-900 dark:text-white">
                                                R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-[200px]">
                                                    {(venda.itens || []).slice(0, 2).map((item, idx) => (
                                                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                                            {item.quantidade}x {buildProductDisplayName(item.produto_nome || item.nome, item.modelo_referencia)}
                                                        </div>
                                                    ))}
                                                    {(venda.itens || []).length > 2 && (
                                                        <span className="text-[10px] text-gray-400">+{(venda.itens || []).length - 2} mais...</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-neutral-800">
                                                    {venda.loja}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    {(() => {
                                                        if (!venda.responsavel_id) return '-';
                                                        const responsavelId = String(venda.responsavel_id).toLowerCase();
                                                        const u = users.find(u =>
                                                            String(u.id).toLowerCase() === responsavelId ||
                                                            String(u.email).toLowerCase() === responsavelId
                                                        );
                                                        return u?.full_name || u?.email || '-';
                                                    })()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-red-100 text-red-800 border-red-200 border px-2 py-0.5 text-[10px] uppercase tracking-wider">
                                                    Cancelado
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={(e) => {
                                                        e.stopPropagation();
                                                        const clienteCompleto = clientes.find(c => c.id === venda.cliente_id) || { nome_completo: venda.cliente_nome, telefone: venda.cliente_telefone };
                                                        let nomeVendedor = venda.responsavel_nome;
                                                        if (venda.responsavel_id) {
                                                            const u = users.find(user => user.id === venda.responsavel_id);
                                                            if (u && u.full_name) nomeVendedor = u.full_name;
                                                        const lojaInfoPdf2 = lojasAtivas.find(l => String(l.nome).trim().toLowerCase() === String(venda.loja || '').trim().toLowerCase()) || null;
                                                        abrirNotaPedidoPDF(venda, clienteCompleto, nomeVendedor || user?.full_name, lojaInfoPdf2);
                                                    }}>
                                                        <FileText className="w-4 h-4 text-blue-600" />
                                                    </Button>
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

            <VendaDetalhesModal
                isOpen={isDetalhesModalOpen}
                onClose={() => setIsDetalhesModalOpen(false)}
                venda={selectedVendaDetalhes}
                entregas={entregas}
                montagens={montagens}
                lancamentos={lancamentos}
            />

            <Dialog open={!!modalPagamentoVenda} onOpenChange={(open) => !open && setModalPagamentoVenda(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700">
                            <CreditCard className="w-5 h-5" />
                            Atualizar Pagamento
                        </DialogTitle>
                        <DialogDescription>
                            Registre pagamento antecipado na loja para o pedido #{modalPagamentoVenda?.numero_pedido}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="rounded-lg border bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                            Saldo atual: <strong>R$ {saldoModalPagamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>

                        <div className="rounded-lg border p-3 space-y-3">
                            <div className="grid gap-3 sm:grid-cols-[1.4fr,1fr,auto] items-end">
                                <div className="space-y-2">
                                    <Label>Forma de pagamento</Label>
                                    <Select
                                        value={novoPagamentoItem.forma_pagamento}
                                        onValueChange={(value) => setNovoPagamentoItem((prev) => ({ ...prev, forma_pagamento: value, parcelas: 1 }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SALES_PAYMENT_OPTIONS.map((forma) => (
                                                <SelectItem key={forma} value={forma}>{forma}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Valor</Label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={novoPagamentoItem.valor}
                                        onChange={(e) => setNovoPagamentoItem((prev) => ({
                                            ...prev,
                                            valor: formatarValorMonetarioInput(e.target.value)
                                        }))}
                                        placeholder="0,00"
                                    />
                                </div>

                                <Button type="button" onClick={adicionarPagamentoAoModal}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Adicionar
                                </Button>
                            </div>

                            {isInstallmentPaymentMethod(novoPagamentoItem.forma_pagamento) && (
                                <div className="space-y-2">
                                    <Label>Parcelas</Label>
                                    <Select
                                        value={String(novoPagamentoItem.parcelas || 1)}
                                        onValueChange={(value) => setNovoPagamentoItem((prev) => ({ ...prev, parcelas: Number(value) }))}
                                    >
                                        <SelectTrigger className="sm:max-w-[180px]">
                                            <SelectValue placeholder="1x" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }).map((_, index) => (
                                                <SelectItem key={index + 1} value={String(index + 1)}>{index + 1}x</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-3">
                                <span>Total informado: <strong>R$ {totalPagamentoInformado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                <span>Restante no modal: <strong>R$ {saldoAposSplit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {pagamentoForm.pagamentos.length === 0 ? (
                                    <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground text-center">
                                        Nenhuma forma adicionada ainda.
                                    </div>
                                ) : pagamentoForm.pagamentos.map((pagamento, index) => (
                                    <div key={`${pagamento.forma_pagamento}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 gap-3">
                                        <div>
                                            <p className="text-sm font-medium">{pagamento.forma_pagamento}{pagamento.parcelas > 1 ? ` (${pagamento.parcelas}x)` : ''}</p>
                                            <p className="text-xs text-muted-foreground">R$ {toMoneyNumber(pagamento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => removerPagamentoDoModal(index)}>
                                            Remover
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Data do pagamento</Label>
                            <Input
                                type="date"
                                value={pagamentoForm.data_pagamento}
                                onChange={(e) => setPagamentoForm((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Observação</Label>
                            <Textarea
                                rows={3}
                                placeholder="Ex: Cliente antecipou pagamento na loja."
                                value={pagamentoForm.observacao}
                                onChange={(e) => setPagamentoForm((prev) => ({ ...prev, observacao: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalPagamentoVenda(null)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmarPagamentoAntecipado}
                            disabled={registrarPagamentoMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {registrarPagamentoMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirmar Pagamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

            <Dialog open={!!modalStatusEntregaVenda} onOpenChange={(open) => !open && setModalStatusEntregaVenda(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sky-700">
                            <Truck className="w-5 h-5" />
                            Atualizar Status da Entrega
                        </DialogTitle>
                        <DialogDescription>
                            Pedido #{modalStatusEntregaVenda?.venda?.numero_pedido}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Novo status</Label>
                            <Select
                                value={statusEntregaForm.status}
                                onValueChange={(value) => setStatusEntregaForm((prev) => ({ ...prev, status: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_ENTREGA_OPTIONS.map((status) => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                                rows={3}
                                placeholder="Ex: Cliente confirmou recebimento no local."
                                value={statusEntregaForm.observacoes}
                                onChange={(e) => setStatusEntregaForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalStatusEntregaVenda(null)}>Cancelar</Button>
                        <Button onClick={handleConfirmarStatusEntrega} className="bg-sky-600 hover:bg-sky-700">
                            Confirmar status
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
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => (
                                    <div key={idx} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`venda-dia-${idx}`}
                                            checked={preferenciasTemp.dias?.includes(idx)}
                                            onCheckedChange={(checked) => {
                                                setPreferenciasTemp(prev => ({
                                                    ...prev,
                                                    dias: checked
                                                        ? [...(prev.dias || []), idx]
                                                        : (prev.dias || []).filter(d => d !== idx)
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

            {/* Modal de Liberar Entrega */}
            <Dialog open={!!modalLiberarEntrega} onOpenChange={(open) => !open && setModalLiberarEntrega(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <Unlock className="w-5 h-5" />
                            Liberar Entrega para Logística
                        </DialogTitle>
                        <DialogDescription>
                            Você está liberando a entrega para a triagem da logística.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-gray-700 mb-4">
                            <strong>Pedido:</strong> #{modalLiberarEntrega?.pedido}
                        </p>
                        <p className="text-sm text-gray-600">
                            Após confirmar, o pedido voltará para a fila de triagem da logística e poderá ser agendado para entrega.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalLiberarEntrega(null)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmarLiberarEntrega}
                            disabled={liberarEntregaMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            {liberarEntregaMutation.isPending ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Liberando...</>
                            ) : (
                                <><Unlock className="w-4 h-4 mr-2" />Confirmar e Liberar</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkTransferVendedorOpen} onOpenChange={(open) => !isBulkRunning && setBulkTransferVendedorOpen(open)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Transferir vendedor em lote</DialogTitle>
                        <DialogDescription>
                            Defina o vendedor de destino para as {selectedVendaIds.length} venda(s) selecionada(s).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>Vendedor destino</Label>
                        <Select value={bulkVendedorId} onValueChange={setBulkVendedorId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o vendedor" />
                            </SelectTrigger>
                            <SelectContent>
                                {vendedoresDisponiveis.map((vendedor) => (
                                    <SelectItem key={vendedor.id} value={String(vendedor.id)}>
                                        {vendedor.full_name || vendedor.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkTransferVendedorOpen(false)} disabled={isBulkRunning}>Cancelar</Button>
                        <Button onClick={handleBulkTransferirVendedor} disabled={isBulkRunning || !bulkVendedorId}>
                            {isBulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkTransferLojaOpen} onOpenChange={(open) => !isBulkRunning && setBulkTransferLojaOpen(open)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Transferir loja em lote</DialogTitle>
                        <DialogDescription>
                            Defina a loja de destino para as {selectedVendaIds.length} venda(s) selecionada(s).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>Loja destino</Label>
                        <Select value={bulkLoja} onValueChange={setBulkLoja}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a loja" />
                            </SelectTrigger>
                            <SelectContent>
                                {lojasDisponiveis.map((loja) => (
                                    <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {lojasDisponiveis.length === 0 && (
                            <p className="text-xs text-gray-500">
                                Nenhuma loja de destino disponivel para seu contexto atual.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkTransferLojaOpen(false)} disabled={isBulkRunning}>Cancelar</Button>
                        <Button onClick={handleBulkTransferirLoja} disabled={isBulkRunning || !bulkLoja}>
                            {isBulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkPagamentoOpen} onOpenChange={(open) => !isBulkRunning && setBulkPagamentoOpen(open)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar pagamento em lote</DialogTitle>
                        <DialogDescription>
                            Será registrado o valor total pendente de cada venda selecionada.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Forma de pagamento</Label>
                            <Select
                                value={bulkPagamentoForm.forma_pagamento}
                                onValueChange={(value) => setBulkPagamentoForm((prev) => ({ ...prev, forma_pagamento: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="PIX">PIX</SelectItem>
                                    <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                                    <SelectItem value="Boleto">Boleto</SelectItem>
                                    <SelectItem value="Transferência">Transferência</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Data do pagamento</Label>
                            <Input
                                type="date"
                                value={bulkPagamentoForm.data_pagamento}
                                onChange={(e) => setBulkPagamentoForm((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Observação</Label>
                            <Textarea
                                rows={3}
                                placeholder="Ex: Pagamento registrado em lote na loja."
                                value={bulkPagamentoForm.observacao}
                                onChange={(e) => setBulkPagamentoForm((prev) => ({ ...prev, observacao: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkPagamentoOpen(false)} disabled={isBulkRunning}>Cancelar</Button>
                        <Button onClick={handleBulkRegistrarPagamento} disabled={isBulkRunning} className="bg-emerald-600 hover:bg-emerald-700">
                            {isBulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirmar pagamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkStatusEntregaOpen} onOpenChange={(open) => !isBulkRunning && setBulkStatusEntregaOpen(open)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Alterar status de entrega em lote</DialogTitle>
                        <DialogDescription>
                            Atualize o status das entregas vinculadas às {selectedVendaIds.length} venda(s) selecionada(s).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Novo status</Label>
                            <Select
                                value={bulkStatusEntregaForm.status}
                                onValueChange={(value) => setBulkStatusEntregaForm((prev) => ({ ...prev, status: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_ENTREGA_OPTIONS.map((status) => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea
                                rows={3}
                                placeholder="Ex: Atualização operacional em lote."
                                value={bulkStatusEntregaForm.observacoes}
                                onChange={(e) => setBulkStatusEntregaForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkStatusEntregaOpen(false)} disabled={isBulkRunning}>Cancelar</Button>
                        <Button onClick={handleBulkAtualizarStatusEntrega} disabled={isBulkRunning} className="bg-sky-600 hover:bg-sky-700">
                            {isBulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirmar status
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
function OrderStatusBadge({ venda, entregas, montagens, financeiro }) {
    // Se a venda foi cancelada, mostrar isso
    if (isVendaCancelada(venda)) {
        return (
            <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1 w-fit">
                <XCircle className="w-3 h-3" />
                Cancelado
            </Badge>
        );
    }

    const badges = [];
    const isStatusFinalizado = (status) => {
        const normalized = String(status || '').toLowerCase();
        return normalized === 'entregue' || normalized === 'retirado' || normalized === 'concluida' || normalized === 'concluída';
    };

    const pushBadge = (key, className, Icon, label) => {
        badges.push(
            <Badge key={key} className={`${className} gap-1 w-fit whitespace-nowrap`}>
                <Icon className="w-3 h-3" />
                {label}
            </Badge>
        );
    };

    // 0. Pre-calculating delivery info to avoid conflicting statuses
    const resumoLogistico = getVendaResumoLogistico(venda, { entregas, montagens });
    const entregasVenda = entregas.filter(e => e.numero_pedido === venda.numero_pedido);
    const temDataEntrega = entregasVenda.some(e => e.data_agendada);
    const triagemPendente = !venda.triagem_realizada && !temDataEntrega;
    const pagamentoPendente = financeiro?.isPending;

    // 1. Verificação de Triagem
    if (triagemPendente) {
        pushBadge('triagem', 'bg-orange-100 text-orange-700 border border-orange-200', ClipboardList, 'Pendente Triagem');
    }

    // 2. Verificação de Entrega
    // Se a triagem ainda não foi realizada e não existe data, não mostramos status de entrega/montagem.
    if (!triagemPendente) {
        // Se não tem entregas criadas
        if (entregasVenda.length === 0) {
            // Verificar se todos os itens são do tipo 'retira' (Cliente Retira)
            const todosRetira = resumoLogistico.allRetirada;

            if (resumoLogistico.isMisto) {
                pushBadge('misto', 'bg-indigo-100 text-indigo-700 border border-indigo-200', Package, 'Pedido Misto');
            }

            if (todosRetira && venda.itens?.length > 0) {
                pushBadge('retira', 'bg-purple-100 text-purple-700 border border-purple-200', UserCheck, 'Cliente Retira');
            } else if (venda.triagem_realizada && !pagamentoPendente) {
                // SÓ mostra Aguardando Expedição se a triagem já foi feita e o pagamento não está pendente.
                pushBadge('processando', 'bg-yellow-100 text-yellow-700 border border-yellow-200', Package, 'Aguardando Expedição');
            }
        } else {
            // Tem entregas
            const entrega = resumoLogistico.entregaPrincipal || entregasVenda[0];
            const dataEntrega = entrega.data_agendada ? new Date(entrega.data_agendada).toLocaleDateString('pt-BR') : null;

            const todosRetira = resumoLogistico.allRetirada;

            if (resumoLogistico.isMisto) {
                pushBadge('misto', 'bg-indigo-100 text-indigo-700 border border-indigo-200', Package, 'Pedido Misto');
            }

            if (todosRetira) {
                if (isStatusFinalizado(entrega.status)) {
                    pushBadge('retirado', 'bg-green-100 text-green-700 border border-green-200', CheckCircle, 'Concluido');
                } else {
                    pushBadge('retirada_pendente', 'bg-purple-100 text-purple-700 border border-purple-200', UserCheck, 'Aguardando Retirada');
                }
            } else {
                // Entrega Comum
                if (isStatusFinalizado(entrega.status)) {
                    pushBadge('entregue', 'bg-green-100 text-green-700 border border-green-200', CheckCircle, 'Entregue');
                } else if (entrega.status === 'Em Rota') {
                    pushBadge('em_rota', 'bg-blue-100 text-blue-700 border border-blue-200', Truck, 'Em Rota');
                } else {
                    const hojeIso = new Date().toLocaleDateString('en-CA');
                    const dataEntregaIso = entrega.data_agendada ? entrega.data_agendada.split('T')[0] : null;
                    const isAtrasada = dataEntregaIso && dataEntregaIso < hojeIso;

                    if (isAtrasada) {
                        pushBadge('ent_atrasada', 'bg-red-100 text-red-700 border border-red-200', AlertTriangle, `Atrasada: ${dataEntrega}`);
                    } else {
                        pushBadge('ent_pendente', 'bg-amber-100 text-amber-700 border border-amber-200', Truck, `Entrega: ${dataEntrega || 'A Agendar'}`);
                    }
                }
            }
        }
    }

    // 3. Verificação de Montagem
    const temMontagem = resumoLogistico.contagens.montagemInterna > 0 || resumoLogistico.contagens.montagemExterna > 0;

    if (temMontagem && !triagemPendente && !pagamentoPendente) {
        const montagensVenda = montagens.filter(m => m.numero_pedido === venda.numero_pedido);
        const todasConcluidas = montagensVenda.length > 0 && montagensVenda.every(m => m.status === 'concluida');

        if (todasConcluidas) {
            pushBadge('montado', 'bg-green-100 text-green-700 border border-green-200', Wrench, 'Montado');
        } else {
            // Se tem itens de montagem criados ou se a venda requer montagem
            pushBadge('mont_pendente', 'bg-amber-100 text-amber-700 border border-amber-200', Wrench, 'Montagem Pendente');
        }
    }

    return (
        <div className="flex flex-col gap-1 items-start">
            {badges}
        </div>
    );
}