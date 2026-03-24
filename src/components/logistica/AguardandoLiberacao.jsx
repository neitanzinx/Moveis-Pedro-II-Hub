import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Unlock, Clock, MapPin, Package, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AguardandoLiberacao({ entregas, vendas }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [modalLiberarEntrega, setModalLiberarEntrega] = useState(null); // { entregaId, pedido }
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
      toast.success("Entrega liberada! O pedido voltou para a Triagem.");
      setModalLiberarEntrega(null);
    },
    onError: () => {
      toast.error("Erro ao liberar entrega.");
    }
  });

  const confirmarLiberarEntrega = () => {
    if (!modalLiberarEntrega) return;
    liberarEntregaMutation.mutate(modalLiberarEntrega.entregaId);
  };

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

            // Apenas o vendedor da venda, Logística ou admin pode liberar
            const isAdmin = user?.cargo === 'Administrador';
            const isLogistica = user?.cargo === 'Logística';
            const isVendedorDaVenda = venda?.responsavel_id === user?.id;
            const isGerenteDaLoja = user?.cargo === 'Gerente' && venda?.loja === user?.loja;

            const podeLiberar = isAdmin || isLogistica || isVendedorDaVenda || isGerenteDaLoja;


            return (
              <Card key={entrega.id} className="hover:shadow-md transition-all border-l-4 border-l-amber-400">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="font-mono">#{entrega.numero_pedido}</Badge>
                    <span className="text-xs text-gray-400 font-medium">
                      {entrega.created_date ? new Date(entrega.created_date).toLocaleDateString() : '-'}
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

                  {podeLiberar ? (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 gap-2"
                      onClick={() => {
                        setModalLiberarEntrega({
                          entregaId: entrega.id,
                          pedido: entrega.numero_pedido
                        });
                      }}
                      disabled={liberarEntregaMutation.isPending}
                    >
                      <Unlock className="w-4 h-4" />
                      Entrega Liberada
                    </Button>
                  ) : (
                    <div className="text-[10px] text-gray-400 italic bg-gray-50 px-3 py-2 rounded border border-gray-100 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      Aguardando Liberação do Vendedor/Gerente
                    </div>
                  )}
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

      {/* Modal de Liberar Entrega */}
      <Dialog open={!!modalLiberarEntrega} onOpenChange={(open) => !open && setModalLiberarEntrega(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Unlock className="w-5 h-5" />
              Confirmar Liberação de Entrega
            </DialogTitle>
            <DialogDescription>
              Autorizar que a logística processe esta entrega.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700 mb-4">
              <strong>Pedido:</strong> #{modalLiberarEntrega?.pedido}
            </p>
            <p className="text-sm text-gray-600">
              Após confirmar, o pedido voltará para a fila de triagem da logística e poderá ser agendado para entrega.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalLiberarEntrega(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarLiberarEntrega}
              disabled={liberarEntregaMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {liberarEntregaMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Liberando...</>
              ) : (
                <><Unlock className="w-4 h-4 mr-2" />Confirmar Liberação</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}