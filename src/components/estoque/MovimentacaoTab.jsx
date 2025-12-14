import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, FileText } from "lucide-react";
import MovimentacaoEstoque from "./MovimentacaoEstoque";
import CadastroRapido from "./CadastroRapido";
import ImportarNFe from "./ImportarNFe";

export default function MovimentacaoTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="movimentacao" className="space-y-6">
        <div className="bg-white dark:bg-neutral-900 p-1 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-x-auto">
            <TabsList className="h-auto bg-transparent p-0 w-full justify-start gap-2">
                <TabsTrigger 
                    value="movimentacao" 
                    className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/20 dark:data-[state=active]:text-blue-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-blue-100 dark:data-[state=active]:border-blue-900 transition-all"
                >
                    <Package className="w-4 h-4 mr-2" />
                    Entrada/Saída Manual
                </TabsTrigger>
                <TabsTrigger 
                    value="nfe"
                    className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-900/20 dark:data-[state=active]:text-orange-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-orange-100 dark:data-[state=active]:border-orange-900 transition-all"
                >
                    <FileText className="w-4 h-4 mr-2" />
                    Entrada via NFe (XML)
                </TabsTrigger>
                <TabsTrigger 
                    value="cadastro"
                    className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/20 dark:data-[state=active]:text-purple-400 py-2.5 px-4 h-auto rounded-lg border border-transparent data-[state=active]:border-purple-100 dark:data-[state=active]:border-purple-900 transition-all"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastro Rápido
                </TabsTrigger>

            </TabsList>
        </div>

        <div className="mt-6">
            <TabsContent value="movimentacao" className="m-0">
                <MovimentacaoEstoque />
            </TabsContent>
            <TabsContent value="nfe" className="m-0">
                <ImportarNFe />
            </TabsContent>
            <TabsContent value="cadastro" className="m-0">
                <CadastroRapido />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}