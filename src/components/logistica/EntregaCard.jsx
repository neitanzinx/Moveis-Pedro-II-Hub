import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDraggable } from "@dnd-kit/core";
import { Map, AlertTriangle, MessageCircle, Package, Truck, User, Wrench, Store, Sofa } from "lucide-react";

export default function EntregaCard({ entrega, venda, onClick, isColumn = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entrega.id,
    data: { entrega }
  });

  const abrirGoogleMaps = (e) => {
    e.stopPropagation();
    const endereco = encodeURIComponent(entrega.endereco_entrega || "");
    window.open(`https://www.google.com/maps/search/?api=1&query=${endereco}`, '_blank');
  };

  const contatoManual = (e) => {
    e.stopPropagation();
    const tel = entrega.cliente_telefone?.replace(/\D/g, '');
    if (tel) window.open(`https://wa.me/55${tel}`, '_blank');
    else alert("Telefone não cadastrado");
  };

  const isPendente = entrega.status_confirmacao === 'Aguardando Resposta' || (!entrega.status_confirmacao && entrega.data_agendada);
  const isProblema = entrega.status_confirmacao === 'Requer Atenção';
  const isConfirmado = entrega.status_confirmacao === 'Confirmada';

  // Core logic for border colors
  let statusColor = "blue";
  if (entrega.data_agendada) {
    if (isConfirmado) statusColor = "green";
    else if (isPendente) statusColor = "yellow";
    else if (isProblema) statusColor = "red";
    else statusColor = "gray";
  }

  const borderClass = `border-l-4 border-l-${statusColor}-500`;
  const bgClass = entrega._notificado ? 'bg-green-50' : 'bg-white';

  const listaItens = venda?.itens?.map(i => i.produto_nome).join(', ') || "Itens não informados";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onClick && onClick(entrega)}
      className={`cursor-grab active:cursor-grabbing transition-all group mb-2 ${isDragging ? 'opacity-50 scale-95' : ''} h-full`}
    >
      <Card className={`relative overflow-hidden hover:shadow-lg transition-all border-0 shadow-sm ring-1 ring-gray-100 ${borderClass} ${bgClass} flex flex-col justify-start ${isColumn ? 'p-2 min-h-[90px]' : 'p-2.5 h-full'} gap-1.5`}>

        {/* Topo: Cliente E Num Pedido/Badge */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
            <User className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="font-bold text-[10px] text-gray-700 truncate uppercase" title={entrega.cliente_nome}>
              {entrega.cliente_nome}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 bg-blue-50 px-1 py-0.5 rounded ml-1">
            <span className="font-mono text-[9px] text-blue-700 font-bold">#{entrega.numero_pedido}</span>
            {/* Badge de Mostruário */}
            {(entrega.origem === 'mostruario' || entrega.item_mostruario) && (
              <Badge className="text-[8px] px-1 py-0 h-4 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-none border-0 flex items-center gap-0.5" title="Item de Mostruário">
                <Sofa className="w-2 h-2" />
                MOST
              </Badge>
            )}
            {/* Badge de Montagem */}
            {entrega.tipo_montagem === 'montado' && (
              <Badge className="text-[8px] px-1 py-0 h-4 bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-none border-0" title="Entrega Montado (montagem interna)">
                <Wrench className="w-2 h-2" />
              </Badge>
            )}
            {entrega.tipo_montagem === 'montagem_cliente' && (
              <Badge className="text-[8px] px-1 py-0 h-4 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-none border-0" title="Montagem no Local (montador externo)">
                <Truck className="w-2 h-2" />
              </Badge>
            )}
            {entrega.tipo_montagem === 'retira' && (
              <Badge className="text-[8px] px-1 py-0 h-4 bg-gray-600 hover:bg-gray-700 text-white font-bold shadow-none border-0" title="Cliente Retira">
                <Store className="w-2 h-2" />
              </Badge>
            )}
            {/* Badge de Status da Montagem Interna */}
            {entrega.tipo_montagem === 'montado' && entrega.montagem_status === 'Concluída' && (
              <Badge className="text-[8px] px-1 py-0 h-4 bg-green-600 hover:bg-green-700 text-white font-bold shadow-none border-0 animate-pulse" title="Montagem Concluída - Pronto para Enviar">
                ✓
              </Badge>
            )}
            {entrega.tipo_montagem === 'montado' && !entrega.montagem_status && (
              <Badge className="text-[8px] px-1 py-0 h-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold shadow-none border-0" title="Aguardando Montagem Interna">
                ⚙️
              </Badge>
            )}
          </div>

        </div>

        {/* Endereço - Agora no topo */}
        <div
          className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors cursor-pointer group/map w-full bg-gray-50/50 rounded py-0.5 px-1 border border-transparent hover:border-blue-100 hover:bg-white"
          onClick={abrirGoogleMaps}
          title="Abrir no Google Maps"
        >
          <Map className="w-3 h-3 group-hover/map:animate-bounce shrink-0 text-blue-400" />
          <span className="text-[10px] font-medium truncate leading-tight">
            {entrega.endereco_entrega || "Sem endereço"}
          </span>
        </div>

        {/* Meio: Produtos (Compacto) */}
        <div className="flex-1 min-h-0 flex items-start gap-1.5 overflow-hidden">
          <Package className="w-3 h-3 text-gray-300 mt-0.5 shrink-0" />
          <p className="text-[10px] font-normal text-gray-600 leading-3 line-clamp-3" title={listaItens}>
            {listaItens}
          </p>
        </div>

        {/* Bottom: Ações/Status se necessário */}
        {(entrega._notificado || (isColumn && (isPendente || isProblema))) && (
          <div className={`mt-auto pt-1 border-t border-dashed border-gray-100 flex items-center justify-end gap-1`}>
            {entrega._notificado && (
              <Badge variant="outline" className="text-[8px] px-1 h-4 border-green-200 bg-green-50 text-green-700">
                Avisado
              </Badge>
            )}
            {isColumn && (isPendente || isProblema) && (
              <Button
                size="icon"
                variant="ghost"
                className="h-4 w-4 hover:bg-green-50 text-green-600"
                onClick={contatoManual}
              >
                <MessageCircle className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}

      </Card>
    </div>
  );
}