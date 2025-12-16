import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FileDown, TrendingUp, Users, Package, DollarSign, Calendar, Filter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const COLORS = ['#07593f', '#f38a4c', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function RelatoriosAvancados() {
  const [user, setUser] = useState(null);
  const [filtros, setFiltros] = useState({
    dataInicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    loja: "todas",
    vendedor: "todos",
    status: "todos"
  });

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

  const { data: produtos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
    initialData: [],
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = user.cargo === 'Administrador';
  const isManager = user.cargo === 'Gerente';

  if (!isAdmin && !isManager) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Alert className="border-2 border-red-200 bg-red-50">
            <AlertDescription className="text-red-600">
              Apenas administradores e gerentes podem acessar os relatórios avançados.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Filtrar vendas
  const vendasFiltradas = vendas.filter(v => {
    const dataVenda = new Date(v.data_venda);
    const dataInicio = new Date(filtros.dataInicio);
    const dataFim = new Date(filtros.dataFim);
    
    const dentroData = dataVenda >= dataInicio && dataVenda <= dataFim;
    const dentroLoja = filtros.loja === "todas" || v.loja === filtros.loja;
    const dentroVendedor = filtros.vendedor === "todos" || v.responsavel_nome === filtros.vendedor;
    const dentroStatus = filtros.status === "todos" || v.status === filtros.status;
    
    return dentroData && dentroLoja && dentroVendedor && dentroStatus;
  });

  // Calcular métricas
  const totalVendas = vendasFiltradas.length;
  const valorTotal = vendasFiltradas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const ticketMedio = totalVendas > 0 ? valorTotal / totalVendas : 0;
  const valorPago = vendasFiltradas.reduce((sum, v) => sum + (v.valor_pago || 0), 0);
  const valorPendente = vendasFiltradas.reduce((sum, v) => sum + (v.valor_restante || 0), 0);

  // Vendas por dia
  const vendasPorDia = {};
  vendasFiltradas.forEach(v => {
    const data = new Date(v.data_venda).toLocaleDateString('pt-BR');
    if (!vendasPorDia[data]) {
      vendasPorDia[data] = { data, quantidade: 0, valor: 0 };
    }
    vendasPorDia[data].quantidade++;
    vendasPorDia[data].valor += v.valor_total || 0;
  });
  const dadosVendasDia = Object.values(vendasPorDia).sort((a, b) => 
    new Date(a.data.split('/').reverse().join('-')) - new Date(b.data.split('/').reverse().join('-'))
  );

  // Vendas por vendedor
  const vendasPorVendedor = {};
  vendasFiltradas.forEach(v => {
    const vendedor = v.responsavel_nome || 'Não informado';
    if (!vendasPorVendedor[vendedor]) {
      vendasPorVendedor[vendedor] = { vendedor, quantidade: 0, valor: 0 };
    }
    vendasPorVendedor[vendedor].quantidade++;
    vendasPorVendedor[vendedor].valor += v.valor_total || 0;
  });
  const dadosVendedor = Object.values(vendasPorVendedor).sort((a, b) => b.valor - a.valor);

  // Vendas por loja
  const vendasPorLoja = {};
  vendasFiltradas.forEach(v => {
    const loja = v.loja || 'Não informada';
    if (!vendasPorLoja[loja]) {
      vendasPorLoja[loja] = { loja, quantidade: 0, valor: 0 };
    }
    vendasPorLoja[loja].quantidade++;
    vendasPorLoja[loja].valor += v.valor_total || 0;
  });
  const dadosLoja = Object.values(vendasPorLoja);

  // Produtos mais vendidos
  const produtosVendidos = {};
  vendasFiltradas.forEach(v => {
    v.itens?.forEach(item => {
      if (!produtosVendidos[item.produto_id]) {
        produtosVendidos[item.produto_id] = {
          nome: item.produto_nome,
          quantidade: 0,
          valor: 0
        };
      }
      produtosVendidos[item.produto_id].quantidade += item.quantidade;
      produtosVendidos[item.produto_id].valor += item.subtotal;
    });
  });
  const dadosProdutos = Object.values(produtosVendidos)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  // Vendas por status
  const vendasPorStatus = {};
  vendasFiltradas.forEach(v => {
    const status = v.status;
    if (!vendasPorStatus[status]) {
      vendasPorStatus[status] = { status, quantidade: 0, valor: 0 };
    }
    vendasPorStatus[status].quantidade++;
    vendasPorStatus[status].valor += v.valor_total || 0;
  });
  const dadosStatus = Object.values(vendasPorStatus);

  // Formas de pagamento
  const formasPagamento = {};
  vendasFiltradas.forEach(v => {
    v.pagamentos?.forEach(pag => {
      if (!formasPagamento[pag.forma_pagamento]) {
        formasPagamento[pag.forma_pagamento] = { forma: pag.forma_pagamento, valor: 0, quantidade: 0 };
      }
      formasPagamento[pag.forma_pagamento].valor += pag.valor;
      formasPagamento[pag.forma_pagamento].quantidade++;
    });
  });
  const dadosFormasPagamento = Object.values(formasPagamento);

  // Lista de vendedores para filtro
  const vendedores = [...new Set(vendas.map(v => v.responsavel_nome).filter(Boolean))];

  const exportarPDF = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #2C2C2C; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #07593f; padding-bottom: 20px; }
          .header h1 { color: #07593f; margin: 0; font-size: 32px; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
          .metric-card { background: #f0f9ff; padding: 20px; border-radius: 8px; }
          .metric-card h3 { margin: 0 0 10px 0; color: #07593f; font-size: 14px; }
          .metric-card p { margin: 0; font-size: 24px; font-weight: bold; color: #07593f; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #07593f; color: white; padding: 12px; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #E5E0D8; }
          .footer { margin-top: 50px; text-align: center; color: #8B8B8B; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Vendas</h1>
          <p>Período: ${new Date(filtros.dataInicio).toLocaleDateString('pt-BR')} a ${new Date(filtros.dataFim).toLocaleDateString('pt-BR')}</p>
        </div>

        <div class="metrics">
          <div class="metric-card">
            <h3>Total de Vendas</h3>
            <p>${totalVendas}</p>
          </div>
          <div class="metric-card">
            <h3>Valor Total</h3>
            <p>R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="metric-card">
            <h3>Ticket Médio</h3>
            <p>R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div class="metric-card">
            <h3>Valor Pendente</h3>
            <p>R$ ${valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <h2 style="color: #07593f; margin-top: 40px;">Vendas por Vendedor</h2>
        <table>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th style="text-align: center;">Quantidade</th>
              <th style="text-align: right;">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${dadosVendedor.map(v => `
              <tr>
                <td>${v.vendedor}</td>
                <td style="text-align: center;">${v.quantidade}</td>
                <td style="text-align: right;">R$ ${v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2 style="color: #07593f; margin-top: 40px;">Top 10 Produtos Mais Vendidos</h2>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th style="text-align: center;">Quantidade</th>
              <th style="text-align: right;">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${dadosProdutos.map(p => `
              <tr>
                <td>${p.nome}</td>
                <td style="text-align: center;">${p.quantidade}</td>
                <td style="text-align: right;">R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
          <p>Móveis Pedro II - Sistema de Gestão</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8" style={{ color: '#07593f' }} />
              <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#07593f' }}>
                Relatórios Avançados
              </h1>
            </div>
            <p style={{ color: '#8B8B8B' }}>
              Análise detalhada de vendas e desempenho
            </p>
          </div>
          <Button
            onClick={exportarPDF}
            className="shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                />
              </div>
              <div>
                <Label>Loja</Label>
                <Select value={filtros.loja} onValueChange={(value) => setFiltros({ ...filtros, loja: value })}>
                  <SelectTrigger>
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
                <Label>Vendedor</Label>
                <Select value={filtros.vendedor} onValueChange={(value) => setFiltros({ ...filtros, vendedor: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Vendedores</SelectItem>
                    {vendedores.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filtros.status} onValueChange={(value) => setFiltros({ ...filtros, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="Pagamento Pendente">Pagamento Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pago & Retirado">Pago & Retirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-10 h-10" style={{ color: '#07593f' }} />
                <div>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>Valor Total</p>
                  <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                    R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-10 h-10 text-blue-600" />
                <div>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>Total de Vendas</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {totalVendas}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-10 h-10" style={{ color: '#f38a4c' }} />
                <div>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>Ticket Médio</p>
                  <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                    R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-10 h-10 text-orange-600" />
                <div>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>Valor Pendente</p>
                  <p className="text-2xl font-bold text-orange-600">
                    R$ {valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <Tabs defaultValue="periodo" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-white border-2" style={{ borderColor: '#E5E0D8' }}>
            <TabsTrigger value="periodo">Por Período</TabsTrigger>
            <TabsTrigger value="vendedor">Por Vendedor</TabsTrigger>
            <TabsTrigger value="produto">Por Produto</TabsTrigger>
            <TabsTrigger value="loja">Por Loja</TabsTrigger>
            <TabsTrigger value="pagamento">Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="periodo">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Vendas por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dadosVendasDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="quantidade" stroke="#07593f" name="Quantidade" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="valor" stroke="#f38a4c" name="Valor (R$)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendedor">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Desempenho por Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dadosVendedor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="vendedor" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="valor" fill="#07593f" name="Valor Total (R$)" />
                    <Bar dataKey="quantidade" fill="#f38a4c" name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="produto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Top 10 Produtos Mais Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dadosProdutos} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="nome" type="category" width={150} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="valor" fill="#07593f" name="Valor (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loja">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Vendas por Loja</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={dadosLoja}
                      dataKey="valor"
                      nameKey="loja"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={(entry) => `${entry.loja}: R$ ${entry.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    >
                      {dadosLoja.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagamento">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Formas de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={dadosFormasPagamento}
                      dataKey="valor"
                      nameKey="forma"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={(entry) => `${entry.forma}: R$ ${entry.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    >
                      {dadosFormasPagamento.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}