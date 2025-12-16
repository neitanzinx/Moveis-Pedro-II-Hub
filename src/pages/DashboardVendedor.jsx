import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ShoppingCart, TrendingUp, Target, Calendar, Trophy, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function DashboardVendedor() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: vendas } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-data_venda'),
    initialData: [],
  });

  const { data: vendedores } = useQuery({
    queryKey: ['vendedores'],
    queryFn: () => base44.entities.Vendedor.list(),
    initialData: [],
  });

  if (!user || !user.vendedor_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const vendedorAtual = vendedores.find(v => v.id === user.vendedor_id);
  
  // Filtrar vendas do vendedor
  const minhasVendas = vendas.filter(v => v.vendedor_id === user.vendedor_id);
  
  // Vendas do mês atual
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const vendasMesAtual = minhasVendas.filter(v => {
    const dataVenda = new Date(v.data_venda);
    return dataVenda.getMonth() === mesAtual && dataVenda.getFullYear() === anoAtual;
  });

  // Cálculos
  const totalVendasMes = vendasMesAtual.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const totalComissoesMes = vendasMesAtual.reduce((sum, v) => sum + (v.comissao_calculada || 0), 0);
  const quantidadeVendasMes = vendasMesAtual.length;
  const ticketMedio = quantidadeVendasMes > 0 ? totalVendasMes / quantidadeVendasMes : 0;
  
  const metaMensal = vendedorAtual?.meta_mensal || 0;
  const percentualMeta = metaMensal > 0 ? (totalVendasMes / metaMensal) * 100 : 0;

  // Dados para gráfico - últimos 6 meses
  const dadosGrafico = [];
  for (let i = 5; i >= 0; i--) {
    const data = new Date();
    data.setMonth(data.getMonth() - i);
    const mes = data.getMonth();
    const ano = data.getFullYear();
    
    const vendasDoMes = minhasVendas.filter(v => {
      const dataVenda = new Date(v.data_venda);
      return dataVenda.getMonth() === mes && dataVenda.getFullYear() === ano;
    });
    
    const totalMes = vendasDoMes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const comissaoMes = vendasDoMes.reduce((sum, v) => sum + (v.comissao_calculada || 0), 0);
    
    dadosGrafico.push({
      mes: data.toLocaleDateString('pt-BR', { month: 'short' }),
      vendas: totalMes,
      comissoes: comissaoMes,
      quantidade: vendasDoMes.length
    });
  }

  // Ranking com outros vendedores da mesma loja
  const vendedoresMesmaLoja = vendedores.filter(v => v.loja === user.loja && v.ativo);
  const rankingVendedores = vendedoresMesmaLoja.map(vendedor => {
    const vendasVendedor = vendas.filter(v => {
      const dataVenda = new Date(v.data_venda);
      return v.vendedor_id === vendedor.id && 
             dataVenda.getMonth() === mesAtual && 
             dataVenda.getFullYear() === anoAtual;
    });
    const total = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    return { vendedor, total };
  }).sort((a, b) => b.total - a.total);

  const minhaPosicao = rankingVendedores.findIndex(r => r.vendedor.id === user.vendedor_id) + 1;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
              style={{ backgroundColor: '#07593f', color: 'white' }}
            >
              {user.vendedor_nome?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#07593f' }}>
                Olá, {user.vendedor_nome}! 👋
              </h1>
              <p style={{ color: '#8B8B8B' }}>
                Loja {user.loja} • Mês de {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Vendas do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-8 h-8" style={{ color: '#07593f' }} />
                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                  {quantidadeVendasMes}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Total em Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-8 h-8" style={{ color: '#3b82f6' }} />
                <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                  R$ {totalVendasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Comissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-8 h-8" style={{ color: '#f38a4c' }} />
                <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                  R$ {totalComissoesMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Ticket Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Target className="w-8 h-8" style={{ color: '#8b5cf6' }} />
                <p className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>
                  R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {metaMensal > 0 && (
          <Card className="border-0 shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                <Target className="w-6 h-6" />
                Meta do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>
                      Meta: R$ {metaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                      R$ {totalVendasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vendidos
                    </p>
                  </div>
                  <Badge 
                    className="text-lg px-4 py-2"
                    style={{
                      backgroundColor: percentualMeta >= 100 ? '#D1FAE5' : percentualMeta >= 70 ? '#FEF3C7' : '#FEE2E2',
                      color: percentualMeta >= 100 ? '#065F46' : percentualMeta >= 70 ? '#92400E' : '#991B1B'
                    }}
                  >
                    {percentualMeta.toFixed(0)}%
                  </Badge>
                </div>
                
                <div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className="h-4 rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ 
                        width: `${Math.min(percentualMeta, 100)}%`,
                        backgroundColor: percentualMeta >= 100 ? '#07593f' : percentualMeta >= 70 ? '#f38a4c' : '#ef4444'
                      }}
                    >
                      {percentualMeta >= 10 && (
                        <span className="text-xs font-bold text-white">
                          {percentualMeta.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mt-2" style={{ color: '#8B8B8B' }}>
                    {percentualMeta >= 100 
                      ? '🎉 Parabéns! Meta atingida!' 
                      : `Faltam R$ ${(metaMensal - totalVendasMes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para atingir a meta`
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                <Calendar className="w-5 h-5" />
                Evolução de Vendas (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
                  <XAxis dataKey="mes" stroke="#8B8B8B" />
                  <YAxis stroke="#8B8B8B" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #E5E0D8' }}
                    formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Bar dataKey="vendas" fill="#07593f" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: '#f38a4c' }}>
                <TrendingUp className="w-5 h-5" />
                Evolução de Comissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
                  <XAxis dataKey="mes" stroke="#8B8B8B" />
                  <YAxis stroke="#8B8B8B" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #E5E0D8' }}
                    formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Line type="monotone" dataKey="comissoes" stroke="#f38a4c" strokeWidth={3} dot={{ fill: '#f38a4c', r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
              <Trophy className="w-6 h-6" />
              Ranking da Loja {user.loja}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rankingVendedores.map((item, index) => (
                <div 
                  key={item.vendedor.id}
                  className="flex items-center gap-4 p-4 rounded-lg"
                  style={{ 
                    backgroundColor: item.vendedor.id === user.vendedor_id ? '#f0f9ff' : '#FAF8F5',
                    border: item.vendedor.id === user.vendedor_id ? '2px solid #07593f' : 'none'
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                      style={{ 
                        backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#E5E0D8',
                        color: index < 3 ? 'white' : '#07593f'
                      }}
                    >
                      {index + 1}º
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: '#07593f' }}>
                        {item.vendedor.nome}
                        {item.vendedor.id === user.vendedor_id && ' (Você)'}
                      </p>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  {index === 0 && <Award className="w-6 h-6 text-yellow-500" />}
                </div>
              ))}
            </div>
            
            {minhaPosicao > 3 && (
              <div className="mt-4 p-4 rounded-lg text-center" style={{ backgroundColor: '#f0f9ff' }}>
                <p className="font-semibold" style={{ color: '#07593f' }}>
                  Você está na {minhaPosicao}ª posição! Continue assim! 💪
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}