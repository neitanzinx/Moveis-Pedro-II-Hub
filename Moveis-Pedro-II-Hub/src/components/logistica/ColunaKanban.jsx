import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDroppable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Sun, Sunset, MessageCircle, Server, WifiOff, Loader2, Briefcase, CheckCircle, AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import EntregaCard from "./EntregaCard";

export default function ColunaKanban({ coluna, vendas, caminhoes = [], onClickEntrega, onCalcularRota, calculandoRota }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { setNodeRef: setNodeRefColuna, isOver: isOverColuna } = useDroppable({ id: coluna.id });
  const { setNodeRef: setNodeRefComercial, isOver: isOverComercial } = useDroppable({ id: `${coluna.id}-comercial` });
  const { setNodeRef: setNodeRefManha, isOver: isOverManha } = useDroppable({ id: `${coluna.id}-manha` });
  const { setNodeRef: setNodeRefTarde, isOver: isOverTarde } = useDroppable({ id: `${coluna.id}-tarde` });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalReagendar, setModalReagendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusServidor, setStatusServidor] = useState("verificando");

  const entregas = coluna?.entregas || [];
  const entregasComercial = entregas.filter(e => !e.turno || e.turno === 'Comercial');
  const entregasManha = entregas.filter(e => e.turno === 'Manhã');
  const entregasTarde = entregas.filter(e => e.turno === 'Tarde');

  const entregasParaDisparo = entregas.filter(e => e.status !== 'Entregue' && e.status !== 'Cancelada');

  // Verificar quais já foram notificadas para ESTA data/turno
  const jaNotificadas = entregasParaDisparo.filter(e => {
    const dataAgendada = e.data_agendada?.split('T')[0];
    const dataNotificada = e.data_notificacao;
    const turnoNotificado = e.turno_notificacao;
    return dataAgendada === dataNotificada && e.turno === turnoNotificado;
  });

  const naoNotificadas = entregasParaDisparo.filter(e => !jaNotificadas.includes(e));

  const updateEntrega = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

  const verificarServidor = async () => {
    setStatusServidor("verificando");
    try {
      await fetch('http://localhost:3001/status', { method: 'GET' });
      setStatusServidor("online");
    } catch (e) { setStatusServidor("offline"); }
  };

  const abrirModalRobo = () => { setModalOpen(true); verificarServidor(); };

  // Disparar apenas para os NÃO notificados
  const enviarParaRobo = async () => {
    setLoading(true);
    try {
      // Só envia os que NÃO foram notificados ainda
      const paraEnviar = naoNotificadas;

      if (paraEnviar.length === 0) {
        toast.success("✅ Todos já foram notificados para esta data!");
        setModalOpen(false);
        setLoading(false);
        return;
      }

      const payload = paraEnviar.map(entrega => {
        const venda = (vendas || []).find(v => v.id === entrega.venda_id);
        const listaProdutos = venda?.itens?.map(item => `• ${item.quantidade}x ${item.produto_nome}`).join('\n') || "Itens não informados";
        return {
          id: entrega.id,
          numero_pedido: entrega.numero_pedido,
          cliente_nome: entrega.cliente_nome,
          telefone: entrega.cliente_telefone,
          turno: entrega.turno || "comercial",
          produtos: listaProdutos,
          data_agendada: entrega.data_agendada
        };
      });

      const response = await fetch('http://localhost:3001/disparar-confirmacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregas: payload })
      });

      if (response.ok) {
        // Marcar como notificado com data e turno
        for (const entrega of paraEnviar) {
          try {
            await base44.entities.Entrega.update(entrega.id, {
              status_confirmacao: 'Aguardando Resposta',
              whatsapp_enviado: true,
              data_notificacao: entrega.data_agendada?.split('T')[0],
              turno_notificacao: entrega.turno,
              ultima_notificacao: new Date().toISOString()
            });
          } catch (dbError) {
            console.warn('Erro ao atualizar entrega (colunas podem não existir):', dbError);
          }
        }
        toast.success(`✅ ${paraEnviar.length} cliente(s) notificado(s)!${jaNotificadas.length > 0 ? ` ⏩ ${jaNotificadas.length} já haviam sido notificados.` : ''}`);
        setModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['entregas'] });
      } else {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        toast.error(`Erro do robô: ${errorText}`);
      }
    } catch (error) {
      console.error('Erro ao enviar para robô:', error);
      toast.warning("⚠️ Não foi possível conectar ao robô. Verifique se 'npm run dev:all' está rodando.");
    } finally { setLoading(false); }
  };

  // Reagendar todas as entregas do dia
  const reagendarTodas = async () => {
    setLoading(true);
    try {
      // Enviar mensagem de reagendamento via bot
      const payload = entregasParaDisparo.map(e => ({
        telefone: e.cliente_telefone,
        nome: e.cliente_nome,
        numero_pedido: e.numero_pedido
      }));

      await fetch('http://localhost:3001/reagendar-entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregas: payload })
      }).catch(() => { });

      // Voltar todas para triagem
      for (const entrega of entregasParaDisparo) {
        await updateEntrega.mutateAsync({
          id: entrega.id,
          data: {
            data_agendada: null,
            turno: null,
            caminhao_id: null,
            status: 'Pendente',
            observacoes_entrega: `[REAGENDADO] Imprevisto em ${coluna.dataFormatada}`
          }
        });
      }

      toast.success(`✅ ${entregasParaDisparo.length} entregas reagendadas!`);
      setModalReagendar(false);
    } catch (e) {
      toast.error("Erro ao reagendar.");
    } finally {
      setLoading(false);
    }
  };

  // Reagendar uma entrega individual
  const reagendarIndividual = async (entrega) => {
    const confirmed = await confirm({
      title: "Reagendar Entrega",
      message: `Reagendar pedido #${entrega.numero_pedido} de ${entrega.cliente_nome}?`,
      confirmText: "Reagendar",
      variant: "warning"
    });
    if (!confirmed) return;

    try {
      // Notificar cliente
      await fetch('http://localhost:3001/reagendar-entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entregas: [{
            telefone: entrega.cliente_telefone,
            nome: entrega.cliente_nome,
            numero_pedido: entrega.numero_pedido
          }]
        })
      }).catch(() => { });

      // Voltar para triagem
      await updateEntrega.mutateAsync({
        id: entrega.id,
        data: {
          data_agendada: null,
          turno: null,
          caminhao_id: null,
          status: 'Pendente',
          observacoes_entrega: `[REAGENDADO] Individual em ${coluna.dataFormatada}`
        }
      });

      toast.success("Entrega reagendada!");
    } catch (e) {
      toast.error("Erro ao reagendar.");
    }
  };

  // Renderizar card de entrega com indicador de notificação
  const renderEntregaCard = (entrega) => {
    const caminhao = caminhoes.find(c => c.id === entrega.caminhao_id);
    const dataAgendada = entrega.data_agendada?.split('T')[0];
    const foiNotificada = dataAgendada === entrega.data_notificacao && entrega.turno === entrega.turno_notificacao;

    return (
      <div key={entrega.id} className="relative group">
        <EntregaCard
          entrega={{
            ...entrega,
            caminhao_nome: caminhao?.placa || caminhao?.nome,
            _notificado: foiNotificada
          }}
          venda={(vendas || []).find(v => v.id === entrega.venda_id)}
          onClick={onClickEntrega}
          isColumn={true}
        />
        {/* Botão de reagendar individual */}
        <button
          onClick={(e) => { e.stopPropagation(); reagendarIndividual(entrega); }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-orange-100 text-orange-600 hover:bg-orange-200"
          title="Reagendar esta entrega"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <>
      <Card
        ref={setNodeRefColuna}
        className={`flex flex-col h-full border-0 bg-gray-100/50 dark:bg-neutral-900/50 min-w-0 transition-all ${isOverColuna ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
      >
        <div className={`p-2 rounded-t-xl border-b bg-white dark:bg-neutral-900 shadow-sm flex-shrink-0 ${coluna.isHoje ? 'border-green-500 border-t-4' : 'border-gray-200'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-800 dark:text-white truncate">
                {coluna.titulo}
              </h3>
              {coluna.isHoje && <Badge className="bg-green-500 text-[8px] px-1 h-3">HOJE</Badge>}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500">{coluna.dataFormatada.slice(0, 5)}</span>
              <div className="flex gap-1">
                {/* Botão Reagendar Todas */}
                {entregasParaDisparo.length > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-orange-500 hover:bg-orange-100"
                    onClick={() => setModalReagendar(true)}
                    title="Reagendar Todas"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                )}
                {/* Botão Disparar */}
                {entregasParaDisparo.length > 0 && (
                  <Button
                    size="icon"
                    className={`h-5 w-5 shadow-sm ${naoNotificadas.length > 0
                      ? 'bg-green-100 hover:bg-green-200 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                      }`}
                    onClick={abrirModalRobo}
                    title={naoNotificadas.length > 0 ? "Disparar Confirmações" : "Todos já notificados"}
                  >
                    <MessageCircle className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-1 text-[10px] text-gray-500 border-t pt-1">
            <span>Total: {entregas.length}</span>
            <div className="flex gap-1">
              {jaNotificadas.length > 0 && (
                <span className="text-green-600">✓ {jaNotificadas.length}</span>
              )}
              {naoNotificadas.length > 0 && (
                <span className="text-orange-600">⏳ {naoNotificadas.length}</span>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-1">
          {/* Comercial */}
          <div ref={setNodeRefComercial} className={`mt-1 pb-1 min-h-[60px] rounded border border-dashed border-transparent transition-colors ${isOverComercial ? 'bg-blue-50 border-blue-300' : ''}`}>
            <div className="flex items-center gap-1 mb-1 px-1 pt-1">
              <Briefcase className="w-3 h-3 text-blue-500" />
              <h4 className="text-[10px] font-bold text-gray-500 uppercase">Comercial</h4>
            </div>
            {entregasComercial.map(renderEntregaCard)}
          </div>

          <div className="border-t border-gray-200 my-1"></div>

          {/* Manhã */}
          <div ref={setNodeRefManha} className={`pb-1 min-h-[60px] rounded border border-dashed border-transparent transition-colors ${isOverManha ? 'bg-amber-50 border-amber-300' : ''}`}>
            <div className="flex items-center gap-1 mb-1 px-1 pt-1">
              <Sun className="w-3 h-3 text-amber-500" />
              <h4 className="text-[10px] font-bold text-gray-500 uppercase">Manhã</h4>
            </div>
            {entregasManha.map(renderEntregaCard)}
          </div>

          <div className="border-t border-gray-200 my-1"></div>

          {/* Tarde */}
          <div ref={setNodeRefTarde} className={`pb-1 min-h-[60px] rounded border border-dashed border-transparent transition-colors ${isOverTarde ? 'bg-orange-50 border-orange-300' : ''}`}>
            <div className="flex items-center gap-1 mb-1 px-1 pt-1">
              <Sunset className="w-3 h-3 text-orange-500" />
              <h4 className="text-[10px] font-bold text-gray-500 uppercase">Tarde</h4>
            </div>
            {entregasTarde.map(renderEntregaCard)}
          </div>
        </ScrollArea>

        {entregas.length > 1 && (
          <div className="p-1 border-t bg-white">
            <Button variant="ghost" size="sm" onClick={onCalcularRota} disabled={calculandoRota} className="w-full h-6 text-[10px] text-gray-400 hover:text-blue-600">
              <Sparkles className="w-3 h-3 mr-1" /> {calculandoRota ? '...' : 'Otimizar'}
            </Button>
          </div>
        )}
      </Card>

      {/* Modal Disparar Confirmações */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Entregas - {coluna.titulo}</DialogTitle>
            <DialogDescription>
              {naoNotificadas.length > 0
                ? `Disparar WhatsApp para ${naoNotificadas.length} clientes?`
                : "Todos os clientes já foram notificados!"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {statusServidor === 'online'
              ? <div className="p-3 rounded bg-green-100 text-green-800 flex items-center gap-2"><Server className="w-5 h-5" /> <span>Robô Online!</span></div>
              : <div className="p-3 rounded bg-red-100 text-red-800 flex items-center gap-2"><WifiOff className="w-5 h-5" /> <span>Robô Offline.</span></div>
            }

            {/* Resumo */}
            <div className="text-sm space-y-1">
              {naoNotificadas.length > 0 && (
                <div className="flex items-center gap-2 text-orange-700">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                  {naoNotificadas.length} serão notificados agora
                </div>
              )}
              {jaNotificadas.length > 0 && (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  {jaNotificadas.length} já notificados (serão ignorados)
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={enviarParaRobo}
              disabled={statusServidor !== "online" || loading || naoNotificadas.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? <Loader2 className="animate-spin" /> : `Notificar ${naoNotificadas.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reagendar Todas */}
      <Dialog open={modalReagendar} onOpenChange={setModalReagendar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Reagendar Entregas
            </DialogTitle>
            <DialogDescription>
              Isso irá notificar {entregasParaDisparo.length} cliente(s) sobre o reagendamento e voltar os pedidos para a triagem.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <p className="font-medium mb-1">⚠️ Ação em massa</p>
              <p>Todos os clientes receberão uma mensagem de desculpas informando que a entrega será reagendada.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalReagendar(false)}>Cancelar</Button>
            <Button
              onClick={reagendarTodas}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? <Loader2 className="animate-spin" /> : `Reagendar ${entregasParaDisparo.length} entregas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}