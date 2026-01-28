
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Users, FileDown, AlertCircle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RelatorioComissoes() {
  const [user, setUser] = useState(null);
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [mesInicio, setMesInicio] = useState(new Date().toISOString().slice(0, 7));
  const [mesFim, setMesFim] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-data_venda'),
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores'],
    queryFn: () => base44.entities.Vendedor.list(),
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  // Sistema simplificado - usa APENAS cargo
  const isAdmin = user.cargo === 'Administrador';

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h2 className="text-2xl font-bold mb-2 text-red-800">
                Acesso Restrito
              </h2>
              <p className="text-red-600">
                Apenas administradores podem acessar o relatório de comissões.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Filtrar vendas por período e vendedor

  const vendasFiltradas = vendas.filter(v => {
    const dataVenda = v.data_venda?.slice(0, 7); // YYYY-MM
    const dentroPeríodo = dataVenda >= mesInicio && dataVenda <= mesFim;
    const vendedorMatch = vendedorFiltro === "todos" || v.vendedor_id === vendedorFiltro;
    return dentroPeríodo && vendedorMatch && v.comissao_calculada > 0;
  });

  // Calcular breakdown por forma de pagamento para todas as vendas filtradas
  const calcularBreakdownPorFormaPagamento = (vendasArr) => {
    const breakdown = {};

    vendasArr.forEach(venda => {
      if (venda.pagamentos && Array.isArray(venda.pagamentos)) {
        venda.pagamentos.forEach(pag => {
          const forma = pag.forma_pagamento;
          if (!breakdown[forma]) {
            breakdown[forma] = { valor: 0, quantidade: 0 };
          }
          breakdown[forma].valor += pag.valor || 0;
          breakdown[forma].quantidade += 1;
        });
      }
    });

    return breakdown;
  };

  // Agrupar por vendedor
  const comissoesPorVendedor = vendedores.map(vendedor => {
    const vendasVendedor = vendasFiltradas.filter(v => v.vendedor_id === vendedor.id);
    const totalComissao = vendasVendedor.reduce((sum, v) => sum + (v.comissao_calculada || 0), 0);
    const totalVendas = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const quantidadeVendas = vendasVendedor.length;
    const breakdownPagamentos = calcularBreakdownPorFormaPagamento(vendasVendedor);

    return {
      vendedor,
      totalComissao,
      totalVendas,
      quantidadeVendas,
      breakdownPagamentos,
      vendas: vendasVendedor
    };
  }).filter(item => item.quantidadeVendas > 0);

  const totalGeralComissoes = comissoesPorVendedor.reduce((sum, item) => sum + item.totalComissao, 0);
  const totalGeralVendas = comissoesPorVendedor.reduce((sum, item) => sum + item.totalVendas, 0);

  const exportarCSV = () => {
    let csv = "Vendedor,Loja,Quantidade de Vendas,Total em Vendas,Total Comissões\n";

    comissoesPorVendedor.forEach(item => {
      csv += `${item.vendedor.nome},${item.vendedor.loja},${item.quantidadeVendas},R$ ${item.totalVendas.toFixed(2)},R$ ${item.totalComissao.toFixed(2)}\n`;
    });

    csv += `\nTOTAL GERAL,,${comissoesPorVendedor.reduce((sum, i) => sum + i.quantidadeVendas, 0)},R$ ${totalGeralVendas.toFixed(2)},R$ ${totalGeralComissoes.toFixed(2)}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes_${mesInicio}_${mesFim}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#07593f' }}>
              Relatório de Comissões
            </h1>
            <p style={{ color: '#8B8B8B' }}>
              Análise detalhada por vendedor e período
            </p>
          </div>
          <Button
            onClick={exportarCSV}
            className="shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="mesInicio">Período Inicial</Label>
                <Input
                  id="mesInicio"
                  type="month"
                  value={mesInicio}
                  onChange={(e) => setMesInicio(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mesFim">Período Final</Label>
                <Input
                  id="mesFim"
                  type="month"
                  value={mesFim}
                  onChange={(e) => setMesFim(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="vendedor">Vendedor</Label>
                <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Vendedores</SelectItem>
                    {vendedores.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nome} - {v.loja}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Total em Comissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-8 h-8" style={{ color: '#f38a4c' }} />
                <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                  R$ {totalGeralComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                <TrendingUp className="w-8 h-8" style={{ color: '#07593f' }} />
                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                  R$ {totalGeralVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Vendedores Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-8 h-8" style={{ color: '#3b82f6' }} />
                <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                  {comissoesPorVendedor.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
          </div>
        ) : comissoesPorVendedor.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
              <p className="text-xl" style={{ color: '#8B8B8B' }}>
                Nenhuma comissão encontrada no período selecionado
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {comissoesPorVendedor.map((item) => (
              <Card key={item.vendedor.id} className="border-0 shadow-lg">
                <CardHeader style={{ backgroundColor: '#f0f9ff' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: '#07593f', color: 'white' }}
                      >
                        {item.vendedor.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle style={{ color: '#07593f' }}>
                          {item.vendedor.nome}
                        </CardTitle>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                          Loja {item.vendedor.loja}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Total Comissão</p>
                      <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                        R$ {item.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Quantidade de Vendas</p>
                      <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                        {item.quantidadeVendas}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Total em Vendas</p>
                      <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                        R$ {item.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Ticket Médio</p>
                      <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                        R$ {(item.totalVendas / item.quantidadeVendas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Breakdown por Forma de Pagamento */}
                  {Object.keys(item.breakdownPagamentos).length > 0 && (
                    <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                      <p className="text-sm font-semibold mb-3" style={{ color: '#07593f' }}>
                        💳 Recebimentos por Forma de Pagamento
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(item.breakdownPagamentos).map(([forma, dados]) => (
                          <div key={forma} className="flex items-center justify-between p-2 rounded bg-gray-50">
                            <span className="text-sm text-gray-600">{forma}</span>
                            <span className="text-sm font-semibold" style={{ color: '#07593f' }}>
                              R$ {dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.vendedor.meta_mensal > 0 && (
                    <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium" style={{ color: '#07593f' }}>
                          Meta Mensal: R$ {item.vendedor.meta_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <Badge
                          style={{
                            backgroundColor: item.totalVendas >= item.vendedor.meta_mensal ? '#D1FAE5' : '#FEF3C7',
                            color: item.totalVendas >= item.vendedor.meta_mensal ? '#065F46' : '#92400E'
                          }}
                        >
                          {((item.totalVendas / item.vendedor.meta_mensal) * 100).toFixed(0)}% atingido
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min((item.totalVendas / item.vendedor.meta_mensal) * 100, 100)}%`,
                            backgroundColor: item.totalVendas >= item.vendedor.meta_mensal ? '#07593f' : '#f38a4c'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
