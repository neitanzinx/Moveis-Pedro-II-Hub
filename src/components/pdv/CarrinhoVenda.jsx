import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CarrinhoVenda({ itens = [], onRemoveItem }) {
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
          className="group flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-gray-100 dark:border-neutral-800 hover:border-green-200 dark:hover:border-green-900 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-sm">
              {item.quantidade}
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{item.produto_nome}</p>
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
      ))}
    </div>
  );
}