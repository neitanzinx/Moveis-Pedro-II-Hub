import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Calendar, Truck, CheckCircle, Clock, AlertCircle } from "lucide-react";
import EntregasPendentes from "../components/entregas/EntregasPendentes";
import EntregasAgendadas from "../components/entregas/EntregasAgendadas";
import EntregasConcluidas from "../components/entregas/EntregasConcluidas";
import BaixaEntregaRapida from "../components/entregas/BaixaEntregaRapida";
import BotaoConfirmacaoWhatsApp from "../components/entregas/BotaoConfirmacaoWhatsApp";

export default function Entregas() {
  // Começa na aba "A Confirmar" pra você ver a ação acontecendo
  const [activeTab, setActiveTab] = useState("a_confirmar");
  const queryClient = useQueryClient();

  // --- MODO TEMPO REAL ATIVADO ---
  const { data: entregas = [] } = useQuery({ 
    queryKey: ['entregas'], 
    queryFn: () => base44.entities.Entrega.list('-created_date'),
    refetchInterval: 5000 // <--- O SEGREDO: Atualiza a cada 5 segundos
  });

  const { data: vendas = [] } = useQuery({ 
    queryKey: ['vendas'], 
    queryFn: () => base44.entities.Venda.list(),
    refetchInterval: 30000 
  });

  const { data: clientes = [] } = useQuery({ 
    queryKey: ['clientes'], 
    queryFn: () => base44.entities.Cliente.list() 
  });

  // --- FILTROS DO FUNIL LOGÍSTICO ---
  
  // 1. A Agendar: Não tem data definida ainda
  const entregasAAgendar = entregas.filter(e => 
    e.status === 'Pendente' && !e.data_agendada
  );
  
  // 2. A Confirmar: Tem data, mas não tá 'Confirmada'
  const entregasAConfirmar = entregas.filter(e => 
    e.status === 'Pendente' && 
    e.data_agendada && 
    e.status_confirmacao !== 'Confirmada'
  );
  
  // 3. Confirmadas: Tem data e status 'Confirmada'
  const entregasConfirmadas = entregas.filter(e => 
    e.status === 'Pendente' && 
    e.data_agendada && 
    e.status_confirmacao === 'Confirmada'
  );

  // 4. Concluídas: Já foi entregue
  const entregasConcluidas = entregas.filter(e => e.status === 'Entregue');

  const tabs = [
    { 
      id: "a_agendar", 
      label: "A Agendar", 
      count: entregasAAgendar.length, 
      icon: Package, 
      color: "orange" 
    },
    { 
      id: "a_confirmar", 
      label: "A Confirmar", 
      count: entregasAConfirmar.length, 
      icon: Clock, 
      color: "yellow" 
    },
    { 
      id: "confirmadas", 
      label: "Confirmadas", 
      count: entregasConfirmadas.length, 
      icon: CheckCircle, 
      color: "blue" 
    },
    { 
      id: "concluidas", 
      label: "Concluídas", 
      count: entregasConcluidas.length, 
      icon: Truck, 
      color: "green" 
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Truck className="w-7 h-7 text-green-700" />
            Gestão de Entregas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Controle de expedição e logística (Atualização em Tempo Real 🟢)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Ferramenta de Baixa Rápida (Sempre visível) */}
          <BaixaEntregaRapida entregas={entregas} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-white dark:bg-neutral-900 p-1.5 rounded-xl border border-gray-200 dark:border-neutral-800">
          <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-2 flex-wrap">
            {tabs.map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className={`
                  py-3 px-5 h-auto rounded-lg border border-transparent transition-all flex items-center gap-2 flex-1 min-w-[140px]
                  data-[state=active]:shadow-sm
                  ${tab.color === 'orange' ? 'data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200' : ''}
                  ${tab.color === 'yellow' ? 'data-[state=active]:bg-yellow-50 data-[state=active]:text-yellow-700 data-[state=active]:border-yellow-200' : ''}
                  ${tab.color === 'blue' ? 'data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200' : ''}
                  ${tab.color === 'green' ? 'data-[state=active]:bg-green-50 data-[state=active]:text-green-700 data-[state=active]:border-green-200' : ''}
                `}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 border border-black/5`}>
                  {tab.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="a_agendar" className="m-0">
            <EntregasPendentes 
              entregas={entregasAAgendar} 
              vendas={vendas} 
              clientes={clientes} 
            />
          </TabsContent>
          
          <TabsContent value="a_confirmar" className="m-0">
            <EntregasAgendadas 
              entregas={entregasAConfirmar} 
              vendas={vendas} 
              clientes={clientes}
              mostrarBotaoRobo={true} 
              titulo="Aguardando Confirmação"
            />
          </TabsContent>

          <TabsContent value="confirmadas" className="m-0">
            <EntregasAgendadas 
              entregas={entregasConfirmadas} 
              vendas={vendas} 
              clientes={clientes}
              mostrarBotaoRobo={false}
              titulo="Entregas Confirmadas"
            />
          </TabsContent>
          
          <TabsContent value="concluidas" className="m-0">
            <EntregasConcluidas 
              entregas={entregasConcluidas} 
              vendas={vendas}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}