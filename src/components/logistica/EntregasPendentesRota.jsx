import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, MapPin } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";

function EntregaCard({ entrega, venda, diaSugerido }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entrega.id,
    data: { entrega, venda }
  });

  const diasRestantes = Math.ceil((new Date(entrega.data_limite) - new Date()) / (1000 * 60 * 60 * 24));
  const urgente = diasRestantes <= 3;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing transition-all relative ${isDragging ? 'opacity-50' : ''}`}
      data-entrega-id={entrega.id}
    >
      <Card className={`p-3 hover:shadow-md transition-all border-l-4 w-[220px] flex-shrink-0 ${
        diaSugerido ? 'border-l-green-500 shadow-lg shadow-green-200/50' : 'border-l-orange-400'
      }`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
              #{entrega.numero_pedido}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {entrega.cliente_nome}
            </p>
          </div>
          {urgente && (
            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">
              URGENTE
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Até {new Date(entrega.data_limite).toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex items-start gap-1">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{entrega.endereco_entrega}</span>
          </div>
        </div>

        {venda?.itens?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {venda.itens.length} {venda.itens.length === 1 ? 'item' : 'itens'}
            </p>
            {diaSugerido && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                → {diaSugerido}
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function EntregasPendentesRota({ entregas, vendas, sugestoes }) {
  // Ordena por data limite (mais urgente primeiro)
  const entregasOrdenadas = [...entregas].sort((a, b) => 
    new Date(a.data_limite) - new Date(b.data_limite)
  );

  return (
    <div className="w-full relative">
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-3 rounded-xl border border-orange-200 mb-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-orange-900 dark:text-orange-400">
              Entregas Pendentes
            </h3>
          </div>
          <Badge variant="outline" className="bg-white text-orange-700 border-orange-300">
            {entregas.length}
          </Badge>
        </div>
        <p className="text-xs text-orange-700 mt-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Arraste para o dia recomendado (em verde)
        </p>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3 min-w-min">
          {entregasOrdenadas.length === 0 ? (
            <div className="text-center py-8 w-full">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Nenhuma entrega pendente</p>
            </div>
          ) : (
            entregasOrdenadas.map(entrega => {
              const venda = vendas.find(v => v.id === entrega.venda_id);
              const sugestao = sugestoes?.find(s => s.entregaId === entrega.id);
              return (
                <EntregaCard 
                  key={entrega.id} 
                  entrega={entrega} 
                  venda={venda}
                  diaSugerido={sugestao?.diaSugerido}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}