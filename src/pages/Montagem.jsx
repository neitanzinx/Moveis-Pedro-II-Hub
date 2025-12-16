import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Wrench, Calendar, DollarSign, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import MontagemAgendamentos from "../components/montagem/MontagemAgendamentos";
import ValoresMontagem from "../components/montagem/ValoresMontagem";
import RelatorioMontadores from "../components/montagem/RelatorioMontadores";

export default function Montagem() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("agendamentos");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  const { data: montagens = [] } = useQuery({ queryKey: ['montagens'], queryFn: () => base44.entities.Montagem.list('-created_date'), initialData: [] });
  const { data: valores = [] } = useQuery({ queryKey: ['valores-montagem'], queryFn: () => base44.entities.ValorMontagem.list('modelo_movel'), initialData: [] });

  if (!user) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  const isAdmin = user.cargo === 'Administrador';
  const isFinanceiro = user.cargo === 'Financeiro';
  const isAgendamento = user.cargo === 'Agendamento';

  if (!isAdmin && !isFinanceiro && !isAgendamento) {
    return (
        <div className="flex items-center justify-center h-[60vh]">
             <div className="text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <h2 className="text-lg font-semibold">Acesso Restrito</h2>
             </div>
        </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Montagem</h1>
        <p className="text-sm text-gray-500">Agendamento e controle de montadores</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-white dark:bg-neutral-900 p-1 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-x-auto">
            <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-2">
                <TabsTrigger 
                    value="agendamentos"
                    className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-green-100 dark:data-[state=active]:border-green-900 transition-all"
                >
                    <Calendar className="w-4 h-4 mr-2" /> Agendamentos
                </TabsTrigger>
                <TabsTrigger 
                    value="valores"
                    className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-green-100 dark:data-[state=active]:border-green-900 transition-all"
                >
                    <FileText className="w-4 h-4 mr-2" /> Tabela de Valores
                </TabsTrigger>
                {(isAdmin || isFinanceiro) && (
                    <TabsTrigger 
                        value="relatorio"
                        className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900/20 dark:data-[state=active]:text-green-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-green-100 dark:data-[state=active]:border-green-900 transition-all"
                    >
                        <DollarSign className="w-4 h-4 mr-2" /> Fechamento
                    </TabsTrigger>
                )}
            </TabsList>
        </div>

        <div className="mt-6">
            <TabsContent value="agendamentos"><MontagemAgendamentos montagens={montagens} valores={valores} /></TabsContent>
            <TabsContent value="valores"><ValoresMontagem valores={valores} /></TabsContent>
            {(isAdmin || isFinanceiro) && <TabsContent value="relatorio"><RelatorioMontadores montagens={montagens} /></TabsContent>}
        </div>
      </Tabs>
    </div>
  );
}