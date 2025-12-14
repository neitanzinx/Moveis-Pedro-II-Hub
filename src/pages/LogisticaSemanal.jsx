import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Package, Clock } from "lucide-react";
import DashboardLogistica from "@/components/logistica/DashboardLogistica";
import KanbanRotasSemanal from "@/components/logistica/KanbanRotasSemanal";
import MontagemInterna from "@/components/logistica/MontagemInterna";
import AguardandoLiberacao from "@/components/logistica/AguardandoLiberacao"; // <--- NOVO
import ChatEquipe from "@/components/logistica/ChatEquipe";

export default function LogisticaSemanal() {
  const [tabAtiva, setTabAtiva] = useState("planejamento");

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['entregas'],
    queryFn: () => base44.entities.Entrega.list(),
    initialData: [],
    refetchInterval: 5000
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list(),
    initialData: [],
  });

  const hoje = new Date();
  const fimSemana = new Date(hoje);
  fimSemana.setDate(hoje.getDate() + 6);

  // 1. Pendentes (Triagem)
  const entregasPendentes = entregas.filter(e => 
    (e.status === 'Pendente' || !e.status) && !e.data_agendada
  );

  // 2. Aguardando Liberação (NOVA LISTA)
  const entregasAguardando = entregas.filter(e => 
    e.status === 'Aguardando Liberação'
  );

  // 3. Montagem
  const entregasMontagemInterna = entregas.filter(e => 
    e.itens_montagem_interna?.length > 0 && !e.montagem_concluida
  );

  // 4. Semanal (Colunas)
  const colunasSemana = [];
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  for (let i = 0; i < 6; i++) {
    const data = new Date();
    data.setDate(hoje.getDate() + i);
    const dataStr = data.toISOString().split('T')[0];
    const diaSemana = diasSemana[data.getDay()];
    
    colunasSemana.push({
      id: dataStr,
      titulo: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `${diaSemana} (${data.getDate()}/${data.getMonth()+1})`,
      data: dataStr,
      entregas: (entregas || []).filter(e => e.data_agendada === dataStr && e.status !== 'Entregue' && e.status !== 'Cancelada' && e.status !== 'Aguardando Liberação'),
      isHoje: i === 0,
      dataFormatada: data.toLocaleDateString('pt-BR')
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Logística Semanal</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Planejamento e rastreamento de entregas
          </p>
        </div>
      </div>

      <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="planejamento" className="gap-2">
            <MapPin className="w-4 h-4" />
            Planejamento
          </TabsTrigger>
          <TabsTrigger value="montagem" className="gap-2">
            <Calendar className="w-4 h-4" />
            Montagem ({entregasMontagemInterna.length})
          </TabsTrigger>
          <TabsTrigger value="aguardando" className="gap-2">
            <Clock className="w-4 h-4" />
            Aguardando ({entregasAguardando.length})
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <Package className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planejamento" className="space-y-4 mt-6">
          <KanbanRotasSemanal 
            entregas={entregas}
            vendas={vendas}
            entregasPendentes={entregasPendentes}
            colunasSemana={colunasSemana}
          />
        </TabsContent>

        <TabsContent value="montagem" className="mt-6">
          <MontagemInterna entregas={entregasMontagemInterna} />
        </TabsContent>

        <TabsContent value="aguardando" className="mt-6">
          <AguardandoLiberacao entregas={entregasAguardando} vendas={vendas} />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4 mt-6">
          <DashboardLogistica entregas={entregas} colunas={colunasSemana} />
        </TabsContent>
      </Tabs>

      <ChatEquipe />
    </div>
  );
}