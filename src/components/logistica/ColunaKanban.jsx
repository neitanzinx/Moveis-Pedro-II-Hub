import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDroppable } from "@dnd-kit/core";
import { Sparkles, Sun, Sunset, MessageCircle, Server, WifiOff, Loader2, Briefcase, CheckCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { ScrollArea } from "@/components/ui/scroll-area";
import EntregaCard from "./EntregaCard";

export default function ColunaKanban({ coluna, vendas, onClickEntrega, onCalcularRota, calculandoRota }) {
  const { setNodeRef: setNodeRefComercial, isOver: isOverComercial } = useDroppable({ id: `${coluna.id}-comercial` });
  const { setNodeRef: setNodeRefManha, isOver: isOverManha } = useDroppable({ id: `${coluna.id}-manha` });
  const { setNodeRef: setNodeRefTarde, isOver: isOverTarde } = useDroppable({ id: `${coluna.id}-tarde` });

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusServidor, setStatusServidor] = useState("verificando");

  // Filtros com validação
  const entregas = coluna?.entregas || [];
  const entregasComercial = entregas.filter(e => !e.turno || e.turno === 'Comercial');
  const entregasManha = entregas.filter(e => e.turno === 'Manhã');
  const entregasTarde = entregas.filter(e => e.turno === 'Tarde');
  
  const entregasParaDisparo = entregas.filter(e => e.status !== 'Entregue' && e.status !== 'Cancelada');
  const entregasPendentes = entregas.filter(e => 
    e.status_confirmacao === 'Aguardando Resposta' || e.status_confirmacao === 'Requer Atenção' || !e.status_confirmacao
  );

  const verificarServidor = async () => {
    setStatusServidor("verificando");
    try {
      await fetch('http://localhost:3001/status', { method: 'GET' });
      setStatusServidor("online");
    } catch (e) { setStatusServidor("offline"); }
  };

  const abrirModalRobo = () => { setModalOpen(true); verificarServidor(); };

  const enviarParaRobo = async () => {
    setLoading(true);
    try {
      const payload = entregasParaDisparo.map(entrega => {
        const venda = (vendas || []).find(v => v.id === entrega.venda_id);
        const listaProdutos = venda?.itens?.map(item => `• ${item.quantidade}x ${item.produto_nome}`).join('\n') || "Itens não informados";
        return {
          id: entrega.id,
          numero_pedido: entrega.numero_pedido,
          cliente_nome: entrega.cliente_nome,
          telefone: entrega.cliente_telefone,
          turno: entrega.turno || "comercial",
          produtos: listaProdutos
        };
      });

      const response = await fetch('http://localhost:3001/disparar-confirmacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregas: payload })
      });

      if (response.ok) {
        for (const entrega of entregasParaDisparo) {
           await base44.entities.Entrega.update(entrega.id, { status_confirmacao: 'Aguardando Resposta', whatsapp_enviado: true });
        }
        alert(`✅ Disparos iniciados!`);
        setModalOpen(false);
      } else { alert("Erro ao comunicar com o robô."); }
    } catch (error) { alert("Erro: O servidor local não está rodando."); } finally { setLoading(false); }
  };

  return (
    <>
      {/* CARD FLEXÍVEL (Remove w-[300px]) */}
      <Card className="flex flex-col h-full border-0 bg-gray-100/50 dark:bg-neutral-900/50 min-w-0">
        <div className={`p-2 rounded-t-xl border-b bg-white dark:bg-neutral-900 shadow-sm flex-shrink-0 ${coluna.isHoje ? 'border-green-500 border-t-4' : 'border-gray-200'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-800 dark:text-white truncate">
                {coluna.titulo}
              </h3>
              {coluna.isHoje && <Badge className="bg-green-500 text-[8px] px-1 h-3">HOJE</Badge>}
            </div>
            
            <div className="flex justify-between items-center">
               <span className="text-[10px] text-gray-500">{coluna.dataFormatada.slice(0,5)}</span>
               {entregasParaDisparo.length > 0 && (
                <Button size="icon" className="h-5 w-5 bg-green-100 hover:bg-green-200 text-green-700 shadow-sm" onClick={abrirModalRobo} title="Disparar Confirmações">
                  <MessageCircle className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-1 text-[10px] text-gray-500 border-t pt-1">
             <span>Total: {entregas.length}</span>
             {entregasPendentes.length > 0 && <span className="text-orange-600 font-bold">! {entregasPendentes.length}</span>}
          </div>
        </div>

        <ScrollArea className="flex-1 px-1">
          {/* Comercial */}
          <div ref={setNodeRefComercial} className={`mt-1 pb-1 min-h-[60px] rounded border border-dashed border-transparent transition-colors ${isOverComercial ? 'bg-blue-50 border-blue-300' : ''}`}>
            <div className="flex items-center gap-1 mb-1 px-1 pt-1">
              <Briefcase className="w-3 h-3 text-blue-500" />
              <h4 className="text-[10px] font-bold text-gray-500 uppercase">Comercial</h4>
            </div>
            {entregasComercial.map(entrega => (
              <EntregaCard key={entrega.id} entrega={entrega} venda={(vendas || []).find(v => v.id === entrega.venda_id)} onClick={onClickEntrega} />
            ))}
          </div>

          <div className="border-t border-gray-200 my-1"></div>

          {/* Manhã */}
          <div ref={setNodeRefManha} className={`pb-1 min-h-[60px] rounded border border-dashed border-transparent transition-colors ${isOverManha ? 'bg-amber-50 border-amber-300' : ''}`}>
            <div className="flex items-center gap-1 mb-1 px-1 pt-1">
              <Sun className="w-3 h-3 text-amber-500" />
              <h4 className="text-[10px] font-bold text-gray-500 uppercase">Manhã</h4>
            </div>
            {entregasManha.map(entrega => (
              <EntregaCard key={entrega.id} entrega={entrega} venda={(vendas || []).find(v => v.id === entrega.venda_id)} onClick={onClickEntrega} />
            ))}
          </div>

          <div className="border-t border-gray-200 my-1"></div>

          {/* Tarde */}
          <div ref={setNodeRefTarde} className={`pb-1 min-h-[60px] rounded border border-dashed border-transparent transition-colors ${isOverTarde ? 'bg-orange-50 border-orange-300' : ''}`}>
            <div className="flex items-center gap-1 mb-1 px-1 pt-1">
              <Sunset className="w-3 h-3 text-orange-500" />
              <h4 className="text-[10px] font-bold text-gray-500 uppercase">Tarde</h4>
            </div>
            {entregasTarde.map(entrega => (
              <EntregaCard key={entrega.id} entrega={entrega} venda={(vendas || []).find(v => v.id === entrega.venda_id)} onClick={onClickEntrega} />
            ))}
          </div>
        </ScrollArea>

        {/* Rodapé Otimizar (Compacto) */}
        {entregas.length > 1 && (
          <div className="p-1 border-t bg-white">
            <Button variant="ghost" size="sm" onClick={onCalcularRota} disabled={calculandoRota} className="w-full h-6 text-[10px] text-gray-400 hover:text-blue-600">
              <Sparkles className="w-3 h-3 mr-1" /> {calculandoRota ? '...' : 'Otimizar'}
            </Button>
          </div>
        )}
      </Card>

      {/* Modal Robô (Mantido) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Entregas - {coluna.titulo}</DialogTitle>
            <DialogDescription>Disparar WhatsApp para {entregasParaDisparo.length} clientes?</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {statusServidor === 'online' ? <div className="p-3 rounded bg-green-100 text-green-800 flex items-center gap-2"><Server className="w-5 h-5"/> <span>Robô Online!</span></div> : <div className="p-3 rounded bg-red-100 text-red-800 flex items-center gap-2"><WifiOff className="w-5 h-5"/> <span>Robô Offline.</span></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={enviarParaRobo} disabled={statusServidor !== "online" || loading} className="bg-green-600 hover:bg-green-700">{loading ? <Loader2 className="animate-spin"/> : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}