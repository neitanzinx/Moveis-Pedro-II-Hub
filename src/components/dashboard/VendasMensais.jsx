import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

export default function VendasMensais({ vendas, showValues = true }) {
  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        mes: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        mesCompleto: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        vendas: 0,
        valor: 0,
        monthYear: `${date.getMonth()}-${date.getFullYear()}`
      });
    }
    return months;
  };

  const data = getLast6Months();
  
  vendas.forEach(venda => {
    if (!venda.data_venda) return;
    const dataVenda = new Date(venda.data_venda);
    if (isNaN(dataVenda.getTime())) return;
    const monthYear = `${dataVenda.getMonth()}-${dataVenda.getFullYear()}`;
    const mes = data.find(m => m.monthYear === monthYear);
    if (mes) {
      mes.vendas += 1;
      mes.valor += venda.valor_total || 0;
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#07593f', opacity: 0.1 }}>
            <TrendingUp className="w-5 h-5" style={{ color: '#07593f' }} />
          </div>
          <CardTitle style={{ color: '#07593f' }}>Vendas Mensais</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
            <XAxis 
              dataKey="mes" 
              tick={{ fill: '#8B8B8B', fontSize: 12 }}
            />
            <YAxis 
              tick={{ fill: '#8B8B8B', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #E5E0D8',
                borderRadius: '8px',
                padding: '12px'
              }}
              formatter={(value, name) => {
                if (!showValues && name === 'valor') return null;
                return [
                  name === 'vendas' ? `${value} vendas` : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  name === 'vendas' ? 'Quantidade' : 'Faturamento'
                ];
              }}
              labelFormatter={(label, payload) => payload[0]?.payload.mesCompleto || label}
            />
            <Bar 
              dataKey="vendas" 
              fill="#07593f" 
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}