import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from "lucide-react";

export default function FinanceiroCharts({ lancamentos, categorias, mesAno, vendas = [] }) {
  // lancamentos já vem filtrado pelo mês do componente pai
  const lancamentosMes = lancamentos || [];

  const dadosPorCategoria = useMemo(() => {
    const map = new Map();

    lancamentosMes.forEach(lanc => {
      const catNome = lanc.categoria_nome || 'Sem categoria';
      if (!map.has(catNome)) {
        map.set(catNome, { entradas: 0, saidas: 0 });
      }
      const current = map.get(catNome);
      if (lanc.tipo === 'Entrada' || lanc.tipo === 'receita') {
        current.entradas += lanc.valor || 0;
      } else {
        current.saidas += Math.abs(lanc.valor || 0);
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
      if (lanc.tipo === 'Entrada' || lanc.tipo === 'receita') {
        current.entradas += lanc.valor || 0;
      } else {
        current.saidas += Math.abs(lanc.valor || 0);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dia - b.dia);
  }, [lancamentosMes]);

  const pizzaEntradas = useMemo(() => {
    const map = new Map();

    lancamentosMes
      .filter(l => l.tipo === 'Entrada' || l.tipo === 'receita')
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
      .filter(l => l.tipo !== 'Entrada' && l.tipo !== 'receita')
      .forEach(lanc => {
        const catNome = lanc.categoria_nome || 'Sem categoria';
        map.set(catNome, (map.get(catNome) || 0) + Math.abs(lanc.valor || 0));
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

      {/* Gráfico de Impacto dos Descontos */}
      {vendas && vendas.length > 0 && (
        <DescontosChart vendas={vendas} formatCurrency={formatCurrency} COLORS={COLORS} />
      )}
    </div>
  );
}

// Componente separado para análise de descontos
function DescontosChart({ vendas, formatCurrency, COLORS }) {
  const dadosDescontos = useMemo(() => {
    const cuponsMap = new Map();
    let descontoManual = 0;

    vendas.forEach(venda => {
      const desconto = venda.desconto || 0;
      if (desconto <= 0) return;

      if (venda.cupom_codigo) {
        const cupom = venda.cupom_codigo;
        cuponsMap.set(cupom, (cuponsMap.get(cupom) || 0) + desconto);
      } else {
        descontoManual += desconto;
      }
    });

    const resultado = [];

    cuponsMap.forEach((valor, cupom) => {
      resultado.push({ name: `Cupom: ${cupom}`, value: valor, tipo: 'cupom' });
    });

    if (descontoManual > 0) {
      resultado.push({ name: 'Desconto Manual', value: descontoManual, tipo: 'manual' });
    }

    return resultado.sort((a, b) => b.value - a.value);
  }, [vendas]);

  const totalDescontos = dadosDescontos.reduce((sum, d) => sum + d.value, 0);
  const totalVendas = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const percentualDesconto = totalVendas > 0 ? ((totalDescontos / (totalVendas + totalDescontos)) * 100).toFixed(1) : 0;

  if (dadosDescontos.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-red-500" />
          Impacto dos Descontos no Faturamento
        </CardTitle>
        <div className="flex items-center gap-4 text-sm mt-2">
          <span className="text-gray-500">
            Total em descontos: <span className="font-bold text-red-600">{formatCurrency(totalDescontos)}</span>
          </span>
          <span className="text-gray-500">
            Representa <span className="font-bold text-red-600">{percentualDesconto}%</span> das vendas brutas
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dadosDescontos}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name.replace('Cupom: ', '')}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {dadosDescontos.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.tipo === 'manual' ? '#9ca3af' : COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={formatCurrency} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            <h4 className="font-bold text-sm text-gray-700 mb-3">Ranking de Descontos</h4>
            {dadosDescontos.slice(0, 8).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-neutral-800">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.tipo === 'manual' ? '#9ca3af' : COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-red-600">
                  -{formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}