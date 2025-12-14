import React from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Package, TrendingUp, CheckCircle, Clock, Truck, Box } from "lucide-react";
import RastreadorFrota from "./RastreadorFrota";

export default function DashboardLogistica({ entregas, colunas }) {
  // KPI 1: Entregas por dia da semana
  const entregasPorDia = colunas.map(col => ({
    dia: col.titulo,
    entregas: col.entregas.length
  }));

  // KPI 2: Status de Montagem
  const comMontagem = entregas.filter(e => e.itens_montagem_interna?.length > 0);
  const montagemConcluida = comMontagem.filter(e => e.montagem_concluida).length;
  const montagemPendente = comMontagem.length - montagemConcluida;
  
  const dadosMontagem = [
    { name: "Concluídas", value: montagemConcluida, color: "#10b981" },
    { name: "Pendentes", value: montagemPendente, color: "#f59e0b" }
  ];

  // KPI 3: Tempo médio até data limite
  const entregasComData = entregas.filter(e => e.data_agendada && e.data_limite);
  const tempoMedio = entregasComData.length > 0 
    ? entregasComData.reduce((acc, e) => {
        const agendada = new Date(e.data_agendada);
        const limite = new Date(e.data_limite);
        const diff = Math.ceil((limite - agendada) / (1000 * 60 * 60 * 24));
        return acc + diff;
      }, 0) / entregasComData.length
    : 0;

  // KPI 4: Volume total por dia (simulado - pode ser calculado com dados reais)
  const volumePorDia = colunas.map(col => ({
    dia: col.titulo,
    volume: col.entregas.reduce((acc, e) => acc + (e.volume_total_m3 || 0), 0)
  }));

  const totalEntregas = entregas.filter(e => e.data_agendada).length;
  const entregasHoje = entregas.filter(e => {
    if (!e.data_agendada) return false;
    const hoje = new Date().toISOString().split('T')[0];
    return e.data_agendada === hoje;
  }).length;

  return (
    <div className="space-y-4">
      {/* KPIs Principais */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 text-blue-600" />
            <span className="text-3xl font-bold text-blue-700">{totalEntregas}</span>
          </div>
          <p className="text-sm font-medium text-blue-800">Total Agendadas</p>
          <p className="text-xs text-blue-600 mt-1">Semana atual</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <Truck className="w-8 h-8 text-green-600" />
            <span className="text-3xl font-bold text-green-700">{entregasHoje}</span>
          </div>
          <p className="text-sm font-medium text-green-800">Entregas Hoje</p>
          <p className="text-xs text-green-600 mt-1">Em andamento</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-purple-600" />
            <span className="text-3xl font-bold text-purple-700">{montagemConcluida}</span>
          </div>
          <p className="text-sm font-medium text-purple-800">Montagens OK</p>
          <p className="text-xs text-purple-600 mt-1">{montagemPendente} pendentes</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-orange-600" />
            <span className="text-3xl font-bold text-orange-700">{tempoMedio.toFixed(0)}</span>
          </div>
          <p className="text-sm font-medium text-orange-800">Dias Médios</p>
          <p className="text-xs text-orange-600 mt-1">Até data limite</p>
        </Card>
      </div>

      {/* Gráficos e Rastreamento */}
      <div className="grid grid-cols-3 gap-4">
        {/* Coluna Esquerda: Gráficos */}
        <div className="col-span-2 space-y-4">
          <Card className="p-4">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Distribuição Semanal
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={entregasPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="entregas" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Volume Transportado (m³)
            </h3>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={volumePorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Coluna Direita: Rastreamento + Status Montagem */}
        <div className="col-span-1 space-y-4">
          <div className="h-[350px]">
            <RastreadorFrota />
          </div>

          <Card className="p-4">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Box className="w-4 h-4 text-purple-600" />
              Status Montagem
            </h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={dadosMontagem}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dadosMontagem.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}