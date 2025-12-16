import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from "lucide-react";

export default function FinanceiroCharts({ lancamentos, categorias, mesAno }) {
  const lancamentosMes = lancamentos.filter(l => 
    l.data_lancamento?.slice(0, 7) === mesAno
  );

  const dadosPorCategoria = useMemo(() => {
    const map = new Map();
    
    lancamentosMes.forEach(lanc => {
      const catNome = lanc.categoria_nome || 'Sem categoria';
      if (!map.has(catNome)) {
        map.set(catNome, { entradas: 0, saidas: 0 });
      }
      const current = map.get(catNome);
      if (lanc.tipo === 'Entrada') {
        current.entradas += lanc.valor || 0;
      } else {
        current.saidas += lanc.valor || 0;
      }
    });

    return Array.from(map.entries()).map(([nome, valores]) => ({
      categoria: nome,
      Entradas: valores.entradas,
      Saídas: valores.saidas
    }));
  }, [lancamentosMes]);

  const dadosFluxoDiario = useMemo(() => {
    const map = new Map();
    
    lancamentosMes.forEach(lanc => {
      if (!lanc.data_lancamento) return;
      const data = new Date(lanc.data_lancamento);
      if (isNaN(data.getTime())) return;
      const dia = data.getDate();
      if (!map.has(dia)) {
        map.set(dia, { dia, entradas: 0, saidas: 0 });
      }
      const current = map.get(dia);
      if (lanc.tipo === 'Entrada') {
        current.entradas += lanc.valor || 0;
      } else {
        current.saidas += lanc.valor || 0;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dia - b.dia);
  }, [lancamentosMes]);

  const pizzaEntradas = useMemo(() => {
    const map = new Map();
    
    lancamentosMes
      .filter(l => l.tipo === 'Entrada')
      .forEach(lanc => {
        const catNome = lanc.categoria_nome || 'Sem categoria';
        map.set(catNome, (map.get(catNome) || 0) + lanc.valor);
      });

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value
    }));
  }, [lancamentosMes]);

  const pizzaSaidas = useMemo(() => {
    const map = new Map();
    
    lancamentosMes
      .filter(l => l.tipo === 'Saída')
      .forEach(lanc => {
        const catNome = lanc.categoria_nome || 'Sem categoria';
        map.set(catNome, (map.get(catNome) || 0) + lanc.valor);
      });

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value
    }));
  }, [lancamentosMes]);

  const COLORS = ['#07593f', '#f38a4c', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#6366f1'];

  const formatCurrency = (value) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Entradas e Saídas por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosPorCategoria}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoria" />
              <YAxis />
              <Tooltip formatter={formatCurrency} />
              <Legend />
              <Bar dataKey="Entradas" fill="#059669" />
              <Bar dataKey="Saídas" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Fluxo de Caixa Diário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosFluxoDiario}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip formatter={formatCurrency} />
              <Legend />
              <Line type="monotone" dataKey="entradas" stroke="#059669" strokeWidth={2} name="Entradas" />
              <Line type="monotone" dataKey="saidas" stroke="#dc2626" strokeWidth={2} name="Saídas" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Distribuição de Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pizzaEntradas.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pizzaEntradas}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pizzaEntradas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatCurrency} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12" style={{ color: '#8B8B8B' }}>
                Nenhuma entrada no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Distribuição de Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pizzaSaidas.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pizzaSaidas}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pizzaSaidas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatCurrency} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12" style={{ color: '#8B8B8B' }}>
                Nenhuma saída no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}