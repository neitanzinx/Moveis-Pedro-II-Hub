import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, DollarSign, Package, Users, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Calendar, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Função auxiliar segura para buscar dados
const fetchSafe = async (fn) => {
  try {
    const res = await fn();
    return Array.isArray(res) ? res : [];
  } catch (error) {
    console.error("Erro na busca:", error);
    return [];
  }
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [periodo, setPeriodo] = useState("30");

  // Queries com fallback para array vazio []
  // Nota: Idealmente a API já filtraria por usuário, mas mantemos o client-side filtering por enquanto
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchSafe(() => base44.entities.Produto.list()),
    enabled: !!user
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => fetchSafe(() => base44.entities.Venda.list('-data_venda')),
    enabled: !!user
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => fetchSafe(() => base44.entities.Cliente.list('-created_date')),
    enabled: !!user
  });

  // useMemo calcula os dados apenas quando vendas/clientes/user mudam
  const dados = useMemo(() => {
    const result = {
      faturamento: 0,
      totalVendas: 0,
      ticketMedio: 0,
      novosClientes: 0,
      trendFat: 0,
      trendVendas: 0,
      chartData: [],
      topProdutos: []
    };

    if (!user) return result;

    try {
      const dias = parseInt(periodo) || 30;
      const limite = new Date();
      limite.setDate(limite.getDate() - dias);

      // 1. Filtragem Segura
      const listaVendas = Array.isArray(vendas) ? vendas : [];
      const listaClientes = Array.isArray(clientes) ? clientes : [];

      const vendasFiltradas = listaVendas.filter(v => {
        // Filtro de Dono (SEMPRE APLICADO)
        // Considera venda do usuário se ele é o responsavel_id OU se ele criou o registro
        if (v?.responsavel_id !== user.id && v?.created_by !== user.email) return false;

        // Filtro de Data
        if (!v?.data_venda) return false;
        const d = new Date(v.data_venda);
        return !isNaN(d.getTime()) && d >= limite;
      });

      // 2. KPIs
      result.totalVendas = vendasFiltradas.length;
      result.faturamento = vendasFiltradas.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
      result.ticketMedio = result.totalVendas > 0 ? result.faturamento / result.totalVendas : 0;

      const clientesFiltrados = listaClientes.filter(c => {
        // Apenas clientes criados por este usuário
        if (c?.created_by !== user.email) return false;
        if (!c?.created_date) return false;
        const d = new Date(c.created_date);
        return !isNaN(d.getTime()) && d >= limite;
      });
      result.novosClientes = clientesFiltrados.length;

      // 3. Tendências
      const limiteAnt = new Date(limite);
      limiteAnt.setDate(limiteAnt.getDate() - dias);

      const vendasAnt = listaVendas.filter(v => {
        if (v?.responsavel_id !== user.id && v?.created_by !== user.email) return false;
        if (!v?.data_venda) return false;
        const d = new Date(v.data_venda);
        return !isNaN(d.getTime()) && d >= limiteAnt && d < limite;
      });

      const fatAnt = vendasAnt.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
      result.trendFat = fatAnt > 0 ? Math.round(((result.faturamento - fatAnt) / fatAnt) * 100) : 0;
      result.trendVendas = vendasAnt.length > 0 ? Math.round(((result.totalVendas - vendasAnt.length) / vendasAnt.length) * 100) : 0;

      // 4. Gráfico
      const vendasMap = {};
      vendasFiltradas.forEach(v => {
        const d = new Date(v.data_venda);
        if (!isNaN(d.getTime())) {
          const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          vendasMap[dia] = (vendasMap[dia] || 0) + (Number(v.valor_total) || 0);
        }
      });

      result.chartData = Object.entries(vendasMap)
        .map(([dia, valor]) => ({ dia, valor }))
        .slice(-15); // Últimos 15 dias com vendas

      // 5. Top Produtos
      const prodMap = {};
      vendasFiltradas.forEach(v => {
        if (Array.isArray(v.itens)) {
          v.itens.forEach(item => {
            if (item?.produto_nome) {
              prodMap[item.produto_nome] = (prodMap[item.produto_nome] || 0) + (Number(item.quantidade) || 0);
            }
          });
        }
      });

      result.topProdutos = Object.entries(prodMap)
        .sort((a, b) => b[1] - a[1]) // Ordena maior qtd primeiro
        .slice(0, 5) // Pega top 5
        .map(([nome, qtd]) => ({ nome, qtd })); // Formata para objeto

    } catch (err) {
      console.error("Erro ao calcular dashboard:", err);
    }

    return result;
  }, [vendas, clientes, user, periodo]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Meu Painel
          </h1>
          <p className="text-sm text-gray-500">
            Acompanhe seu desempenho e metas pessoais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px] h-9 text-sm bg-white dark:bg-neutral-900">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 3 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Minhas Vendas (R$)"
          value={`R$ ${dados.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          trend={`${dados.trendFat >= 0 ? '+' : ''}${dados.trendFat}%`}
          trendUp={dados.trendFat >= 0}
          color="text-green-600"
        />
        <StatsCard
          title="Vendas Realizadas (Qtd)"
          value={dados.totalVendas}
          icon={ShoppingCart}
          trend={`${dados.trendVendas >= 0 ? '+' : ''}${dados.trendVendas}%`}
          trendUp={dados.trendVendas >= 0}
          color="text-blue-600"
        />
        <StatsCard
          title="Meu Ticket Médio"
          value={`R$ ${dados.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          trend={null}
          trendUp={true}
          color="text-orange-600"
        />
        <StatsCard
          title="Meus Novos Clientes"
          value={dados.novosClientes}
          icon={Users}
          trend={null}
          trendUp={true}
          color="text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white dark:bg-neutral-900">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" /> Minha Evolução
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dados.chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dados.chartData}>
                    <defs>
                      <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(val) => [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                    />
                    <Area type="monotone" dataKey="valor" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorFat)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                <p>Sem vendas no período</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-neutral-900">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" /> Meus Top Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dados.topProdutos.map((prod, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-gray-500">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{prod.nome}</p>
                  </div>
                  <span className="text-sm font-medium text-green-600">{prod.qtd} un</span>
                </div>
              ))}
              {dados.topProdutos.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Nenhuma venda registrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, trend, trendUp, color }) {
  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}
