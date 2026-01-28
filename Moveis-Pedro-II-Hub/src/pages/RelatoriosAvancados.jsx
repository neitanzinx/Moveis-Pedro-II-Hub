import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from "recharts";
import {
  FileDown, TrendingUp, TrendingDown, Users, Package, DollarSign, Calendar,
  Filter, BarChart3, PieChartIcon, ArrowUpRight, ArrowDownRight, Target,
  CreditCard, Wallet, ShoppingCart, Store, RefreshCw, Download, Printer,
  Star, Copy, Link, AlertTriangle, CheckCircle, ThumbsUp, ThumbsDown, Loader2,
  Megaphone, Tag, UserPlus, Repeat, PercentIcon, Share2,
  Trophy, MapPin, LayoutDashboard, FileText, Meh, Award
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import KPICard from "@/components/dashboard/KPICard";
import ProdutoModal from "@/components/produtos/ProdutoModal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];
const GRADIENT_COLORS = {
  green: ['#10b981', '#059669'],
  blue: ['#3b82f6', '#2563eb'],
  purple: ['#8b5cf6', '#7c3aed'],
  orange: ['#f59e0b', '#d97706'],
  red: ['#ef4444', '#dc2626'],
  pink: ['#ec4899', '#db2777']
};

// Custom Tooltip para gráficos
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-neutral-700">
        <p className="font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.name.includes('R$') || entry.name === 'Valor'
              ? `R$ ${Number(entry.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Componente de KPI Card moderno
function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'green', delay = 0 }) {
  const colorStyles = {
    green: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    pink: 'from-pink-500 to-pink-600'
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className={`absolute inset-0 bg-gradient-to-br ${colorStyles[color]} opacity-0 group-hover:opacity-5 transition-opacity`} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>{Math.abs(trend).toFixed(1)}% {trendValue}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorStyles[color]} text-white shadow-lg`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de Mini Card para rankings
function RankingCard({ position, name, value, percentage, color }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow
        ${position === 1 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
          position === 2 ? 'bg-gray-100 text-gray-700 border border-gray-200' :
            position === 3 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
              'bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-300'
        }`}>
        {position <= 3 ? <Trophy className="w-4 h-4" /> : position}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-sm text-gray-500">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="text-right">
        <div className="w-16 h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(0)}%</p>
      </div>
    </div>
  );
}

export default function RelatoriosAvancados() {
  const { user, loading: authLoading, can } = useAuth();
  const [filtros, setFiltros] = useState({
    dataInicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    loja: "todas",
    vendedor: "todos",
    status: "todos"
  });
  const [activeTab, setActiveTab] = useState("visao-geral");

  // Queries
  const { data: vendas = [], isLoading: loadingVendas, refetch: refetchVendas } = useQuery({
    queryKey: ['vendas-relatorios'],
    queryFn: () => base44.entities.Venda.list('-data_venda'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-relatorios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-relatorios'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-relatorios'],
    queryFn: () => base44.entities.Entrega.list(),
  });

  const { data: lancamentos = [] } = useQuery({
    queryKey: ['lancamentos-relatorios'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list('-data_lancamento'),
  });

  // Queries de Marketing
  const { data: campanhas = [], refetch: refetchCampanhas } = useQuery({
    queryKey: ['campanhas-relatorios'],
    queryFn: () => base44.entities.Campanha.list('-data_inicio'),
  });

  const { data: cupons = [] } = useQuery({
    queryKey: ['cupons-relatorios'],
    queryFn: () => base44.entities.Cupom.list('-created_at'),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-relatorios'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const { data: npsAvaliacoes = [], refetch: refetchNPS } = useQuery({
    queryKey: ['nps-avaliacoes'],
    queryFn: () => base44.entities.NPSAvaliacao.list('-created_at'),
  });

  const { data: npsLinks = [] } = useQuery({
    queryKey: ['nps-links'],
    queryFn: () => base44.entities.NPSLink.list('-created_at'),
  });

  // Estados para detalhes do produto (Curva ABC)
  const [produtoModalOpen, setProdutoModalOpen] = useState(false);
  const [produtoDetalhe, setProdutoDetalhe] = useState(null);

  // Filtrar vendas (moved to useMemo to maintain hooks order)
  const vendasFiltradas = useMemo(() => {
    return vendas.filter(v => {
      const dataVenda = new Date(v.data_venda);
      const dataInicio = new Date(filtros.dataInicio);
      const dataFim = new Date(filtros.dataFim);
      dataFim.setHours(23, 59, 59);

      let vendedorNome = v.responsavel_nome || v.vendedor_nome || 'Não informado';
      if (v.responsavel_id) {
        const u = users.find(user => user.id === v.responsavel_id);
        if (u && u.full_name) vendedorNome = u.full_name;
      }

      return (
        dataVenda >= dataInicio &&
        dataVenda <= dataFim &&
        (filtros.loja === "todas" || v.loja === filtros.loja) &&
        (filtros.vendedor === "todos" || vendedorNome === filtros.vendedor) &&
        (filtros.status === "todos" || v.status === filtros.status)
      );
    });
  }, [vendas, filtros, users]);

  // Dados para gráficos (all useMemo hooks MUST be before any conditional returns)
  const vendasPorDia = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      const data = new Date(v.data_venda).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!map[data]) map[data] = { data, quantidade: 0, valor: 0 };
      map[data].quantidade++;
      map[data].valor += v.valor_total || 0;
    });
    return Object.values(map).sort((a, b) => {
      const [diaA, mesA] = a.data.split('/');
      const [diaB, mesB] = b.data.split('/');
      return new Date(2024, mesA - 1, diaA) - new Date(2024, mesB - 1, diaB);
    });
  }, [vendasFiltradas]);

  const vendasPorVendedor = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      let vendedor = v.responsavel_nome || v.vendedor_nome || 'Não informado';
      if (v.responsavel_id) {
        const u = users.find(user => user.id === v.responsavel_id);
        if (u && u.full_name) vendedor = u.full_name;
      }

      if (!map[vendedor]) map[vendedor] = { vendedor, quantidade: 0, valor: 0 };
      map[vendedor].quantidade++;
      map[vendedor].valor += v.valor_total || 0;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [vendasFiltradas, users]);

  const vendasPorLoja = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      const loja = v.loja || 'Não informada';
      if (!map[loja]) map[loja] = { loja, quantidade: 0, valor: 0 };
      map[loja].quantidade++;
      map[loja].valor += v.valor_total || 0;
    });
    return Object.values(map);
  }, [vendasFiltradas]);

  const produtosMaisVendidos = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      v.itens?.forEach(item => {
        if (!map[item.produto_id]) {
          map[item.produto_id] = { nome: item.produto_nome, quantidade: 0, valor: 0 };
        }
        map[item.produto_id].quantidade += item.quantidade;
        map[item.produto_id].valor += item.subtotal || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [vendasFiltradas]);

  const formasPagamento = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      v.pagamentos?.forEach(pag => {
        const forma = pag.forma_pagamento || 'Outros';
        if (!map[forma]) map[forma] = { forma, valor: 0, quantidade: 0 };
        map[forma].valor += pag.valor;
        map[forma].quantidade++;
      });
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [vendasFiltradas]);

  const vendasPorStatus = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      const status = v.status || 'Indefinido';
      if (!map[status]) map[status] = { status, quantidade: 0, valor: 0 };
      map[status].quantidade++;
      map[status].valor += v.valor_total || 0;
    });
    return Object.values(map);
  }, [vendasFiltradas]);

  // === MÉTRICAS DE MARKETING ===

  // Vendas por Canal
  const vendasPorCanal = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      const canal = v.canal_venda || 'Loja Física';
      if (!map[canal]) map[canal] = { canal, quantidade: 0, valor: 0 };
      map[canal].quantidade++;
      map[canal].valor += v.valor_total || 0;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }, [vendasFiltradas]);

  // Performance de Cupons
  const performanceCupons = useMemo(() => {
    const map = {};
    vendasFiltradas.forEach(v => {
      if (v.cupom_codigo) {
        if (!map[v.cupom_codigo]) {
          map[v.cupom_codigo] = {
            codigo: v.cupom_codigo,
            usos: 0,
            desconto_total: 0,
            valor_vendas: 0
          };
        }
        map[v.cupom_codigo].usos++;
        map[v.cupom_codigo].desconto_total += v.cupom_desconto || 0;
        map[v.cupom_codigo].valor_vendas += v.valor_total || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.usos - a.usos);
  }, [vendasFiltradas]);

  // Métricas gerais de cupons
  const metricsCupons = useMemo(() => {
    const vendasComCupom = vendasFiltradas.filter(v => v.cupom_codigo);
    const vendasSemCupom = vendasFiltradas.filter(v => !v.cupom_codigo);
    const totalDescontos = vendasFiltradas.reduce((sum, v) => sum + (v.cupom_desconto || 0), 0);

    return {
      vendasComCupom: vendasComCupom.length,
      vendasSemCupom: vendasSemCupom.length,
      taxaConversao: vendasFiltradas.length > 0
        ? (vendasComCupom.length / vendasFiltradas.length * 100)
        : 0,
      totalDescontos,
      ticketMedioCupom: vendasComCupom.length > 0
        ? vendasComCupom.reduce((sum, v) => sum + (v.valor_total || 0), 0) / vendasComCupom.length
        : 0,
      ticketMedioSemCupom: vendasSemCupom.length > 0
        ? vendasSemCupom.reduce((sum, v) => sum + (v.valor_total || 0), 0) / vendasSemCupom.length
        : 0
    };
  }, [vendasFiltradas]);

  // ROI de Campanhas
  const roiCampanhas = useMemo(() => {
    return campanhas.map(c => {
      const vendasCampanha = vendasFiltradas.filter(v => v.campanha_id === c.id);
      const receita = vendasCampanha.reduce((sum, v) => sum + (v.valor_total || 0), 0);
      const investimento = c.investimento || 0;
      const roi = investimento > 0 ? ((receita - investimento) / investimento) * 100 : 0;
      const roas = investimento > 0 ? receita / investimento : 0;

      return {
        ...c,
        vendasCount: vendasCampanha.length,
        receita,
        roi,
        roas
      };
    }).sort((a, b) => b.receita - a.receita);
  }, [campanhas, vendasFiltradas]);

  // Métricas gerais de campanhas
  const metricsCampanhas = useMemo(() => {
    const totalInvestimento = campanhas.reduce((sum, c) => sum + (c.investimento || 0), 0);
    const totalReceita = roiCampanhas.reduce((sum, c) => sum + c.receita, 0);
    const totalVendas = roiCampanhas.reduce((sum, c) => sum + c.vendasCount, 0);

    return {
      totalInvestimento,
      totalReceita,
      totalVendas,
      roiGeral: totalInvestimento > 0 ? ((totalReceita - totalInvestimento) / totalInvestimento) * 100 : 0,
      roasGeral: totalInvestimento > 0 ? totalReceita / totalInvestimento : 0,
      cac: totalVendas > 0 ? totalInvestimento / totalVendas : 0
    };
  }, [campanhas, roiCampanhas]);

  // Métricas de Aquisição de Clientes
  const metricsAquisicao = useMemo(() => {
    const clientesUnicos = new Set(vendasFiltradas.map(v => v.cliente_id)).size;
    const vendasPorCliente = {};

    vendasFiltradas.forEach(v => {
      if (!vendasPorCliente[v.cliente_id]) {
        vendasPorCliente[v.cliente_id] = { count: 0, valor: 0 };
      }
      vendasPorCliente[v.cliente_id].count++;
      vendasPorCliente[v.cliente_id].valor += v.valor_total || 0;
    });

    const clientesRecompra = Object.values(vendasPorCliente).filter(c => c.count > 1).length;
    const taxaRecompra = clientesUnicos > 0 ? (clientesRecompra / clientesUnicos) * 100 : 0;
    const ltvMedio = clientesUnicos > 0
      ? Object.values(vendasPorCliente).reduce((sum, c) => sum + c.valor, 0) / clientesUnicos
      : 0;

    return {
      clientesUnicos,
      clientesRecompra,
      taxaRecompra,
      ltvMedio,
      frequenciaMedia: clientesUnicos > 0 ? vendasFiltradas.length / clientesUnicos : 0
    };
  }, [vendasFiltradas]);

  // ============ D.R.E. CALCULATIONS ============
  const dreData = useMemo(() => {
    // Create products map for cost lookup
    const produtosMap = {};
    produtos.forEach(p => {
      produtosMap[p.id] = p;
    });

    // Receita Bruta (total sales)
    const receitaBruta = vendasFiltradas.reduce((sum, v) => sum + (v.valor_total || 0), 0);

    // Deduções (discounts + cancelled sales)
    const descontos = vendasFiltradas.reduce((sum, v) => sum + (v.desconto || 0) + (v.cupom_desconto || 0), 0);
    const vendasCanceladas = vendasFiltradas
      .filter(v => v.status === 'Cancelada' || v.status === 'Cancelado')
      .reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const deducoes = descontos + vendasCanceladas;

    // Receita Líquida
    const receitaLiquida = receitaBruta - deducoes;

    // CMV (Cost of Goods Sold) - calculate from product costs in items
    let cmv = 0;
    vendasFiltradas.forEach(v => {
      if (v.status !== 'Cancelada' && v.status !== 'Cancelado') {
        v.itens?.forEach(item => {
          const produto = produtosMap[item.produto_id];
          const custoProduto = produto?.preco_custo || (item.preco_unitario * 0.6); // Fallback: 60% do preço venda
          cmv += custoProduto * (item.quantidade || 1);
        });
      }
    });

    // Lucro Bruto
    const lucroBruto = receitaLiquida - cmv;

    // Filter lancamentos by date
    const lancamentosFiltrados = lancamentos.filter(l => {
      const dataLanc = new Date(l.data_lancamento || l.data_vencimento);
      const dataInicio = new Date(filtros.dataInicio);
      const dataFim = new Date(filtros.dataFim);
      dataFim.setHours(23, 59, 59);
      return dataLanc >= dataInicio && dataLanc <= dataFim;
    });

    // Despesas Operacionais (from lancamentos_financeiros)
    const despesasOperacionais = lancamentosFiltrados
      .filter(l => l.tipo?.toLowerCase() === 'despesa')
      .reduce((sum, l) => sum + (l.valor || 0), 0);

    // Group expenses by category for breakdown
    const despesasPorCategoria = {};
    lancamentosFiltrados
      .filter(l => l.tipo?.toLowerCase() === 'despesa')
      .forEach(l => {
        const cat = l.categoria_nome || 'Outras Despesas';
        despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + (l.valor || 0);
      });

    // Lucro Operacional
    const lucroOperacional = lucroBruto - despesasOperacionais;

    // Margem Bruta e Líquida (percentuais)
    const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
    const margemLiquida = receitaLiquida > 0 ? (lucroOperacional / receitaLiquida) * 100 : 0;

    return {
      receitaBruta,
      descontos,
      vendasCanceladas,
      deducoes,
      receitaLiquida,
      cmv,
      lucroBruto,
      despesasOperacionais,
      despesasPorCategoria: Object.entries(despesasPorCategoria).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor),
      lucroOperacional,
      margemBruta,
      margemLiquida
    };
  }, [vendasFiltradas, lancamentos, produtos, filtros]);

  // ============ ABC CURVE CALCULATIONS ============
  const curvaABCData = useMemo(() => {
    // Aggregate all products from sales
    const produtosVendidos = {};
    vendasFiltradas.forEach(v => {
      if (v.status !== 'Cancelada' && v.status !== 'Cancelado') {
        v.itens?.forEach(item => {
          const id = item.produto_id || item.id;
          const produtoInfo = produtos.find(p => p.id === id);

          if (id && !produtosVendidos[id]) {
            produtosVendidos[id] = {
              id,
              nome: item.produto_nome || item.nome || produtoInfo?.nome || `Produto #${id}`,
              quantidade: 0,
              valorTotal: 0,
              custo: 0,
              produtoInfo // Salvar info completa para o modal
            };
          }

          if (id && produtosVendidos[id]) {
            produtosVendidos[id].quantidade += item.quantidade || 1;
            produtosVendidos[id].valorTotal += item.subtotal || 0;

            // Find cost from products if not already set or accumulate
            if (produtoInfo?.preco_custo) {
              produtosVendidos[id].custo += (produtoInfo.preco_custo * (item.quantidade || 1));
            }
          }
        });
      }
    });

    // Sort by value descending
    const sortedProducts = Object.values(produtosVendidos).sort((a, b) => b.valorTotal - a.valorTotal);

    // Calculate cumulative percentage
    const totalValue = sortedProducts.reduce((sum, p) => sum + p.valorTotal, 0);
    let cumulative = 0;

    const productsWithABC = sortedProducts.map((p, index) => {
      cumulative += p.valorTotal;
      const percentualAcumulado = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;
      const percentualIndividual = totalValue > 0 ? (p.valorTotal / totalValue) * 100 : 0;

      // ABC Classification
      let classificacao = 'C';
      if (percentualAcumulado <= 80) classificacao = 'A';
      else if (percentualAcumulado <= 95) classificacao = 'B';

      return {
        ...p,
        posicao: index + 1,
        percentualIndividual,
        percentualAcumulado,
        classificacao,
        lucro: p.valorTotal - p.custo,
        margemLucro: p.valorTotal > 0 ? ((p.valorTotal - p.custo) / p.valorTotal) * 100 : 0
      };
    });

    // Summary counts
    const resumo = {
      totalProdutos: productsWithABC.length,
      classeA: productsWithABC.filter(p => p.classificacao === 'A').length,
      classeB: productsWithABC.filter(p => p.classificacao === 'B').length,
      classeC: productsWithABC.filter(p => p.classificacao === 'C').length,
      valorA: productsWithABC.filter(p => p.classificacao === 'A').reduce((sum, p) => sum + p.valorTotal, 0),
      valorB: productsWithABC.filter(p => p.classificacao === 'B').reduce((sum, p) => sum + p.valorTotal, 0),
      valorC: productsWithABC.filter(p => p.classificacao === 'C').reduce((sum, p) => sum + p.valorTotal, 0),
      totalValue
    };

    return { produtos: productsWithABC, resumo };
  }, [vendasFiltradas, produtos]);

  // ============ CASH FLOW PROJECTION ============
  const fluxoCaixaData = useMemo(() => {
    const hoje = new Date();
    const projecao30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
    const projecao60 = new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000);
    const projecao90 = new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Receivables (valor_restante from sales with prazo_entrega or delivery pending)
    const recebiveisTotal = vendas
      .filter(v => v.status !== 'Cancelada' && v.status !== 'Cancelado')
      .reduce((sum, v) => sum + (v.valor_restante || 0), 0);

    // Group receivables by expected date
    const recebiveis30 = vendas
      .filter(v => {
        const prazo = v.prazo_entrega ? new Date(v.prazo_entrega) : new Date(v.data_venda);
        return prazo <= projecao30 && (v.valor_restante || 0) > 0;
      })
      .reduce((sum, v) => sum + (v.valor_restante || 0), 0);

    // Payables (scheduled expenses not paid)
    const despesasPendentes = lancamentos
      .filter(l => l.tipo?.toLowerCase() === 'despesa' && !l.pago)
      .reduce((sum, l) => sum + (l.valor || 0), 0);

    const despesas30 = lancamentos
      .filter(l => {
        const venc = new Date(l.data_vencimento);
        return l.tipo?.toLowerCase() === 'despesa' && !l.pago && venc <= projecao30;
      })
      .reduce((sum, l) => sum + (l.valor || 0), 0);

    const despesas60 = lancamentos
      .filter(l => {
        const venc = new Date(l.data_vencimento);
        return l.tipo?.toLowerCase() === 'despesa' && !l.pago && venc <= projecao60;
      })
      .reduce((sum, l) => sum + (l.valor || 0), 0);

    const despesas90 = lancamentos
      .filter(l => {
        const venc = new Date(l.data_vencimento);
        return l.tipo?.toLowerCase() === 'despesa' && !l.pago && venc <= projecao90;
      })
      .reduce((sum, l) => sum + (l.valor || 0), 0);

    // Weekly projection for chart
    const semanas = [];
    for (let i = 0; i < 12; i++) {
      const semanaInicio = new Date(hoje.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const semanaFim = new Date(semanaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);

      const entradas = vendas
        .filter(v => {
          const prazo = v.prazo_entrega ? new Date(v.prazo_entrega) : new Date(v.data_venda);
          return prazo >= semanaInicio && prazo < semanaFim && (v.valor_restante || 0) > 0;
        })
        .reduce((sum, v) => sum + (v.valor_restante || 0), 0);

      const saidas = lancamentos
        .filter(l => {
          const venc = new Date(l.data_vencimento);
          return l.tipo?.toLowerCase() === 'despesa' && !l.pago && venc >= semanaInicio && venc < semanaFim;
        })
        .reduce((sum, l) => sum + (l.valor || 0), 0);

      semanas.push({
        semana: `S${i + 1}`,
        periodo: semanaInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        entradas,
        saidas,
        saldo: entradas - saidas
      });
    }

    // Calculate running balance
    let saldoAcumulado = 0;
    const semanasComSaldo = semanas.map(s => {
      saldoAcumulado += s.saldo;
      return { ...s, saldoAcumulado };
    });

    return {
      recebiveisTotal,
      recebiveis30,
      despesasPendentes,
      despesas30,
      despesas60,
      despesas90,
      saldoProjetado30: recebiveis30 - despesas30,
      saldoProjetado60: recebiveisTotal * 0.7 - despesas60, // Estimate 70% collection
      saldoProjetado90: recebiveisTotal * 0.9 - despesas90, // Estimate 90% collection
      semanas: semanasComSaldo,
      alertaNegativo: saldoAcumulado < 0
    };
  }, [vendas, lancamentos]);

  // ============ NPS CALCULATIONS ============
  const npsData = useMemo(() => {
    if (npsAvaliacoes.length === 0) {
      return {
        score: 0,
        promotores: 0,
        neutros: 0,
        detratores: 0,
        totalAvaliacoes: 0,
        mediaAtendimento: 0,
        mediaEntrega: 0,
        mediaQualidade: 0,
        percentualRecomendacao: 0,
        avaliacoesRecentes: []
      };
    }

    // Calculate NPS based on average score (all 3 ratings)
    let promotores = 0, neutros = 0, detratores = 0;
    let somaAtendimento = 0, somaEntrega = 0, somaQualidade = 0;
    let recomendariam = 0;

    npsAvaliacoes.forEach(a => {
      const mediaNotas = ((a.nota_atendimento || 0) + (a.nota_entrega || 0) + (a.nota_qualidade || 0)) / 3;

      if (mediaNotas >= 9) promotores++;
      else if (mediaNotas >= 7) neutros++;
      else detratores++;

      somaAtendimento += a.nota_atendimento || 0;
      somaEntrega += a.nota_entrega || 0;
      somaQualidade += a.nota_qualidade || 0;
      if (a.recomendaria) recomendariam++;
    });

    const total = npsAvaliacoes.length;
    const score = Math.round(((promotores - detratores) / total) * 100);

    return {
      score,
      promotores,
      neutros,
      detratores,
      totalAvaliacoes: total,
      mediaAtendimento: total > 0 ? (somaAtendimento / total).toFixed(1) : 0,
      mediaEntrega: total > 0 ? (somaEntrega / total).toFixed(1) : 0,
      mediaQualidade: total > 0 ? (somaQualidade / total).toFixed(1) : 0,
      percentualRecomendacao: total > 0 ? ((recomendariam / total) * 100).toFixed(0) : 0,
      avaliacoesRecentes: npsAvaliacoes.slice(0, 10)
    };
  }, [npsAvaliacoes]);

  // State for NPS link generation
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [selectedVendaForNPS, setSelectedVendaForNPS] = useState(null);

  // Generate NPS link function
  const generateNPSLink = async (venda) => {
    if (!venda) return;
    setGeneratingLink(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      const expiraEm = new Date();
      expiraEm.setDate(expiraEm.getDate() + 7); // 7 days expiration

      await base44.entities.NPSLink.create({
        venda_id: venda.id,
        token,
        cliente_nome: venda.cliente_nome,
        cliente_telefone: venda.cliente_telefone,
        numero_pedido: venda.numero_pedido,
        expira_em: expiraEm.toISOString(),
        usado: false
      });

      const link = `${window.location.origin}/avaliacao/${token}`;
      setGeneratedLink(link);
      toast.success('Link de avaliação gerado com sucesso!');
    } catch (error) {
      console.error('Error generating NPS link:', error);
      toast.error('Erro ao gerar link de avaliação');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado para a área de transferência!');
  };

  // Loading state (AFTER all hooks)
  if (authLoading || loadingVendas) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-neutral-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-gray-500">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  // Verificar permissão (AFTER all hooks)
  if (!can('view_relatorios')) {
    return (
      <div className="p-8">
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <AlertDescription className="text-red-600 dark:text-red-400">
            Você não tem permissão para acessar os relatórios avançados.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Calcular métricas principais
  const totalVendas = vendasFiltradas.length;
  const valorTotal = vendasFiltradas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const ticketMedio = totalVendas > 0 ? valorTotal / totalVendas : 0;
  const valorPago = vendasFiltradas.reduce((sum, v) => sum + (v.valor_pago || 0), 0);
  const valorPendente = vendasFiltradas.reduce((sum, v) => sum + (v.valor_restante || 0), 0);

  // Calcular período anterior para comparação
  const diasPeriodo = Math.ceil((new Date(filtros.dataFim) - new Date(filtros.dataInicio)) / (1000 * 60 * 60 * 24));
  const dataInicioAnterior = new Date(new Date(filtros.dataInicio).getTime() - diasPeriodo * 24 * 60 * 60 * 1000);
  const dataFimAnterior = new Date(filtros.dataInicio);

  const vendasPeriodoAnterior = vendas.filter(v => {
    const dataVenda = new Date(v.data_venda);
    return dataVenda >= dataInicioAnterior && dataVenda < dataFimAnterior;
  });

  const valorAnterior = vendasPeriodoAnterior.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const crescimentoVendas = valorAnterior > 0 ? ((valorTotal - valorAnterior) / valorAnterior) * 100 : 0;

  // Lista de vendedores únicos
  const vendedoresUnicos = useMemo(() => {
    const names = new Set();
    vendas.forEach(v => {
      let name = v.responsavel_nome || v.vendedor_nome || 'Não informado';
      if (v.responsavel_id) {
        const u = users.find(user => user.id === v.responsavel_id);
        if (u && u.full_name) name = u.full_name;
      }
      if (name) names.add(name);
    });
    return [...names].sort();
  }, [vendas, users]);

  // Calcular valor máximo para percentuais nos rankings
  const maxValorVendedor = Math.max(...vendasPorVendedor.map(v => v.valor), 1);
  const maxValorProduto = Math.max(...produtosMaisVendidos.map(p => p.valor), 1);
  const totalPagamentos = formasPagamento.reduce((sum, f) => sum + f.valor, 0);

  // Funções de exportação
  const exportarCSV = () => {
    const headers = ['Data', 'Pedido', 'Cliente', 'Vendedor', 'Loja', 'Valor Total', 'Valor Pago', 'Status'];
    const rows = vendasFiltradas.map(v => {
      let vendedorNome = v.responsavel_nome || v.vendedor_nome || '';
      if (v.responsavel_id) {
        const u = users.find(user => user.id === v.responsavel_id);
        if (u && u.full_name) vendedorNome = u.full_name;
      }
      return [
        new Date(v.data_venda).toLocaleDateString('pt-BR'),
        v.numero_pedido || '',
        v.cliente_nome || '',
        vendedorNome,
        v.loja || '',
        `R$ ${(v.valor_total || 0).toFixed(2).replace('.', ',')}`,
        `R$ ${(v.valor_pago || 0).toFixed(2).replace('.', ',')}`,
        v.status || ''
      ];
    });

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_vendas_${filtros.dataInicio}_${filtros.dataFim}.csv`;
    link.click();
    toast.success('CSV exportado com sucesso!');
  };

  const exportarPDF = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1f2937; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #10b981; }
          .header h1 { color: #10b981; margin: 0 0 10px 0; font-size: 28px; font-weight: 700; }
          .header p { color: #6b7280; margin: 5px 0; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px; }
          .metric { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #10b981; }
          .metric h3 { margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .metric p { margin: 0; font-size: 24px; font-weight: 700; color: #065f46; }
          .section { margin: 40px 0; }
          .section h2 { color: #374151; font-size: 18px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
          th { background: #10b981; color: white; padding: 12px 16px; text-align: left; font-weight: 600; }
          td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
      <body>
        <div class="header">
          <h1>Relatório de Vendas</h1>
          <p><strong>Período:</strong> ${new Date(filtros.dataInicio).toLocaleDateString('pt-BR')} a ${new Date(filtros.dataFim).toLocaleDateString('pt-BR')}</p>
          ${filtros.loja !== 'todas' ? `<p><strong>Loja:</strong> ${filtros.loja}</p>` : ''}
          ${filtros.vendedor !== 'todos' ? `<p><strong>Vendedor:</strong> ${filtros.vendedor}</p>` : ''}
        </div>

        <div class="metrics">
          <div class="metric">
            <h3>Total de Vendas</h3>
            <p>${totalVendas}</p>
          </div>
          <div class="metric">
            <h3>Faturamento</h3>
            <p>R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="metric">
            <h3>Ticket Médio</h3>
            <p>R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="metric">
            <h3>A Receber</h3>
            <p>R$ ${valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div class="section">
          <h2>Ranking de Vendedores</h2>
          <table>
            <thead><tr><th>#</th><th>Vendedor</th><th>Vendas</th><th>Valor Total</th></tr></thead>
            <tbody>
              ${vendasPorVendedor.slice(0, 10).map((v, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${v.vendedor}</td>
                  <td>${v.quantidade}</td>
                  <td>R$ ${v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Top 10 Produtos</h2>
          <table>
            <thead><tr><th>#</th><th>Produto</th><th>Qtd</th><th>Valor</th></tr></thead>
            <tbody>
              ${produtosMaisVendidos.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${p.nome}</td>
                  <td>${p.quantidade}</td>
                  <td>R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Formas de Pagamento</h2>
          <table>
            <thead><tr><th>Forma</th><th>Transações</th><th>Valor</th><th>%</th></tr></thead>
            <tbody>
              ${formasPagamento.map(f => `
                <tr>
                  <td>${f.forma}</td>
                  <td>${f.quantidade}</td>
                  <td>R$ ${f.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td>${totalPagamentos > 0 ? ((f.valor / totalPagamentos) * 100).toFixed(1) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
          <p>Móveis Pedro II - Sistema de Gestão Integrada</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=800,width=1000');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                Relatórios Avançados
              </h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              Análise completa de vendas, desempenho e métricas do negócio
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchVendas()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              size="sm"
              onClick={exportarPDF}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir PDF
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700 dark:text-gray-300">Filtros</span>
              <Badge variant="secondary" className="ml-2">
                {totalVendas} vendas encontradas
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Data Início</Label>
                <Input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Data Fim</Label>
                <Input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Loja</Label>
                <Select value={filtros.loja} onValueChange={(value) => setFiltros({ ...filtros, loja: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Lojas</SelectItem>
                    <SelectItem value="Centro">Centro</SelectItem>
                    <SelectItem value="Carangola">Carangola</SelectItem>
                    <SelectItem value="Ponte Branca">Ponte Branca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Vendedor</Label>
                <Select value={filtros.vendedor} onValueChange={(value) => setFiltros({ ...filtros, vendedor: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {vendedoresUnicos.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Status</Label>
                <Select value={filtros.status} onValueChange={(value) => setFiltros({ ...filtros, status: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Pagamento Pendente">Pagamento Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pago & Retirado">Pago & Retirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Faturamento Total"
            value={`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle={`${totalVendas} vendas realizadas`}
            icon={DollarSign}
            trend={crescimentoVendas}
            trendValue="vs período anterior"
            color="green"
          />
          <KPICard
            title="Ticket Médio"
            value={`R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="Valor médio por venda"
            icon={Target}
            color="blue"
          />
          <KPICard
            title="Valor Recebido"
            value={`R$ ${valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle={`${valorTotal > 0 ? ((valorPago / valorTotal) * 100).toFixed(0) : 0}% do total`}
            icon={Wallet}
            color="purple"
          />
          <KPICard
            title="A Receber"
            value={`R$ ${valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="Valores pendentes"
            icon={CreditCard}
            color="orange"
          />
        </div>

        {/* Tabs com Gráficos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-1 h-auto flex-wrap gap-1">
            <TabsTrigger value="visao-geral" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="vendedores" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <Users className="w-4 h-4" />
              Vendedores
            </TabsTrigger>
            <TabsTrigger value="produtos" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <Package className="w-4 h-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="lojas" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <Store className="w-4 h-4" />
              Lojas
            </TabsTrigger>
            <TabsTrigger value="dre" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <FileText className="w-4 h-4" />
              D.R.E.
            </TabsTrigger>
            <TabsTrigger value="curva-abc" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Curva ABC
            </TabsTrigger>
            <TabsTrigger value="fluxo-caixa" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Fluxo de Caixa
            </TabsTrigger>
            <TabsTrigger value="nps" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <Star className="w-4 h-4" />
              NPS
            </TabsTrigger>
            <TabsTrigger value="marketing" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Marketing
            </TabsTrigger>
          </TabsList>

          {/* Tab Visão Geral */}
          <TabsContent value="visao-geral" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Gráfico de Vendas por Dia */}
              <Card className="lg:col-span-2 border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Evolução de Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={vendasPorDia}>
                      <defs>
                        <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="valor"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#colorValor)"
                        name="Valor"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Status das Vendas */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Status das Vendas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={vendasPorStatus}
                        dataKey="quantidade"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                      >
                        {vendasPorStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {vendasPorStatus.map((s, i) => (
                      <div key={s.status} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-600 dark:text-gray-400">{s.status}</span>
                        </div>
                        <span className="font-medium">{s.quantidade}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Vendedores */}
          <TabsContent value="vendedores" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Desempenho por Vendedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={vendasPorVendedor.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="vendedor" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Valor" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Ranking de Vendedores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-2">
                      {vendasPorVendedor.map((v, i) => (
                        <RankingCard
                          key={v.vendedor}
                          position={i + 1}
                          name={v.vendedor}
                          value={v.valor}
                          percentage={(v.valor / maxValorVendedor) * 100}
                          color={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Produtos */}
          <TabsContent value="produtos" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    Top 10 Produtos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={produtosMaisVendidos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="nome" type="category" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="valor" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Valor" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    Ranking de Produtos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {produtosMaisVendidos.map((p, i) => (
                        <RankingCard
                          key={p.nome}
                          position={i + 1}
                          name={p.nome}
                          value={p.valor}
                          percentage={(p.valor / maxValorProduto) * 100}
                          color={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Pagamentos */}
          <TabsContent value="pagamentos" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-600" />
                    Formas de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={formasPagamento}
                        dataKey="valor"
                        nameKey="forma"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ forma, percent }) => `${forma} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {formasPagamento.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    Detalhamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {formasPagamento.map((f, i) => (
                      <div key={f.forma} className="p-4 rounded-lg bg-gray-50 dark:bg-neutral-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-medium">{f.forma}</span>
                          </div>
                          <Badge variant="secondary">{f.quantidade} transações</Badge>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          R$ {f.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="mt-2 w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${totalPagamentos > 0 ? (f.valor / totalPagamentos) * 100 : 0}%`,
                              backgroundColor: COLORS[i % COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Lojas */}
          <TabsContent value="lojas" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-pink-600" />
                    Vendas por Loja
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={vendasPorLoja}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="loja" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="valor" fill="#ec4899" radius={[4, 4, 0, 0]} name="Valor (R$)" />
                      <Bar dataKey="quantidade" fill="#f97316" radius={[4, 4, 0, 0]} name="Quantidade" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-pink-600" />
                    Distribuição por Loja
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={vendasPorLoja}
                        dataKey="valor"
                        nameKey="loja"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        label={({ loja }) => loja}
                      >
                        {vendasPorLoja.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {vendasPorLoja.map((l, i) => (
                      <div key={l.loja} className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 text-center">
                        <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <p className="font-medium text-sm">{l.loja}</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-500">{l.quantidade} vendas</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab D.R.E. */}
          <TabsContent value="dre" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Demonstração do Resultado do Exercício (D.R.E.)
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Período: {new Date(filtros.dataInicio).toLocaleDateString('pt-BR')} a {new Date(filtros.dataFim).toLocaleDateString('pt-BR')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* D.R.E. Table */}
                  <div className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-neutral-800">
                          <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Descrição</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Valor</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                        <tr className="bg-emerald-50 dark:bg-emerald-900/20">
                          <td className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">RECEITA BRUTA</td>
                          <td className="text-right px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">
                            R$ {dreData.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">100%</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 pl-8 text-gray-600 dark:text-gray-400">(-) Descontos</td>
                          <td className="text-right px-4 py-3 text-red-600">
                            R$ {dreData.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-3 text-gray-500">
                            {dreData.receitaBruta > 0 ? ((dreData.descontos / dreData.receitaBruta) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 pl-8 text-gray-600 dark:text-gray-400">(-) Vendas Canceladas</td>
                          <td className="text-right px-4 py-3 text-red-600">
                            R$ {dreData.vendasCanceladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-3 text-gray-500">
                            {dreData.receitaBruta > 0 ? ((dreData.vendasCanceladas / dreData.receitaBruta) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                        <tr className="bg-blue-50 dark:bg-blue-900/20">
                          <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-400">= RECEITA LÍQUIDA</td>
                          <td className="text-right px-4 py-3 font-semibold text-blue-700 dark:text-blue-400">
                            R$ {dreData.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-3 font-semibold text-blue-700 dark:text-blue-400">
                            {dreData.receitaBruta > 0 ? ((dreData.receitaLiquida / dreData.receitaBruta) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 pl-8 text-gray-600 dark:text-gray-400">(-) CMV (Custo da Mercadoria Vendida)</td>
                          <td className="text-right px-4 py-3 text-red-600">
                            R$ {dreData.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-3 text-gray-500">
                            {dreData.receitaLiquida > 0 ? ((dreData.cmv / dreData.receitaLiquida) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                        <tr className="bg-purple-50 dark:bg-purple-900/20">
                          <td className="px-4 py-3 font-semibold text-purple-700 dark:text-purple-400">= LUCRO BRUTO</td>
                          <td className="text-right px-4 py-3 font-semibold text-purple-700 dark:text-purple-400">
                            R$ {dreData.lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-3 font-semibold text-purple-700 dark:text-purple-400">
                            {dreData.margemBruta.toFixed(1)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 pl-8 text-gray-600 dark:text-gray-400">(-) Despesas Operacionais</td>
                          <td className="text-right px-4 py-3 text-red-600">
                            R$ {dreData.despesasOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-3 text-gray-500">
                            {dreData.receitaLiquida > 0 ? ((dreData.despesasOperacionais / dreData.receitaLiquida) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                        <tr className={`${dreData.lucroOperacional >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          <td className={`px-4 py-3 font-bold ${dreData.lucroOperacional >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                            = LUCRO OPERACIONAL
                          </td>
                          <td className={`text-right px-4 py-3 font-bold ${dreData.lucroOperacional >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                            R$ {dreData.lucroOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`text-right px-4 py-3 font-bold ${dreData.lucroOperacional >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                            {dreData.margemLiquida.toFixed(1)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Expense Breakdown */}
                  {dreData.despesasPorCategoria.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Detalhamento das Despesas</h4>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dreData.despesasPorCategoria.map((cat, i) => (
                          <div key={cat.nome} className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{cat.nome}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              R$ {cat.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Curva ABC */}
          <TabsContent value="curva-abc" className="space-y-6">
            {/* ABC Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total de Produtos"
                value={curvaABCData.resumo.totalProdutos}
                subtitle="Produtos vendidos no período"
                icon={Package}
                color="blue"
              />
              <KPICard
                title="Classe A"
                value={curvaABCData.resumo.classeA}
                subtitle={`${((curvaABCData.resumo.classeA / Math.max(curvaABCData.resumo.totalProdutos, 1)) * 100).toFixed(0)}% dos produtos | 80% do faturamento`}
                icon={Star}
                color="green"
              />
              <KPICard
                title="Classe B"
                value={curvaABCData.resumo.classeB}
                subtitle={`${((curvaABCData.resumo.classeB / Math.max(curvaABCData.resumo.totalProdutos, 1)) * 100).toFixed(0)}% dos produtos | 15% do faturamento`}
                icon={Target}
                color="orange"
              />
              <KPICard
                title="Classe C"
                value={curvaABCData.resumo.classeC}
                subtitle={`${((curvaABCData.resumo.classeC / Math.max(curvaABCData.resumo.totalProdutos, 1)) * 100).toFixed(0)}% dos produtos | 5% do faturamento`}
                icon={Package}
                color="purple"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* ABC Chart */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Curva ABC - Pareto</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={curvaABCData.produtos.slice(0, 20)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="posicao" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="valorTotal" name="Valor (R$)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="percentualAcumulado" name="% Acumulado" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* ABC Distribution */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Distribuição por Classe</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Classe A', value: curvaABCData.resumo.valorA, color: '#10b981' },
                          { name: 'Classe B', value: curvaABCData.resumo.valorB, color: '#f59e0b' },
                          { name: 'Classe C', value: curvaABCData.resumo.valorC, color: '#8b5cf6' }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#8b5cf6" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Classe A</p>
                      <p className="font-bold text-emerald-600">R$ {curvaABCData.resumo.valorA.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                      <div className="w-3 h-3 rounded-full bg-amber-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Classe B</p>
                      <p className="font-bold text-amber-600">R$ {curvaABCData.resumo.valorB.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <div className="w-3 h-3 rounded-full bg-purple-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Classe C</p>
                      <p className="font-bold text-purple-600">R$ {curvaABCData.resumo.valorC.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ABC Products Table */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Ranking de Produtos - Curva ABC</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                      <tr className="border-b border-gray-200 dark:border-neutral-700">
                        <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">#</th>
                        <th className="text-left px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Produto</th>
                        <th className="text-right px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Qtd</th>
                        <th className="text-right px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Valor</th>
                        <th className="text-right px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">% Acum</th>
                        <th className="text-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Classe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {curvaABCData.produtos.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                          onClick={() => {
                            if (p.produtoInfo) {
                              setProdutoDetalhe(p.produtoInfo);
                              setProdutoModalOpen(true);
                            } else {
                              // Tentativa de fallback buscar de novo
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
                          <td className="px-4 py-2 text-sm text-gray-500">{p.posicao}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{p.nome}</td>
                          <td className="text-right px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{p.quantidade}</td>
                          <td className="text-right px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                            R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-4 py-2 text-sm text-gray-500">{p.percentualAcumulado.toFixed(1)}%</td>
                          <td className="text-center px-4 py-2">
                            <Badge className={`
                              ${p.classificacao === 'A' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                              ${p.classificacao === 'B' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                              ${p.classificacao === 'C' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : ''}
                            `}>
                              {p.classificacao}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Fluxo de Caixa */}
          <TabsContent value="fluxo-caixa" className="space-y-6">
            {/* Cash Flow Alert */}
            {fluxoCaixaData.alertaNegativo && (
              <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-600 dark:text-red-400">
                  Atenção: O saldo projetado está negativo. Revise entradas e saídas para evitar problemas de caixa.
                </AlertDescription>
              </Alert>
            )}

            {/* Cash Flow KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="A Receber Total"
                value={`R$ ${fluxoCaixaData.recebiveisTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                subtitle="Valores pendentes de clientes"
                icon={ArrowUpRight}
                color="green"
              />
              <KPICard
                title="A Pagar Total"
                value={`R$ ${fluxoCaixaData.despesasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                subtitle="Despesas pendentes"
                icon={ArrowDownRight}
                color="red"
              />
              <KPICard
                title="Saldo Projetado 30 dias"
                value={`R$ ${fluxoCaixaData.saldoProjetado30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                subtitle="Entradas - Saídas"
                icon={Wallet}
                color={fluxoCaixaData.saldoProjetado30 >= 0 ? 'blue' : 'red'}
              />
              <KPICard
                title="Saldo Projetado 90 dias"
                value={`R$ ${fluxoCaixaData.saldoProjetado90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                subtitle="Projeção de longo prazo"
                icon={Calendar}
                color={fluxoCaixaData.saldoProjetado90 >= 0 ? 'purple' : 'red'}
              />
            </div>

            {/* Cash Flow Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-600" />
                  Projeção de Fluxo de Caixa - Próximas 12 Semanas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={fluxoCaixaData.semanas}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas (R$)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#3b82f6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Weekly Breakdown */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Detalhamento Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {fluxoCaixaData.semanas.slice(0, 8).map((s, i) => (
                    <div key={s.semana} className="p-4 rounded-lg bg-gray-50 dark:bg-neutral-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{s.semana}</span>
                        <span className="text-xs text-gray-500">{s.periodo}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-emerald-600">+ Entradas</span>
                          <span className="text-emerald-600">R$ {s.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-600">- Saídas</span>
                          <span className="text-red-600">R$ {s.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                        </div>
                        <div className={`flex justify-between font-semibold pt-1 border-t border-gray-200 dark:border-neutral-700 ${s.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          <span>= Saldo</span>
                          <span>R$ {s.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab NPS */}
          <TabsContent value="nps" className="space-y-6">
            {/* NPS Score Card */}
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 border-0 shadow-lg">
                <CardHeader className="text-center">
                  <CardTitle>NPS Score</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className={`text-7xl font-bold ${npsData.score >= 50 ? 'text-emerald-600' :
                    npsData.score >= 0 ? 'text-amber-500' : 'text-red-600'
                    }`}>
                    {npsData.score}
                  </div>
                  <p className="text-gray-500 mt-2">
                    {npsData.score >= 70 ? 'Excelente!' :
                      npsData.score >= 50 ? 'Muito Bom' :
                        npsData.score >= 0 ? 'Pode Melhorar' : 'Precisa de Atenção'}
                  </p>
                  <div className="mt-4 text-sm text-gray-500">
                    Total de {npsData.totalAvaliacoes} avaliações
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Distribuição de Respostas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                      <ThumbsUp className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                      <p className="text-3xl font-bold text-emerald-600">{npsData.promotores}</p>
                      <p className="text-sm text-gray-500">Promotores (9-10)</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                      <Meh className="w-8 h-8 mx-auto mb-2 text-amber-600" />
                      <p className="text-3xl font-bold text-amber-600">{npsData.neutros}</p>
                      <p className="text-sm text-gray-500">Neutros (7-8)</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                      <ThumbsDown className="w-8 h-8 mx-auto mb-2 text-red-600" />
                      <p className="text-3xl font-bold text-red-600">{npsData.detratores}</p>
                      <p className="text-sm text-gray-500">Detratores (0-6)</p>
                    </div>
                  </div>
                  <div className="h-4 rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${npsData.totalAvaliacoes > 0 ? (npsData.promotores / npsData.totalAvaliacoes) * 100 : 0}%` }}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{ width: `${npsData.totalAvaliacoes > 0 ? (npsData.neutros / npsData.totalAvaliacoes) * 100 : 0}%` }}
                    />
                    <div
                      className="bg-red-500 h-full transition-all"
                      style={{ width: `${npsData.totalAvaliacoes > 0 ? (npsData.detratores / npsData.totalAvaliacoes) * 100 : 0}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Metrics */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Média Atendimento</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{npsData.mediaAtendimento}</p>
                  <div className="flex justify-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${Number(npsData.mediaAtendimento) >= star * 2 ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Média Entrega</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{npsData.mediaEntrega}</p>
                  <div className="flex justify-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${Number(npsData.mediaEntrega) >= star * 2 ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Média Qualidade</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{npsData.mediaQualidade}</p>
                  <div className="flex justify-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${Number(npsData.mediaQualidade) >= star * 2 ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Recomendariam</p>
                  <p className="text-3xl font-bold text-emerald-600">{npsData.percentualRecomendacao}%</p>
                  <CheckCircle className="w-6 h-6 mx-auto mt-2 text-emerald-500" />
                </CardContent>
              </Card>
            </div>

            {/* Generate NPS Link Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="w-5 h-5 text-blue-600" />
                  Gerar Link de Avaliação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Selecione uma venda recente:</Label>
                    <Select value={selectedVendaForNPS?.id?.toString() || ''} onValueChange={(value) => {
                      const venda = vendasFiltradas.find(v => v.id.toString() === value);
                      setSelectedVendaForNPS(venda);
                      setGeneratedLink(null);
                    }}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Escolha uma venda..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vendasFiltradas.slice(0, 50).map(v => (
                          <SelectItem key={v.id} value={v.id.toString()}>
                            {v.numero_pedido} - {v.cliente_nome} ({new Date(v.data_venda).toLocaleDateString('pt-BR')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedVendaForNPS && (
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-neutral-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Pedido:</strong> {selectedVendaForNPS.numero_pedido}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Cliente:</strong> {selectedVendaForNPS.cliente_nome}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Telefone:</strong> {selectedVendaForNPS.cliente_telefone || 'Não informado'}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => generateNPSLink(selectedVendaForNPS)}
                    disabled={!selectedVendaForNPS || generatingLink}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                  >
                    {generatingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4 mr-2" />
                        Gerar Link de Avaliação
                      </>
                    )}
                  </Button>

                  {generatedLink && (
                    <div className="mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Link gerado com sucesso!</p>
                      <div className="flex gap-2">
                        <Input value={generatedLink} readOnly className="flex-1 text-sm" />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedLink)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Este link expira em 7 dias.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Evaluations */}
            {npsData.avaliacoesRecentes.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Avaliações Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {npsData.avaliacoesRecentes.map((a, i) => (
                        <div key={a.id || i} className="p-4 rounded-lg bg-gray-50 dark:bg-neutral-800">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-2">
                              <Badge className={`
                                ${((a.nota_atendimento + a.nota_entrega + a.nota_qualidade) / 3) >= 9 ? 'bg-emerald-100 text-emerald-700' : ''}
                                ${((a.nota_atendimento + a.nota_entrega + a.nota_qualidade) / 3) >= 7 && ((a.nota_atendimento + a.nota_entrega + a.nota_qualidade) / 3) < 9 ? 'bg-amber-100 text-amber-700' : ''}
                                ${((a.nota_atendimento + a.nota_entrega + a.nota_qualidade) / 3) < 7 ? 'bg-red-100 text-red-700' : ''}
                              `}>
                                Média: {((a.nota_atendimento + a.nota_entrega + a.nota_qualidade) / 3).toFixed(1)}
                              </Badge>
                              {a.recomendaria && <Badge className="bg-blue-100 text-blue-700">Recomenda</Badge>}
                            </div>
                            <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Atendimento:</span>
                              <span className="ml-1 font-semibold">{a.nota_atendimento}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Entrega:</span>
                              <span className="ml-1 font-semibold">{a.nota_entrega}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Qualidade:</span>
                              <span className="ml-1 font-semibold">{a.nota_qualidade}</span>
                            </div>
                          </div>
                          {a.comentario && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">"{a.comentario}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Marketing */}
          <TabsContent value="marketing" className="space-y-6">
            {/* KPIs de Marketing */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="ROI Geral"
                value={`${metricsCampanhas.roiGeral.toFixed(1)}%`}
                subtitle={`ROAS: ${metricsCampanhas.roasGeral.toFixed(2)}x`}
                icon={TrendingUp}
                trend={metricsCampanhas.roiGeral}
                color="green"
              />
              <KPICard
                title="Investimento Total"
                value={`R$ ${metricsCampanhas.totalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                subtitle={`${campanhas.length} campanhas ativas`}
                icon={Megaphone}
                color="blue"
              />
              <KPICard
                title="Taxa de Cupons"
                value={`${metricsCupons.taxaConversao.toFixed(1)}%`}
                subtitle={`${metricsCupons.vendasComCupom} vendas com cupom`}
                icon={Tag}
                color="purple"
              />
              <KPICard
                title="Taxa de Recompra"
                value={`${metricsAquisicao.taxaRecompra.toFixed(1)}%`}
                subtitle={`${metricsAquisicao.clientesRecompra} clientes recorrentes`}
                icon={Repeat}
                color="orange"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* ROI de Campanhas */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-blue-600" />
                    ROI por Campanha
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {roiCampanhas.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={roiCampanhas.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nome" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" orientation="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="investimento" fill="#ef4444" name="Investimento (R$)" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="receita" fill="#10b981" name="Receita (R$)" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="roi" stroke="#3b82f6" strokeWidth={2} name="ROI (%)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[350px] text-gray-500">
                      <Megaphone className="w-12 h-12 mb-4 opacity-50" />
                      <p>Nenhuma campanha cadastrada</p>
                      <p className="text-sm">Cadastre campanhas para ver o ROI</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Vendas por Canal */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-purple-600" />
                    Vendas por Canal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={vendasPorCanal}
                        dataKey="valor"
                        nameKey="canal"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                      >
                        {vendasPorCanal.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {vendasPorCanal.map((c, i) => (
                      <div key={c.canal} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-neutral-800">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="font-medium text-sm">{c.canal}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                          <p className="text-xs text-gray-500">{c.quantidade} vendas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Performance de Cupons */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-pink-600" />
                    Performance de Cupons
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Descontos</p>
                      <p className="text-2xl font-bold text-pink-600">R$ {metricsCupons.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Ticket Médio (c/ cupom)</p>
                      <p className="text-2xl font-bold text-blue-600">R$ {metricsCupons.ticketMedioCupom.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  {performanceCupons.length > 0 ? (
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-2">
                        {performanceCupons.map((c, i) => (
                          <div key={c.codigo} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                                <span className="font-bold text-sm text-pink-600">#{i + 1}</span>
                              </div>
                              <div>
                                <p className="font-mono font-bold text-sm">{c.codigo}</p>
                                <p className="text-xs text-gray-500">{c.usos} uso{c.usos !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600">R$ {c.valor_vendas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                              <p className="text-xs text-gray-500">-R$ {c.desconto_total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[250px] text-gray-500">
                      <Tag className="w-12 h-12 mb-4 opacity-50" />
                      <p>Nenhum cupom utilizado</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Métricas de Aquisição */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-teal-600" />
                    Métricas de Aquisição
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Clientes Únicos</p>
                      <p className="text-3xl font-bold text-teal-600">{metricsAquisicao.clientesUnicos}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Clientes Recorrentes</p>
                      <p className="text-3xl font-bold text-amber-600">{metricsAquisicao.clientesRecompra}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                      <p className="text-sm text-gray-600 dark:text-gray-400">LTV Médio</p>
                      <p className="text-2xl font-bold text-purple-600">R$ {metricsAquisicao.ltvMedio.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Frequência Média</p>
                      <p className="text-2xl font-bold text-blue-600">{metricsAquisicao.frequenciaMedia.toFixed(1)}x</p>
                    </div>
                  </div>
                  {metricsCampanhas.cac > 0 && (
                    <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-800/20 border-l-4 border-red-500">
                      <p className="text-sm text-gray-600 dark:text-gray-400">CAC (Custo de Aquisição)</p>
                      <p className="text-2xl font-bold text-red-600">R$ {metricsCampanhas.cac.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-500 mt-1">Investimento / Vendas de campanhas</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

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
                queryClient.invalidateQueries(['produtos-relatorios']);
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
      </div>
    </div>
  );
}