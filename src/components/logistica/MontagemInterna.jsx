import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Clock, Package, User, Phone, MapPin } from "lucide-react";

export default function MontagemInterna({ entregas, vendas }) {
  const queryClient = useQueryClient();

  const atualizarItemMutation = useMutation({
    mutationFn: ({ entregaId, itens }) => 
      base44.entities.Entrega.update(entregaId, { 
        itens_montagem_interna: itens,
        montagem_concluida: itens.every(i => i.montado)
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

  const toggleItemMontado = async (entrega, itemIndex) => {
    const novosItens = [...entrega.itens_montagem_interna];
    novosItens[itemIndex].montado = !novosItens[itemIndex].montado;
    
    await atualizarItemMutation.mutateAsync({
      entregaId: entrega.id,
      itens: novosItens
    });
  };

  const finalizarEntrega = async (entrega) => {
    if (!confirm('Confirmar que todos os itens foram montados?')) return;
    
    const todosItens = entrega.itens_montagem_interna.map(i => ({ ...i, montado: true }));
    await atualizarItemMutation.mutateAsync({
      entregaId: entrega.id,
      itens: todosItens
    });
  };

  return (
    <div className="h-full overflow-y-auto p-4 max-w-4xl mx-auto">
      {/* Header Mobile */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-3">
          <Package className="w-8 h-8 text-orange-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Montagem Interna
        </h2>
        <p className="text-sm text-gray-500">
          Itens que precisam ser montados até amanhã
        </p>
      </div>

      {/* Lista de Entregas */}
      <div className="space-y-4">
        {entregas.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-3" />
            <p className="text-lg font-medium text-gray-700">Tudo certo!</p>
            <p className="text-sm text-gray-500">Nenhum item aguardando montagem</p>
          </Card>
        ) : (
          entregas.map(entrega => {
            const venda = vendas.find(v => v.id === entrega.venda_id);
            const totalItens = entrega.itens_montagem_interna?.length || 0;
            const itensMontados = entrega.itens_montagem_interna?.filter(i => i.montado).length || 0;
            const progresso = totalItens > 0 ? Math.round((itensMontados / totalItens) * 100) : 0;

            return (
              <Card key={entrega.id} className="p-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4 pb-3 border-b">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">#{entrega.numero_pedido}</h3>
                      <Badge className={progresso === 100 ? 'bg-green-500' : 'bg-orange-500'}>
                        {progresso}%
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{entrega.cliente_nome}</span>
                      </div>
                      {entrega.data_agendada && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>Entrega: {new Date(entrega.data_agendada).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {itensMontados} de {totalItens} itens montados
                  </p>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-2 mb-4">
                  {entrega.itens_montagem_interna?.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        item.montado
                          ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                          : 'border-orange-200 bg-orange-50 dark:bg-orange-900/20'
                      }`}
                      onClick={() => toggleItemMontado(entrega, index)}
                    >
                      <Checkbox checked={item.montado} />
                      <div className="flex-1">
                        <p className={`font-medium ${item.montado ? 'line-through text-gray-500' : ''}`}>
                          {item.produto_nome}
                        </p>
                        <p className="text-xs text-gray-500">Quantidade: {item.quantidade}</p>
                      </div>
                      {item.montado && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Botão Finalizar */}
                {progresso === 100 && (
                  <Button
                    onClick={() => finalizarEntrega(entrega)}
                    className="w-full bg-green-600 hover:bg-green-700 text-lg h-12"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirmar Montagem Completa
                  </Button>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}