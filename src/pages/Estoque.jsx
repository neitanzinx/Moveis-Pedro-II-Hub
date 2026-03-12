import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, AlertTriangle, ArrowRightLeft,
  ClipboardCheck, Building2, Plus, Loader2, Upload, Truck, ScanBarcode
} from "lucide-react";

// Tab Components
import EstoqueTab from "../components/estoque/EstoqueTab";
import BipagemTab from "../components/estoque/BipagemTab";

import TransferenciasTab from "../components/estoque/TransferenciasTab";
import InventarioTab from "../components/estoque/InventarioTab";
import RecebimentosTab from "../components/estoque/RecebimentosTab";

export default function Estoque() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("estoque");

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });



  const { data: transferencias = [] } = useQuery({
    queryKey: ['transferencias-estoque'],
    queryFn: () => base44.entities.TransferenciaEstoque.list(),
  });


  const transferenciasPendentes = transferencias.filter(t => t.status === 'Pendente').length;

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-compra-recebimento-count'],
    queryFn: async () => {
      const { data } = await base44.entities.PedidoCompra.search({ limit: 100 });
      return data.filter(p => ['Enviado', 'Confirmado', 'Em Conferência', 'Parcialmente Recebido'].includes(p.status));
    }
  });
  const pedidosPendentes = pedidos.length;

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "estoque", label: "Produtos", icon: Package, count: produtos.length },
    { id: "recebimentos", label: "Recebimentos", icon: Truck, count: pedidosPendentes, variant: "default" },
    { id: "transferencias", label: "Transferências", icon: ArrowRightLeft, count: transferenciasPendentes },
    { id: "bipagem", label: "Bipagem Rápida", icon: ScanBarcode },
    { id: "inventario", label: "Inventário", icon: ClipboardCheck },
  ];

  const handleNovoProduto = () => {
    window.dispatchEvent(new CustomEvent('estoque-header-action', { detail: 'estoque' }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header simples */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque</h1>
          <p className="text-sm text-gray-500">Gerencie produtos, movimentacoes e estoque</p>
        </div>

        {activeTab === "estoque" && (
          <Button
            onClick={handleNovoProduto}
            className="bg-green-700 hover:bg-green-800 text-white font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full md:w-max h-auto p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-gray-200 hover:bg-white/50 whitespace-nowrap"
            >
              <tab.icon className="w-4 h-4 transition-colors" />
              <span className="font-semibold text-sm">{tab.label}</span>
              {tab.count > 0 && (
                <Badge
                  variant={tab.variant || "secondary"}
                  className={`ml-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full ${tab.variant === "destructive"
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                    }`}
                >
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="estoque" className="m-0">
            <EstoqueTab user={user} />
          </TabsContent>
          <TabsContent value="transferencias" className="m-0">
            <TransferenciasTab user={user} />
          </TabsContent>
          <TabsContent value="recebimentos" className="m-0">
            <RecebimentosTab />
          </TabsContent>
          <TabsContent value="bipagem" className="m-0">
            <BipagemTab />
          </TabsContent>
          <TabsContent value="inventario" className="m-0">
            <InventarioTab user={user} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}