import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, AlertCircle, Plus, Calendar, BarChart3, PieChart } from "lucide-react";
import FinanceiroStats from "../components/financeiro/FinanceiroStats";
import LancamentoForm from "../components/financeiro/LancamentoForm";
import LancamentosList from "../components/financeiro/LancamentosList";
import FinanceiroCharts from "../components/financeiro/FinanceiroCharts";
import CategoriasManager from "../components/financeiro/CategoriasManager";
import RecorrentesManager from "../components/financeiro/RecorrentesManager";

export default function Financeiro() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("lancamentos");
  const [mesAno, setMesAno] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { base44.auth.me().then(setUser).catch(console.error); }, []);

  // 1. BLINDAGEM: queryFn assíncrona com fallback "|| []"
  const { data: lancamentos = [], isLoading } = useQuery({ 
    queryKey: ['lancamentos-financeiros'], 
    queryFn: async () => await base44.entities.LancamentoFinanceiro.list('-data_lancamento') || [], 
    initialData: [] 
  });

  const { data: categorias = [] } = useQuery({ 
    queryKey: ['categorias-financeiras'], 
    queryFn: async () => await base44.entities.CategoriaFinanceira.list('nome') || [], 
    initialData: [] 
  });

  if (!user) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  const isAdmin = user.cargo === 'Administrador';
  const isManager = user.cargo === 'Gerente';

  if (!isAdmin && !isManager) {
    return (
        <div className="flex items-center justify-center h-[60vh]">
             <div className="text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h2 className="text-lg font-semibold">Acesso Restrito</h2>
             </div>
        </div>
    );
  }

  // 2. BLINDAGEM: Garante que é array antes de filtrar
  const listaLancamentos = Array.isArray(lancamentos) ? lancamentos : [];
  
  const lancamentosDoMes = listaLancamentos.filter(l => l.data_lancamento?.slice(0, 7) === mesAno);
  
  const totalEntradas = lancamentosDoMes
    .filter(l => l.tipo === 'Entrada')
    .reduce((sum, l) => sum + (l.valor || 0), 0);
    
  const totalSaidas = lancamentosDoMes
    .filter(l => l.tipo === 'Saída')
    .reduce((sum, l) => sum + (l.valor || 0), 0);
    
  const saldo = totalEntradas - totalSaidas;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle Financeiro</h1>
            <p className="text-sm text-gray-500">Gestão de fluxo de caixa</p>
        </div>
        <input 
            type="month" 
            value={mesAno} 
            onChange={e => setMesAno(e.target.value)} 
            className="border rounded px-3 py-2 text-sm bg-white dark:bg-neutral-900 dark:border-neutral-800"
        />
      </div>

      <FinanceiroStats totalEntradas={totalEntradas} totalSaidas={totalSaidas} saldo={saldo} lancamentos={lancamentosDoMes} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-white dark:bg-neutral-900 p-1 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-x-auto">
            <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-2">
                {[
                    { id: "lancamentos", label: "Lançamentos", icon: DollarSign },
                    { id: "recorrentes", label: "Recorrentes", icon: Calendar },
                    { id: "graficos", label: "Gráficos", icon: BarChart3 },
                    { id: "categorias", label: "Categorias", icon: PieChart },
                    { id: "novo", label: "Novo Lançamento", icon: Plus }
                ].map(tab => (
                    <TabsTrigger 
                        key={tab.id} 
                        value={tab.id}
                        className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-green-100 dark:data-[state=active]:border-green-900 transition-all"
                    >
                        <tab.icon className="w-4 h-4 mr-2" />
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </div>

        <div className="mt-6">
            <TabsContent value="lancamentos">
              <LancamentosList lancamentos={lancamentosDoMes} categorias={categorias} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="recorrentes">
              <RecorrentesManager lancamentos={listaLancamentos} />
            </TabsContent>
            <TabsContent value="graficos">
              <FinanceiroCharts lancamentos={lancamentosDoMes} categorias={categorias} mesAno={mesAno} />
            </TabsContent>
            <TabsContent value="categorias">
              <CategoriasManager categorias={categorias} />
            </TabsContent>
            <TabsContent value="novo">
              <LancamentoForm categorias={categorias} />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}