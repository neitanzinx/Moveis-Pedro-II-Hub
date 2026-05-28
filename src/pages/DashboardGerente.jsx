import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import SolicitacoesCadastroWidget from "@/components/dashboard/SolicitacoesCadastroWidget";
import ControleMontadoresWidget from "@/components/dashboard/ControleMontadoresWidget";
import ProdutoCadastroCompleto from "@/components/produtos/ProdutoCadastroCompleto";
import AcoesVendedoresWidget from "@/components/dashboard/AcoesVendedoresWidget";
import { toast } from "sonner";
import { formatarMoeda } from "@/utils/formatters";
import { isVendaCancelada } from "@/utils/vendaStatus";
import {
    DollarSign,
    ShoppingCart,
    TrendingUp,
    TrendingDown,
    Target,
    Calendar,
    Truck,
    Wrench,
    CreditCard,
    ClipboardList,
    RefreshCw,
    Award,
    AlertTriangle,
    Store,
    Users,
    Settings,
    Plus,
    Edit2,
    Loader2,
    Key,
    Copy,
    Ban,
    Clock,
    Check,
    Package,
    BarChart3,
    Box,
    AlertCircle,
    Layers,
    ArrowUpRight,
    ArrowDownRight,
    Percent,
    Search,
    Eye,
    FileText,
    Filter
} from "lucide-react";
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';

// Sub-componente para linha de margem negociável por loja
function MargemLojaRow({ loja, salvando, onSave }) {
    const [valor, setValor] = useState(loja.margem_negociavel ?? 0);
    const valorSalvo = loja.margem_negociavel ?? 0;
    const alterado = parseFloat(valor) !== parseFloat(valorSalvo);

    return (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-800 rounded-lg border border-green-100 dark:border-green-900/40">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">{loja.nome}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                    {parseFloat(valorSalvo) === 0
                        ? 'Desconto livre desabilitado'
                        : `Desconto livre de até ${valorSalvo}%`}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative w-28">
                    <Input
                        type="number"
                        value={valor}
                        onChange={e => {
                            let v = parseFloat(e.target.value);
                            if (isNaN(v) || v < 0) v = 0;
                            if (v > 100) v = 100;
                            setValor(v);
                        }}
                        className="h-9 text-sm pr-7"
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="0"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                </div>
                <Button
                    size="sm"
                    className="h-9 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onSave(parseFloat(valor) || 0)}
                    disabled={salvando || !alterado}
                >
                    {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </Button>
            </div>
        </div>
    );
}

export default function DashboardGerente() {
    const { user, isGerente, filterData } = useAuth();
    const queryClient = useQueryClient();
    const [periodo, setPeriodo] = useState('mes');
    const [lojaFiltro, setLojaFiltro] = useState('');
    const [metaModalOpen, setMetaModalOpen] = useState(false);
    const [editingMeta, setEditingMeta] = useState(null);
    const [novaMetaValor, setNovaMetaValor] = useState('');
    const [metaVendedorSelecionado, setMetaVendedorSelecionado] = useState(null);
    const [periodoGrafico, setPeriodoGrafico] = useState('mes'); // 5, 7, 14, 30, 60, 2y

    // Estados para tokens gerenciais (v2 - simplificado)
    const [tokenModalOpen, setTokenModalOpen] = useState(false);
    const [mostrarExpirados, setMostrarExpirados] = useState(false);
    const [novoToken, setNovoToken] = useState({
        tipoToken: 'SINGLE_USE', // 'SINGLE_USE' ou 'SUPERVISOR_MODE'
        permissao: 'DESCONTO', // 'DESCONTO', 'CANCELAMENTO', 'ALTERACAO_PRECO', 'SUPER_CAIXA'
        valorLimite: 20, // % ou R$
        validadeMinutos: 15,
        maxUsos: 1
    });
    const [tokenGerado, setTokenGerado] = useState(null); // Código gerado para exibição
    const [copiado, setCopiado] = useState(null);
    const [tokenHistoricoOpen, setTokenHistoricoOpen] = useState(false);

    // States for Price Approval Modal
    const [priceModalOpen, setPriceModalOpen] = useState(false);
    const [selectedPriceRequest, setSelectedPriceRequest] = useState(null);
    const [newPrice, setNewPrice] = useState('');

    // Estado para margem negociável por loja
    const [margemSalvando, setMargemSalvando] = useState({});

    // Estados para dashboard tabs e pesquisa
    const [abaDashboard, setAbaDashboard] = useState('visao-geral');
    const [tipoComparativo, setTipoComparativo] = useState('mes'); // 'mes' ou 'ano'
    const [vendedorChartMode, setVendedorChartMode] = useState({}); // { nomeVendedor: 'evolucao' | 'comparativo' }
    const [buscaPedido, setBuscaPedido] = useState('');
    const [buscaEntrega, setBuscaEntrega] = useState('');
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

    // Estados para detalhes do produto (Curva ABC)
    const [produtoModalOpen, setProdutoModalOpen] = useState(false);
    const [produtoDetalhe, setProdutoDetalhe] = useState(null);

    // Estado para modal de pendências
    const [pendenciasModalOpen, setPendenciasModalOpen] = useState(false);


    // Estados para Giro de Estoque
    const [giroFiltro, setGiroFiltro] = useState(60); // dias sem venda

    // Determinar se pode ver todas as lojas
    const isGerenteGeral = user?.cargo === 'Gerente Geral' || user?.cargo === 'Administrador';

    // Queries
    const { data: users = [] } = useQuery({
        queryKey: ['users-gerente'],
        queryFn: () => base44.entities.User.list(),
        enabled: !!user
    });

    const { data: lojasData = [] } = useQuery({
        queryKey: ['lojas-ativas'],
        queryFn: () => base44.entities.Loja.list('nome'),
        enabled: !!user
    });

    // Lojas que o gerente pode gerenciar
    const lojasGerenciadas = isGerenteGeral
        ? lojasData
        : lojasData.filter(l => l.nome === user?.loja || l.id === user?.loja_id);

    const { data: vendas = [], isLoading: loadingVendas, refetch: refetchVendas } = useQuery({
        queryKey: ['vendas-gerente'],
        queryFn: () => base44.entities.Venda.list('-data_venda'),
        enabled: !!user
    });

    // Assinatura em tempo real para Vendas
    React.useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('dashboard-gerente-vendas')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'vendas' },
                () => {
                    refetchVendas();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, refetchVendas]);

    const { data: entregas = [], isLoading: loadingEntregas } = useQuery({
        queryKey: ['entregas-gerente'],
        queryFn: () => base44.entities.Entrega.list('-data_agendada'),
        enabled: !!user
    });

    const { data: montagens = [], isLoading: loadingMontagens } = useQuery({
        queryKey: ['montagens-gerente'],
        queryFn: () => base44.entities.Montagem.list(),
        enabled: !!user
    });

    const { data: metas = [] } = useQuery({
        queryKey: ['metas-vendas'],
        queryFn: () => base44.entities.MetaVenda.list(),
        enabled: !!user
    });

    // Query para produtos (Curva ABC e Giro de Estoque)
    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos-gerente'],
        queryFn: () => base44.entities.Produto.list(),
        enabled: !!user
    });

    // Query para tokens gerenciais
    const { data: tokens = [], refetch: refetchTokens } = useQuery({
        queryKey: ['tokens-gerenciais'],
        queryFn: () => base44.entities.TokenGerencial.list('-created_at'),
        enabled: !!user
    });

    const { data: assistencias = [] } = useQuery({
        queryKey: ['assistencias-gerente'],
        queryFn: () => base44.entities.AssistenciaTecnica.list(),
        enabled: !!user
    });

    // Query para solicitações de preço (novo)
    const { data: solicitacoesPreco = [], refetch: refetchSolicitacoesPreco } = useQuery({
        queryKey: ['solicitacoes-preco-gerente'],
        queryFn: () => base44.entities.SolicitacaoPreco.list('-data_solicitacao'),
        enabled: !!user
    });

    const { data: fechamentosComissao = [] } = useQuery({
        queryKey: ['comissoes-fechamento-dashboard'],
        queryFn: () => base44.entities.ComissaoFechamentoMensal.list('-created_at'),
        enabled: !!user
    });

    // Assinatura em tempo real para Solicitações de Preço
    React.useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('dashboard-gerente-solicitacoes-preco')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'solicitacoes_preco' },
                () => {
                    refetchSolicitacoesPreco();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, refetchSolicitacoesPreco]);

    // Mutation para salvar metas
    const saveMeta = useMutation({
        mutationFn: async (meta) => {
            const { id, ...dataWithoutId } = meta;
            if (id) {
                return base44.entities.MetaVenda.update(id, dataWithoutId);
            }
            return base44.entities.MetaVenda.create(dataWithoutId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['metas-vendas']);
            setMetaModalOpen(false);
            setEditingMeta(null);
            setNovaMetaValor('');
            setMetaVendedorSelecionado(null);
        }
    });

    // Mutation para criar token
    // Mutation para criar token (v2 - mantém para compatibilidade, mas usamos handleCriarToken direto)
    const criarToken = useMutation({
        mutationFn: async (token) => {
            return base44.entities.TokenGerencial.create(token);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['tokens-gerenciais']);
            setTokenModalOpen(false);
            setNovoToken({
                tipoToken: 'SINGLE_USE',
                permissao: 'DESCONTO',
                valorLimite: 20,
                validadeMinutos: 15,
                maxUsos: 1
            });
        }
    });

    // Mutation para revogar token
    const revogarToken = useMutation({
        mutationFn: async (tokenId) => {
            return base44.entities.TokenGerencial.update(tokenId, { ativo: false });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['tokens-gerenciais']);
        }
    });

    // Gerar código numérico de 6 dígitos (100000-999999)
    const gerarCodigoToken = () => {
        return String(Math.floor(100000 + Math.random() * 900000));
    };

    // Copiar código do token
    const copiarCodigo = async (codigo) => {
        await navigator.clipboard.writeText(codigo);
        setCopiado(codigo);
        setTimeout(() => setCopiado(null), 2000);
    };

    // Lojas disponíveis (do usuário ou todas) - MUST be before lojaAtiva
    const lojas = useMemo(() => {
        if (!vendas.length) return [];
        const unique = [...new Set(vendas.map(v => v.loja).filter(Boolean))];
        return unique;
    }, [vendas]);

    // Se usuário é gerente de loja, definir loja automaticamente - MUST be before code that uses it
    const lojaAtiva = useMemo(() => {
        if (isGerenteGeral) {
            return lojaFiltro || 'todas';
        }
        return user?.loja || lojas[0] || '';
    }, [isGerenteGeral, lojaFiltro, user?.loja, lojas]);

    const getSolicitacoesPrecoPendentes = useMemo(() => {
        return solicitacoesPreco.filter(s => {
            const isPendente = s.status === 'pendente';
            const daLojaAtiva = lojaAtiva === 'todas' || s.loja === lojaAtiva;
            return isPendente && daLojaAtiva;
        });
    }, [solicitacoesPreco, lojaAtiva]);

    // Criar novo token (v2 - simplificado)
    const handleCriarToken = async () => {
        const codigo = gerarCodigoToken();
        const lojaDestino = lojaAtiva === 'todas' ? (lojas[0] || 'Centro') : lojaAtiva;
        const expiraEm = new Date(Date.now() + novoToken.validadeMinutos * 60 * 1000).toISOString();

        try {
            const tokenCriado = await base44.entities.TokenGerencial.create({
                codigo,
                gerente_id: user.id,
                gerente_nome: user.full_name,
                loja: lojaDestino,
                tipo_token: novoToken.tipoToken,
                permissao: novoToken.permissao,
                valor_limite: novoToken.tipoToken === 'SUPER_CAIXA' ? null : novoToken.valorLimite,
                validade_minutos: novoToken.validadeMinutos,
                max_usos: novoToken.maxUsos,
                usos_realizados: 0,
                ativo: true,
                expira_em: expiraEm
            });
            setTokenGerado(tokenCriado);
            refetchTokens();
            toast.success('Token gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao criar token:', error);
            toast.error('Erro ao criar token');
        }
    };

    // Mutation para responder solicitação de preço
    const responderSolicitacaoPreco = useMutation({
        mutationFn: async ({ id, status, precoValido, produtoId }) => {
            const promessas = [
                base44.entities.SolicitacaoPreco.update(id, {
                    status,
                    gerente_id: user.id,
                    data_resposta: new Date().toISOString()
                })
            ];

            // Atualiza automaticamente o preço de venda master do produto
            if (precoValido !== undefined && produtoId) {
                promessas.push(
                    supabase
                        .from('produtos')
                        .update({ preco_venda: precoValido, updated_at: new Date().toISOString() })
                        .eq('id', produtoId)
                );
                // Invalidate future products list 
                queryClient.invalidateQueries(['produtos']);
            }

            return Promise.all(promessas);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries(['solicitacoes-preco-gerente']);
            const acao = variables.status === 'aprovado' ? 'aprovada' : 'rejeitada';
            toast.success(`Solicitação de preço ${acao}!`);
        },
        onError: (err) => {
            console.error('Erro ao responder solicitação:', err);
            toast.error('Erro ao processar a solicitação de preço.');
        }
    });

    // Tokens filtrados por loja
    const tokensFiltrados = useMemo(() => {
        return tokens.filter(t => {
            if (lojaAtiva === 'todas') return true;
            return t.loja === lojaAtiva;
        });
    }, [tokens, lojaAtiva]);

    const tokensAtivos = tokensFiltrados.filter(t => {
        if (!t.ativo) return false;
        if (t.expira_em && new Date(t.expira_em) < new Date()) return false;
        if (t.max_usos && t.usos_realizados >= t.max_usos) return false;
        return true;
    });

    const tokensExibidos = useMemo(() => {
        return tokensFiltrados.filter(t => {
            const expirado = t.expira_em && new Date(t.expira_em) < new Date();
            if (mostrarExpirados) return true;
            return !expirado;
        });
    }, [tokensFiltrados, mostrarExpirados]);

    // lojaAtiva moved earlier in the file (before handleCriarToken and tokensFiltrados)

    // Filtrar vendas por período e loja
    const vendasFiltradas = useMemo(() => {
        const hojeIso = new Date().toLocaleDateString('en-CA');
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return vendas.filter(v => {
            // Filtro de status
            if (isVendaCancelada(v)) return false;

            // Filtro de loja
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;

            // Filtro de período
            if (!v.data_venda) return false;
            const dataVendaStr = v.data_venda.split('T')[0];
            const d = new Date(v.data_venda);
            d.setHours(0, 0, 0, 0);

            switch (periodo) {
                case 'hoje':
                    return dataVendaStr === hojeIso;
                case 'semana': {
                    const inicioSemana = new Date(hoje);
                    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
                    return d >= inicioSemana;
                }
                case 'mes':
                    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
                default:
                    return true;
            }
        });
    }, [vendas, periodo, lojaAtiva]);

    // Vendas de hoje específicas
    const vendasHoje = useMemo(() => {
        const hojeIso = new Date().toLocaleDateString('en-CA');

        return vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const dataVendaStr = v.data_venda.split('T')[0];
            return dataVendaStr === hojeIso;
        });
    }, [vendas, lojaAtiva]);

    // Vendas deste mês
    const vendasMes = useMemo(() => {
        const hoje = new Date();
        return vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        });
    }, [vendas, lojaAtiva]);

    // KPIs principais
    const kpis = useMemo(() => {
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

        // Helper para cálculo líquido (centralizado)
        const calcularTotalLiquido = (vendasArr) => {
            return vendasArr.reduce((sum, v) => {
                const assistencia = assistencias.find(a =>
                    a.numero_pedido === v.numero_pedido &&
                    a.status === 'Concluída' &&
                    (a.tipo === 'Devolução' || a.tipo === 'Troca')
                );
                return sum + (v.valor_total || 0) - (assistencia?.valor_devolvido || 0);
            }, 0);
        };

        const totalHoje = calcularTotalLiquido(vendasHoje);
        const qtdHoje = vendasHoje.length;

        const totalMes = calcularTotalLiquido(vendasMes);
        const qtdMes = vendasMes.length;
        const ticketMedio = qtdMes > 0 ? totalMes / qtdMes : 0;

        // Meta do mês
        const metaLoja = metas.find(m =>
            m.mes === mesAtual &&
            m.loja === lojaAtiva &&
            !m.vendedor_id
        );
        const metaValor = metaLoja?.meta_valor || 0;
        const progressoMeta = metaValor > 0 ? (totalMes / metaValor) * 100 : 0;

        // Dias restantes no mês
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        const diasRestantes = ultimoDia.getDate() - hoje.getDate();

        // Comparativo com mesmo dia da semana anterior
        const semanaPassada = new Date(hoje);
        semanaPassada.setDate(hoje.getDate() - 7);
        semanaPassada.setHours(0, 0, 0, 0);

        const vendasSemanaPassada = vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === semanaPassada.getTime();
        });
        const totalSemanaPassada = vendasSemanaPassada.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        const variacaoHoje = totalSemanaPassada > 0
            ? ((totalHoje - totalSemanaPassada) / totalSemanaPassada) * 100
            : 0;

        return {
            totalHoje,
            qtdHoje,
            totalMes,
            qtdMes,
            ticketMedio,
            metaValor,
            progressoMeta,
            diasRestantes,
            variacaoHoje
        };
    }, [vendasHoje, vendasMes, vendas, metas, lojaAtiva]);

    // Comparativo YoY (Year over Year)
    const comparativoYoY = useMemo(() => {
        const hoje = new Date();
        const mesAnoPassado = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1);
        const fimMesAnoPassado = new Date(hoje.getFullYear() - 1, hoje.getMonth() + 1, 0);

        const vendasAnoPassado = vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            return d >= mesAnoPassado && d <= fimMesAnoPassado;
        });

        // Usar a mesma lógica de cálculo líquido para consistência
        const calcularTotalLiquido = (vendasArr) => {
            return vendasArr.reduce((sum, v) => {
                const assistencia = assistencias.find(a =>
                    a.numero_pedido === v.numero_pedido &&
                    a.status === 'Concluída' &&
                    (a.tipo === 'Devolução' || a.tipo === 'Troca')
                );
                return sum + (v.valor_total || 0) - (assistencia?.valor_devolvido || 0);
            }, 0);
        };

        const totalAnoPassado = calcularTotalLiquido(vendasAnoPassado);
        const variacao = totalAnoPassado > 0
            ? ((kpis.totalMes - totalAnoPassado) / totalAnoPassado) * 100
            : 0;

        const nomeMesAnoPassado = mesAnoPassado.toLocaleDateString('pt-BR', { month: 'short' });
        const labelStr = `${nomeMesAnoPassado.charAt(0).toUpperCase() + nomeMesAnoPassado.slice(1)}/${hoje.getFullYear() - 1}`;

        return { totalAnoPassado, variacao, label: labelStr };
    }, [vendas, lojaAtiva, kpis.totalMes, assistencias]);

    // Comparativo MoM (Month over Month)
    const comparativoMoM = useMemo(() => {
        const hoje = new Date();
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

        const vendasMesAnterior = vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            return d >= mesAnterior && d <= fimMesAnterior;
        });

        const calcularTotalLiquido = (vendasArr) => {
            return vendasArr.reduce((sum, v) => {
                const assistencia = assistencias.find(a =>
                    a.numero_pedido === v.numero_pedido &&
                    a.status === 'Concluída' &&
                    (a.tipo === 'Devolução' || a.tipo === 'Troca')
                );
                return sum + (v.valor_total || 0) - (assistencia?.valor_devolvido || 0);
            }, 0);
        };

        const totalMesAnterior = calcularTotalLiquido(vendasMesAnterior);
        const variacao = totalMesAnterior > 0
            ? ((kpis.totalMes - totalMesAnterior) / totalMesAnterior) * 100
            : 0;

        return { totalMesAnterior, variacao };
    }, [vendas, lojaAtiva, kpis.totalMes, assistencias]);

    // Comissões a pagar por vendedor
    const comissoesPorVendedor = useMemo(() => {
        const agrupado = {};

        vendasMes.forEach(v => {
            const vendedorId = v.responsavel_id;
            let vendedorNome = v.responsavel_nome || v.vendedor_nome || 'Não informado';

            // Tentar resolver nome pelo ID se possível
            if (vendedorId) {
                const userEncontrado = users.find(u => u.id === vendedorId);
                if (userEncontrado && userEncontrado.full_name) {
                    vendedorNome = userEncontrado.full_name;
                }
            }

            if (!agrupado[vendedorNome]) {
                agrupado[vendedorNome] = { nome: vendedorNome, id: vendedorId, comissao: 0, vendas: 0, total: 0 };
            }

            // Ajuste de comissão por devolução
            const assistencia = assistencias.find(a =>
                a.numero_pedido === v.numero_pedido &&
                a.status === 'Concluída' &&
                (a.tipo === 'Devolução' || a.tipo === 'Troca')
            );

            const valorTotalAjustado = (v.valor_total || 0) - (assistencia?.valor_devolvido || 0);
            const taxaComissao = (v.comissao_calculada || 0) / (v.valor_total || 1);

            agrupado[vendedorNome].comissao += valorTotalAjustado * taxaComissao;
            agrupado[vendedorNome].vendas += 1;
            agrupado[vendedorNome].total += valorTotalAjustado;
        });


        return Object.values(agrupado)
            .filter(v => v.comissao > 0)
            .sort((a, b) => b.comissao - a.comissao);
    }, [vendasMes]);

    const totalComissoes = comissoesPorVendedor.reduce((sum, v) => sum + v.comissao, 0);

    const comissoesPendentesFechamento = useMemo(() => {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

        const fechamentosPendentes = (fechamentosComissao || []).filter((item) => {
            const inicio = (item.periodo_inicio || '').slice(0, 10);
            const fim = (item.periodo_fim || '').slice(0, 10);
            const statusPendente = item.status !== 'Pago';
            const periodoAtual = inicio === inicioMes && fim === fimMes;
            const lojaMatch = lojaAtiva === 'todas' || item.loja === lojaAtiva;
            return statusPendente && periodoAtual && lojaMatch;
        });

        return fechamentosPendentes
            .map((item) => {
                const userEncontrado = users.find((u) => u.id === item.vendedor_id);
                return {
                    id: item.vendedor_id || item.id,
                    nome: userEncontrado?.full_name || 'Vendedor',
                    vendas: item.quantidade_vendas || 0,
                    comissao: Number(item.total_final || item.total_comissao || 0),
                    status: item.status || 'Pendente'
                };
            })
            .sort((a, b) => b.comissao - a.comissao);
    }, [fechamentosComissao, lojaAtiva, users]);

    const totalComissoesPendentes = comissoesPendentesFechamento.reduce((sum, v) => sum + v.comissao, 0);
    const comissoesCardLista = comissoesPendentesFechamento.length > 0 ? comissoesPendentesFechamento : comissoesPorVendedor;
    const totalComissoesCard = comissoesPendentesFechamento.length > 0 ? totalComissoesPendentes : totalComissoes;

    // Curva ABC de produtos
    const curvaABC = useMemo(() => {
        const produtosVendidos = {};

        vendasMes.forEach(v => {
            if (v.itens && Array.isArray(v.itens)) {
                v.itens.forEach(item => {
                    const prodId = item.produto_id || item.id;
                    // Buscar nome do produto na lista de produtos quando item.nome está vazio
                    const produtoInfo = produtos.find(p => p.id === prodId);
                    const nomeProduto = item.produto_nome || item.nome || produtoInfo?.nome || `Produto #${prodId}`;

                    if (!produtosVendidos[prodId]) {
                        produtosVendidos[prodId] = { id: prodId, nome: nomeProduto, valor: 0, qtd: 0, produtoInfo };
                    }
                    produtosVendidos[prodId].valor += (item.preco_unitario || item.preco_venda || 0) * (item.quantidade || 1);
                    produtosVendidos[prodId].qtd += item.quantidade || 1;
                });
            }
        });

        const ordenado = Object.values(produtosVendidos).sort((a, b) => b.valor - a.valor);
        const totalVendas = ordenado.reduce((sum, p) => sum + p.valor, 0);

        let acumulado = 0;
        const classificados = ordenado.map(p => {
            acumulado += p.valor;
            const percentual = totalVendas > 0 ? (acumulado / totalVendas) * 100 : 0;
            return {
                ...p,
                classificacao: percentual <= 80 ? 'A' : percentual <= 95 ? 'B' : 'C'
            };
        });

        return {
            produtos: classificados.slice(0, 10),
            resumo: {
                A: classificados.filter(p => p.classificacao === 'A').length,
                B: classificados.filter(p => p.classificacao === 'B').length,
                C: classificados.filter(p => p.classificacao === 'C').length
            }
        };
    }, [vendasMes, produtos]);

    // Giro de estoque e produtos encalhados
    const giroEstoque = useMemo(() => {
        const hoje = new Date();
        const produtosComVendas = {};
        const vendasPorProduto = {};

        // Mapear última venda e total de vendas de cada produto
        vendas.forEach(v => {
            if (isVendaCancelada(v)) return;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return;
            if (v.itens && Array.isArray(v.itens)) {
                v.itens.forEach(item => {
                    const prodId = item.produto_id || item.id;
                    const dataVenda = new Date(v.data_venda);
                    if (!produtosComVendas[prodId] || dataVenda > produtosComVendas[prodId]) {
                        produtosComVendas[prodId] = dataVenda;
                    }
                    // Contar vendas por produto
                    vendasPorProduto[prodId] = (vendasPorProduto[prodId] || 0) + (item.quantidade || 1);
                });
            }
        });

        // Produtos encalhados (usando giroFiltro dinâmico)
        const encalhados = produtos
            .filter(p => {
                if (!p.ativo) return false;
                if (lojaAtiva !== 'todas' && p.loja && p.loja !== lojaAtiva) return false;
                if ((p.quantidade_estoque || 0) <= 0) return false;

                const ultimaVenda = produtosComVendas[p.id];
                if (!ultimaVenda) return true; // Nunca vendido

                const diasSemVenda = Math.floor((hoje - ultimaVenda) / (1000 * 60 * 60 * 24));
                return diasSemVenda > giroFiltro;
            })
            .map(p => {
                const ultimaVenda = produtosComVendas[p.id];
                const diasSemVenda = ultimaVenda
                    ? Math.floor((hoje - ultimaVenda) / (1000 * 60 * 60 * 24))
                    : 999; // Nunca vendido

                // Calcular valor em estoque (apenas preço de venda para segurança)
                const valorEstoque = (p.quantidade_estoque || 0) * (p.preco_venda || 0);

                // Buscar classificação ABC
                const abcProduto = curvaABC.produtos.find(abc => abc.id === p.id);

                return {
                    ...p,
                    diasSemVenda,
                    valorEstoque,
                    classificacaoABC: abcProduto?.classificacao || 'C',
                    qtdVendas: vendasPorProduto[p.id] || 0
                };
            })
            .sort((a, b) => b.valorEstoque - a.valorEstoque); // Ordenar por valor em estoque

        // Calcular métricas gerais
        const totalValorEncalhado = encalhados.reduce((sum, p) => sum + (p.valorEstoque || 0), 0);
        const produtosC = encalhados.filter(p => p.classificacaoABC === 'C');

        return {
            encalhados: encalhados.slice(0, 10),
            totalEncalhados: encalhados.length,
            totalValorEncalhado,
            produtosCriticos: produtosC.length // Produtos C encalhados (alta prioridade)
        };
    }, [vendas, produtos, lojaAtiva, giroFiltro, curvaABC.produtos]);

    // Status de entregas
    const statusEntregas = useMemo(() => {
        const hojeIso = new Date().toLocaleDateString('en-CA');

        const entregasFiltradas = entregas.filter(e => {
            if (lojaAtiva === 'todas') return true;
            const vendaAssociada = vendas.find(v => v.id === e.venda_id);
            return vendaAssociada?.loja === lojaAtiva;
        });

        const pendentes = entregasFiltradas.filter(e => e.status === 'Pendente' || e.status === 'Agendada');
        const emRota = entregasFiltradas.filter(e => e.status === 'Em Rota' || e.status === 'Em Transito');
        const atrasadas = entregasFiltradas.filter(e => {
            if (e.status === 'Entregue' || isVendaCancelada(e?.status)) return false;
            if (!e.data_agendada) return false;

            // Comparação segura de strings YYYY-MM-DD
            const dataAgendadaStr = e.data_agendada.split('T')[0];
            return dataAgendadaStr < hojeIso;
        });

        return { pendentes, emRota, atrasadas };
    }, [entregas, vendas, lojaAtiva]);

    // Pendências
    const pendencias = useMemo(() => {
        // Entregas pendentes
        const entregasPendentes = entregas.filter(e => {
            if (lojaAtiva !== 'todas') {
                // Precisa filtrar por loja através da venda associada
                const vendaAssociada = vendas.find(v => v.id === e.venda_id);
                if (vendaAssociada?.loja !== lojaAtiva) return false;
            }
            return e.status !== 'Entregue' && !isVendaCancelada(e?.status);
        });

        // Montagens pendentes
        const montagensPendentes = montagens.filter(m => {
            if (lojaAtiva !== 'todas') {
                const vendaAssociada = vendas.find(v => v.id === m.venda_id);
                if (vendaAssociada?.loja !== lojaAtiva) return false;
            }
            return m.status !== 'Concluída' && !isVendaCancelada(m?.status);
        });

        // Pagamentos em aberto
        const pagamentosAbertos = vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            return (v.valor_restante || 0) > 0;
        });

        // Triagem pendente
        const triagemPendente = vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            return v.triagem_realizada === false;
        });

        return {
            entregas: entregasPendentes,
            montagens: montagensPendentes,
            pagamentos: pagamentosAbertos,
            triagem: triagemPendente,
            total: entregasPendentes.length + montagensPendentes.length + pagamentosAbertos.length + triagemPendente.length
        };
    }, [entregas, montagens, vendas, lojaAtiva]);

    // Pesquisa de pedidos
    const pedidosPesquisados = useMemo(() => {
        if (!buscaPedido.trim()) return [];
        const termo = buscaPedido.toLowerCase().trim();

        return vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;

            // Buscar por número do pedido, cliente ou vendedor
            const numeroPedido = (v.numero_pedido || v.id || '').toString().toLowerCase();
            const cliente = (v.cliente_nome || '').toLowerCase();
            const vendedor = (v.responsavel_nome || v.vendedor_nome || '').toLowerCase();

            return numeroPedido.includes(termo) ||
                cliente.includes(termo) ||
                vendedor.includes(termo);
        }).slice(0, 20);
    }, [vendas, buscaPedido, lojaAtiva]);

    // Pesquisa de entregas
    const entregasPesquisadas = useMemo(() => {
        if (!buscaEntrega.trim()) return statusEntregas.pendentes.concat(statusEntregas.emRota).concat(statusEntregas.atrasadas);
        const termo = buscaEntrega.toLowerCase().trim();

        const todasEntregas = statusEntregas.pendentes.concat(statusEntregas.emRota).concat(statusEntregas.atrasadas);
        // Remover duplicatas (um item pode ser pendente E atrasado)
        const entregasUnicas = Array.from(new Map(todasEntregas.map(item => [item.id, item])).values());

        return entregasUnicas.filter(e => {
            const vendaAssociada = vendas.find(v => v.id === e.venda_id);
            const cliente = (vendaAssociada?.cliente_nome || e.cliente_nome || '').toLowerCase();
            const endereco = (e.endereco || '').toLowerCase();
            const numeroPedido = (vendaAssociada?.numero_pedido || e.venda_id || '').toString().toLowerCase();

            return cliente.includes(termo) ||
                endereco.includes(termo) ||
                numeroPedido.includes(termo);
        });
    }, [statusEntregas, buscaEntrega, vendas]);

    // Ranking de vendedores expandido com gráfico e metas
    const rankingVendedores = useMemo(() => {
        const agrupado = {};
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

        const vendasMesAnterior = vendas.filter(v => {
            if (isVendaCancelada(v)) return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            return d >= mesAnterior && d <= fimMesAnterior;
        });

        vendasMes.forEach(v => {
            const vendedorId = v.responsavel_id;
            let vendedorNome = v.responsavel_nome || v.vendedor_nome || 'Não informado';

            // Tentar resolver nome pelo ID se possível
            if (vendedorId && users) {
                const userEncontrado = users.find(u => u.id === vendedorId);
                if (userEncontrado && userEncontrado.full_name) {
                    vendedorNome = userEncontrado.full_name;
                }
            }

            if (!agrupado[vendedorNome]) {
                agrupado[vendedorNome] = {
                    nome: vendedorNome,
                    id: vendedorId,
                    total: 0,
                    qtd: 0,
                    vendasDetalhadas: []
                };
            }
            agrupado[vendedorNome].total += v.valor_total || 0;
            agrupado[vendedorNome].qtd++;
            agrupado[vendedorNome].vendasDetalhadas.push(v);
        });

        // Adicionar metas individuais e gráfico
        return Object.values(agrupado)
            .map(vendedor => {
                const metaVendedor = metas.find(m =>
                    m.mes === mesAtual &&
                    m.vendedor_id === vendedor.id
                );

                // Variacao MoM
                const vendasAnt = vendasMesAnterior.filter(v => v.responsavel_id === vendedor.id || v.responsavel_nome === vendedor.nome || v.vendedor_nome === vendedor.nome);
                const totalAnt = vendasAnt.reduce((sum, v) => sum + (v.valor_total || 0), 0);
                const variacaoMoM = totalAnt > 0 ? ((vendedor.total - totalAnt) / totalAnt) * 100 : 0;

                // Gerar grafico diario (deste mes apenas)
                const graficoMap = {};
                for (let d = new Date(hoje.getFullYear(), hoje.getMonth(), 1); d <= hoje; d.setDate(d.getDate() + 1)) {
                    const dia = d.toISOString().split('T')[0];
                    const diaNum = d.getDate();
                    graficoMap[dia] = { dia, diaNum, total: 0, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
                }

                vendedor.vendasDetalhadas.forEach(v => {
                    const dia = v.data_venda.split('T')[0];
                    if (graficoMap[dia]) {
                        graficoMap[dia].total += v.valor_total || 0;
                    }
                });

                const dadosGrafico = Object.values(graficoMap);

                // Gerar grafico diário do mês anterior (para comparativo MoM)
                const graficoMapAnt = {};
                const diasMesAnterior = fimMesAnterior.getDate();
                for (let d = 1; d <= diasMesAnterior; d++) {
                    graficoMapAnt[d] = 0;
                }
                vendasAnt.forEach(v => {
                    if (v.data_venda) {
                        const dAnt = new Date(v.data_venda).getDate();
                        if (graficoMapAnt[dAnt] !== undefined) {
                            graficoMapAnt[dAnt] += v.valor_total || 0;
                        }
                    }
                });

                // Combinar dados para comparativo (dia a dia)
                const dadosComparativoVendedor = dadosGrafico.map(item => ({
                    ...item,
                    totalMesAnterior: graficoMapAnt[item.diaNum] || 0
                }));

                // Meta diária
                const metaValor = metaVendedor?.meta_valor || 0;
                const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                const metaDiaria = metaValor > 0 ? metaValor / diasNoMes : 0;

                return {
                    ...vendedor,
                    meta: metaValor,
                    metaDiaria,
                    progresso: metaValor > 0
                        ? (vendedor.total / metaValor) * 100
                        : 0,
                    totalMesAnterior: totalAnt,
                    variacaoMoM,
                    dadosGrafico,
                    dadosComparativoVendedor
                };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 5); // Traz os top 5
    }, [vendasMes, metas, vendas, lojaAtiva, users]);

    // Lista de todos os vendedores da loja (para dropdown de metas)
    const vendedoresLoja = useMemo(() => {
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

        return users
            .filter(u => {
                // Filtrar por cargo de vendedor
                if (u.cargo !== 'Vendedor') return false;
                // Filtrar por loja ativa
                if (lojaAtiva !== 'todas' && u.loja !== lojaAtiva) return false;
                // Filtrar apenas ativos
                if (u.ativo === false) return false;
                return true;
            })
            .map(u => {
                // Buscar vendas do vendedor no mês
                const vendasVendedor = vendasMes.filter(v => v.responsavel_id === u.id);
                const totalVendas = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);

                // Buscar meta individual
                const metaVendedor = metas.find(m =>
                    m.mes === mesAtual &&
                    m.vendedor_id === u.id
                );

                return {
                    id: u.id,
                    nome: u.full_name || u.nome || 'Sem nome',
                    total: totalVendas,
                    qtd: vendasVendedor.length,
                    meta: metaVendedor?.meta_valor || 0,
                    progresso: metaVendedor?.meta_valor > 0
                        ? (totalVendas / metaVendedor.meta_valor) * 100
                        : 0
                };
            })
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [users, lojaAtiva, vendasMes, metas]);

    // Dados para gráfico de evolução
    const dadosGrafico = useMemo(() => {
        const hoje = new Date();
        const agrupado = {};
        let dataInicio;
        let pAgrupamento = 'dia'; // 'dia' ou 'mes'

        // Definir data de início e agrupamento
        switch (periodoGrafico) {
            case '5':
                dataInicio = new Date(hoje);
                dataInicio.setDate(hoje.getDate() - 4);
                break;
            case '7':
                dataInicio = new Date(hoje);
                dataInicio.setDate(hoje.getDate() - 6);
                break;
            case '14':
                dataInicio = new Date(hoje);
                dataInicio.setDate(hoje.getDate() - 13);
                break;
            case 'mes':
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                break;
            case '60':
                dataInicio = new Date(hoje);
                dataInicio.setDate(hoje.getDate() - 59);
                break;
            case '2y':
                dataInicio = new Date(hoje.getFullYear() - 2, hoje.getMonth(), 1);
                pAgrupamento = 'mes';
                break;
            default:
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        }

        dataInicio.setHours(0, 0, 0, 0);

        // Inicializar agrupamento
        if (pAgrupamento === 'dia') {
            for (let d = new Date(dataInicio); d <= hoje; d.setDate(d.getDate() + 1)) {
                const dia = d.toISOString().split('T')[0];
                agrupado[dia] = { dia, total: 0, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
            }
        } else {
            // Grupar por mês (2 anos)
            for (let d = new Date(dataInicio); d <= hoje; d.setMonth(d.getMonth() + 1)) {
                const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                agrupado[mes] = { mes, total: 0, label: label.charAt(0).toUpperCase() + label.slice(1) };
            }
        }

        // Preencher com vendas (filtrando por loja e status)
        vendas.forEach(v => {
            if (isVendaCancelada(v)) return;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return;
            if (!v.data_venda) return;

            const dVal = new Date(v.data_venda);
            if (dVal < dataInicio || dVal > hoje) return;

            const chave = pAgrupamento === 'dia'
                ? v.data_venda.split('T')[0]
                : `${dVal.getFullYear()}-${String(dVal.getMonth() + 1).padStart(2, '0')}`;

            if (agrupado[chave]) {
                agrupado[chave].total += v.valor_total || 0;
            }
        });

        // Calcular acumulado
        let acumulado = 0;
        return Object.values(agrupado).map(d => {
            acumulado += d.total;
            return {
                ...d,
                acumulado,
                diaFormatado: d.label
            };
        });
    }, [vendas, periodoGrafico, lojaAtiva]);

    // Dados para gráfico comparativo (Este Mês vs Mês Anterior)
    const dadosComparativoMeses = useMemo(() => {
        const hoje = new Date();
        const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

        const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const mesAnteriorStr = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;

        const dados = [];

        // Helper para cálculo líquido (centralizado)
        const calcularTotalLiquido = (vendasArr) => {
            return vendasArr.reduce((sum, v) => {
                const assistencia = assistencias.find(a =>
                    a.numero_pedido === v.numero_pedido &&
                    a.status === 'Concluída' &&
                    (a.tipo === 'Devolução' || a.tipo === 'Troca')
                );
                return sum + (v.valor_total || 0) - (assistencia?.valor_devolvido || 0);
            }, 0);
        };

        for (let i = 1; i <= diasNoMes; i++) {
            const diaStr = String(i).padStart(2, '0');

            // Vendas do dia específico este mês
            const vendasDiaAtual = vendas.filter(v =>
                !isVendaCancelada(v) &&
                (lojaAtiva === 'todas' || v.loja === lojaAtiva) &&
                v.data_venda?.startsWith(`${mesAtualStr}-${diaStr}`)
            );

            // Vendas do mesmo dia no mês anterior
            const vendasDiaAnterior = vendas.filter(v =>
                !isVendaCancelada(v) &&
                (lojaAtiva === 'todas' || v.loja === lojaAtiva) &&
                v.data_venda?.startsWith(`${mesAnteriorStr}-${diaStr}`)
            );

            dados.push({
                dia: i,
                label: `Dia ${i}`,
                esteMes: calcularTotalLiquido(vendasDiaAtual),
                mesAnterior: calcularTotalLiquido(vendasDiaAnterior)
            });
        }

        return dados;
    }, [vendas, lojaAtiva, assistencias]);

    // Dados para gráfico comparativo (Este Ano vs Ano Anterior)
    const dadosComparativoAnual = useMemo(() => {
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const anoPassado = anoAtual - 1;
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        const calcularTotalLiquido = (vendasArr) => {
            return vendasArr.reduce((sum, v) => {
                const assistencia = assistencias.find(a =>
                    a.numero_pedido === v.numero_pedido &&
                    a.status === 'Concluída' &&
                    (a.tipo === 'Devolução' || a.tipo === 'Troca')
                );
                return sum + (v.valor_total || 0) - (assistencia?.valor_devolvido || 0);
            }, 0);
        };

        return meses.map((nome, index) => {
            const mesStr = String(index + 1).padStart(2, '0');

            const vendasEsteAno = vendas.filter(v =>
                !isVendaCancelada(v) &&
                (lojaAtiva === 'todas' || v.loja === lojaAtiva) &&
                v.data_venda?.startsWith(`${anoAtual}-${mesStr}`)
            );

            const vendasAnoPassado = vendas.filter(v =>
                !isVendaCancelada(v) &&
                (lojaAtiva === 'todas' || v.loja === lojaAtiva) &&
                v.data_venda?.startsWith(`${anoPassado}-${mesStr}`)
            );

            return {
                mes: nome,
                index,
                esteAno: calcularTotalLiquido(vendasEsteAno),
                anoAnterior: calcularTotalLiquido(vendasAnoPassado)
            };
        });
    }, [vendas, lojaAtiva, assistencias]);

    // Meta diária projetada
    const metaDiaria = useMemo(() => {
        if (!kpis.metaValor) return 0;
        const hoje = new Date();
        const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        return kpis.metaValor / diasNoMes;
    }, [kpis.metaValor]);

    const formatarMoeda = (valor) => {
        return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatarData = (data) => {
        if (!data) return "-";
        return new Date(data.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR');
    };

    const loading = loadingVendas || loadingEntregas || loadingMontagens;

    const handleSaveMeta = () => {
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
        const lojaParaMeta = lojaAtiva === 'todas' ? lojas[0] : lojaAtiva;

        // Verificar se já existe uma meta para este mês/loja/vendedor
        const metaExistente = metas.find(m =>
            m.mes === mesAtual &&
            m.loja === lojaParaMeta &&
            (metaVendedorSelecionado
                ? m.vendedor_id === metaVendedorSelecionado.id
                : !m.vendedor_id)
        );

        saveMeta.mutate({
            id: metaExistente?.id || editingMeta?.id,
            mes: mesAtual,
            loja: lojaParaMeta,
            vendedor_id: metaVendedorSelecionado?.id || null,
            vendedor_nome: metaVendedorSelecionado?.nome || null,
            meta_valor: parseFloat(novaMetaValor.replace(/\./g, '')) || 0
        });
    };

    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-green-600" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Target className="w-7 h-7 text-green-600" />
                        Dashboard do Gerente
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Visão operacional da loja em tempo real
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={periodo} onValueChange={setPeriodo}>
                        <SelectTrigger className="w-[140px]">
                            <Calendar className="w-4 h-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="hoje">Hoje</SelectItem>
                            <SelectItem value="semana">Esta Semana</SelectItem>
                            <SelectItem value="mes">Este Mês</SelectItem>
                        </SelectContent>
                    </Select>

                    {isGerenteGeral && lojas.length > 1 && (
                        <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
                            <SelectTrigger className="w-[160px]">
                                <Store className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Todas Lojas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todas">Todas Lojas</SelectItem>
                                {lojas.map(loja => (
                                    <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Button variant="outline" size="icon" onClick={() => refetchVendas()} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* KPIs Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Vendas do Dia */}
                <Card className="relative overflow-hidden border-l-4 border-l-green-500">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Vendas de Hoje</p>
                                <p className="text-2xl font-bold mt-1">{formatarMoeda(kpis.totalHoje)}</p>
                                <p className="text-xs text-gray-400 mt-1">{kpis.qtdHoje} vendas realizadas</p>
                            </div>
                            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                                <DollarSign className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                        {kpis.variacaoHoje !== 0 && (
                            <div className={`flex items-center gap-1 mt-3 text-sm ${kpis.variacaoHoje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {kpis.variacaoHoje >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                <span>{Math.abs(kpis.variacaoHoje).toFixed(1)}% vs semana passada</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Vendas do Mês + Meta */}
                <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Vendas do Mês</p>
                                <p className="text-2xl font-bold mt-1">{formatarMoeda(kpis.totalMes)}</p>
                                {kpis.metaValor > 0 ? (
                                    <div className="mt-2">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>{kpis.progressoMeta.toFixed(0)}% da meta</span>
                                            <span>{formatarMoeda(kpis.metaValor)}</span>
                                        </div>
                                        <Progress value={Math.min(kpis.progressoMeta, 100)} className="h-2" />
                                        <p className="text-xs text-gray-400 mt-1">{kpis.diasRestantes} dias restantes</p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-orange-500 mt-2">Meta não definida</p>
                                )}
                            </div>
                            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                                <Target className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Ticket Médio */}
                <Card className="relative overflow-hidden border-l-4 border-l-purple-500">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Médio</p>
                                <p className="text-2xl font-bold mt-1">{formatarMoeda(kpis.ticketMedio)}</p>
                                <p className="text-xs text-gray-400 mt-1">{kpis.qtdMes} vendas no mês</p>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                                <ShoppingCart className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pendências */}
                {/* Pendências */}
                <Card
                    className={`relative overflow-hidden border-l-4 cursor-pointer transition-shadow hover:shadow-md ${pendencias.total > 0 ? 'border-l-orange-500' : 'border-l-emerald-500'}`}
                    onClick={() => setPendenciasModalOpen(true)}
                >
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Pendências</p>
                                <p className="text-2xl font-bold mt-1">{pendencias.total}</p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {pendencias.entregas.length > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                            <Truck className="w-3 h-3 mr-1" />{pendencias.entregas.length}
                                        </Badge>
                                    )}
                                    {pendencias.montagens.length > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                            <Wrench className="w-3 h-3 mr-1" />{pendencias.montagens.length}
                                        </Badge>
                                    )}
                                    {pendencias.pagamentos.length > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                            <CreditCard className="w-3 h-3 mr-1" />{pendencias.pagamentos.length}
                                        </Badge>
                                    )}
                                    {pendencias.triagem.length > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                            <ClipboardList className="w-3 h-3 mr-1" />{pendencias.triagem.length}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className={`p-3 rounded-xl ${pendencias.total > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                                <AlertTriangle className={`w-6 h-6 ${pendencias.total > 0 ? 'text-orange-600' : 'text-emerald-600'}`} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Fluxo Operacional */}
            <div className="mt-8 mb-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Fluxo Operacional</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Acompanhe pedidos, entregas e pagamentos em uma sequência única de operação.
                </p>
            </div>

            {/* Tabs de Navegação do Dashboard - Estilo "Caixinha" Centralizado */}
            <div className="mb-6 flex justify-center">
                <Tabs value={abaDashboard} onValueChange={setAbaDashboard} className="w-full max-w-4xl">
                    <div className="flex justify-center mb-6">
                        <TabsList className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full inline-flex items-center justify-center h-auto shadow-inner">
                            <TabsTrigger
                                value="visao-geral"
                                className="gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-indigo-400"
                            >
                                <BarChart3 className="w-4 h-4" />
                                Visão Geral
                            </TabsTrigger>
                            <TabsTrigger
                                value="pesquisa-pedido"
                                className="gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-indigo-400"
                            >
                                <Search className="w-4 h-4" />
                                Pedidos
                            </TabsTrigger>
                            <TabsTrigger
                                value="entregas"
                                className="gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-indigo-400"
                            >
                                <Truck className="w-4 h-4" />
                                Entregas
                                {statusEntregas.atrasadas.length > 0 && (
                                    <Badge className="bg-red-500 text-white ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center rounded-full">
                                        {statusEntregas.atrasadas.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="pagamentos"
                                className="gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-orange-400"
                            >
                                <CreditCard className="w-4 h-4" />
                                Pagamentos
                                {pendencias.pagamentos.length > 0 && (
                                    <Badge className="bg-orange-500 text-white ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center rounded-full">
                                        {pendencias.pagamentos.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab: Visão Geral - Placeholder para conteúdo existente */}
                    <TabsContent value="visao-geral" className="p-0 m-0">
                        <div className="text-center text-gray-500 text-sm py-2 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <p>Visão completa em tempo real</p>
                        </div>
                    </TabsContent>

                    {/* Tab: Pesquisa de Pedido */}
                    <TabsContent value="pesquisa-pedido" className="m-0">
                        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
                            <CardContent className="p-6">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                placeholder="Buscar por número do pedido, nome do cliente ou vendedor..."
                                                value={buscaPedido}
                                                onChange={(e) => setBuscaPedido(e.target.value)}
                                                className="pl-9 bg-gray-50 border-gray-200"
                                            />
                                        </div>
                                        <Button variant="outline" className="gap-2">
                                            <Filter className="w-4 h-4" />
                                            Filtros
                                        </Button>
                                    </div>

                                    {buscaPedido && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {pedidosPesquisados.map(pedido => {
                                                const entregaAssociada = entregas.find(e => e.venda_id === pedido.id);
                                                return (
                                                    <Card key={pedido.id} className="hover:shadow-md transition-shadow border-gray-100 dark:border-gray-800">
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="font-bold text-blue-600">
                                                                            #{pedido.numero_pedido || pedido.id}
                                                                        </span>
                                                                        <Badge variant="outline" className={
                                                                            pedido.status === 'Finalizada' ? 'bg-green-100 text-green-700' :
                                                                                pedido.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' :
                                                                                    'bg-gray-100 text-gray-700'
                                                                        }>
                                                                            {pedido.status}
                                                                        </Badge>
                                                                        {(pedido.valor_restante || 0) > 0 && (
                                                                            <Badge className="bg-orange-100 text-orange-700">
                                                                                <CreditCard className="w-3 h-3 mr-1" />
                                                                                Pendente: {formatarMoeda(pedido.valor_restante)}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                                                                        {pedido.cliente_nome || 'Cliente não informado'}
                                                                    </p>
                                                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                                                        <span className="flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3" />
                                                                            {pedido.data_venda ? new Date(pedido.data_venda).toLocaleDateString('pt-BR') : '-'}
                                                                        </span>
                                                                        <span>{formatarMoeda(pedido.valor_total || 0)}</span>
                                                                        {entregaAssociada && (
                                                                            <span className="flex items-center gap-1">
                                                                                <Truck className="w-3 h-3" />
                                                                                Entrega: {entregaAssociada.status}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Eye className="w-5 h-5 text-gray-400" />
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {!buscaPedido && (
                                        <div className="text-center py-12 text-gray-500 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">Digite para buscar pedidos</p>
                                            <p className="text-xs mt-1 text-gray-400">Busque por número, cliente ou vendedor</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Entregas */}
                    <TabsContent value="entregas" className="m-0">
                        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
                            <CardContent className="p-6">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                placeholder="Filtrar entregas por cliente, endereço ou pedido..."
                                                value={buscaEntrega}
                                                onChange={(e) => setBuscaEntrega(e.target.value)}
                                                className="pl-9 bg-gray-50 border-gray-200"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Badge className="bg-yellow-100 text-yellow-700 px-3 py-1">
                                                Pendentes: {statusEntregas.pendentes.length}
                                            </Badge>
                                            <Badge className="bg-blue-100 text-blue-700 px-3 py-1">
                                                Em Rota: {statusEntregas.emRota.length}
                                            </Badge>
                                            <Badge className="bg-red-100 text-red-700 px-3 py-1">
                                                Atrasadas: {statusEntregas.atrasadas.length}
                                            </Badge>
                                        </div>
                                    </div>

                                    {entregasPesquisadas.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                            <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">Nenhuma entrega encontrada</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                            {entregasPesquisadas.map(entrega => {
                                                const vendaAssociada = vendas.find(v => v.id === entrega.venda_id);
                                                const isAtrasada = statusEntregas.atrasadas.some(e => e.id === entrega.id);
                                                const isEmRota = statusEntregas.emRota.some(e => e.id === entrega.id);

                                                return (
                                                    <Card key={entrega.id} className={`border ${isAtrasada ? 'border-red-200 bg-red-50/30' : isEmRota ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 hover:bg-gray-50'} transition-all`}>
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-medium text-gray-900">
                                                                            #{vendaAssociada?.numero_pedido || entrega.venda_id}
                                                                        </span>
                                                                        <Badge className={
                                                                            isAtrasada ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                                                                isEmRota ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                                                                    'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                                                                        }>
                                                                            {isAtrasada ? 'Atrasada' : isEmRota ? 'Em Rota' : entrega.status}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-sm font-medium text-gray-700 mt-1">
                                                                        {vendaAssociada?.cliente_nome || entrega.cliente_nome || 'Cliente'}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1 min-w-0">
                                                                        <div className="h-1.5 w-1.5 rounded-full bg-gray-300"></div>
                                                                        <p className="text-xs text-gray-500 truncate max-w-md">
                                                                            {entrega.endereco || entrega.endereco_entrega || 'Endereço não informado'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right text-sm pl-4 border-l border-gray-100 ml-4">
                                                                    <p className="font-medium text-gray-900">
                                                                        {entrega.data_agendada ? new Date(entrega.data_agendada.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 capitalize">{entrega.turno || ''}</p>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Pagamentos em Aberto */}
                    <TabsContent value="pagamentos" className="m-0">
                        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
                            <CardContent className="p-6">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                        <div>
                                            <h3 className="font-semibold text-lg text-gray-900">Pagamentos em Aberto</h3>
                                            <p className="text-sm text-gray-500">Pedidos com saldo pendente</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500">Total em Aberto</p>
                                            <p className="text-2xl font-bold text-orange-600">
                                                {formatarMoeda(pendencias.pagamentos.reduce((sum, p) => sum + (p.valor_restante || 0), 0))}
                                            </p>
                                        </div>
                                    </div>

                                    {pendencias.pagamentos.length === 0 ? (
                                        <div className="text-center py-12 text-green-600 bg-green-50/50 rounded-lg border border-dashed border-green-200">
                                            <Check className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p className="font-medium">Nenhum pagamento pendente!</p>
                                            <p className="text-sm">Todos os pedidos estão quitados</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                            {pendencias.pagamentos.map(pedido => (
                                                <Card key={pedido.id} className="border border-orange-200 bg-orange-50/30 hover:bg-orange-50/50 transition-colors">
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-orange-900">#{pedido.numero_pedido || pedido.id}</span>
                                                                    <Badge variant="outline" className="bg-white/50">{pedido.status}</Badge>
                                                                </div>
                                                                <p className="text-gray-800 mt-1 font-medium">{pedido.cliente_nome || 'Cliente'}</p>
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    {pedido.data_venda ? new Date(pedido.data_venda).toLocaleDateString('pt-BR') : '-'}
                                                                    {' • '}Vendedor: {pedido.responsavel_nome || pedido.vendedor_nome || '-'}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm text-gray-500">Valor Total</p>
                                                                <p className="font-medium">{formatarMoeda(pedido.valor_total || 0)}</p>
                                                                <div className="mt-1 bg-white/80 px-2 py-1 rounded border border-orange-100 inline-block">
                                                                    <p className="text-orange-600 font-bold text-sm">
                                                                        Restante: {formatarMoeda(pedido.valor_restante || 0)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Gráfico + Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico de Evolução + Comparativos */}
                <Card className="lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            Análise de Desempenho
                        </CardTitle>
                        <Dialog open={metaModalOpen} onOpenChange={(open) => {
                            setMetaModalOpen(open);
                            if (!open) {
                                setMetaVendedorSelecionado(null);
                                setNovaMetaValor('');
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => {
                                    setEditingMeta(null);
                                    setMetaVendedorSelecionado(null);
                                    setNovaMetaValor(kpis.metaValor.toString());
                                }}>
                                    <Settings className="w-4 h-4 mr-2" />
                                    Definir Metas
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Definir Meta do Mês</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label>Loja</Label>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {lojaAtiva === 'todas' ? lojas[0] || 'Principal' : lojaAtiva}
                                        </p>
                                    </div>
                                    <div>
                                        <Label>Vendedor</Label>
                                        <Select
                                            value={metaVendedorSelecionado?.id || ''}
                                            onValueChange={(value) => {
                                                const vendedor = vendedoresLoja.find(v => v.id === value);
                                                setMetaVendedorSelecionado(vendedor);
                                                // Buscar meta do vendedor
                                                const hoje = new Date();
                                                const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
                                                const metaVendedor = metas.find(m => m.mes === mesAtual && m.vendedor_id === value);
                                                setNovaMetaValor(metaVendedor?.meta_valor?.toString() || '');
                                            }}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Selecione um vendedor..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vendedoresLoja.map(vendedor => (
                                                    <SelectItem key={vendedor.id} value={vendedor.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4" />
                                                            {vendedor.nome}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="meta-valor">Valor da Meta (R$)</Label>
                                        <Input
                                            id="meta-valor"
                                            type="text"
                                            value={novaMetaValor}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\D/g, '');
                                                const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                                                setNovaMetaValor(formatted);
                                            }}
                                            placeholder="Ex: 150.000"
                                            className="mt-1"
                                        />
                                        {novaMetaValor && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Meta diária: {formatarMoeda(parseFloat(novaMetaValor.replace(/\./g, '')) / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setMetaModalOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button onClick={handleSaveMeta} disabled={saveMeta.isPending}>
                                        {saveMeta.isPending ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                                        ) : (
                                            'Salvar Meta'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="p-6">
                        {/* Linha 1: Evolução de Vendas (Largura Total) */}
                        <div className="w-full mb-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <h3 className="text-sm font-medium text-gray-500">Evolução de Vendas</h3>
                                <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                    {[
                                        { id: '5', label: '5D' },
                                        { id: '7', label: '7D' },
                                        { id: '14', label: '14D' },
                                        { id: 'mes', label: '30D' },
                                        { id: '60', label: '60D' },
                                        { id: '2y', label: '2 ANOS' }
                                    ].map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => setPeriodoGrafico(p.id)}
                                            className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all ${periodoGrafico === p.id
                                                ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dadosGrafico}>
                                        <defs>
                                            <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="diaFormatado"
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                            formatter={(value) => [formatarMoeda(value), '']}
                                            labelFormatter={(label) => `Data: ${label}`}
                                        />
                                        {kpis.metaValor > 0 && (
                                            <ReferenceLine
                                                y={kpis.metaValor}
                                                stroke="#ef4444"
                                                strokeDasharray="5 5"
                                                label={{ value: 'Meta', position: 'right', fill: '#ef4444', fontSize: 11 }}
                                            />
                                        )}
                                        <Area
                                            type="monotone"
                                            dataKey="acumulado"
                                            stroke="#4f46e5"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorAcumulado)"
                                            name="Acumulado"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Linha 2: Comparativos (Gráfico + Cards) */}
                        <div className="flex flex-col lg:flex-row gap-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                            {/* Gráficos Comparativos com Toggle */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-gray-500">
                                        {tipoComparativo === 'mes' ? 'Comparativo: Este Mês vs Mês Anterior' : 'Comparativo: Este Ano vs Ano Anterior'}
                                    </h3>

                                    <div className="flex items-center gap-4">
                                        {/* Toggle Mes/Ano */}
                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                            <button
                                                onClick={() => setTipoComparativo('mes')}
                                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${tipoComparativo === 'mes' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Mensal
                                            </button>
                                            <button
                                                onClick={() => setTipoComparativo('ano')}
                                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${tipoComparativo === 'ano' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Anual
                                            </button>
                                        </div>

                                        {/* Legenda Dinâmica */}
                                        <div className="flex items-center gap-4 border-l pl-4 border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${tipoComparativo === 'mes' ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
                                                <span className="text-[10px] font-medium text-gray-500 uppercase">
                                                    {tipoComparativo === 'mes' ? 'ESTE MÊS' : 'ESTE ANO'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full border-2 border-gray-400 border-dashed" />
                                                <span className="text-[10px] font-medium text-gray-500 uppercase">
                                                    {tipoComparativo === 'mes' ? 'MÊS ANTERIOR' : 'ANO ANTERIOR'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-[200px] w-full">
                                    {tipoComparativo === 'mes' ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={dadosComparativoMeses}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis
                                                    dataKey="dia"
                                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value) => [formatarMoeda(value), '']}
                                                    labelFormatter={(label) => `Dia ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="esteMes"
                                                    stroke="#4f46e5"
                                                    strokeWidth={3}
                                                    dot={{ r: 0 }}
                                                    activeDot={{ r: 4 }}
                                                    name="Este Mês"
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="mesAnterior"
                                                    stroke="#9ca3af"
                                                    strokeWidth={2}
                                                    strokeDasharray="5 5"
                                                    dot={{ r: 0 }}
                                                    activeDot={{ r: 4 }}
                                                    name="Mês Anterior"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={dadosComparativoAnual}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis
                                                    dataKey="mes"
                                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value) => [formatarMoeda(value), '']}
                                                    labelFormatter={(label) => `Mês: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="esteAno"
                                                    stroke="#10b981"
                                                    strokeWidth={3}
                                                    dot={{ r: 0 }}
                                                    activeDot={{ r: 4 }}
                                                    name="Este Ano"
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="anoAnterior"
                                                    stroke="#9ca3af"
                                                    strokeWidth={2}
                                                    strokeDasharray="5 5"
                                                    dot={{ r: 0 }}
                                                    activeDot={{ r: 4 }}
                                                    name="Ano Anterior"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Área de Métricas (Insights Rápidos) */}
                            <div className="lg:w-1/4 flex flex-col lg:border-l border-gray-100 dark:border-gray-800 lg:pl-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                        Comparativos
                                    </h3>
                                    <Badge variant="secondary" className="text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">STATUS ATUAL</Badge>
                                </div>

                                <div className="grid grid-cols-1 gap-4 flex-grow">
                                    {/* MoM Card */}
                                    <div className="group relative p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mês contra Mês</span>
                                                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">MoM Performance</h4>
                                            </div>
                                            <Badge variant="outline" className="text-[9px] font-medium border-gray-200 text-gray-500">Mês Anterior</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className={`text-2xl font-black ${comparativoMoM.variacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {comparativoMoM.variacao >= 0 ? '+' : ''}{comparativoMoM.variacao.toFixed(1)}%
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium mt-0.5">Anterior: {formatarMoeda(comparativoMoM.totalMesAnterior)}</span>
                                            </div>
                                            <div className={`p-2.5 rounded-xl ${comparativoMoM.variacao >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
                                                {comparativoMoM.variacao >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* YoY Card */}
                                    <div className="group relative p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ano contra Ano</span>
                                                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">YoY Performance</h4>
                                            </div>
                                            <Badge variant="outline" className="text-[9px] font-medium border-gray-200 text-gray-500">{comparativoYoY.label}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className={`text-2xl font-black ${comparativoYoY.variacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {comparativoYoY.variacao >= 0 ? '+' : ''}{comparativoYoY.variacao.toFixed(1)}%
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium mt-0.5">Anterior: {formatarMoeda(comparativoYoY.totalAnoPassado)}</span>
                                            </div>
                                            <div className={`p-2.5 rounded-xl ${comparativoYoY.variacao >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
                                                {comparativoYoY.variacao >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Comercial */}
            <div className="mt-6 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Performance Comercial</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Comissões, evolução dos vendedores e comparação de desempenho.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Comissões: {formatarMoeda(totalComissoes)}
                    </Badge>
                    <Badge variant="outline" className="text-gray-500 bg-white dark:bg-gray-900">
                        Vendedores ativos: {rankingVendedores.length}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Comissões a Pagar */}
                <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                            Comissões a Pagar
                            <Badge className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                {formatarMoeda(totalComissoesCard)}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {comissoesCardLista.length > 0 ? (
                            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                                {comissoesCardLista.map((v, i) => (
                                    <div key={v.id || v.nome} className="flex items-center justify-between p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-transparent hover:border-amber-200 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-sm font-bold text-amber-700 shadow-sm">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{v.nome}</p>
                                                <p className="text-xs text-gray-500">{v.vendas} vendas</p>
                                            </div>
                                        </div>
                                        <p className="font-bold text-amber-600">{formatarMoeda(v.comissao)}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                <p>Nenhuma comissão no período</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                {/* Visão Rápida */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            Visão Rápida
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <span className="text-sm text-gray-600 dark:text-gray-300">MoM</span>
                            <span className={`font-bold ${comparativoMoM.variacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {comparativoMoM.variacao >= 0 ? '+' : ''}{comparativoMoM.variacao.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <span className="text-sm text-gray-600 dark:text-gray-300">YoY</span>
                            <span className={`font-bold ${comparativoYoY.variacao >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {comparativoYoY.variacao >= 0 ? '+' : ''}{comparativoYoY.variacao.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Média comissão/vendedor</span>
                            <span className="font-bold text-amber-600">
                                {formatarMoeda(comissoesPorVendedor.length ? totalComissoes / comissoesPorVendedor.length : 0)}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Vendedores */}
            <div className="mt-6">
                <Card className="overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
                    <CardHeader className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Award className="w-6 h-6 text-yellow-500 fill-yellow-500/20" />
                                Top Vendedores (Mês Atual)
                            </CardTitle>
                            <Badge variant="outline" className="text-gray-500 bg-white dark:bg-gray-900">
                                Top {rankingVendedores.length}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            {rankingVendedores.length > 0 ? rankingVendedores.map((v, i) => (
                                <div key={v.nome} className="group flex flex-col md:flex-row items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-yellow-200/60 dark:hover:border-yellow-900/40 transition-all duration-300 gap-6">

                                    {/* 1. Perfil do Vendedor */}
                                    <div className="flex items-center gap-4 w-full md:w-[250px] shrink-0">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${i === 0 ? 'bg-gradient-to-br from-yellow-100 to-amber-200 text-amber-700 border-2 border-yellow-300' :
                                            i === 1 ? 'bg-gradient-to-br from-gray-100 to-gray-300 text-gray-700 border-2 border-gray-400' :
                                                i === 2 ? 'bg-gradient-to-br from-orange-100 to-orange-300 text-orange-800 border-2 border-orange-400' :
                                                    'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                                            }`}>
                                            <span className="text-xl font-bold">#{i + 1}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white text-lg tracking-tight group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-colors">{v.nome}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {v.qtd} vendas
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Gráfico de Evolução / Comparativo */}
                                    <div className="w-full md:flex-grow min-w-[250px] flex flex-col gap-1">
                                        {/* Toggle do gráfico */}
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => setVendedorChartMode(prev => ({ ...prev, [v.nome]: 'evolucao' }))}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${(vendedorChartMode[v.nome] || 'evolucao') === 'evolucao'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                Evolução
                                            </button>
                                            <button
                                                onClick={() => setVendedorChartMode(prev => ({ ...prev, [v.nome]: 'comparativo' }))}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${vendedorChartMode[v.nome] === 'comparativo'
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                MoM
                                            </button>
                                        </div>
                                        <div className="h-24">
                                            {v.dadosGrafico && v.dadosGrafico.length > 0 ? (
                                                (vendedorChartMode[v.nome] || 'evolucao') === 'evolucao' ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={v.dadosGrafico} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                                            <defs>
                                                                <linearGradient id={`colorVendasTop${i}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={i === 0 ? "#EAB308" : "#3B82F6"} stopOpacity={0.4} />
                                                                    <stop offset="95%" stopColor={i === 0 ? "#EAB308" : "#3B82F6"} stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <XAxis dataKey="dia" hide />
                                                            <Tooltip
                                                                contentStyle={{ borderRadius: '12px', fontSize: '11px', padding: '6px 10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                formatter={(value) => [formatarMoeda(value), 'Total']}
                                                                labelFormatter={(label) => {
                                                                    if (typeof label !== 'string') return `Dia ${label}`;
                                                                    return `Dia ${label.split('-')[2] || label}`;
                                                                }}
                                                                cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                            />
                                                            {v.metaDiaria > 0 && (
                                                                <ReferenceLine
                                                                    y={v.metaDiaria}
                                                                    stroke="#EF4444"
                                                                    strokeWidth={1.5}
                                                                    strokeDasharray="6 3"
                                                                    label={{ value: `Meta: ${formatarMoeda(v.metaDiaria)}/dia`, position: 'insideTopRight', fill: '#EF4444', fontSize: 9, fontWeight: 600 }}
                                                                />
                                                            )}
                                                            <Area
                                                                type="monotone"
                                                                dataKey="total"
                                                                stroke={i === 0 ? "#EAB308" : "#3B82F6"}
                                                                strokeWidth={2.5}
                                                                fillOpacity={1}
                                                                fill={`url(#colorVendasTop${i})`}
                                                                isAnimationActive={true}
                                                            />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={v.dadosComparativoVendedor} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                                            <XAxis dataKey="dia" hide />
                                                            <Tooltip
                                                                contentStyle={{ borderRadius: '12px', fontSize: '11px', padding: '6px 10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                formatter={(value, name) => [formatarMoeda(value), name === 'total' ? 'Mês Atual' : 'Mês Anterior']}
                                                                labelFormatter={(label) => {
                                                                    if (typeof label !== 'string') return `Dia ${label}`;
                                                                    return `Dia ${label.split('-')[2] || label}`;
                                                                }}
                                                                cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                            />
                                                            {v.metaDiaria > 0 && (
                                                                <ReferenceLine
                                                                    y={v.metaDiaria}
                                                                    stroke="#EF4444"
                                                                    strokeWidth={1.5}
                                                                    strokeDasharray="6 3"
                                                                    label={{ value: `Meta`, position: 'insideTopRight', fill: '#EF4444', fontSize: 9, fontWeight: 600 }}
                                                                />
                                                            )}
                                                            <Line type="monotone" dataKey="total" stroke={i === 0 ? '#EAB308' : '#3B82F6'} strokeWidth={2.5} dot={false} name="Mês Atual" />
                                                            <Line type="monotone" dataKey="totalMesAnterior" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Mês Anterior" />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                )
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                                    Gráfico indisponível
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Métricas e Metas */}
                                    <div className="flex items-center gap-8 w-full md:w-auto shrink-0 justify-end">

                                        {/* Total e MoM */}
                                        <div className="flex flex-col items-end min-w-[120px]">
                                            <span className="text-xl font-bold text-gray-900 dark:text-white">{formatarMoeda(v.total)}</span>
                                            <div className={`flex items-center gap-1.5 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${v.variacaoMoM >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-50 text-red-700 dark:bg-red-900/30'}`}>
                                                {v.variacaoMoM >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                <span>{v.variacaoMoM >= 0 ? '+' : ''}{v.variacaoMoM.toFixed(1)}% MoM</span>
                                            </div>
                                        </div>

                                        {/* Progresso da Meta */}
                                        <div className="w-[140px] flex flex-col gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                            {v.meta > 0 ? (
                                                <>
                                                    <div className="flex justify-between items-end text-xs font-medium">
                                                        <span className="text-gray-500 flex items-center gap-1"><Target className="w-3 h-3" /> Meta</span>
                                                        <span className={v.progresso >= 100 ? 'text-green-600 font-bold' : 'text-gray-700 dark:text-gray-300'}>
                                                            {v.progresso.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <Progress value={Math.min(v.progresso, 100)} className={`h-2 shadow-inner ${v.progresso >= 100 ? '[&>div]:bg-green-500' : ''}`} />
                                                    <div className="text-[10px] text-gray-400 text-right font-medium">
                                                        {formatarMoeda(v.meta)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg p-2 bg-gray-50/50 dark:bg-gray-900/50">
                                                    <Target className="w-4 h-4 text-gray-400 mb-1" />
                                                    <span className="text-[10px] text-gray-400 font-medium">Sem meta</span>
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                </div>
                            )) : (
                                <div className="text-center py-16 text-gray-500">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Award className="w-8 h-8 opacity-40 text-gray-600" />
                                    </div>
                                    <p className="font-semibold text-gray-700 dark:text-gray-300 text-lg">Nenhuma venda encontrada</p>
                                    <p className="text-sm mt-1">Os top vendedores aparecerão aqui.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Operações de Estoque e Entrega */}
            <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
                    <Package className="w-5 h-5 text-blue-600" />
                    Operações de Estoque e Entrega
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Alertas de giro, curva ABC e acompanhamento de execução logística.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Curva ABC */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-blue-600" />
                                Curva ABC
                                <div className="ml-auto flex gap-2">
                                    <Badge className="bg-green-100 text-green-700">A: {curvaABC.resumo.A}</Badge>
                                    <Badge className="bg-yellow-100 text-yellow-700">B: {curvaABC.resumo.B}</Badge>
                                    <Badge className="bg-red-100 text-red-700">C: {curvaABC.resumo.C}</Badge>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {curvaABC.produtos.length > 0 ? (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {curvaABC.produtos.map((p, i) => (
                                        <div
                                            key={p.id}
                                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 cursor-pointer transition-colors"
                                            onClick={() => {
                                                if (p.produtoInfo) {
                                                    setProdutoDetalhe(p.produtoInfo);
                                                    setProdutoModalOpen(true);
                                                } else {
                                                    // Fallback se não tiver info completa, tenta buscar de novo ou avisa
                                                    const freshInfo = produtos.find(prod => prod.id === p.id);
                                                    if (freshInfo) {
                                                        setProdutoDetalhe(freshInfo);
                                                        setProdutoModalOpen(true);
                                                    } else {
                                                        toast.info(`Detalhes não disponíveis para ${p.nome}`);
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Badge className={
                                                    p.classificacao === 'A' ? 'bg-green-100 text-green-700' :
                                                        p.classificacao === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                }>{p.classificacao}</Badge>
                                                <span className="text-sm truncate max-w-[150px]" title="Clique para ver detalhes">{p.nome}</span>
                                            </div>
                                            <span className="text-sm font-medium">{formatarMoeda(p.valor)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Sem dados de vendas</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Giro de Estoque */}
                    <Card className={giroEstoque.totalEncalhados > 0 ? 'border-orange-200' : ''}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Box className="w-5 h-5 text-purple-600" />
                                Giro de Estoque
                                <div className="ml-auto flex items-center gap-2">
                                    <Select value={String(giroFiltro)} onValueChange={(v) => setGiroFiltro(Number(v))}>
                                        <SelectTrigger className="w-[100px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="30">30 dias</SelectItem>
                                            <SelectItem value="60">60 dias</SelectItem>
                                            <SelectItem value="90">90 dias</SelectItem>
                                            <SelectItem value="120">120 dias</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {giroEstoque.totalEncalhados > 0 && (
                                        <Badge variant="destructive">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            {giroEstoque.totalEncalhados}
                                        </Badge>
                                    )}
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Métricas Resumidas - Expandido */}
                            {giroEstoque.totalEncalhados > 0 && (
                                <>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-center">
                                            <p className="text-lg font-bold text-orange-600">{formatarMoeda(giroEstoque.totalValorEncalhado)}</p>
                                            <p className="text-[10px] text-gray-500">Valor parado</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-center">
                                            <p className="text-lg font-bold text-red-600">{giroEstoque.produtosCriticos}</p>
                                            <p className="text-[10px] text-gray-500">Classe C (liquidar)</p>
                                        </div>
                                    </div>

                                    {/* Métricas Adicionais */}
                                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                                        <div className="p-1.5 rounded bg-gray-50 dark:bg-gray-800 text-center">
                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                {giroEstoque.encalhados.length > 0
                                                    ? Math.round(giroEstoque.encalhados.reduce((sum, p) => sum + (p.diasSemVenda === 999 ? giroFiltro : p.diasSemVenda), 0) / giroEstoque.encalhados.length)
                                                    : 0} dias
                                            </p>
                                            <p className="text-[9px] text-gray-500">Média parado</p>
                                        </div>
                                        <div className="p-1.5 rounded bg-gray-50 dark:bg-gray-800 text-center">
                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                {formatarMoeda(giroEstoque.totalEncalhados > 0 ? giroEstoque.totalValorEncalhado / giroEstoque.totalEncalhados : 0)}
                                            </p>
                                            <p className="text-[9px] text-gray-500">Valor médio/prod</p>
                                        </div>
                                        <div className="p-1.5 rounded bg-gray-50 dark:bg-gray-800 text-center">
                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                {giroEstoque.encalhados.reduce((sum, p) => sum + (p.quantidade_estoque || 0), 0)} un
                                            </p>
                                            <p className="text-[9px] text-gray-500">Total unidades</p>
                                        </div>
                                    </div>

                                    {/* Distribuição ABC dos Encalhados */}
                                    <div className="flex items-center gap-1 mb-3 text-xs">
                                        <span className="text-gray-500">Distribuição:</span>
                                        <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">
                                            A: {giroEstoque.encalhados.filter(p => p.classificacaoABC === 'A').length}
                                        </Badge>
                                        <Badge className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0">
                                            B: {giroEstoque.encalhados.filter(p => p.classificacaoABC === 'B').length}
                                        </Badge>
                                        <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
                                            C: {giroEstoque.encalhados.filter(p => p.classificacaoABC === 'C').length}
                                        </Badge>
                                    </div>

                                    {/* Dica de Ação */}
                                    {giroEstoque.produtosCriticos > 0 && (
                                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 mb-3 border border-amber-200 dark:border-amber-800">
                                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                                <strong>Sugestão:</strong> {giroEstoque.produtosCriticos} produto(s) Classe C parado(s) há mais de {giroFiltro} dias. Considere promoção, giro interno entre lojas ou campanha de saída.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {giroEstoque.encalhados.length > 0 ? (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {giroEstoque.encalhados.map(p => (
                                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg transition-colors group ${p.diasSemVenda === 999
                                            ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100'
                                            : p.diasSemVenda > 60
                                                ? 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100'
                                                : 'bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100'
                                            }`}>
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <Badge className={
                                                    p.classificacaoABC === 'A' ? 'bg-green-100 text-green-700' :
                                                        p.classificacaoABC === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                }>{p.classificacaoABC}</Badge>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm truncate block font-medium">{p.nome}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] ${p.diasSemVenda === 999 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                            {p.diasSemVenda === 999 ? 'Nunca vendido' : `${p.diasSemVenda} dias sem venda`}
                                                        </span>
                                                        {p.qtdVendas > 0 && (
                                                            <span className="text-[10px] text-green-600">({p.qtdVendas} vendas antes)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <p className="text-xs font-medium">{formatarMoeda(p.valorEstoque)}</p>
                                                    <p className="text-[10px] text-gray-500">{p.quantidade_estoque} un</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                    <p className="text-sm font-medium">Estoque saudável</p>
                                    <p className="text-xs text-gray-400">Nenhum produto parado há mais de {giroFiltro} dias</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Status de Entregas */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Truck className="w-5 h-5 text-cyan-600" />
                                Status de Entregas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                                    <p className="text-2xl font-bold text-yellow-600">{statusEntregas.pendentes.length}</p>
                                    <p className="text-xs text-gray-600">Pendentes</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                    <p className="text-2xl font-bold text-blue-600">{statusEntregas.emRota.length}</p>
                                    <p className="text-xs text-gray-600">Em Rota</p>
                                </div>
                                <div className={`text-center p-3 rounded-lg ${statusEntregas.atrasadas.length > 0 ? 'bg-red-100 dark:bg-red-950/30' : 'bg-green-50 dark:bg-green-950/20'}`}>
                                    <p className={`text-2xl font-bold ${statusEntregas.atrasadas.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{statusEntregas.atrasadas.length}</p>
                                    <p className="text-xs text-gray-600">Atrasadas</p>
                                </div>
                            </div>
                            {statusEntregas.atrasadas.length > 0 && (
                                <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                                    <p className="text-xs text-red-600 font-medium mb-1">Entregas atrasadas requerem atenção.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Painel de Pendências */}
            <div className="mt-6 mb-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Painel de Pendências</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Resumo consolidado dos itens que precisam de ação imediata.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Entregas Pendentes */}
                <Card className={pendencias.entregas.length > 0 ? 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20' : ''}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${pendencias.entregas.length > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                <Truck className={`w-5 h-5 ${pendencias.entregas.length > 0 ? 'text-orange-600' : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">Entregas Pendentes</p>
                                <p className={`text-2xl font-bold ${pendencias.entregas.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                    {pendencias.entregas.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Montagens Pendentes */}
                <Card className={pendencias.montagens.length > 0 ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20' : ''}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${pendencias.montagens.length > 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                <Wrench className={`w-5 h-5 ${pendencias.montagens.length > 0 ? 'text-blue-600' : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">Montagens Pendentes</p>
                                <p className={`text-2xl font-bold ${pendencias.montagens.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {pendencias.montagens.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pagamentos em Aberto */}
                <Card className={pendencias.pagamentos.length > 0 ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : ''}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${pendencias.pagamentos.length > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                <CreditCard className={`w-5 h-5 ${pendencias.pagamentos.length > 0 ? 'text-red-600' : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">Pagamentos Abertos</p>
                                <p className={`text-2xl font-bold ${pendencias.pagamentos.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    {pendencias.pagamentos.length}
                                </p>
                                {pendencias.pagamentos.length > 0 && (
                                    <p className="text-xs text-gray-500">
                                        {formatarMoeda(pendencias.pagamentos.reduce((sum, v) => sum + (v.valor_restante || 0), 0))}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Triagem Pendente */}
                <Card className={pendencias.triagem.length > 0 ? 'border-purple-200 bg-purple-50/50 dark:bg-purple-950/20' : ''}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${pendencias.triagem.length > 0 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                <ClipboardList className={`w-5 h-5 ${pendencias.triagem.length > 0 ? 'text-purple-600' : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">Triagem Pendente</p>
                                <p className={`text-2xl font-bold ${pendencias.triagem.length > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                    {pendencias.triagem.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Operações Complementares */}
            <div className="mt-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Operações Complementares</h2>

                {/* Seção de Tokens Gerenciais */}
                <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Key className="w-5 h-5 text-amber-600" />
                        Tokens de Autorização
                    </CardTitle>
                    <Dialog open={tokenModalOpen} onOpenChange={setTokenModalOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                                <Plus className="w-4 h-4 mr-1" />
                                Criar Token
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Key className="w-5 h-5 text-amber-600" />
                                    Criar Token de Autorização
                                </DialogTitle>
                            </DialogHeader>

                            {tokenGerado ? (
                                // Mostrar código gerado
                                <div className="py-6 space-y-6">
                                    <div className="text-center">
                                        <p className="text-sm text-gray-500 mb-2">Código do Token (6 dígitos)</p>
                                        <div className="flex items-center justify-center gap-3">
                                            <code className="font-mono font-bold text-5xl text-amber-600 tracking-wider">
                                                {tokenGerado.codigo}
                                            </code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copiarCodigo(tokenGerado.codigo)}
                                                className="h-10 w-10"
                                            >
                                                {copiado === tokenGerado.codigo ? (
                                                    <Check className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <Copy className="w-5 h-5" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Tipo:</span>
                                            <Badge className={tokenGerado.tipo_token === 'SUPERVISOR_MODE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                                                {tokenGerado.tipo_token === 'SUPERVISOR_MODE' ? '👑 Modo Supervisor' : '🎫 Uso Único'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Permissão:</span>
                                            <span className="font-medium">{tokenGerado.permissao}</span>
                                        </div>
                                        {tokenGerado.valor_limite && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600">Limite:</span>
                                                <span className="font-medium">{tokenGerado.valor_limite}%</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Expira em:</span>
                                            <span className="font-medium">{tokenGerado.validade_minutos} min</span>
                                        </div>
                                    </div>

                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setTokenGerado(null);
                                                setTokenModalOpen(false);
                                            }}
                                            className="w-full"
                                        >
                                            Fechar
                                        </Button>
                                    </DialogFooter>
                                </div>
                            ) : (
                                // Formulário de criação
                                <div className="space-y-4 py-4">
                                    {/* Seletor de Modo */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setNovoToken({ ...novoToken, tipoToken: 'SINGLE_USE', maxUsos: 1 })}
                                            className={`p-4 rounded-lg border-2 transition-all ${novoToken.tipoToken === 'SINGLE_USE'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="text-2xl mb-1">🎫</div>
                                            <p className="font-medium text-sm">Uso Único</p>
                                            <p className="text-xs text-gray-500">1 operação específica</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNovoToken({ ...novoToken, tipoToken: 'SUPERVISOR_MODE', maxUsos: 10 })}
                                            className={`p-4 rounded-lg border-2 transition-all ${novoToken.tipoToken === 'SUPERVISOR_MODE'
                                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="text-2xl mb-1">👑</div>
                                            <p className="font-medium text-sm">Supervisor</p>
                                            <p className="text-xs text-gray-500">Múltiplas operações</p>
                                        </button>
                                    </div>

                                    {/* Configurações */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Permissão</Label>
                                            <Select
                                                value={novoToken.permissao}
                                                onValueChange={(v) => setNovoToken({ ...novoToken, permissao: v })}
                                            >
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DESCONTO">Desconto</SelectItem>
                                                    <SelectItem value="CANCELAMENTO">❌ Cancelamento</SelectItem>
                                                    <SelectItem value="ALTERACAO_PRECO">✏️ Alt. Preço</SelectItem>
                                                    <SelectItem value="SUPER_CAIXA">⭐ Super Caixa</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Validade</Label>
                                            <Select
                                                value={String(novoToken.validadeMinutos)}
                                                onValueChange={(v) => setNovoToken({ ...novoToken, validadeMinutos: Number(v) })}
                                            >
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="5">5 minutos</SelectItem>
                                                    <SelectItem value="15">15 minutos</SelectItem>
                                                    <SelectItem value="30">30 minutos</SelectItem>
                                                    <SelectItem value="60">1 hora</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {novoToken.permissao !== 'SUPER_CAIXA' && (
                                        <div>
                                            <Label>Limite de Valor (%)</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input
                                                    type="number"
                                                    value={novoToken.valorLimite}
                                                    onChange={(e) => setNovoToken({ ...novoToken, valorLimite: Number(e.target.value) })}
                                                    className="w-24"
                                                    min={1}
                                                    max={100}
                                                />
                                                <span className="text-sm text-gray-500">% máximo</span>
                                            </div>
                                        </div>
                                    )}

                                    {novoToken.tipoToken === 'SUPERVISOR_MODE' && (
                                        <div>
                                            <Label>Máximo de Usos</Label>
                                            <Select
                                                value={String(novoToken.maxUsos)}
                                                onValueChange={(v) => setNovoToken({ ...novoToken, maxUsos: Number(v) })}
                                            >
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="5">5 usos</SelectItem>
                                                    <SelectItem value="10">10 usos</SelectItem>
                                                    <SelectItem value="20">20 usos</SelectItem>
                                                    <SelectItem value="50">50 usos</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <DialogFooter className="pt-4">
                                        <Button variant="outline" onClick={() => setTokenModalOpen(false)}>Cancelar</Button>
                                        <Button onClick={handleCriarToken} className="bg-amber-600 hover:bg-amber-700">
                                            <Key className="w-4 h-4 mr-2" />
                                            Gerar Token
                                        </Button>
                                    </DialogFooter>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
                                {tokensAtivos.length} token{tokensAtivos.length !== 1 ? 's' : ''} ativo{tokensAtivos.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <Switch
                                id="mostrar-expirados"
                                checked={mostrarExpirados}
                                onCheckedChange={setMostrarExpirados}
                            />
                            <Label htmlFor="mostrar-expirados" className="text-sm text-gray-600 cursor-pointer">
                                Exibir tokens expirados
                            </Label>
                        </div>
                    </div>

                    {tokensExibidos.length > 0 ? (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {tokensExibidos.map(token => {
                                const expirado = token.expira_em && new Date(token.expira_em) < new Date();
                                const esgotado = token.max_usos && token.usos_realizados >= token.max_usos;
                                const ativo = token.ativo && !expirado && !esgotado;

                                return (
                                    <div
                                        key={token.id}
                                        className={`flex items-center justify-between p-3 rounded-lg border ${ativo
                                            ? 'bg-white dark:bg-neutral-800 border-amber-200 dark:border-amber-800'
                                            : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${token.tipo_token === 'SUPERVISOR_MODE' ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                                                {token.tipo_token === 'SUPERVISOR_MODE' ? (
                                                    <span className="text-lg">👑</span>
                                                ) : (
                                                    <span className="text-lg">🎫</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <code className="font-mono font-bold text-lg">{token.codigo}</code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => copiarCodigo(token.codigo)}
                                                    >
                                                        {copiado === token.codigo ? (
                                                            <Check className="w-3 h-3 text-green-600" />
                                                        ) : (
                                                            <Copy className="w-3 h-3" />
                                                        )}
                                                    </Button>
                                                </div>
                                                <div className="flex gap-2 mt-1">
                                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${token.tipo_token === 'SUPERVISOR_MODE' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                        {token.tipo_token === 'SUPERVISOR_MODE' ? 'Supervisor' : 'Uso Único'}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                        {token.permissao === 'DESCONTO' && 'Desc.'}
                                                        {token.permissao === 'CANCELAMENTO' && '❌ Canc.'}
                                                        {token.permissao === 'ALTERACAO_PRECO' && '✏️ Preço'}
                                                        {token.permissao === 'SUPER_CAIXA' && '⭐ Super'}
                                                    </Badge>
                                                    {token.valor_limite && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                                            Até {token.valor_limite}%
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right text-xs">
                                                <div className="flex items-center gap-1 text-gray-500">
                                                    <span>{token.usos_realizados}/{token.max_usos || '∞'} usos</span>
                                                </div>
                                                {token.expira_em && (
                                                    <div className={`flex items-center gap-1 ${expirado ? 'text-red-500' : 'text-gray-500'}`}>
                                                        <Clock className="w-3 h-3" />
                                                        <span>{expirado ? 'Expirado' : new Date(token.expira_em).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {!expirado && !esgotado && token.ativo && (
                                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                                    Ativo
                                                </Badge>
                                            )}
                                            {expirado && <Badge variant="destructive">Expirado</Badge>}
                                            {esgotado && !expirado && <Badge className="bg-gray-200 text-gray-600">Esgotado</Badge>}
                                            {!token.ativo && !expirado && !esgotado && <Badge variant="secondary">Revogado</Badge>}

                                            {ativo && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => revogarToken.mutate(token.id)}
                                                    title="Revogar token"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <Key className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p>Nenhum token criado ainda</p>
                            <p className="text-xs mt-1">Crie um token para autorizar descontos especiais</p>
                        </div>
                    )}
                </CardContent>
                </Card>

                {/* Margem Negociável por Loja */}
                <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Percent className="w-5 h-5 text-green-600" />
                            Margem Negociável por Loja
                        </CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Defina a % máxima de desconto que os vendedores podem aplicar livremente no PDV, sem precisar de token.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {lojasGerenciadas.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <Store className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Nenhuma loja encontrada</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {lojasGerenciadas.map(loja => (
                                    <MargemLojaRow
                                        key={loja.id}
                                        loja={loja}
                                        salvando={!!margemSalvando[loja.id]}
                                        onSave={async (novaMargemPercent) => {
                                            setMargemSalvando(prev => ({ ...prev, [loja.id]: true }));
                                            try {
                                                await base44.entities.Loja.update(loja.id, { margem_negociavel: novaMargemPercent });
                                                queryClient.invalidateQueries({ queryKey: ['lojas-ativas'] });
                                                queryClient.invalidateQueries({ queryKey: ['lojas'] });
                                                toast.success(`Margem negociável de ${loja.nome} atualizada para ${novaMargemPercent}%`);
                                            } catch (err) {
                                                console.error('Erro ao salvar margem:', err);
                                                toast.error('Erro ao salvar margem negociável');
                                            } finally {
                                                setMargemSalvando(prev => ({ ...prev, [loja.id]: false }));
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Solicitações de Cadastro e Aprovação de Preços */}
                <div className={`grid grid-cols-1 ${isGerenteGeral && getSolicitacoesPrecoPendentes.length > 0 ? 'xl:grid-cols-2' : ''} gap-6`}>
                {isGerenteGeral && (
                    <SolicitacoesCadastroWidget />
                )}

                {/* Tabela de Aprovação de Preços */}
                {getSolicitacoesPrecoPendentes.length > 0 && (
                    <Card className="border-orange-200 self-start">
                        <CardHeader className="bg-orange-50 pb-4 border-b border-orange-100">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-orange-800 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Aprovação de Preços ({getSolicitacoesPrecoPendentes.length})
                                </CardTitle>
                            </div>
                            <p className="text-sm text-orange-600">Produtos sem preço aguardando sua autorização</p>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-orange-50/50">
                                        <TableHead>Data</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Sugerido</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {getSolicitacoesPrecoPendentes.map(s => (
                                        <TableRow key={s.id} className="hover:bg-orange-50/30">
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {new Date(s.data_solicitacao).toLocaleString('pt-BR')}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {s.vendedor_nome}
                                                {lojaAtiva === 'todas' && (
                                                    <div className="text-xs text-gray-400">{s.loja}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">{s.produto_nome}</TableCell>
                                            <TableCell className="font-bold text-lg text-green-700 text-right">
                                                R$ {Number(s.preco_sugerido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => responderSolicitacaoPreco.mutate({ id: s.id, status: 'aprovado', precoValido: s.preco_sugerido, produtoId: s.produto_id })}
                                                        disabled={responderSolicitacaoPreco.isPending}
                                                    >
                                                        Aprovar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-amber-600 text-amber-600 hover:bg-amber-50"
                                                        onClick={() => {
                                                            setSelectedPriceRequest(s);
                                                            setNewPrice(Number(s.preco_sugerido).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                                                            setPriceModalOpen(true);
                                                        }}
                                                        disabled={responderSolicitacaoPreco.isPending}
                                                    >
                                                        Editar e Aprovar
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
                </div>
            </div>

            {/* Ações de Vendedores - LOG DE AUDITORIA */}
            <div className="mt-6">
                <AcoesVendedoresWidget />
            </div>

            {/* Modal de Correção de Preço */}
            <Dialog open={priceModalOpen} onOpenChange={setPriceModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tratar Solicitação de Preço</DialogTitle>
                        <DialogDescription>
                            A sugestão de R$ {selectedPriceRequest ? Number(selectedPriceRequest.preco_sugerido).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'} enviada do caixa para o produto <strong>{selectedPriceRequest?.produto_nome}</strong> não será aprovada.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Qual o preço correto deste produto?</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                <Input
                                    type="text"
                                    className="pl-8"
                                    placeholder="0,00"
                                    value={newPrice}
                                    onChange={(e) => {
                                        // Allow only numbers and comma
                                        const val = e.target.value.replace(/[^0-9,]/g, '');
                                        setNewPrice(val);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPriceModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={() => {
                                if (!selectedPriceRequest) return;
                                const precoLimpo = newPrice.replace(/\./g, '').replace(',', '.');
                                const precoCerto = parseFloat(precoLimpo);
                                if (isNaN(precoCerto) || precoCerto <= 0) {
                                    toast.error("Preço inválido inserido.");
                                    return;
                                }
                                responderSolicitacaoPreco.mutate({
                                    id: selectedPriceRequest.id,
                                    status: 'aprovado',
                                    precoValido: precoCerto,
                                    produtoId: selectedPriceRequest.produto_id
                                }, {
                                    onSuccess: () => {
                                        setPriceModalOpen(false);
                                        setSelectedPriceRequest(null);
                                        setNewPrice('');
                                    }
                                });
                            }}
                            disabled={responderSolicitacaoPreco.isPending}
                        >
                            Confirmar Novo Preço e Aprovar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Controle de Montadores Externos - apenas para Gerente Geral/Admin */}
            {
                isGerenteGeral && (
                    <ControleMontadoresWidget />
                )
            }
            {/* Modal de Detalhes do Produto */}
            <ProdutoCadastroCompleto
                isOpen={produtoModalOpen}
                onClose={() => {
                    setProdutoModalOpen(false);
                    setProdutoDetalhe(null);
                }}
                onSave={async (dados) => {
                    try {
                        if (produtoDetalhe?.id) {
                            await base44.entities.Produto.update(produtoDetalhe.id, dados);
                            toast.success('Produto atualizado com sucesso!');
                            queryClient.invalidateQueries(['produtos-gerente']);
                            setProdutoModalOpen(false);
                        }
                    } catch (error) {
                        console.error('Erro ao atualizar produto:', error);
                        toast.error('Erro ao atualizar produto');
                    }
                }}
                produto={produtoDetalhe}
                isLoading={false}
            />

            {/* Modal Detalhes Pendências */}
            <Dialog open={pendenciasModalOpen} onOpenChange={setPendenciasModalOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            Detalhamento de Pendências
                        </DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="entregas" className="flex-1 overflow-hidden flex flex-col">
                        <TabsList className="mb-4">
                            <TabsTrigger value="entregas" className="gap-2">
                                <Truck className="w-4 h-4" />
                                Entregas <Badge variant="secondary" className="ml-1">{pendencias.entregas.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="montagens" className="gap-2">
                                <Wrench className="w-4 h-4" />
                                Montagens <Badge variant="secondary" className="ml-1">{pendencias.montagens.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="pagamentos" className="gap-2">
                                <CreditCard className="w-4 h-4" />
                                Pagamentos <Badge variant="secondary" className="ml-1">{pendencias.pagamentos.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="triagem" className="gap-2">
                                <ClipboardList className="w-4 h-4" />
                                Triagem <Badge variant="secondary" className="ml-1">{pendencias.triagem.length}</Badge>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="entregas" className="flex-1 overflow-auto">
                            {pendencias.entregas.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                    <p>Nenhuma entrega pendente!</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Endereço</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendencias.entregas.map(e => (
                                            <TableRow key={e.id}>
                                                <TableCell>{e.data_agendada ? new Date(e.data_agendada).toLocaleDateString('pt-BR') : 'Sem data'}</TableCell>
                                                <TableCell>{e.cliente_nome}</TableCell>
                                                <TableCell className="max-w-xs truncate" title={e.endereco}>{e.endereco}</TableCell>
                                                <TableCell>
                                                    <Badge variant={e.status === 'Atrasada' ? 'destructive' : 'outline'}>{e.status}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>

                        <TabsContent value="montagens" className="flex-1 overflow-auto">
                            {pendencias.montagens.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                    <p>Nenhuma montagem pendente!</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Montador</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendencias.montagens.map(m => (
                                            <TableRow key={m.id}>
                                                <TableCell>{m.data_agendada ? new Date(m.data_agendada).toLocaleDateString('pt-BR') : 'Sem data'}</TableCell>
                                                <TableCell>{m.cliente_nome}</TableCell>
                                                <TableCell>{m.montador_nome || 'Não atribuído'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={m.status === 'Atrasada' ? 'destructive' : 'outline'}>{m.status}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>

                        <TabsContent value="pagamentos" className="flex-1 overflow-auto">
                            {pendencias.pagamentos.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                    <p>Nenhum pagamento pendente!</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pedido</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Valor Total</TableHead>
                                            <TableHead>Restante</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendencias.pagamentos.map(v => (
                                            <TableRow key={v.id}>
                                                <TableCell className="font-medium">#{v.numero_pedido || v.id}</TableCell>
                                                <TableCell>{v.cliente_nome}</TableCell>
                                                <TableCell>{formatarMoeda(v.valor_total)}</TableCell>
                                                <TableCell className="text-red-600 font-bold">{formatarMoeda(v.valor_restante)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>

                        <TabsContent value="triagem" className="flex-1 overflow-auto">
                            {pendencias.triagem.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                    <p>Nenhuma venda aguardando triagem!</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pedido</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Data Venda</TableHead>
                                            <TableHead>Loja</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendencias.triagem.map(v => (
                                            <TableRow key={v.id}>
                                                <TableCell className="font-medium">#{v.numero_pedido || v.id}</TableCell>
                                                <TableCell>{v.cliente_nome}</TableCell>
                                                <TableCell>{new Date(v.data_venda).toLocaleDateString('pt-BR')}</TableCell>
                                                <TableCell>{v.loja}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>
                    </Tabs>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setPendenciasModalOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
