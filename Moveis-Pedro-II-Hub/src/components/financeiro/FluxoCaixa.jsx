import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

export default function FluxoCaixa({ parcelas, vendas }) {
  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        mes: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        mesCompleto: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        recebido: 0,
        pendente: 0,
        monthYear: `${date.getMonth()}-${date.getFullYear()}`
      });
    }
    return months;
  };

  const data = getLast6Months();
  
  // Parcelas pagas
  parcelas.filter(p => p.status === 'Paga' && p.data_pagamento).forEach(parcela => {
    const dataPagamento = new Date(parcela.data_pagamento);
    const monthYear = `${dataPagamento.getMonth()}-${dataPagamento.getFullYear()}`;
    const mes = data.find(m => m.monthYear === monthYear);
    if (mes) {
      mes.recebido += parcela.valor_parcela || 0;
    }
  });

  // Parcelas pendentes/atrasadas
  parcelas.filter(p => (p.status === 'Pendente' || p.status === 'Atrasada')).forEach(parcela => {
    const dataVencimento = new Date(parcela.data_vencimento);
    const monthYear = `${dataVencimento.getMonth()}-${dataVencimento.getFullYear()}`;
    const mes = data.find(m => m.monthYear === monthYear);
    if (mes) {
      mes.pendente += parcela.valor_parcela || 0;
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#07593f', opacity: 0.1 }}>
            <TrendingUp className="w-5 h-5" style={{ color: '#07593f' }} />
          </div>
          <CardTitle style={{ color: '#07593f' }}>Fluxo de Caixa</CardTitle>
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
              formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
              labelFormatter={(label, payload) => payload[0]?.payload.mesCompleto || label}
            />
            <Legend />
            <Bar 
              dataKey="recebido" 
              name="Recebido"
              fill="#07593f" 
              radius={[8, 8, 0, 0]}
            />
            <Bar 
              dataKey="pendente" 
              name="Pendente"
              fill="#f38a4c" 
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}