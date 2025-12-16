import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Warehouse, Package, AlertTriangle, ArrowRightLeft, ClipboardCheck, Building2, Truck } from "lucide-react";

// Tab Components
import EstoqueTab from "../components/estoque/EstoqueTab";
import FornecedoresTab from "../components/estoque/FornecedoresTab";
import MovimentacaoTab from "../components/estoque/MovimentacaoTab";
import AlertasTab from "../components/estoque/AlertasTab";
import TransferenciasTab from "../components/estoque/TransferenciasTab";
import InventarioTab from "../components/estoque/InventarioTab";

export default function Estoque() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("estoque");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  if (!user) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  const tabs = [
    { id: "estoque", label: "Estoque", icon: Warehouse },
    { id: "movimentacao", label: "Movimentação", icon: Package },
    { id: "fornecedores", label: "Fornecedores", icon: Building2 },
    { id: "alertas", label: "Alertas", icon: AlertTriangle },
    { id: "transferencias", label: "Transferências", icon: ArrowRightLeft },
    { id: "inventario", label: "Inventário", icon: ClipboardCheck },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque</h1>
        <p className="text-sm text-gray-500">Controle de produtos e movimentações</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="bg-white dark:bg-neutral-900 p-1 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-x-auto">
            <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-2">
                {tabs.map(tab => (
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
            <TabsContent value="estoque"><EstoqueTab user={user} /></TabsContent>
            <TabsContent value="movimentacao"><MovimentacaoTab /></TabsContent>
            <TabsContent value="fornecedores"><FornecedoresTab user={user} /></TabsContent>
            <TabsContent value="alertas"><AlertasTab user={user} /></TabsContent>
            <TabsContent value="transferencias"><TransferenciasTab user={user} /></TabsContent>
            <TabsContent value="inventario"><InventarioTab user={user} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}