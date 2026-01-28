import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import SolicitacoesCadastroWidget from "@/components/dashboard/SolicitacoesCadastroWidget";
import ControleMontadoresWidget from "@/components/dashboard/ControleMontadoresWidget";
import ProdutoModal from "@/components/produtos/ProdutoModal";
import { toast } from "sonner";
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
    Sofa,
    Filter
} from "lucide-react";
import {
    AreaChart,
    Area,
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

export default function DashboardGerente() {
    const { user, isGerente, filterData } = useAuth();
    const queryClient = useQueryClient();
    const [periodo, setPeriodo] = useState('mes');
    const [lojaFiltro, setLojaFiltro] = useState('');
    const [metaModalOpen, setMetaModalOpen] = useState(false);
    const [editingMeta, setEditingMeta] = useState(null);
    const [novaMetaValor, setNovaMetaValor] = useState('');
    const [metaVendedorSelecionado, setMetaVendedorSelecionado] = useState(null);

    // Estados para tokens gerenciais (v2 - simplificado)
    const [tokenModalOpen, setTokenModalOpen] = useState(false);
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

    // Estados para dashboard tabs e pesquisa
    const [abaDashboard, setAbaDashboard] = useState('visao-geral');
    const [buscaPedido, setBuscaPedido] = useState('');
    const [buscaEntrega, setBuscaEntrega] = useState('');
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

    // Estados para mostruário
    const [mostruarioModalOpen, setMostruarioModalOpen] = useState(false);
    const [produtoParaMostruario, setProdutoParaMostruario] = useState(null);
    const [mostruarioMotivo, setMostruarioMotivo] = useState('');

    // Estados para solicitar mostruário (nova funcionalidade)
    const [solicitarMostruarioModalOpen, setSolicitarMostruarioModalOpen] = useState(false);
    const [buscaProdutoMostruario, setBuscaProdutoMostruario] = useState('');
    const [produtoSelecionadoMostruario, setProdutoSelecionadoMostruario] = useState(null);
    const [quantidadeMostruario, setQuantidadeMostruario] = useState(1);

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

    const { data: vendas = [], isLoading: loadingVendas, refetch: refetchVendas } = useQuery({
        queryKey: ['vendas-gerente'],
        queryFn: () => base44.entities.Venda.list('-data_venda'),
        enabled: !!user
    });

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

    // Query para pedidos de mostruário
    const { data: pedidosMostruario = [], refetch: refetchMostruario } = useQuery({
        queryKey: ['pedidos-mostruario'],
        queryFn: () => base44.entities.PedidoMostruario.list('-created_at'),
        enabled: !!user
    });

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

    // Mutation para marcar produto como mostruário
    const marcarMostruario = useMutation({
        mutationFn: async ({ produtoId, isMostruario, loja, motivo }) => {
            await base44.entities.Produto.update(produtoId, {
                is_mostruario: isMostruario,
                mostruario_loja: isMostruario ? loja : null,
                mostruario_data: isMostruario ? new Date().toISOString() : null
            });
            // Registrar movimentação
            if (isMostruario) {
                await base44.entities.MostruarioMovimentacao.create({
                    produto_id: produtoId,
                    produto_nome: produtoParaMostruario?.nome || '',
                    loja: loja,
                    tipo: 'entrada',
                    quantidade: 1,
                    motivo: motivo || 'Marcar como mostruário',
                    usuario_id: user?.id,
                    usuario_nome: user?.full_name
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['produtos-gerente']);
            queryClient.invalidateQueries(['pedidos-mostruario']);
            setMostruarioModalOpen(false);
            setProdutoParaMostruario(null);
            setMostruarioMotivo('');
        }
    });

    // Mutation para criar pedido de mostruário (solicitação para montagem interna)
    const criarPedidoMostruario = useMutation({
        mutationFn: async (pedido) => {
            return base44.entities.PedidoMostruario.create(pedido);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['pedidos-mostruario']);
            queryClient.invalidateQueries(['pedidos-mostruario-montagem']);
            setSolicitarMostruarioModalOpen(false);
            setBuscaProdutoMostruario('');
            setProdutoSelecionadoMostruario(null);
            setQuantidadeMostruario(1);
            toast.success('🔧 Montagem solicitada!', {
                description: 'O pedido foi enviado para os montadores internos.'
            });
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

    // lojaAtiva moved earlier in the file (before handleCriarToken and tokensFiltrados)

    // Filtrar vendas por período e loja
    const vendasFiltradas = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return vendas.filter(v => {
            // Filtro de status
            if (v.status === 'Cancelada') return false;

            // Filtro de loja
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;

            // Filtro de período
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            d.setHours(0, 0, 0, 0);

            switch (periodo) {
                case 'hoje':
                    return d.getTime() === hoje.getTime();
                case 'semana':
                    const inicioSemana = new Date(hoje);
                    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
                    return d >= inicioSemana;
                case 'mes':
                    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
                default:
                    return true;
            }
        });
    }, [vendas, periodo, lojaAtiva]);

    // Vendas de hoje específicas
    const vendasHoje = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return vendas.filter(v => {
            if (v.status === 'Cancelada') return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === hoje.getTime();
        });
    }, [vendas, lojaAtiva]);

    // Vendas deste mês
    const vendasMes = useMemo(() => {
        const hoje = new Date();
        return vendas.filter(v => {
            if (v.status === 'Cancelada') return false;
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

        // Totais
        const totalHoje = vendasHoje.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        const qtdHoje = vendasHoje.length;

        const totalMes = vendasMes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
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
            if (v.status === 'Cancelada') return false;
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
            if (v.status === 'Cancelada') return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            return d >= mesAnoPassado && d <= fimMesAnoPassado;
        });

        const totalAnoPassado = vendasAnoPassado.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        const variacao = totalAnoPassado > 0
            ? ((kpis.totalMes - totalAnoPassado) / totalAnoPassado) * 100
            : 0;

        return { totalAnoPassado, variacao };
    }, [vendas, lojaAtiva, kpis.totalMes]);

    // Comparativo MoM (Month over Month)
    const comparativoMoM = useMemo(() => {
        const hoje = new Date();
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

        const vendasMesAnterior = vendas.filter(v => {
            if (v.status === 'Cancelada') return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            if (!v.data_venda) return false;
            const d = new Date(v.data_venda);
            return d >= mesAnterior && d <= fimMesAnterior;
        });

        const totalMesAnterior = vendasMesAnterior.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        const variacao = totalMesAnterior > 0
            ? ((kpis.totalMes - totalMesAnterior) / totalMesAnterior) * 100
            : 0;

        return { totalMesAnterior, variacao };
    }, [vendas, lojaAtiva, kpis.totalMes]);

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
            agrupado[vendedorNome].comissao += v.comissao_calculada || 0;
            agrupado[vendedorNome].vendas += 1;
            agrupado[vendedorNome].total += v.valor_total || 0;
        });


        return Object.values(agrupado)
            .filter(v => v.comissao > 0)
            .sort((a, b) => b.comissao - a.comissao);
    }, [vendasMes]);

    const totalComissoes = comissoesPorVendedor.reduce((sum, v) => sum + v.comissao, 0);

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
            if (v.status === 'Cancelada') return;
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

                // Calcular valor em estoque
                const valorEstoque = (p.quantidade_estoque || 0) * (p.preco_venda || p.preco_custo || 0);

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

        // Produtos de mostruário
        const mostruarios = produtos.filter(p =>
            p.is_mostruario &&
            p.ativo &&
            (lojaAtiva === 'todas' || p.mostruario_loja === lojaAtiva)
        );

        return {
            encalhados: encalhados.slice(0, 10),
            totalEncalhados: encalhados.length,
            totalValorEncalhado,
            produtosCriticos: produtosC.length, // Produtos C encalhados (alta prioridade)
            mostruarios,
            totalMostruarios: mostruarios.length
        };
    }, [vendas, produtos, lojaAtiva, giroFiltro, curvaABC.produtos]);

    // Status de entregas
    const statusEntregas = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const entregasFiltradas = entregas.filter(e => {
            if (lojaAtiva === 'todas') return true;
            const vendaAssociada = vendas.find(v => v.id === e.venda_id);
            return vendaAssociada?.loja === lojaAtiva;
        });

        const pendentes = entregasFiltradas.filter(e => e.status === 'Pendente' || e.status === 'Agendada');
        const emRota = entregasFiltradas.filter(e => e.status === 'Em Rota' || e.status === 'Em Transito');
        const atrasadas = entregasFiltradas.filter(e => {
            if (e.status === 'Entregue' || e.status === 'Cancelada') return false;
            const dataAgendada = e.data_agendada ? new Date(e.data_agendada) : null;
            if (!dataAgendada) return false;
            dataAgendada.setHours(0, 0, 0, 0);
            return dataAgendada < hoje;
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
            return !['Entregue', 'Cancelada'].includes(e.status);
        });

        // Montagens pendentes
        const montagensPendentes = montagens.filter(m => {
            if (lojaAtiva !== 'todas') {
                const vendaAssociada = vendas.find(v => v.id === m.venda_id);
                if (vendaAssociada?.loja !== lojaAtiva) return false;
            }
            return m.status !== 'Concluída' && m.status !== 'Cancelada';
        });

        // Pagamentos em aberto
        const pagamentosAbertos = vendas.filter(v => {
            if (v.status === 'Cancelada') return false;
            if (lojaAtiva !== 'todas' && v.loja !== lojaAtiva) return false;
            return (v.valor_restante || 0) > 0;
        });

        // Triagem pendente
        const triagemPendente = vendas.filter(v => {
            if (v.status === 'Cancelada') return false;
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
            if (v.status === 'Cancelada') return false;
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

        return todasEntregas.filter(e => {
            const vendaAssociada = vendas.find(v => v.id === e.venda_id);
            const cliente = (vendaAssociada?.cliente_nome || e.cliente_nome || '').toLowerCase();
            const endereco = (e.endereco || '').toLowerCase();
            const numeroPedido = (vendaAssociada?.numero_pedido || e.venda_id || '').toString().toLowerCase();

            return cliente.includes(termo) ||
                endereco.includes(termo) ||
                numeroPedido.includes(termo);
        });
    }, [statusEntregas, buscaEntrega, vendas]);

    // Ranking de vendedores
    const rankingVendedores = useMemo(() => {
        const agrupado = {};
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

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
                agrupado[vendedorNome] = {
                    nome: vendedorNome,
                    id: vendedorId,
                    total: 0,
                    qtd: 0
                };
            }
            agrupado[vendedorNome].total += v.valor_total || 0;
            agrupado[vendedorNome].qtd++;
        });

        // Adicionar metas individuais
        return Object.values(agrupado)
            .map(vendedor => {
                const metaVendedor = metas.find(m =>
                    m.mes === mesAtual &&
                    m.vendedor_id === vendedor.id
                );
                return {
                    ...vendedor,
                    meta: metaVendedor?.meta_valor || 0,
                    progresso: metaVendedor?.meta_valor > 0
                        ? (vendedor.total / metaVendedor.meta_valor) * 100
                        : 0
                };
            })
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [vendasMes, metas]);

    // Dados para gráfico de evolução diária
    const dadosGrafico = useMemo(() => {
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const agrupado = {};

        // Inicializar todos os dias do mês
        for (let d = new Date(primeiroDia); d <= hoje; d.setDate(d.getDate() + 1)) {
            const dia = d.toISOString().split('T')[0];
            agrupado[dia] = { dia, total: 0, acumulado: 0 };
        }

        // Preencher com vendas
        vendasMes.forEach(v => {
            const dia = v.data_venda?.split('T')[0];
            if (dia && agrupado[dia]) {
                agrupado[dia].total += v.valor_total || 0;
            }
        });

        // Calcular acumulado
        let acumulado = 0;
        return Object.values(agrupado).map(d => {
            acumulado += d.total;
            return {
                ...d,
                acumulado,
                diaFormatado: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            };
        });
    }, [vendasMes]);

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
            meta_valor: parseFloat(novaMetaValor) || 0
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

            {/* Tabs de Navegação do Dashboard - Estilo "Caixinha" Centralizado */}
            <div className="mt-8 mb-6 flex justify-center">
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
                                Pesquisar Pedido
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
                                                                            {entrega.endereco || 'Endereço não informado'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right text-sm pl-4 border-l border-gray-100 ml-4">
                                                                    <p className="font-medium text-gray-900">
                                                                        {entrega.data_agendada ? new Date(entrega.data_agendada).toLocaleDateString('pt-BR') : '-'}
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
                                                const vendedor = rankingVendedores.find(v => v.id === value);
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
                                                {rankingVendedores.map(vendedor => (
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
                                            type="number"
                                            value={novaMetaValor}
                                            onChange={(e) => setNovaMetaValor(e.target.value)}
                                            placeholder="Ex: 150000"
                                            className="mt-1"
                                        />
                                        {novaMetaValor && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Meta diária: {formatarMoeda(parseFloat(novaMetaValor) / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())}
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
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Área do Gráfico */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-gray-500 mb-4">Evolução de Vendas Diária</h3>
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
                                                labelFormatter={(label) => `Dia: ${label}`}
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

                            {/* Área de Métricas (Sidebar) */}
                            <div className="lg:w-1/4 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-800 pt-6 lg:pt-0 lg:pl-6">
                                <h3 className="text-sm font-medium text-gray-500 mb-2">Comparativos</h3>

                                <div className="space-y-4">
                                    {/* YoY */}
                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-gray-500 uppercase">YoY (Ano Anterior)</span>
                                            <Badge variant="outline" className="text-[10px] font-normal">Jan/{new Date().getFullYear() - 1}</Badge>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    {comparativoYoY.variacao >= 0 ? '+' : ''}{Math.abs(comparativoYoY.variacao).toFixed(1)}%
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">vs {formatarMoeda(comparativoYoY.totalAnoPassado)}</p>
                                            </div>
                                            <div className={`p-2 rounded-lg ${comparativoYoY.variacao >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                {comparativoYoY.variacao >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* MoM */}
                                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-gray-500 uppercase">MoM (Mês Anterior)</span>
                                            <Badge variant="outline" className="text-[10px] font-normal">Mês Anterior</Badge>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    {comparativoMoM.variacao >= 0 ? '+' : ''}{Math.abs(comparativoMoM.variacao).toFixed(1)}%
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">vs {formatarMoeda(comparativoMoM.totalMesAnterior)}</p>
                                            </div>
                                            <div className={`p-2 rounded-lg ${comparativoMoM.variacao >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                {comparativoMoM.variacao >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Projeção / Meta Diária */}
                                    <div className="pt-4 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                        <p className="text-xs text-gray-500 mb-1">Meta Diária Necessária</p>
                                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                            {formatarMoeda(metaDiaria)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Seção 2: Comissões e Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Comissões a Pagar */}
                <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                            Comissões a Pagar
                            <Badge className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                {formatarMoeda(totalComissoes)}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {comissoesPorVendedor.length > 0 ? (
                            <div className="space-y-3 max-h-[250px] overflow-y-auto">
                                {comissoesPorVendedor.map((v, i) => (
                                    <div key={v.id || v.nome} className="flex items-center justify-between p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-sm font-bold text-amber-700">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{v.nome}</p>
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

                {/* Ranking de Vendedores */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Award className="w-5 h-5 text-yellow-500" />
                            Top Vendedores
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10">#</TableHead>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rankingVendedores.length > 0 ? rankingVendedores.map((v, i) => (
                                    <TableRow key={v.nome}>
                                        <TableCell className="font-medium">
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium text-sm">{v.nome}</p>
                                                <p className="text-xs text-gray-500">{v.qtd} vendas</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <p className="font-bold text-green-600 text-sm">{formatarMoeda(v.total)}</p>
                                            {v.meta > 0 && (
                                                <p className="text-xs text-gray-500">{v.progresso.toFixed(0)}% meta</p>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                                            Nenhuma venda no período
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Seção 3: Estoque e Logística */}
            <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-blue-600" />
                    Estoque e Logística
                </h2>

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
                                            <p className="text-[10px] text-gray-500">💰 Valor parado</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-center">
                                            <p className="text-lg font-bold text-red-600">{giroEstoque.produtosCriticos}</p>
                                            <p className="text-[10px] text-gray-500">🔴 Classe C (liquidar)</p>
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
                                                💡 <strong>Sugestão:</strong> {giroEstoque.produtosCriticos} produto(s) Classe C parado(s) há mais de {giroFiltro} dias. Considere promoção ou transferência para mostruário.
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
                                                            {p.diasSemVenda === 999 ? '⚠️ Nunca vendido' : `${p.diasSemVenda} dias sem venda`}
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
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        setProdutoParaMostruario(p);
                                                        setMostruarioModalOpen(true);
                                                    }}
                                                    title="Transferir para Mostruário"
                                                >
                                                    <Sofa className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                    <p className="text-sm font-medium">Estoque saudável! 🎉</p>
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
                                    <p className="text-xs text-red-600 font-medium mb-1">⚠️ Entregas atrasadas requerem atenção!</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Mostruário */}
                    <Card className="border-indigo-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Sofa className="w-5 h-5 text-indigo-600" />
                                Peças de Mostruário
                                <div className="ml-auto flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                        onClick={() => setSolicitarMostruarioModalOpen(true)}
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Solicitar Montagem
                                    </Button>
                                    <Badge className="bg-indigo-100 text-indigo-700">
                                        {giroEstoque.totalMostruarios} peças
                                    </Badge>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Pedidos de mostruário pendentes de montagem */}
                            {pedidosMostruario.filter(p => p.status === 'Pendente' || p.status === 'Em Montagem').length > 0 && (
                                <div className="mb-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                                    <p className="text-xs font-medium text-amber-700 mb-2">⏳ Aguardando montagem:</p>
                                    <div className="space-y-1">
                                        {pedidosMostruario.filter(p => p.status === 'Pendente' || p.status === 'Em Montagem').slice(0, 3).map(p => (
                                            <div key={p.id} className="flex items-center justify-between text-xs">
                                                <span className="text-gray-700 dark:text-gray-300 truncate">{p.produto_nome}</span>
                                                <Badge className={
                                                    p.status === 'Em Montagem'
                                                        ? 'bg-blue-100 text-blue-700 text-[10px]'
                                                        : 'bg-yellow-100 text-yellow-700 text-[10px]'
                                                }>
                                                    {p.status === 'Em Montagem' ? '🔧 Montando' : '⏳ Pendente'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {giroEstoque.mostruarios.length > 0 ? (
                                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                                    {giroEstoque.mostruarios.slice(0, 5).map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm truncate block font-medium">{p.nome}</span>
                                                <span className="text-[10px] text-gray-500">
                                                    {p.mostruario_loja} • {p.mostruario_data ? new Date(p.mostruario_data).toLocaleDateString('pt-BR') : ''}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-red-500 hover:text-red-700"
                                                onClick={() => {
                                                    marcarMostruario.mutate({
                                                        produtoId: p.id,
                                                        isMostruario: false,
                                                        loja: lojaAtiva,
                                                        motivo: 'Removido do mostruário'
                                                    });
                                                }}
                                            >
                                                Remover
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    <Sofa className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Nenhuma peça de mostruário</p>
                                    <p className="text-xs text-gray-400 mt-1">Adicione produtos encalhados ao mostruário</p>
                                </div>
                            )}

                            {/* Potencial Mostruário */}
                            <div className="mt-3 p-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Potencial (estoque = 1):</span>
                                    <span className="font-bold text-indigo-600">
                                        {produtos.filter(p => p.ativo && p.quantidade_estoque === 1 && !p.is_mostruario).length} itens
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Cards de Pendências Detalhadas */}
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
                                                    <SelectItem value="DESCONTO">💰 Desconto</SelectItem>
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
                    </div>

                    {tokensFiltrados.length > 0 ? (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {tokensFiltrados.map(token => {
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
                                                        {token.permissao === 'DESCONTO' && '💰 Desc.'}
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

            {/* Solicitações de Cadastro de Produto (PDV) - apenas para Gerente Geral/Admin */}
            {isGerenteGeral && (
                <SolicitacoesCadastroWidget />
            )}

            {/* Controle de Montadores Externos - apenas para Gerente Geral/Admin */}
            {isGerenteGeral && (
                <ControleMontadoresWidget />
            )}


            {/* Modal para Marcar Mostruário */}
            <Dialog open={mostruarioModalOpen} onOpenChange={setMostruarioModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sofa className="w-5 h-5 text-indigo-600" />
                            Marcar como Mostruário
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {produtoParaMostruario && (
                            <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
                                <p className="font-medium">{produtoParaMostruario.nome}</p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                    <span>Estoque: {produtoParaMostruario.quantidade_estoque} un</span>
                                    <span>Valor: {formatarMoeda(produtoParaMostruario.valorEstoque)}</span>
                                </div>
                                <p className="text-xs text-orange-600 mt-2">
                                    {produtoParaMostruario.diasSemVenda === 999
                                        ? 'Nunca vendido'
                                        : `Sem venda há ${produtoParaMostruario.diasSemVenda} dias`}
                                </p>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="mostruario-motivo">Motivo (opcional)</Label>
                            <Input
                                id="mostruario-motivo"
                                value={mostruarioMotivo}
                                onChange={(e) => setMostruarioMotivo(e.target.value)}
                                placeholder="Ex: Peça de demonstração"
                                className="mt-1"
                            />
                        </div>
                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            <p>✓ Será marcado como mostruário na loja: <strong>{lojaAtiva === 'todas' ? lojas[0] : lojaAtiva}</strong></p>
                            <p>✓ A movimentação será registrada no histórico</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setMostruarioModalOpen(false);
                            setProdutoParaMostruario(null);
                            setMostruarioMotivo('');
                        }}>Cancelar</Button>
                        <Button
                            onClick={() => {
                                marcarMostruario.mutate({
                                    produtoId: produtoParaMostruario.id,
                                    isMostruario: true,
                                    loja: lojaAtiva === 'todas' ? lojas[0] : lojaAtiva,
                                    motivo: mostruarioMotivo || 'Marcado como mostruário'
                                });
                            }}
                            disabled={marcarMostruario.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {marcarMostruario.isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
                            ) : (
                                <><Sofa className="w-4 h-4 mr-2" /> Marcar como Mostruário</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal para Solicitar Montagem de Mostruário */}
            <Dialog open={solicitarMostruarioModalOpen} onOpenChange={setSolicitarMostruarioModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sofa className="w-5 h-5 text-indigo-600" />
                            Solicitar Montagem de Mostruário
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Buscar Produto</Label>
                            <Input
                                value={buscaProdutoMostruario}
                                onChange={(e) => setBuscaProdutoMostruario(e.target.value)}
                                placeholder="Digite o nome do produto..."
                                className="mt-1"
                            />
                        </div>

                        {/* Lista de produtos cadastrados */}
                        <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                            {produtos
                                .filter(p =>
                                    p.ativo &&
                                    (buscaProdutoMostruario === '' ||
                                        p.nome?.toLowerCase().includes(buscaProdutoMostruario.toLowerCase()))
                                )
                                .slice(0, 20)
                                .map(p => (
                                    <div
                                        key={p.id}
                                        className={`p-3 border-b cursor-pointer transition-colors ${produtoSelecionadoMostruario?.id === p.id
                                            ? 'bg-indigo-100 dark:bg-indigo-900/30'
                                            : 'hover:bg-gray-50 dark:hover:bg-neutral-800'
                                            }`}
                                        onClick={() => setProdutoSelecionadoMostruario(p)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-sm">{p.nome}</p>
                                                <p className="text-xs text-gray-500">
                                                    Estoque: {p.quantidade_estoque || 0} • {formatarMoeda(p.preco_venda || 0)}
                                                </p>
                                            </div>
                                            {produtoSelecionadoMostruario?.id === p.id && (
                                                <Check className="w-5 h-5 text-indigo-600" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            {produtos.filter(p =>
                                p.ativo &&
                                (buscaProdutoMostruario === '' ||
                                    p.nome?.toLowerCase().includes(buscaProdutoMostruario.toLowerCase()))
                            ).length === 0 && (
                                    <div className="p-6 text-center text-gray-500">
                                        <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">Nenhum produto encontrado</p>
                                    </div>
                                )}
                        </div>

                        {/* Produto selecionado */}
                        {produtoSelecionadoMostruario && (
                            <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200">
                                <p className="font-medium text-indigo-900 dark:text-indigo-100">
                                    Selecionado: {produtoSelecionadoMostruario.nome}
                                </p>
                                <div className="flex items-center gap-4 mt-2">
                                    <Label className="text-sm">Quantidade:</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantidadeMostruario}
                                        onChange={(e) => setQuantidadeMostruario(parseInt(e.target.value) || 1)}
                                        className="w-20 h-8"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="text-xs text-gray-500 bg-gray-50 dark:bg-neutral-900 p-2 rounded">
                            <p>📋 A solicitação será enviada para <strong>Montagens Internas</strong></p>
                            <p>🔧 Os montadores poderão ver e executar a montagem</p>
                            <p>📍 Loja: <strong>{lojaAtiva === 'todas' ? lojas[0] || 'Principal' : lojaAtiva}</strong></p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setSolicitarMostruarioModalOpen(false);
                            setBuscaProdutoMostruario('');
                            setProdutoSelecionadoMostruario(null);
                            setQuantidadeMostruario(1);
                        }}>Cancelar</Button>
                        <Button
                            onClick={() => {
                                if (!produtoSelecionadoMostruario) return;
                                criarPedidoMostruario.mutate({
                                    produto_id: produtoSelecionadoMostruario.id,
                                    produto_nome: produtoSelecionadoMostruario.nome,
                                    quantidade: quantidadeMostruario,
                                    loja: lojaAtiva === 'todas' ? lojas[0] || 'Principal' : lojaAtiva,
                                    status: 'Pendente',
                                    solicitante_id: user?.id,
                                    solicitante_nome: user?.full_name,
                                    observacoes: `Solicitado para mostruário por ${user?.full_name}`
                                });
                            }}
                            disabled={!produtoSelecionadoMostruario || criarPedidoMostruario.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {criarPedidoMostruario.isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Solicitando...</>
                            ) : (
                                <><Package className="w-4 h-4 mr-2" /> Solicitar Montagem</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Modal de Detalhes do Produto */}
            <ProdutoModal
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
