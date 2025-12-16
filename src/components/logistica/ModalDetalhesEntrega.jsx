import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, MapPin, User, Phone, Wrench, Save } from "lucide-react";

export default function ModalDetalhesEntrega({ entrega, venda, onClose }) {
  const queryClient = useQueryClient();
  const [itensMontagem, setItensMontagem] = useState(
    entrega.itens_montagem_interna || []
  );

  const atualizarEntregaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      onClose();
    }
  });

  const toggleItemMontagem = (itemNome) => {
    const itemExiste = (itensMontagem || []).find(i => i.produto_nome === itemNome);
    
    if (itemExiste) {
      setItensMontagem((itensMontagem || []).filter(i => i.produto_nome !== itemNome));
    } else {
      const itemVenda = venda?.itens?.find(i => i.produto_nome === itemNome);
      if (itemVenda) {
        setItensMontagem([...(itensMontagem || []), {
          produto_nome: itemNome,
          quantidade: itemVenda.quantidade,
          montado: false
        }]);
      }
    }
  };

  const salvarMontagem = async () => {
    await atualizarEntregaMutation.mutateAsync({
      id: entrega.id,
      data: { 
        itens_montagem_interna: itensMontagem,
        montagem_concluida: false
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Detalhes da Entrega #{entrega.numero_pedido}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">{entrega.cliente_nome}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{entrega.cliente_telefone}</span>
            </div>
          </div>

          {/* Endereço */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-600 mt-0.5" />
              <span className="text-sm">{entrega.endereco_entrega}</span>
            </div>
          </div>

          {/* Itens da Venda */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold">Selecionar Itens para Montagem Interna</h3>
            </div>
            <div className="space-y-2">
              {(venda?.itens || []).map((item, index) => {
                const selecionado = (itensMontagem || []).some(i => i.produto_nome === item.produto_nome);
                return (
                  <div 
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      selecionado 
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300'
                    }`}
                    onClick={() => toggleItemMontagem(item.produto_nome)}
                  >
                    <Checkbox 
                      checked={selecionado}
                      onCheckedChange={() => toggleItemMontagem(item.produto_nome)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.produto_nome}</p>
                      <p className="text-xs text-gray-500">Qtd: {item.quantidade}</p>
                    </div>
                    {selecionado && (
                      <Badge className="bg-orange-500 text-white">
                        Para Montar
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumo */}
          {itensMontagem.length > 0 && (
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-400 font-medium">
                ⚠️ {itensMontagem.length} {itensMontagem.length === 1 ? 'item será enviado' : 'itens serão enviados'} para os montadores internos
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={salvarMontagem}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}