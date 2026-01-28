import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Activity, PieChart } from "lucide-react";

export default function FinanceiroStats({ totalEntradas, totalSaidas, saldo, lancamentos }) {
  const lancamentosEntradas = lancamentos.filter(l => l.tipo === 'Entrada' || l.tipo === 'receita');
  const lancamentosSaidas = lancamentos.filter(l => l.tipo === 'Saída' || l.tipo === 'despesa');

  const mediaEntradas = lancamentosEntradas.length > 0
    ? totalEntradas / lancamentosEntradas.length
    : 0;

  const mediaSaidas = lancamentosSaidas.length > 0
    ? totalSaidas / lancamentosSaidas.length
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
            Total Entradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">
                R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>
                {lancamentosEntradas.length} lançamento(s)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
            Total Saídas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-600">
                R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>
                {lancamentosSaidas.length} lançamento(s)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
            Saldo do Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8" style={{ color: saldo >= 0 ? '#07593f' : '#dc2626' }} />
            <div>
              <p
                className="text-2xl font-bold"
                style={{ color: saldo >= 0 ? '#07593f' : '#dc2626' }}
              >
                R$ {Math.abs(saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>
                {saldo >= 0 ? 'Superávit' : 'Déficit'}
              </p>
            </div>
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
            <PieChart className="w-8 h-8" style={{ color: '#f38a4c' }} />
            <div>
              <p className="text-lg font-bold" style={{ color: '#f38a4c' }}>
                R$ {mediaEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>
                Média por entrada
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}