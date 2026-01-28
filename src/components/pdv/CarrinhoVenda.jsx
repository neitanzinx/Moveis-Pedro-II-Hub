import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Package, Wrench, Truck, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CarrinhoVenda({ itens = [], onRemoveItem, onToggleMontagem }) {
  if (itens.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-8 h-full min-h-[300px]">
        <div className="w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-8 h-8 text-gray-300" />
        </div>
        <p className="font-medium">O carrinho está vazio</p>
        <p className="text-sm text-gray-400">Adicione produtos para começar a venda</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
      {itens.map((item, index) => (
        <div
          key={index}
          className="group p-3 bg-white dark:bg-neutral-900 rounded-lg border border-gray-100 dark:border-neutral-800 hover:border-green-200 dark:hover:border-green-900 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-sm">
                {item.quantidade}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{item.produto_nome}</p>
                  {item.is_solicitacao && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                      Novo
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Unit: R$ {item.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <p className="font-bold text-gray-800 dark:text-gray-200 w-24 text-right">
                R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => onRemoveItem(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Toggle de Montagem */}
          {onToggleMontagem && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 mb-1">Tipo de Entrega/Montagem:</span>
                <div className="flex gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onToggleMontagem(index, 'montado')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_montagem === 'montado'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300'
                      : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-green-50'
                      }`}
                    title="Produto vai montado (montagem interna, entrega com produto já montado)"
                  >
                    <Truck className="w-3 h-3" />
                    Entrega Montado
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleMontagem(index, 'montagem_cliente')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_montagem === 'montagem_cliente'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-300'
                      : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-blue-50'
                      }`}
                    title="Produto vai na caixa, montador externo monta no endereço do cliente"
                  >
                    <Wrench className="w-3 h-3" />
                    Montagem no Local
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleMontagem(index, 'retira')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${item.tipo_montagem === 'retira'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-300'
                      : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-orange-50'
                      }`}
                    title="Cliente retira na loja (sem entrega ou montagem)"
                  >
                    <Store className="w-3 h-3" />
                    Cliente Retira
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}