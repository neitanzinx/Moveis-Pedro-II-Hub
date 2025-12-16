import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Unlock, Clock, MapPin, Package } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function AguardandoLiberacao({ entregas, vendas }) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const liberarEntregaMutation = useMutation({
    mutationFn: (id) => base44.entities.Entrega.update(id, {
      status: 'Pendente', // Volta para ser um pedido "Pendente" normal
      data_agendada: null,
      turno: null,
      observacoes: "Entrega liberada pelo cliente."
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      alert("Pedido liberado! Ele voltou para a Triagem.");
    }
  });

  const entregasFiltradas = entregas.filter(e => {
    const termo = search.toLowerCase();
    return (
      e.cliente_nome?.toLowerCase().includes(termo) ||
      e.numero_pedido?.toString().includes(termo) ||
      e.endereco_entrega?.toLowerCase().includes(termo)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="p-3 bg-amber-100 rounded-full text-amber-700">
          <Clock className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800">Aguardando Liberação do Cliente</h2>
          <p className="text-sm text-gray-500">Pedidos reservados que precisam de autorização para entrega (ex: obra atrasada)</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Buscar cliente ou pedido..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entregasFiltradas.length > 0 ? (
          entregasFiltradas.map(entrega => {
            const venda = (vendas || []).find(v => v.id === entrega.venda_id);
            const itens = venda?.itens?.map(i => `${i.quantidade}x ${i.produto_nome}`).join(', ');

            return (
              <Card key={entrega.id} className="hover:shadow-md transition-all border-l-4 border-l-amber-400">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="font-mono">#{entrega.numero_pedido}</Badge>
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(entrega.created_date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-gray-800 mb-1">{entrega.cliente_nome}</h3>
                  
                  <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 mb-3 flex gap-2">
                    <Package className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
                    <p className="line-clamp-2">{itens || "Sem itens"}</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{entrega.endereco_entrega}</span>
                  </div>

                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 gap-2"
                    onClick={() => {
                        if(confirm(`Liberar entrega do pedido #${entrega.numero_pedido}? Ele voltará para a Triagem.`)) {
                            liberarEntregaMutation.mutate(entrega.id);
                        }
                    }}
                  >
                    <Unlock className="w-4 h-4" />
                    Entrega Liberada
                  </Button>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>Nenhum pedido aguardando liberação.</p>
          </div>
        )}
      </div>
    </div>
  );
}