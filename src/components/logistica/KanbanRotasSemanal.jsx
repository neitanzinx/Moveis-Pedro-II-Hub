import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DndContext, DragOverlay, pointerWithin, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import ColunaKanban from "./ColunaKanban";
import EntregaCard from "./EntregaCard";
import ModalDetalhesEntrega from "./ModalDetalhesEntrega";
import { PackageOpen, ArrowDown, Search, Clock, ArrowUpRight } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function KanbanRotasSemanal({ entregas, vendas, colunasSemana, entregasPendentes }) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [entregaSelecionada, setEntregaSelecionada] = useState(null);
  const [calculandoRota, setCalculandoRota] = useState(false);
  const [searchTriagem, setSearchTriagem] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Dropzones Especiais
  const { setNodeRef: setTriagemRef, isOver: isOverTriagem } = useDroppable({ id: 'triagem' });
  const { setNodeRef: setAguardandoRef, isOver: isOverAguardando } = useDroppable({ id: 'aguardando' });

  const atualizarEntregaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

  const colunas = colunasSemana || [];

  // Filtra a triagem pela busca
  const pendentesFiltrados = (entregasPendentes || []).filter(e => {
    const termo = searchTriagem.toLowerCase();
    if (!termo) return true;
    
    const matchCliente = e.cliente_nome?.toLowerCase().includes(termo);
    const matchPedido = e.numero_pedido?.toString().includes(termo);
    const venda = (vendas || []).find(v => v.id === e.venda_id);
    const matchProduto = venda?.itens?.some(i => i.produto_nome?.toLowerCase().includes(termo));
    
    return matchCliente || matchPedido || matchProduto;
  });

  const handleDragStart = (event) => { setActiveId(event.active.id); };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const entregaId = active.id;
    const overId = over.id.toString();

    // 1. Soltou na Triagem (Remove da agenda)
    if (overId === 'triagem') {
      await atualizarEntregaMutation.mutateAsync({
        id: entregaId,
        data: { data_agendada: null, turno: null, ordem_rota: null, status: 'Pendente' }
      });
      return;
    }

    // 2. Soltou em "Aguardando Liberação"
    if (overId === 'aguardando') {
      const motivo = prompt("Motivo para aguardar liberação? (Opcional)");
      await atualizarEntregaMutation.mutateAsync({
        id: entregaId,
        data: { 
            data_agendada: null, 
            turno: null, 
            ordem_rota: null, 
            status: 'Aguardando Liberação',
            observacoes: motivo ? `Aguardando: ${motivo}` : 'Aguardando liberação do cliente'
        }
      });
      return;
    }

    // 3. Soltou em um Dia (Agendar)
    if (overId.includes('-manha') || overId.includes('-tarde') || overId.includes('-comercial')) {
      const parts = overId.split('-');
      const turno = parts.pop(); 
      const dataAlvo = parts.join('-'); 

      let turnoFormatado = 'Comercial';
      if (turno === 'manha') turnoFormatado = 'Manhã';
      if (turno === 'tarde') turnoFormatado = 'Tarde';
      
      await atualizarEntregaMutation.mutateAsync({
        id: entregaId,
        data: { data_agendada: dataAlvo, turno: turnoFormatado, ordem_rota: null, status: 'Agendada' }
      });
    }
  };

  const calcularRotaOtimizada = async (colunaId) => {
    setCalculandoRota(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert("Rota reordenada com sucesso! (Simulação)");
    setCalculandoRota(false);
  };

  const activeEntrega = (entregas || []).find(e => e.id === activeId);

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="h-full flex flex-col gap-3 pb-2">
          
          {/* --- BARRA SUPERIOR: TRIAGEM + DROPZONE AGUARDANDO --- */}
          <div className="flex gap-3 h-[140px] flex-shrink-0">
            
            {/* 1. TRIAGEM DE PEDIDOS */}
            <Card 
                ref={setTriagemRef}
                className={`flex-1 flex flex-col border-0 transition-all shadow-sm ${
                isOverTriagem ? 'bg-blue-100 ring-4 ring-blue-400' : 'bg-white'
                }`}
            >
                <div className="px-3 py-2 border-b flex justify-between items-center bg-gray-50/50 rounded-t-xl gap-4">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`p-1.5 rounded-md ${isOverTriagem ? 'bg-blue-600 text-white' : 'bg-orange-100 text-orange-600'}`}>
                        <PackageOpen className="w-4 h-4" />
                        </div>
                        <div>
                        <h3 className="font-bold text-sm text-gray-800">
                            {isOverTriagem ? "Solte para Desagendar" : "Triagem"}
                        </h3>
                        </div>
                    </div>

                    {/* Barra de Pesquisa Integrada */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <Input 
                            className="h-7 text-xs pl-7 bg-white border-gray-200" 
                            placeholder="Buscar pedido, cliente ou item..."
                            value={searchTriagem}
                            onChange={e => setSearchTriagem(e.target.value)}
                        />
                    </div>

                    <Badge variant="secondary" className="text-[10px] font-mono">
                        {pendentesFiltrados.length}
                    </Badge>
                </div>
                
                <ScrollArea className="flex-1 w-full p-2">
                <div className="flex gap-2 pb-2 pl-1">
                    {pendentesFiltrados.map(entrega => (
                    <div key={entrega.id} className="w-[220px] flex-shrink-0">
                        <EntregaCard 
                        entrega={entrega} 
                        venda={(vendas || []).find(v => v.id === entrega.venda_id)} 
                        onClick={setEntregaSelecionada} 
                        isColumn={false}
                        />
                    </div>
                    ))}
                    
                    {pendentesFiltrados.length === 0 && !isOverTriagem && (
                    <div className="w-full flex flex-col items-center justify-center pt-1 text-gray-300 text-[10px]">
                        <p>{searchTriagem ? "Nenhum resultado" : "Tudo organizado!"}</p>
                    </div>
                    )}
                </div>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </Card>

            {/* 2. DROPZONE: AGUARDANDO LIBERAÇÃO */}
            <Card
                ref={setAguardandoRef}
                className={`w-[180px] flex flex-col items-center justify-center border-2 border-dashed transition-all ${
                    isOverAguardando 
                        ? 'bg-amber-100 border-amber-500 scale-105 shadow-lg' 
                        : 'bg-gray-50 border-gray-300 hover:border-amber-400'
                }`}
            >
                <Clock className={`w-8 h-8 mb-2 ${isOverAguardando ? 'text-amber-600 animate-bounce' : 'text-gray-400'}`} />
                <p className={`text-xs font-bold text-center ${isOverAguardando ? 'text-amber-800' : 'text-gray-500'}`}>
                    {isOverAguardando ? "Solte para Segurar" : "Arrastar para \nAguardando Liberação"}
                </p>
            </Card>
          </div>

          {/* --- COLUNAS DOS DIAS (GRID) --- */}
          <div className="flex-1 grid grid-cols-6 gap-2 min-h-0">
            {colunas.map((coluna) => (
              <ColunaKanban
                key={coluna.id}
                coluna={coluna}
                vendas={vendas || []}
                onClickEntrega={setEntregaSelecionada}
                onCalcularRota={() => calcularRotaOtimizada(coluna.id)}
                calculandoRota={calculandoRota}
              />
            ))}
          </div>
        </div>
        
        <DragOverlay>
          {activeEntrega ? (
            <Card className="p-2 bg-white shadow-2xl opacity-90 border-2 border-blue-500 w-[220px] cursor-grabbing rotate-3 z-50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] bg-white">#{activeEntrega.numero_pedido}</Badge>
              </div>
              <p className="text-xs font-bold truncate">{activeEntrega.cliente_nome}</p>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {entregaSelecionada && (
        <ModalDetalhesEntrega
          entrega={entregaSelecionada}
          venda={(vendas || []).find(v => v.id === entregaSelecionada.venda_id)}
          onClose={() => setEntregaSelecionada(null)}
        />
      )}
    </>
  );
}