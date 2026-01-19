import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, AlertTriangle, ArrowRightLeft,
  ClipboardCheck, Building2, Plus, Loader2, Upload
} from "lucide-react";

// Tab Components
import EstoqueTab from "../components/estoque/EstoqueTab";

import MovimentacaoTab from "../components/estoque/MovimentacaoTab";
import AlertasTab from "../components/estoque/AlertasTab";
import TransferenciasTab from "../components/estoque/TransferenciasTab";
import InventarioTab from "../components/estoque/InventarioTab";
import ImportarProdutos from "../components/estoque/ImportarProdutos";

export default function Estoque() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("estoque");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-recompra'],
    queryFn: () => base44.entities.AlertaRecompra.list(),
  });

  const { data: transferencias = [] } = useQuery({
    queryKey: ['transferencias-estoque'],
    queryFn: () => base44.entities.TransferenciaEstoque.list(),
  });

  const alertasAtivos = alertas.filter(a => a.status === 'Ativo').length;
  const transferenciasPendentes = transferencias.filter(t => t.status === 'Pendente').length;

  if (!user) {
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
    { id: "estoque", label: "Produtos", icon: Package, count: produtos.filter(p => !!p.is_parent).length },
    { id: "importar", label: "Importar", icon: Upload },
    { id: "movimentacao", label: "Movimentacao", icon: Package },
    { id: "alertas", label: "Alertas", icon: AlertTriangle, count: alertasAtivos, variant: "destructive" },
    { id: "transferencias", label: "Transferencias", icon: ArrowRightLeft, count: transferenciasPendentes },
    { id: "inventario", label: "Inventario", icon: ClipboardCheck },
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-4xl grid-cols-6">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <Badge
                  variant={tab.variant || "secondary"}
                  className={`ml-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold ${tab.variant === "destructive"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400"
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
          <TabsContent value="importar" className="m-0">
            <ImportarProdutos />
          </TabsContent>
          <TabsContent value="movimentacao" className="m-0">
            <MovimentacaoTab />
          </TabsContent>
          <TabsContent value="alertas" className="m-0">
            <AlertasTab user={user} />
          </TabsContent>
          <TabsContent value="transferencias" className="m-0">
            <TransferenciasTab user={user} />
          </TabsContent>
          <TabsContent value="inventario" className="m-0">
            <InventarioTab user={user} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}