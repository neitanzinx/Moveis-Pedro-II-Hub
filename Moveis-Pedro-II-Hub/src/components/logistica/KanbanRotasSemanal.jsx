import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DndContext, DragOverlay, pointerWithin, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import EntregaCard from "./EntregaCard";
import AssistenciaCard from "./AssistenciaCard";
import ModalDetalhesEntrega from "./ModalDetalhesEntrega";
import { PackageOpen, Search, Clock, Truck, AlertTriangle, ChevronLeft, ChevronRight, Wrench, Calendar, MessageCircle, Loader2, Server, WifiOff, CheckCircle, Sun, Sunset, Route } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import RouteOptimizer from "./RouteOptimizer";

// Cores para cada caminhão
const CORES_CAMINHOES = [
  { bg: 'from-blue-50 to-blue-100', border: 'border-blue-400', badge: 'bg-blue-500', text: 'text-blue-700', ring: 'ring-blue-400' },
  { bg: 'from-green-50 to-green-100', border: 'border-green-400', badge: 'bg-green-500', text: 'text-green-700', ring: 'ring-green-400' },
  { bg: 'from-purple-50 to-purple-100', border: 'border-purple-400', badge: 'bg-purple-500', text: 'text-purple-700', ring: 'ring-purple-400' },
  { bg: 'from-orange-50 to-orange-100', border: 'border-orange-400', badge: 'bg-orange-500', text: 'text-orange-700', ring: 'ring-orange-400' },
  { bg: 'from-pink-50 to-pink-100', border: 'border-pink-400', badge: 'bg-pink-500', text: 'text-pink-700', ring: 'ring-pink-400' },
  { bg: 'from-teal-50 to-teal-100', border: 'border-teal-400', badge: 'bg-teal-500', text: 'text-teal-700', ring: 'ring-teal-400' },
];

// Turnos disponíveis
const TURNOS = [
  { id: 'Manhã', label: 'Manhã', Icon: Sun, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconColor: 'text-amber-500' },
  { id: 'Tarde', label: 'Tarde', Icon: Sunset, bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', iconColor: 'text-orange-500' },
  { id: 'Comercial', label: 'Comercial', Icon: Clock, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconColor: 'text-blue-500' },
];

// Componente de slot de turno (drop zone)
function SlotTurno({ turno, caminhaoId, dataAtual, entregas, vendas, onClickEntrega, corCaminhao, assistencias = [] }) {
  const dropId = `${dataAtual}-${caminhaoId}-${turno.id}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  const entregasDoSlot = entregas.filter(e =>
    e.data_agendada?.split('T')[0] === dataAtual &&
    e.caminhao_id === caminhaoId &&
    e.turno === turno.id
  );

  const assistenciasDoSlot = assistencias.filter(a =>
    a.data_visita?.split('T')[0] === dataAtual &&
    a.caminhao_id === caminhaoId &&
    a.turno === turno.id
  );

  const totalItens = entregasDoSlot.length + assistenciasDoSlot.length;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col border rounded-lg transition-all ${isOver
        ? `${corCaminhao.ring} ring-2 ${turno.bg} scale-[1.01]`
        : `${turno.border} ${turno.bg}/50 hover:${turno.bg}`
        }`}
    >
      {/* Header do turno */}
      <div className={`px-2 py-1 border-b ${turno.border} flex items-center gap-1`}>
        <turno.Icon className={`w-3.5 h-3.5 ${turno.iconColor}`} />
        <span className={`text-[10px] font-bold ${turno.text}`}>{turno.label}</span>
        {totalItens > 0 && (
          <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1">
            {totalItens}
          </Badge>
        )}
      </div>

      {/* Itens do slot */}
      <div className="flex-1 p-1.5 space-y-1 min-h-[60px]">
        {entregasDoSlot.map(entrega => (
          <EntregaCard
            key={entrega.id}
            entrega={entrega}
            venda={vendas.find(v => v.id === entrega.venda_id)}
            onClick={onClickEntrega}
            isColumn={true}
          />
        ))}

        {assistenciasDoSlot.map(at => (
          <AssistenciaCard
            key={at.id}
            assistencia={at}
            isColumn={true}
          />
        ))}

        {totalItens === 0 && isOver && (
          <div className={`h-full flex items-center justify-center ${turno.text}`}>
            <p className="text-[10px] font-bold">Solte aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente de coluna para cada caminhão
function ColunaCaminhao({ caminhao, cor, dataAtual, entregas, vendas, onClickEntrega, onNotificar, onOtimizar, assistencias = [] }) {
  const entregasDoCaminhao = entregas.filter(e =>
    e.data_agendada?.split('T')[0] === dataAtual &&
    e.caminhao_id === caminhao.id
  );

  const assistenciasDoCaminhao = assistencias.filter(a =>
    a.data_visita?.split('T')[0] === dataAtual &&
    a.caminhao_id === caminhao.id
  );

  // Verificar quais entregas já foram notificadas
  const entregasParaDisparo = entregasDoCaminhao.filter(e => e.status !== 'Entregue' && e.status !== 'Cancelada');
  const entregasJaNotificadas = entregasParaDisparo.filter(e => {
    const dataAgendada = e.data_agendada?.split('T')[0];
    return dataAgendada === e.data_notificacao && e.turno === e.turno_notificacao;
  });
  const entregasNaoNotificadas = entregasParaDisparo.filter(e => !entregasJaNotificadas.includes(e));

  // Verificar quais assistências já foram notificadas (usando mesma lógica)
  const assistenciasParaDisparo = assistenciasDoCaminhao.filter(a => a.status !== 'Concluída' && a.status !== 'Cancelada');
  const assistenciasJaNotificadas = assistenciasParaDisparo.filter(a => {
    const dataVisita = a.data_visita?.split('T')[0];
    return dataVisita === a.data_notificacao && a.turno === a.turno_notificacao;
  });
  const assistenciasNaoNotificadas = assistenciasParaDisparo.filter(a => !assistenciasJaNotificadas.includes(a));

  const totalParaDisparo = entregasParaDisparo.length + assistenciasParaDisparo.length;
  const totalNaoNotificadas = entregasNaoNotificadas.length + assistenciasNaoNotificadas.length;
  const totalJaNotificadas = entregasJaNotificadas.length + assistenciasJaNotificadas.length;

  return (
    <div className="flex-1 min-w-[220px] max-w-[300px] flex flex-col rounded-xl border-2 border-gray-200 bg-white">
      {/* Header do caminhão */}
      <div className={`px-3 py-2 border-b flex items-center gap-2 bg-gradient-to-r ${cor.bg} rounded-t-lg`}>
        <div className={`p-1.5 rounded-md ${cor.badge} text-white`}>
          <Truck className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${cor.text} truncate`}>{caminhao.nome || caminhao.placa}</p>
          <p className="text-[10px] text-gray-500">{caminhao.placa}</p>
        </div>

        {/* Botão de Notificação do Caminhão */}
        {totalParaDisparo > 0 && (
          <button
            onClick={() => onNotificar(caminhao, {
              entregas: entregasParaDisparo,
              entregasNaoNotificadas,
              entregasJaNotificadas,
              assistencias: assistenciasParaDisparo,
              assistenciasNaoNotificadas,
              assistenciasJaNotificadas,
              totalNaoNotificadas,
              totalJaNotificadas
            })}
            className={`p-1.5 rounded-md transition-all ${totalNaoNotificadas > 0
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-200 text-gray-500'
              }`}
            title={totalNaoNotificadas > 0 ? `Notificar ${totalNaoNotificadas}` : 'Todos notificados'}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Botão Otimizar Rota */}
        {entregasDoCaminhao.length >= 2 && (
          <button
            onClick={() => onOtimizar(entregasDoCaminhao)}
            className="p-1.5 rounded-md transition-all bg-blue-500 hover:bg-blue-600 text-white"
            title="Otimizar rota"
          >
            <Route className="w-3.5 h-3.5" />
          </button>
        )}

        <Badge className={`${cor.badge} text-white text-[10px]`}>
          {entregasDoCaminhao.length}
        </Badge>
      </div>

      {/* 3 Slots de Turno */}
      <div className="flex-1 flex flex-col gap-1.5 p-2 overflow-y-auto">
        {TURNOS.map(turno => (
          <SlotTurno
            key={turno.id}
            turno={turno}
            caminhaoId={caminhao.id}
            dataAtual={dataAtual}
            entregas={entregas}
            vendas={vendas}
            onClickEntrega={onClickEntrega}
            corCaminhao={cor}
            assistencias={assistencias}
          />
        ))}
      </div>
    </div>
  );
}


export default function KanbanRotasSemanal({ entregas, vendas, entregasPendentes, caminhoes = [], assistencias = [] }) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [entregaSelecionada, setEntregaSelecionada] = useState(null);
  const [searchTriagem, setSearchTriagem] = useState("");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [diaSelecionado, setDiaSelecionado] = useState(null); // null = nenhum dia selecionado

  // Estados para modais
  const [modalMotivoAguardando, setModalMotivoAguardando] = useState(null);
  const [motivoAguardando, setMotivoAguardando] = useState("");

  // Estados para disparo de notificações (por caminhão)
  const [modalDisparo, setModalDisparo] = useState(null); // { caminhao, entregas, naoNotificadas, jaNotificadas }
  const [statusServidor, setStatusServidor] = useState("verificando");
  const [loadingDisparo, setLoadingDisparo] = useState(false);

  // Estado para otimização de rotas
  const [modalOtimizacao, setModalOtimizacao] = useState(null); // Array de entregas para otimizar

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { setNodeRef: setTriagemRef, isOver: isOverTriagem } = useDroppable({ id: 'triagem' });
  const { setNodeRef: setAguardandoRef, isOver: isOverAguardando } = useDroppable({ id: 'aguardando' });

  const atualizarEntregaMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Entrega.update(id, data);
    },
    onError: (error) => console.error("Erro ao atualizar entrega:", error)
  });

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Gerar os 7 próximos dias
  const diasDisponiveis = useMemo(() => {
    const dias = [];
    const hoje = new Date();

    for (let i = 0; i < 7; i++) {
      const dia = new Date(hoje);
      dia.setDate(hoje.getDate() + i + (semanaOffset * 7));
      const dataKey = dia.toISOString().split('T')[0];
      const hojeKey = new Date().toISOString().split('T')[0];

      // Contar entregas do dia
      const entregasDoDia = (entregas || []).filter(e => e.data_agendada?.split('T')[0] === dataKey);

      dias.push({
        id: dataKey,
        label: i === 0 && semanaOffset === 0 ? 'Hoje' : i === 1 && semanaOffset === 0 ? 'Amanhã' : diasSemana[dia.getDay()],
        dataFormatada: `${dia.getDate()}/${dia.getMonth() + 1}`,
        isHoje: dataKey === hojeKey,
        totalEntregas: entregasDoDia.length,
        diaSemana: dia.getDay()
      });
    }
    return dias;
  }, [entregas, semanaOffset]);

  const dataAtual = diaSelecionado !== null ? diasDisponiveis[diaSelecionado]?.id : null;

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

  // Assistências não agendadas (sem data_visita ou caminhao_id) - aparecem na triagem
  const assistenciasNaoAgendadas = (assistencias || []).filter(a =>
    !a.data_visita || !a.caminhao_id
  );

  // Entrega ativa (sendo arrastada)
  const activeEntrega = activeId ? (entregas || []).find(e => e.id === activeId) : null;

  // Verificar servidor do bot
  const verificarServidor = async () => {
    setStatusServidor("verificando");
    try {
      await fetch(`${import.meta.env.VITE_ZAP_API_URL}/status`, { method: 'GET' });
      setStatusServidor("online");
    } catch (e) { setStatusServidor("offline"); }
  };

  // Abrir modal de notificação para um caminhão específico
  const handleNotificarCaminhao = (caminhao, dados) => {
    setModalDisparo({ caminhao, ...dados });
    verificarServidor();
  };

  // Disparar confirmações via WhatsApp para o caminhão selecionado
  const enviarConfirmacoes = async () => {
    if (!modalDisparo) return;

    setLoadingDisparo(true);
    try {
      const {
        entregasNaoNotificadas = [],
        assistenciasNaoNotificadas = [],
        caminhao
      } = modalDisparo;

      const totalParaEnviar = entregasNaoNotificadas.length + assistenciasNaoNotificadas.length;

      if (totalParaEnviar === 0) {
        toast.success("✅ Todos já foram notificados!");
        setModalDisparo(null);
        setLoadingDisparo(false);
        return;
      }

      // Payload para entregas
      const payloadEntregas = entregasNaoNotificadas.map(entrega => {
        const venda = (vendas || []).find(v => v.id === entrega.venda_id);
        const listaProdutos = venda?.itens?.map(item => `• ${item.quantidade}x ${item.produto_nome}`).join('\n') || "Itens não informados";
        return {
          id: entrega.id,
          tipo: 'entrega',
          numero_pedido: entrega.numero_pedido,
          cliente_nome: entrega.cliente_nome,
          telefone: entrega.cliente_telefone,
          turno: entrega.turno || "Comercial",
          produtos: listaProdutos,
          data_agendada: entrega.data_agendada
        };
      });

      // Payload para assistências
      const payloadAssistencias = assistenciasNaoNotificadas.map(at => {
        const itensTexto = at.itens_envolvidos?.map(i => `• ${i.produto_nome}`).join('\n') || at.tipo;
        return {
          id: at.id,
          tipo: 'assistencia',
          numero_pedido: at.numero_pedido,
          cliente_nome: at.cliente_nome,
          telefone: at.cliente_telefone,
          turno: at.turno || "Comercial",
          produtos: itensTexto,
          data_agendada: at.data_visita,
          tipo_assistencia: at.tipo
        };
      });

      const payloadCompleto = [...payloadEntregas, ...payloadAssistencias];

      const response = await fetch(`${import.meta.env.VITE_ZAP_API_URL}/disparar-confirmacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregas: payloadCompleto })
      });

      if (response.ok) {
        // Marcar entregas como notificadas
        for (const entrega of entregasNaoNotificadas) {
          try {
            await base44.entities.Entrega.update(entrega.id, {
              status_confirmacao: 'Aguardando Resposta',
              whatsapp_enviado: true,
              data_notificacao: entrega.data_agendada?.split('T')[0],
              turno_notificacao: entrega.turno,
              ultima_notificacao: new Date().toISOString()
            });
          } catch (dbError) {
            console.warn('Erro ao atualizar entrega:', dbError);
          }
        }

        // Marcar assistências como notificadas
        for (const at of assistenciasNaoNotificadas) {
          try {
            await base44.entities.AssistenciaTecnica.update(at.id, {
              data_notificacao: at.data_visita?.split('T')[0],
              turno_notificacao: at.turno,
              ultima_notificacao: new Date().toISOString()
            });
          } catch (dbError) {
            console.warn('Erro ao atualizar assistência:', dbError);
          }
        }

        toast.success(`✅ ${totalParaEnviar} cliente(s) do ${caminhao.nome || caminhao.placa} notificado(s)!`);
        setModalDisparo(null);
        queryClient.invalidateQueries({ queryKey: ['entregas'] });
        queryClient.invalidateQueries({ queryKey: ['assistencias'] });
      } else {
        toast.error("Erro do robô");
      }
    } catch (error) {
      console.error('Erro ao enviar:', error);
      toast.warning("⚠️ Não foi possível conectar ao robô.");
    } finally { setLoadingDisparo(false); }
  };

  const handleDragStart = (event) => { setActiveId(event.active.id); };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const itemId = active.id;
    const overId = over.id.toString();
    const isAssistencia = itemId.toString().startsWith('at-');

    // Se for assistência, tratar separadamente
    if (isAssistencia) {
      const assistenciaId = itemId.toString().replace('at-', ''); // UUID - manter como string

      // Soltou em um slot de turno → associar data/caminhão/turno (se o sistema suportar)
      const turnoMatch = overId.match(/^(\d{4}-\d{2}-\d{2})-(\d+)-(Manhã|Tarde|Comercial)$/);
      if (turnoMatch) {
        const dataAlvo = turnoMatch[1];
        const caminhaoId = parseInt(turnoMatch[2]);
        const turno = turnoMatch[3];
        const caminhao = caminhoes.find(c => c.id === caminhaoId);

        try {
          await base44.entities.AssistenciaTecnica.update(assistenciaId, {
            data_visita: dataAlvo,
            caminhao_id: caminhaoId,
            turno: turno,
            status: 'Agendado' // Requer adicionar 'Agendado' ao check constraint
          });
          toast.success(`AT agendada - ${turno} - ${caminhao?.nome || caminhao?.placa}`);
          queryClient.invalidateQueries({ queryKey: ['assistencias'] });
        } catch (error) {
          console.error('Erro ao agendar assistência:', error);
          toast.error("Erro ao agendar assistência");
        }
      }
      return;
    }

    // É uma entrega normal
    const entregaId = itemId;
    const entregaAtual = (entregas || []).find(e => e.id === entregaId);
    if (!entregaAtual) return;

    // 1. Soltou na Triagem → Desagendar
    if (overId === 'triagem') {
      queryClient.setQueryData(['entregas'], (oldData) =>
        oldData.map(e => e.id === entregaId ? { ...e, data_agendada: null, turno: null, ordem_rota: null, status: 'Pendente', caminhao_id: null } : e)
      );

      try {
        await atualizarEntregaMutation.mutateAsync({
          id: entregaId,
          data: { data_agendada: null, turno: null, ordem_rota: null, status: 'Pendente', caminhao_id: null }
        });
        toast.success("Entrega desagendada");
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ['entregas'] }), 500);
      } catch (error) {
        queryClient.invalidateQueries({ queryKey: ['entregas'] });
      }
      return;
    }

    // 2. Soltou em "Aguardando Liberação"
    if (overId === 'aguardando') {
      setModalMotivoAguardando({ entregaId });
      return;
    }

    // 3. Soltou em um slot de turno → Agendar para data + caminhão + turno
    // Formato do ID: ${data}-${caminhaoId}-${turno}
    // Exemplo: 2025-12-28-5-Manhã
    const turnoMatch = overId.match(/^(\d{4}-\d{2}-\d{2})-(\d+)-(Manhã|Tarde|Comercial)$/);
    if (turnoMatch) {
      const dataAlvo = turnoMatch[1];
      const caminhaoId = parseInt(turnoMatch[2]);
      const turno = turnoMatch[3];

      const caminhao = caminhoes.find(c => c.id === caminhaoId);

      const updateData = {
        data_agendada: dataAlvo,
        turno: turno,
        ordem_rota: null,
        status: 'Agendada',
        caminhao_id: caminhaoId
      };

      // Atualização otimista
      queryClient.setQueryData(['entregas'], (oldData) =>
        oldData.map(e => e.id === entregaId ? { ...e, ...updateData } : e)
      );

      try {
        await atualizarEntregaMutation.mutateAsync({ id: entregaId, data: updateData });
        toast.success(`${turno} - ${caminhao?.nome || caminhao?.placa}`);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ['entregas'] }), 500);
      } catch (error) {
        queryClient.invalidateQueries({ queryKey: ['entregas'] });
        toast.error("Erro ao agendar");
      }
      return;
    }
  };

  const confirmarAguardando = async () => {
    if (!modalMotivoAguardando || !motivoAguardando.trim()) {
      toast.error("Informe o motivo");
      return;
    }

    try {
      await atualizarEntregaMutation.mutateAsync({
        id: modalMotivoAguardando.entregaId,
        data: {
          status: 'Aguardando Liberação',
          observacoes_internas: motivoAguardando,
          data_agendada: null,
          caminhao_id: null
        }
      });
      toast.success("Entrega aguardando liberação");
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
    } catch (error) {
      toast.error("Erro ao atualizar");
    }

    setModalMotivoAguardando(null);
    setMotivoAguardando("");
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="h-full flex flex-col gap-4 p-4 rounded-2xl bg-gray-50">

          {/* --- TRIAGEM + AGUARDANDO --- */}
          <div className="flex gap-3 h-[180px] flex-shrink-0">
            {/* Triagem */}
            <Card
              ref={setTriagemRef}
              className={`flex-1 flex flex-col border-0 transition-all shadow-sm ${isOverTriagem ? 'bg-blue-100 ring-4 ring-blue-400' : 'bg-white/80 backdrop-blur'}`}
            >
              <div className="px-3 py-2 border-b flex justify-between items-center bg-white/50 rounded-t-xl gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`p-1.5 rounded-md ${isOverTriagem ? 'bg-blue-600 text-white' : 'bg-orange-100 text-orange-600'}`}>
                    <PackageOpen className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-800">
                    {isOverTriagem ? "Solte para Desagendar" : "Triagem"}
                  </h3>
                </div>

                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <Input
                    className="h-7 text-xs pl-7 bg-white border-gray-200"
                    placeholder="Buscar..."
                    value={searchTriagem}
                    onChange={e => setSearchTriagem(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] font-mono bg-blue-100 text-blue-700">
                    {pendentesFiltrados.length} 🚚
                  </Badge>
                  {assistenciasNaoAgendadas.length > 0 && (
                    <Badge className="text-[10px] font-mono bg-purple-600 text-white">
                      {assistenciasNaoAgendadas.length} 🔧
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 w-full p-2 overflow-y-hidden">
                <div className="flex gap-2 pb-2 pl-1 h-full items-start">
                  {pendentesFiltrados.map(entrega => (
                    <div key={entrega.id} className="w-[220px] flex-shrink-0 h-full">
                      <EntregaCard
                        entrega={entrega}
                        venda={(vendas || []).find(v => v.id === entrega.venda_id)}
                        onClick={setEntregaSelecionada}
                        isColumn={false}
                      />
                    </div>
                  ))}

                  {assistenciasNaoAgendadas.map(at => (
                    <div key={`at-${at.id}`} className="w-[220px] flex-shrink-0 h-full">
                      <AssistenciaCard assistencia={at} isColumn={false} />
                    </div>
                  ))}

                  {pendentesFiltrados.length === 0 && assistenciasNaoAgendadas.length === 0 && !isOverTriagem && (
                    <div className="w-full flex flex-col items-center justify-center pt-1 text-gray-300 text-[10px]">
                      <p>Tudo organizado!</p>
                    </div>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Card>

            {/* Aguardando Liberação */}
            <Card
              ref={setAguardandoRef}
              className={`w-[120px] flex flex-col items-center justify-center border-2 border-dashed transition-all ${isOverAguardando ? 'bg-amber-100 border-amber-500 scale-105 shadow-lg' : 'bg-white/60 border-gray-300 hover:border-amber-400'
                }`}
            >
              <Clock className={`w-6 h-6 mb-1 ${isOverAguardando ? 'text-amber-600 animate-bounce' : 'text-gray-400'}`} />
              <p className={`text-[9px] font-bold text-center px-2 ${isOverAguardando ? 'text-amber-800' : 'text-gray-500'}`}>
                {isOverAguardando ? "Solte aqui" : "Aguardando\nLiberação"}
              </p>
            </Card>
          </div>

          {/* --- ABAS DE DIAS --- */}
          <div className="flex items-center gap-2 bg-white rounded-xl p-2 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSemanaOffset(s => s - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex-1 flex gap-1 overflow-x-auto">
              {diasDisponiveis.map((dia, index) => (
                <button
                  key={dia.id}
                  onClick={() => setDiaSelecionado(index)}
                  className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-center transition-all ${diaSelecionado === index
                    ? 'bg-blue-600 text-white shadow-md'
                    : dia.isHoje
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  <p className="font-bold text-sm">{dia.label}</p>
                  <p className={`text-[10px] ${diaSelecionado === index ? 'text-blue-100' : 'text-gray-400'}`}>
                    {dia.dataFormatada}
                  </p>
                  {dia.totalEntregas > 0 && (
                    <Badge className={`mt-1 text-[9px] ${diaSelecionado === index ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {dia.totalEntregas}
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSemanaOffset(s => s + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* --- COLUNAS DE CAMINHÕES --- */}
          <div className="flex-1 min-h-0">
            <div className="h-full flex gap-3 overflow-x-auto pb-2">
              {diaSelecionado === null ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <Calendar className="w-16 h-16 mb-4 opacity-30" />
                  <p className="font-medium text-lg">Selecione um dia</p>
                  <p className="text-sm">Clique em um dia acima para ver as entregas</p>
                </div>
              ) : caminhoes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <Truck className="w-12 h-12 mb-3 opacity-30" />
                  <p className="font-medium">Nenhum caminhão cadastrado</p>
                  <p className="text-sm">Cadastre caminhões para organizar as entregas</p>
                </div>
              ) : (
                caminhoes.map((caminhao, index) => (
                  <ColunaCaminhao
                    key={caminhao.id}
                    caminhao={caminhao}
                    cor={CORES_CAMINHOES[index % CORES_CAMINHOES.length]}
                    dataAtual={dataAtual}
                    entregas={entregas || []}
                    vendas={vendas || []}
                    onClickEntrega={setEntregaSelecionada}
                    onNotificar={handleNotificarCaminhao}
                    onOtimizar={(entregasDoCaminhao) => setModalOtimizacao(entregasDoCaminhao)}
                    assistencias={assistencias || []}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeEntrega ? (
            <Card className="p-2 bg-white shadow-2xl opacity-90 border-2 border-blue-500 w-[180px] cursor-grabbing rotate-3 z-50">
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

      {/* Modal Motivo Aguardando */}
      <Dialog open={!!modalMotivoAguardando} onOpenChange={() => setModalMotivoAguardando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              Motivo da Espera
            </DialogTitle>
            <DialogDescription>
              Informe por que esta entrega está aguardando liberação.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Ex: Aguardando pagamento, peça em falta, cliente viajando..."
              value={motivoAguardando}
              onChange={(e) => setMotivoAguardando(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMotivoAguardando(null)}>Cancelar</Button>
            <Button onClick={confirmarAguardando} className="bg-amber-600 hover:bg-amber-700">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Disparo de Confirmações - Por Caminhão */}
      <Dialog open={!!modalDisparo} onOpenChange={() => setModalDisparo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <MessageCircle className="w-5 h-5" />
              Notificar - {modalDisparo?.caminhao?.nome || modalDisparo?.caminhao?.placa}
            </DialogTitle>
            <DialogDescription>
              {(modalDisparo?.totalNaoNotificadas || 0) > 0
                ? `Disparar WhatsApp para ${modalDisparo.totalNaoNotificadas} cliente(s)?`
                : "Todos os clientes já foram notificados!"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {statusServidor === 'online'
              ? <div className="p-3 rounded bg-green-100 text-green-800 flex items-center gap-2"><Server className="w-5 h-5" /> <span>Robô Online!</span></div>
              : <div className="p-3 rounded bg-red-100 text-red-800 flex items-center gap-2"><WifiOff className="w-5 h-5" /> <span>Robô Offline</span></div>
            }

            {/* Resumo de Entregas */}
            {(modalDisparo?.entregasNaoNotificadas?.length || 0) > 0 && (
              <div className="text-sm space-y-2">
                <p className="font-medium text-blue-600 flex items-center gap-1">
                  <Truck className="w-4 h-4" /> Entregas ({modalDisparo.entregasNaoNotificadas.length})
                </p>
                {['Manhã', 'Tarde', 'Comercial'].map(turno => {
                  const doTurno = modalDisparo.entregasNaoNotificadas.filter(e => e.turno === turno);
                  if (doTurno.length === 0) return null;
                  const TurnoIcon = turno === 'Manhã' ? Sun : turno === 'Tarde' ? Sunset : Clock;
                  const iconColor = turno === 'Manhã' ? 'text-amber-500' : turno === 'Tarde' ? 'text-orange-500' : 'text-blue-500';
                  return (
                    <div key={turno} className="flex items-center gap-2 text-gray-700 ml-4">
                      <TurnoIcon className={`w-3.5 h-3.5 ${iconColor}`} />
                      <span className="text-xs">{turno}: <strong>{doTurno.length}</strong></span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resumo de Assistências */}
            {(modalDisparo?.assistenciasNaoNotificadas?.length || 0) > 0 && (
              <div className="text-sm space-y-2">
                <p className="font-medium text-purple-600 flex items-center gap-1">
                  <Wrench className="w-4 h-4" /> Assistências ({modalDisparo.assistenciasNaoNotificadas.length})
                </p>
                {['Manhã', 'Tarde', 'Comercial'].map(turno => {
                  const doTurno = modalDisparo.assistenciasNaoNotificadas.filter(a => a.turno === turno);
                  if (doTurno.length === 0) return null;
                  const TurnoIcon = turno === 'Manhã' ? Sun : turno === 'Tarde' ? Sunset : Clock;
                  const iconColor = turno === 'Manhã' ? 'text-amber-500' : turno === 'Tarde' ? 'text-orange-500' : 'text-blue-500';
                  return (
                    <div key={turno} className="flex items-center gap-2 text-gray-700 ml-4">
                      <TurnoIcon className={`w-3.5 h-3.5 ${iconColor}`} />
                      <span className="text-xs">{turno}: <strong>{doTurno.length}</strong></span>
                    </div>
                  );
                })}
              </div>
            )}

            {(modalDisparo?.totalJaNotificadas || 0) > 0 && (
              <div className="flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle className="w-4 h-4" />
                {modalDisparo.totalJaNotificadas} já notificados (serão ignorados)
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDisparo(null)}>Cancelar</Button>
            <Button
              onClick={enviarConfirmacoes}
              disabled={statusServidor !== "online" || loadingDisparo || !(modalDisparo?.totalNaoNotificadas)}
              className="bg-green-600 hover:bg-green-700"
            >
              {loadingDisparo ? <Loader2 className="animate-spin" /> : `Notificar ${modalDisparo?.totalNaoNotificadas || 0}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Otimização de Rota */}
      {modalOtimizacao && (
        <RouteOptimizer
          open={!!modalOtimizacao}
          onClose={() => setModalOtimizacao(null)}
          entregas={modalOtimizacao}
        />
      )}
    </>
  );
}