import React, { useState, useMemo } from "react";
import { base44 } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, AlertCircle, Plus, BarChart3,
  LayoutDashboard, TrendingDown, TrendingUp
} from "lucide-react";
import VisaoGeral from "../components/financeiro/VisaoGeral";
import ContasReceber from "../components/financeiro/ContasReceber";
import ContasPagar from "../components/financeiro/ContasPagar";
import LancamentoForm from "../components/financeiro/LancamentoForm";
import LancamentosList from "../components/financeiro/LancamentosList";
import FinanceiroCharts from "../components/financeiro/FinanceiroCharts";
import RecorrentesManager from "../components/financeiro/RecorrentesManager";


export default function Financeiro() {
  const { user, loading, can } = useAuth();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [mesAno, setMesAno] = useState(new Date().toISOString().slice(0, 7));
  const canViewFinanceiro = can('view_financeiro') || can('manage_financeiro');
  const canManage = can('manage_financeiro');

  const queryOpts = { enabled: !!user && canViewFinanceiro };

  const { data: lancamentos = [], isLoading: loadingLancamentos } = useQuery({
    queryKey: ['lancamentos-financeiros'],
    queryFn: async () => await base44.entities.LancamentoFinanceiro.list('-data_lancamento') || [],
    ...queryOpts,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-financeiras'],
    queryFn: async () => await base44.entities.CategoriaFinanceira.list('nome') || [],
    ...queryOpts,
  });

  const { data: vendas = [], isLoading: loadingVendas } = useQuery({
    queryKey: ['vendas-financeiro'],
    queryFn: async () => await base44.entities.Venda.list('-data_venda') || [],
    ...queryOpts,
  });

  const { data: folhas = [], isLoading: loadingFolhas } = useQuery({
    queryKey: ['folhas-pagamento'],
    queryFn: async () => await base44.entities.FolhaPagamento.list('-created_at') || [],
    ...queryOpts,
  });

  const { data: comissoes = [], isLoading: loadingComissoes } = useQuery({
    queryKey: ['comissoes-historico'],
    queryFn: async () => await base44.entities.ComissaoHistorico.list('-data_calculo') || [],
    ...queryOpts,
  });

  const { data: contasPagarCompras = [], isLoading: loadingCompras } = useQuery({
    queryKey: ['contas-pagar-compras'],
    queryFn: async () => {
      try {
        return await base44.entities.ContaPagarCompras.list('-created_at') || [];
      } catch {
        // tabela pode não existir em todos os ambientes
        return [];
      }
    },
    ...queryOpts,
  });

  const { data: metas = [] } = useQuery({
    queryKey: ['metas-vendas'],
    queryFn: async () => await base44.entities.MetaVenda.list() || [],
    ...queryOpts,
  });

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!canViewFinanceiro) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
        </div>
      </div>
    );
  }

  const listaLancamentos = Array.isArray(lancamentos) ? lancamentos : [];
  const lancamentosDoMes = listaLancamentos.filter(
    (l) => l.data_lancamento?.slice(0, 7) === mesAno
  );
  const vendasDoMes = vendas.filter(
    (v) => v.data_venda?.slice(0, 7) === mesAno && v.status !== "Cancelada"
  );

  const TABS = [
    { id: "visao-geral",    label: "Visão Geral",       icon: LayoutDashboard },
    { id: "contas-receber", label: "A Receber",          icon: TrendingDown },
    { id: "contas-pagar",   label: "A Pagar",            icon: TrendingUp },
    { id: "lancamentos",    label: "Lançamentos",        icon: DollarSign },
    { id: "graficos",       label: "Gráficos",           icon: BarChart3 },
    ...(canManage ? [{ id: "novo", label: "Novo", icon: Plus }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle Financeiro</h1>
          <p className="text-sm text-gray-500">Gestão financeira integrada</p>
        </div>
        <input
          type="month"
          value={mesAno}
          onChange={(e) => setMesAno(e.target.value)}
          className="border rounded px-3 py-2 text-sm bg-white dark:bg-neutral-900 dark:border-neutral-800"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Tab nav */}
        <div className="bg-white dark:bg-neutral-900 p-1 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-x-auto">
          <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-1">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-green-100 dark:data-[state=active]:border-green-900 transition-all whitespace-nowrap"
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4">
          <TabsContent value="visao-geral">
            <VisaoGeral
              vendas={vendas}
              lancamentos={listaLancamentos}
              folhas={folhas}
              comissoes={comissoes}
              contasPagarCompras={contasPagarCompras}
              metas={metas}
              mesAno={mesAno}
            />
          </TabsContent>

          <TabsContent value="contas-receber">
            <ContasReceber vendas={vendas} isLoading={loadingVendas} />
          </TabsContent>

          <TabsContent value="contas-pagar">
            <ContasPagar
              folhas={folhas}
              comissoes={comissoes}
              contasPagarCompras={contasPagarCompras}
              lancamentos={listaLancamentos}
              mesAno={mesAno}
              isLoadingFolha={loadingFolhas}
              isLoadingComissoes={loadingComissoes}
              isLoadingCompras={loadingCompras}
              isLoadingLancamentos={loadingLancamentos}
            />
          </TabsContent>

          <TabsContent value="lancamentos">
            <div className="space-y-4">
              <LancamentosList
                lancamentos={lancamentosDoMes}
                categorias={categorias}
                isLoading={loadingLancamentos}
              />
              <RecorrentesManager lancamentos={listaLancamentos} />
            </div>
          </TabsContent>

          <TabsContent value="graficos">
            <FinanceiroCharts
              lancamentos={lancamentosDoMes}
              categorias={categorias}
              mesAno={mesAno}
              vendas={vendasDoMes}
            />
          </TabsContent>

          <TabsContent value="categorias">
            {/* removido — categorias agora ficam dentro do formulário de lançamento */}
          </TabsContent>

          {canManage && (
            <TabsContent value="novo">
              <LancamentoForm categorias={categorias} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}