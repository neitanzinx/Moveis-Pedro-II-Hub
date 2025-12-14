import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDraggable } from "@dnd-kit/core";
import { Map, AlertTriangle, MessageCircle, Package } from "lucide-react";

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
  
  // Estilo Clean: Borda fina colorida na esquerda, fundo branco
  let borderClass = "border-l-4 border-l-blue-500"; // Padrão (Triagem)
  
  if (entrega.data_agendada) {
      if (isConfirmado) borderClass = "border-l-4 border-l-green-500";
      else if (isPendente) borderClass = "border-l-4 border-l-yellow-400";
      else if (isProblema) borderClass = "border-l-4 border-l-red-500";
      else borderClass = "border-l-4 border-l-gray-300";
  }

  const listaItens = venda?.itens?.map(i => i.produto_nome).join(', ') || "Itens não informados";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onClick && onClick(entrega)}
      className={`cursor-grab active:cursor-grabbing transition-all group mb-1.5 ${isDragging ? 'opacity-50 scale-95' : ''}`}
    >
      <Card className={`relative overflow-hidden bg-white hover:shadow-md transition-shadow border-0 shadow-sm ring-1 ring-gray-100 ${borderClass} ${isColumn ? 'p-2' : 'p-2.5'}`}>
        
        {/* Título Principal: PRODUTO */}
        <div className="mb-1">
          <p className={`${isColumn ? 'text-[11px]' : 'text-xs'} font-bold text-gray-800 leading-tight line-clamp-2`}>
            {listaItens}
          </p>
        </div>

        {/* Linha Secundária: Pedido + Cliente */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="font-mono text-[9px] text-gray-400 font-medium">#{entrega.numero_pedido}</span>
          <span className="text-[9px] text-gray-400">•</span>
          <p className="text-[10px] text-gray-500 font-medium truncate flex-1 uppercase">
            {entrega.cliente_nome}
          </p>
        </div>

        {/* Linha Inferior: Endereço + Ações */}
        <div className="flex items-center justify-between mt-1">
           {/* Endereço com botão Maps integrado */}
           <div className="flex items-center gap-1 flex-1 min-w-0 bg-gray-50 rounded-full px-1.5 py-0.5 border border-gray-100">
              <button 
                onClick={abrirGoogleMaps}
                className="text-blue-500 hover:text-blue-700 transition-colors"
                title="Abrir no Maps"
              >
                <Map className="w-3 h-3" />
              </button>
              <span className="text-[9px] text-gray-500 truncate cursor-help" title={entrega.endereco_entrega}>
                {entrega.endereco_entrega ? entrega.endereco_entrega.split(',')[0] : "Endereço..."}
              </span>
           </div>

           {/* Status / Caminhão */}
           <div className="flex items-center gap-1 ml-1">
              {entrega.caminhao_nome && (
                <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-blue-50 text-blue-600 border-0">
                  {entrega.caminhao_nome}
                </Badge>
              )}
              
              {/* Botão Zap só aparece se tiver pendência E estiver agendado */}
              {isColumn && (isPendente || isProblema) && (
                <button 
                  onClick={contatoManual}
                  className="h-4 w-4 flex items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200"
                  title="Chamar no WhatsApp"
                >
                  <MessageCircle className="w-2.5 h-2.5" />
                </button>
              )}
           </div>
        </div>
      </Card>
    </div>
  );
}