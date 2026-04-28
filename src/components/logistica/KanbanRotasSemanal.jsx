import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase";
import { DndContext, DragOverlay, rectIntersection, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import EntregaCard from "./EntregaCard";
import AssistenciaCard from "./AssistenciaCard";
import ModalDetalhesEntrega from "./ModalDetalhesEntrega";
import { PackageOpen, Search, Clock, Truck, AlertTriangle, ChevronLeft, ChevronRight, Wrench, Calendar, MessageCircle, Loader2, Server, WifiOff, CheckCircle, Sun, Sunset, Route } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { whatsappService } from "@/services/whatsappService";
import RouteOptimizer from "./RouteOptimizer";
import { buildProductDisplayName } from "@/utils/productReference";

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
function SlotTurno({ turno, caminhaoId, dataAtual, entregas, vendas, onClickEntrega, corCaminhao, assistencias = [], activeEntrega }) {
  const dropId = `${dataAtual}-${caminhaoId}-${turno.id}`;
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    disabled: !!activeEntrega && (function () {
      // --- LÓGICA DE RESTRIÇÃO VISUAL (MESMA DO DRAG END) ---
      if (!activeEntrega) return false;

      // 1. Data Passada
      const hojeStr = new Date().toISOString().split('T')[0];
      if (dataAtual < hojeStr) return true;

      // 2. Preferências (Dias e Turnos - WHITELIST)
      if (activeEntrega.preferencias_entrega) {
        const { dias, turnos } = activeEntrega.preferencias_entrega;

        // Check Dia da Semana - WHITELIST: Only allow if in the list
        if (dias && dias.length > 0) {
          const [y, m, d] = dataAtual.split('-').map(Number);
          const diaSemanaSlot = new Date(y, m - 1, d).getDay(); // 0=Dom

          const diasPermitidos = dias.map(d => Number(d));
          if (!diasPermitidos.includes(diaSemanaSlot)) {
            return true;
          }
        }

        // Check Turno - WHITELIST: Only allow if in the list
        if (turnos && turnos.length > 0) {
          const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const turnoSlotNorm = normalize(turno.id);

          if (!turnos.some(t => normalize(t) === turnoSlotNorm)) {
            return true;
          }
        }
      }
      return false;
    })()
  });

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

  // --- CALCULO SE ESTÁ RESTRITO (PARA ESTILO) ---
  const isRestricted = useMemo(() => {
    if (!activeEntrega) return false;

    // 1. Data Passada (Melhorado para Local Time)
    const hoje = new Date();
    const hojeStr = new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    if (dataAtual < hojeStr) return true;

    // 2. Preferências
    if (activeEntrega.preferencias_entrega) {
      const { dias, turnos } = activeEntrega.preferencias_entrega;

      // Check Dia (Normalized) - WHITELIST: Only allow if in the list
      if (dias && dias.length > 0) {
        const [y, m, d] = dataAtual.split('-').map(Number);
        const diaSemanaSlot = new Date(y, m - 1, d).getDay();
        const diasPermitidos = dias.map(d => Number(d));
        if (!diasPermitidos.includes(diaSemanaSlot)) return true;
      }

      // Check Turno (Normalized) - WHITELIST: Only allow if in the list
      if (turnos && turnos.length > 0) {
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const turnoSlotNorm = normalize(turno.id);

        if (!turnos.some(t => normalize(t) === turnoSlotNorm)) {
          return true;
        }
      }
    }

    return false;
  }, [activeEntrega, dataAtual, turno.id]);


  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col border rounded-lg transition-all 
        ${isRestricted ? 'opacity-30 grayscale pointer-events-none bg-gray-100' : ''}
        ${isOver && !isRestricted
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

// Componente Visual da Aba de Data com Drop/Hover logic
function DateTabVisual({ dia, index, isSelected, onClick, activeEntrega, onHoverSwitch }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tab-date-${index}`,
    data: { type: 'date-tab', index }
  });

  // Hover timer logic
  useEffect(() => {
    if (isOver && activeEntrega) {
      const timer = setTimeout(() => {
        onHoverSwitch(index);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOver, activeEntrega, index, onHoverSwitch]);

  // Restrição Visual logic
  const isRestricted = useMemo(() => {
    if (!activeEntrega) return false;

    // 1. Data Passada (Melhorado para Local Time)
    const hoje = new Date();
    const hojeStr = new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    if (dia.id < hojeStr) return true;

    // 2. Preferências (Dia da Semana - WHITELIST)
    if (activeEntrega.preferencias_entrega?.dias?.length > 0) {
      const diasPermitidos = activeEntrega.preferencias_entrega.dias.map(d => Number(d));
      // SE NÃO ESTÁ NA LISTA -> BLOQUEADO
      if (!diasPermitidos.includes(dia.diaSemana)) return true;
    }

    return false;
  }, [activeEntrega, dia]);

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-center transition-all relative
        ${isRestricted ? 'opacity-30 grayscale cursor-not-allowed bg-gray-100' : ''}
        ${isSelected
          ? 'bg-blue-600 text-white shadow-md'
          : dia.isHoje
            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }
        ${isOver && !isRestricted && !isSelected ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
      `}
    >
      {/* Loading indicator if hover switching */}
      {isOver && !isRestricted && !isSelected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-200 overflow-hidden rounded-t-lg">
          <div className="h-full bg-blue-600 animate-[progress_1s_linear]" />
        </div>
      )}

      <p className="font-bold text-sm">{dia.label}</p>
      <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
        {dia.dataFormatada}
      </p>
      {dia.totalEntregas > 0 && (
        <Badge className={`mt-1 text-[9px] ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
          {dia.totalEntregas}
        </Badge>
      )}
    </button>
  );
}

// Componente de coluna para cada caminhão
function ColunaCaminhao({ caminhao, cor, dataAtual, entregas, vendas, onClickEntrega, onNotificar, onOtimizar, assistencias = [], activeEntrega }) {
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

        {/* Botão de Confirmar (Antigo Notificar) */}
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
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wide ${totalNaoNotificadas > 0
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
              : 'bg-gray-200 text-gray-500'
              }`}
            title={totalNaoNotificadas > 0 ? `Solicitar confirmação de ${totalNaoNotificadas} itens` : 'Todos confirmados'}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {totalNaoNotificadas > 0 && <span>Confirmar</span>}
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
            activeEntrega={activeEntrega}
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
  const [pedidoEnvioManual, setPedidoEnvioManual] = useState("");
  const [caminhaoEnvioManual, setCaminhaoEnvioManual] = useState("");
  const [turnoEnvioManual, setTurnoEnvioManual] = useState("Comercial");
  const [dataEnvioManual, setDataEnvioManual] = useState("");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [weekNavDirection, setWeekNavDirection] = useState(null);
  const [weekNavAnimationKey, setWeekNavAnimationKey] = useState(0);
  const [diaSelecionado, setDiaSelecionado] = useState(null); // null = nenhum dia selecionado

  // Estados para modais

  // Estados para disparo de notificações (por caminhão)
  const [modalDisparo, setModalDisparo] = useState(null); // { caminhao, entregas, naoNotificadas, jaNotificadas }
  const [statusServidor, setStatusServidor] = useState("verificando");
  const [loadingDisparo, setLoadingDisparo] = useState(false);

  // Estado para otimização de rotas
  const [modalOtimizacao, setModalOtimizacao] = useState(null); // Array de entregas para otimizar

  // Estados para reagendamento
  const [modalReagendamento, setModalReagendamento] = useState(null); // { entrega }
  const [motivoReagendamento, setMotivoReagendamento] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { setNodeRef: setTriagemRef, isOver: isOverTriagem } = useDroppable({ id: 'triagem' });

  const atualizarEntregaMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Entrega.update(id, data);
    },
    onError: (error) => console.error("Erro ao atualizar entrega:", error)
  });

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Calcular início e fim da semana (Segunda a Domingo)
  const getWeekRange = (offset = 0) => {
    const hoje = new Date();
    const diaSemana = hoje.getDay(); // 0 = Domingo, 1 = Segunda, ...

    // Ajustar para Monday ser o primeiro dia (1) e Domingo o último (7)
    // Se hoje é Domingo (0), queremos voltar 6 dias para pegar a Segunda passada
    // Se hoje é Segunda (1), voltamos 0 dias
    const diffToMonday = diaSemana === 0 ? -6 : 1 - diaSemana;

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() + diffToMonday + (offset * 7));
    inicioSemana.setHours(0, 0, 0, 0);

    return inicioSemana;
  };

  const inicioSemanaAtual = getWeekRange(semanaOffset);

  const navigateSemana = (direction) => {
    setWeekNavDirection(direction);
    setSemanaOffset((s) => s + direction);
    setWeekNavAnimationKey((k) => k + 1);
  };

  // Gerar os 7 dias da semana (Segunda a Domingo)
  const diasDisponiveis = useMemo(() => {
    const dias = [];
    const hojeStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicioSemanaAtual);
      dia.setDate(inicioSemanaAtual.getDate() + i);
      const dataKey = dia.toISOString().split('T')[0];

      // Contar entregas do dia
      const entregasDoDia = (entregas || []).filter(e => e.data_agendada?.split('T')[0] === dataKey);

      dias.push({
        id: dataKey,
        label: diasSemana[dia.getDay()],
        dataFormatada: `${dia.getDate().toString().padStart(2, '0')}/${(dia.getMonth() + 1).toString().padStart(2, '0')}`,
        isHoje: dataKey === hojeStr,
        totalEntregas: entregasDoDia.length,
        diaSemana: dia.getDay()
      });
    }
    return dias;
  }, [entregas, inicioSemanaAtual]);

  const dataAtual = diaSelecionado !== null ? diasDisponiveis[diaSelecionado]?.id : null;

  useEffect(() => {
    if (!dataEnvioManual && diasDisponiveis.length > 0) {
      const hojeDaSemana = diasDisponiveis.find(d => d.isHoje);
      setDataEnvioManual(hojeDaSemana?.id || diasDisponiveis[0].id);
    }
  }, [diasDisponiveis, dataEnvioManual]);

  // Filtra a triagem pela busca
  const pendentesFiltrados = (entregasPendentes || []).filter(e => {
    const termo = searchTriagem.toLowerCase();
    if (!termo) return true;
    const matchCliente = e.cliente_nome?.toLowerCase().includes(termo);
    const matchPedido = e.numero_pedido?.toString().includes(termo);
    const venda = (vendas || []).find(v => v.id === e.venda_id);
    const matchProduto = venda?.itens?.some(i => buildProductDisplayName(i.produto_nome, i.modelo_referencia).toLowerCase().includes(termo));
    return matchCliente || matchPedido || matchProduto;
  });

  const entregasConfirmadasNaoEntregues = useMemo(() => {
    return (entregas || [])
      .filter((e) =>
        e.status_confirmacao === 'Confirmada' &&
        e.data_agendada &&
        e.status !== 'Entregue' &&
        e.status !== 'Cancelada'
      )
      .sort((a, b) => (a.data_agendada || '').localeCompare(b.data_agendada || ''));
  }, [entregas]);

  const buscaPedidoInfo = useMemo(() => {
    const termo = (searchTriagem || '').trim();
    if (!termo) return null;

    const entrega = (entregas || []).find((e) => String(e.numero_pedido) === termo);
    if (!entrega) return null;

    const dataAgendada = entrega.data_agendada?.split('T')[0] || null;
    const diaIndex = dataAgendada ? diasDisponiveis.findIndex((d) => d.id === dataAgendada) : -1;
    const caminhao = caminhoes.find((c) => String(c.id) === String(entrega.caminhao_id));

    return {
      entrega,
      caminhao,
      dataAgendada,
      diaIndex,
      localizadaEmCaminhao: Boolean(entrega.caminhao_id && dataAgendada && caminhao)
    };
  }, [searchTriagem, entregas, diasDisponiveis, caminhoes]);

  useEffect(() => {
    if (buscaPedidoInfo?.localizadaEmCaminhao && buscaPedidoInfo.diaIndex >= 0) {
      setDiaSelecionado(buscaPedidoInfo.diaIndex);
    }
  }, [buscaPedidoInfo]);

  const caminhoesFiltradosPorBusca = useMemo(() => {
    if (!buscaPedidoInfo?.localizadaEmCaminhao) return caminhoes;
    return caminhoes.filter((c) => String(c.id) === String(buscaPedidoInfo.entrega.caminhao_id));
  }, [caminhoes, buscaPedidoInfo]);


  // Assistências não agendadas (sem data_visita ou caminhao_id) - aparecem na triagem
  const assistenciasNaoAgendadas = (assistencias || []).filter(a =>
    !a.data_visita || !a.caminhao_id
  );

  // Entrega ativa (sendo arrastada)
  // Entrega ou Assistência ativa (sendo arrastada)
  const activeEntrega = useMemo(() => {
    if (!activeId) return null;
    const idStr = activeId.toString();

    // Se for assistência
    if (idStr.startsWith('at-')) {
      const cleanId = idStr.replace('at-', '');
      const assist = (assistencias || []).find(a => a.id.toString() === cleanId);
      if (assist) return { ...assist, isAssistencia: true, cliente_nome: `(AT) ${assist.cliente_nome}` };
    }

    // Se for entrega
    return (entregas || []).find(e => e.id.toString() === idStr);
  }, [activeId, entregas, assistencias]);

  // Verificar servidor do bot
  const verificarServidor = async () => {
    setStatusServidor("verificando");
    try {
      if (await whatsappService.checkStatus()) {
        setStatusServidor("online");
      } else {
        setStatusServidor("offline");
      }
    } catch (error) {
      console.error("Erro ao verificar servidor:", error);
      setStatusServidor("offline");
    }
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
        toast.success("✅ Todos já confirmados!");
        setModalDisparo(null);
        setLoadingDisparo(false);
        return;
      }

      // Payload para entregas
      const payloadEntregas = entregasNaoNotificadas.map(entrega => {
        const venda = (vendas || []).find(v => v.id === entrega.venda_id);
        const listaProdutos = venda?.itens?.map(item => `• ${item.quantidade}x ${buildProductDisplayName(item.produto_nome, item.modelo_referencia)}`).join('\n') || "Itens não informados";
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
        const itensTexto = at.itens_envolvidos?.map(i => `• ${buildProductDisplayName(i.produto_nome, i.modelo_referencia)}`).join('\n') || at.tipo;
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

      const response = await whatsappService.sendConfirmations(payloadCompleto);

      if (response.ok) {
        // Marcar entregas como notificadas
        for (const entrega of entregasNaoNotificadas) {
          try {
            await base44.entities.Entrega.update(entrega.id, {
              status_confirmacao: 'Notificada', // Fluxo direto para Notificada
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

        toast.success(`✅ Solicitação de confirmação enviada para ${totalParaEnviar} clientes!`);
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

        // Guardrail: Não permitir agendar para o passado
        const hojeStr = new Date().toISOString().split('T')[0];
        if (dataAlvo < hojeStr) {
          toast.error("Não é possível agendar para uma data passada!");
          return;
        }

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
    const entregaId = itemId.toString();
    const entregaAtual = (entregas || []).find(e => e.id.toString() === entregaId);

    if (!entregaAtual) {
      console.error("❌ Entrega não encontrada no drop:", itemId);
      return;
    }

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
      // Otimista: Mover para "Aguardando Liberação" na UI
      queryClient.setQueryData(['entregas'], (oldData) =>
        oldData.map(e => e.id === entregaId ? { ...e, status: 'Aguardando Liberação', data_agendada: null, turno: null, caminhao_id: null } : e)
      );
      try {
        await atualizarEntregaMutation.mutateAsync({
          id: entregaId,
          data: { status: 'Aguardando Liberação', data_agendada: null, turno: null, caminhao_id: null }
        });
      } catch (error) {
        queryClient.invalidateQueries({ queryKey: ['entregas'] });
      }
      return;
    }

    // 3. Soltou em um slot de turno → Agendar para data + caminhão + turno
    // Formato do ID: ${data}-${caminhaoId}-${turno}
    // Exemplo: 2025-12-28-5-Manhã
    const turnoMatch = overId.match(/^(\d{4}-\d{2}-\d{2})-(\d+)-(Manhã|Tarde|Comercial)$/);
    if (turnoMatch) {
      const dataAlvo = turnoMatch[1];

      // Guardrail: Não permitir agendar para o passado
      const hojeStr = new Date().toISOString().split('T')[0];
      if (dataAlvo < hojeStr) {
        toast.error("Não é possível agendar para uma data passada!");
        return;
      }

      const caminhaoId = parseInt(turnoMatch[2]);
      const turno = turnoMatch[3];

      // GUARDRAIL: Preferências de Entrega (WHITELIST)
      if (entregaAtual.preferencias_entrega) {
        const { dias, turnos } = entregaAtual.preferencias_entrega;

        // Verificar Dia da Semana (Whitelist)
        if (dias && dias.length > 0) {
          const [y, m, d] = dataAlvo.split('-').map(Number);
          const diaSemanaAlvo = new Date(y, m - 1, d).getDay(); // 0=Dom

          const diasPermitidos = dias.map(d => Number(d));
          if (!diasPermitidos.includes(diaSemanaAlvo)) {
            const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            toast.error(`BLOQUEADO: Dia não permitido pelo Cliente`, {
              description: `O cliente só permite receber em: ${diasPermitidos.map(d => nomesDias[d]).join(', ')}.`,
              duration: 4000
            });
            return;
          }
        }

        // Verificar Turno (Whitelist - Normalized)
        if (turnos && turnos.length > 0) {
          const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const turnoTargetNorm = normalize(turno);

          if (!turnos.some(t => normalize(t) === turnoTargetNorm)) {
            toast.error(`BLOQUEADO: Turno não permitido pelo Cliente`, {
              description: `O cliente só permite receber no turno: ${turnos.join(', ')}.`,
              duration: 4000
            });
            return;
          }
        }
      }

      const caminhao = caminhoes.find(c => c.id === caminhaoId);
      const isDateChange = entregaAtual.data_agendada?.split('T')[0] !== dataAlvo;

      const normalize = (str) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isShiftChange = normalize(entregaAtual.turno) !== normalize(turno);

      const updateData = {
        data_agendada: dataAlvo,
        turno: turno,
        ordem_rota: null,
        status: 'Agendada',
        caminhao_id: caminhaoId
      };

      // Se apenas o caminhão mudou, mantém confirmação já existente.
      if (entregaAtual.status_confirmacao === 'Confirmada' && !isDateChange && !isShiftChange) {
        updateData.status_confirmacao = 'Confirmada';
      }

      console.log("🛠️ Drag Check:", {
        status: entregaAtual.status_confirmacao,
        isConfirmada: entregaAtual.status_confirmacao === 'Confirmada',
        isDateChange,
        isShiftChange,
        entTurno: entregaAtual.turno,
        newTurno: turno
      });

      // 4. Se já está CONFIRMADA e trocou de data OU turno, pedir motivo
      if (entregaAtual.status_confirmacao === 'Confirmada' && (isDateChange || isShiftChange)) {
        setModalReagendamento({
          entrega: entregaAtual,
          novoAgendamento: updateData,
          isMove: true
        });
        return; // Interrompe o drag imediato
      }

      // Atualização otimista
      queryClient.setQueryData(['entregas'], (oldData) =>
        oldData.map(e => String(e.id) === String(entregaId) ? { ...e, ...updateData } : e)
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


  const handleCardClick = (item, action) => {
    if (action === 'reagendar') {
      setModalReagendamento({ entrega: item });
      setMotivoReagendamento("");
    } else {
      setEntregaSelecionada(item);
    }
  };

  const confirmarReagendamento = async () => {
    if (!modalReagendamento || !motivoReagendamento.trim()) {
      toast.error("Informe o motivo do reagendamento");
      return;
    }

    try {
      const historicoAtual = modalReagendamento.entrega.historico_reagendamentos || [];
      const novoEvento = {
        data_anterior: modalReagendamento.entrega.data_agendada,
        data_nova: modalReagendamento.isMove ? modalReagendamento.novoAgendamento.data_agendada : null,
        motivo: motivoReagendamento,
        data_registro: new Date().toISOString(),
        usuario: 'Logistica',
        tipo: modalReagendamento.isMove ? 'ALTERACAO_DATA' : 'CANCELAMENTO'
      };

      if (modalReagendamento.isMove) {
        // CASO 1: MOVER (Trocar Data)
        await atualizarEntregaMutation.mutateAsync({
          id: modalReagendamento.entrega.id,
          data: {
            ...modalReagendamento.novoAgendamento,
            status_confirmacao: 'Notificada', // Resetar confirmação pois mudou data
            historico_reagendamentos: [...historicoAtual, novoEvento]
          }
        });

        // DISPARAR NOTIFICAÇÃO DE REAGENDAMENTO PARA O CLIENTE
        try {
          const venda = (vendas || []).find(v => v.id === modalReagendamento.entrega.venda_id);
          const listaProdutos = venda?.itens?.map(item => `• ${item.quantidade}x ${buildProductDisplayName(item.produto_nome, item.modelo_referencia)}`).join('\n') || "Itens não informados";

          const payload = [{
            id: modalReagendamento.entrega.id,
            tipo: 'entrega',
            numero_pedido: modalReagendamento.entrega.numero_pedido,
            cliente_nome: modalReagendamento.entrega.cliente_nome,
            telefone: modalReagendamento.entrega.cliente_telefone,
            turno: modalReagendamento.novoAgendamento.turno || "Comercial",
            produtos: listaProdutos,
            data_agendada: modalReagendamento.novoAgendamento.data_agendada,
            is_reagendamento: true // Flag para mensagem diferenciada
          }];

          await whatsappService.sendConfirmations(payload);
          toast.success("Cliente notificado via WhatsApp!");
        } catch (err) {
          console.error("Erro ao notificar reagendamento:", err);
          toast.warning("Reagendado, mas erro ao notificar WhatsApp.");
        }

        toast.success("Entrega reagendada! Status resetado para 'Notificada'.");
      } else {
        // CASO 2: CANCELAR (Voltar para Triagem)
        await atualizarEntregaMutation.mutateAsync({
          id: modalReagendamento.entrega.id,
          data: {
            status: 'Pendente',
            data_agendada: null,
            turno: null,
            caminhao_id: null,
            ordem_rota: null,
            status_confirmacao: null, // Limpar confirmação
            // Registrar restrição
            data_restricao: modalReagendamento.entrega.data_agendada,
            turno_restricao: modalReagendamento.entrega.turno,
            motivo_restricao: motivoReagendamento,
            historico_reagendamentos: [...historicoAtual, novoEvento]
          }
        });
        toast.success("Entrega retornada para triagem com restrição de data.");
      }

      queryClient.invalidateQueries({ queryKey: ['entregas'] });
    } catch (error) {
      console.error("Erro ao reagendar:", error);
      toast.error("Erro ao processar solicitação");
    }
    setModalReagendamento(null);
    setMotivoReagendamento("");
  };

  const enviarPedidoManual = async () => {
    const pedido = (pedidoEnvioManual || '').trim();
    if (!pedido || !caminhaoEnvioManual || !turnoEnvioManual || !dataEnvioManual) {
      toast.error("Preencha pedido, caminhão, data e turno para enviar.");
      return;
    }

    const entrega = (entregasPendentes || []).find((e) => String(e.numero_pedido) === pedido);
    if (!entrega) {
      toast.error("Pedido não está na triagem pendente ou não foi encontrado.");
      return;
    }

    const updateData = {
      data_agendada: dataEnvioManual,
      turno: turnoEnvioManual,
      caminhao_id: Number(caminhaoEnvioManual),
      status: 'Agendada',
      ordem_rota: null
    };

    try {
      await atualizarEntregaMutation.mutateAsync({ id: entrega.id, data: updateData });
      toast.success(`Pedido #${pedido} enviado para caminhão e turno selecionados.`);
      setPedidoEnvioManual("");
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
    } catch (error) {
      toast.error("Erro ao enviar pedido para o caminhão.");
    }
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="h-full flex flex-col gap-4 p-4 rounded-2xl bg-gray-50">

          {/* --- TRIAGEM + AGUARDANDO --- */}
          <div className="flex gap-3 h-[250px] flex-shrink-0">
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
                    placeholder="Buscar (cliente/produto/pedido)"
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

              <div className="px-3 py-2 border-b bg-slate-50/60">
                <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-gray-600">Pedido</Label>
                    <Input
                      className="h-8 text-xs bg-white"
                      placeholder="#12345"
                      value={pedidoEnvioManual}
                      onChange={(e) => setPedidoEnvioManual(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-gray-600">Enviar para caminhão</Label>
                    <Select value={caminhaoEnvioManual} onValueChange={setCaminhaoEnvioManual}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {caminhoes.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.nome || c.placa}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-gray-600">Data</Label>
                    <Select value={dataEnvioManual} onValueChange={setDataEnvioManual}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {diasDisponiveis.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.label} - {d.dataFormatada}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-gray-600">Horário</Label>
                    <Select value={turnoEnvioManual} onValueChange={setTurnoEnvioManual}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TURNOS.map((turno) => (
                          <SelectItem key={turno.id} value={turno.id}>
                            {turno.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="h-8 text-xs" onClick={enviarPedidoManual}>
                    Enviar para rota
                  </Button>
                </div>

                {buscaPedidoInfo && (
                  <div className={`mt-2 rounded-md border px-2 py-1.5 text-xs ${buscaPedidoInfo.localizadaEmCaminhao ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    {buscaPedidoInfo.localizadaEmCaminhao
                      ? `Pedido #${buscaPedidoInfo.entrega.numero_pedido} está no caminhão ${buscaPedidoInfo.caminhao?.nome || buscaPedidoInfo.caminhao?.placa}, turno ${buscaPedidoInfo.entrega.turno}, dia ${new Date(`${buscaPedidoInfo.dataAgendada}T12:00:00`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.`
                      : `Pedido #${buscaPedidoInfo.entrega.numero_pedido} localizado, mas ainda não está alocado em caminhão/data.`}
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1 min-h-[128px] w-full p-2 overflow-y-hidden">
                <div className="flex gap-2 pb-2 pl-1 h-full items-start">
                  {pendentesFiltrados.map(entrega => (
                    <div key={entrega.id} className="w-[248px] flex-shrink-0 h-full">
                      <EntregaCard
                        entrega={entrega}
                        venda={(vendas || []).find(v => v.id === entrega.venda_id)}
                        onClick={handleCardClick}
                        isColumn={false}
                      />
                    </div>
                  ))}


                  {assistenciasNaoAgendadas.map(at => (
                    <div key={`at-${at.id}`} className="w-[248px] flex-shrink-0 h-full">
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

          </div>

          <Card className="border-0 shadow-sm bg-white/90">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-800">Agendados e Confirmados (Pendentes de Entrega)</h3>
              <Badge className="text-[10px] bg-emerald-600">{entregasConfirmadasNaoEntregues.length}</Badge>
            </div>
            <CardContent className="p-2">
              {entregasConfirmadasNaoEntregues.length === 0 ? (
                <p className="text-xs text-gray-400 px-1 py-2">Nenhum pedido confirmado pendente de entrega.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {entregasConfirmadasNaoEntregues.map((e) => {
                    const cam = caminhoes.find((c) => String(c.id) === String(e.caminhao_id));
                    return (
                      <button
                        key={e.id}
                        onClick={() => {
                          const dataAgendada = e.data_agendada?.split('T')[0];
                          const idx = diasDisponiveis.findIndex((d) => d.id === dataAgendada);
                          if (idx >= 0) setDiaSelecionado(idx);
                          setSearchTriagem(String(e.numero_pedido || ''));
                        }}
                        className="min-w-[260px] text-left p-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-bold text-emerald-700">#{e.numero_pedido}</span>
                          <Badge className="text-[9px] bg-emerald-600">Confirmada</Badge>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 truncate mt-1">{e.cliente_nome}</p>
                        <p className="text-[11px] text-gray-600 mt-1">
                          {cam ? (cam.nome || cam.placa) : 'Sem caminhão'} • {e.turno || '-'} • {e.data_agendada ? new Date(e.data_agendada).toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* --- ABAS DE DIAS --- */}
          <div className="flex items-center gap-2 bg-white rounded-xl p-2 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateSemana(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div
              key={weekNavAnimationKey}
              className={`flex-1 flex gap-1 overflow-x-auto ${weekNavDirection === -1
                ? 'animate-week-rotate-left'
                : weekNavDirection === 1
                  ? 'animate-week-rotate-right'
                  : ''}`}
            >
              {diasDisponiveis.map((dia, index) => (
                <DateTabVisual
                  key={dia.id}
                  dia={dia}
                  index={index}
                  isSelected={diaSelecionado === index}
                  onClick={() => setDiaSelecionado(index)}
                  activeEntrega={activeEntrega}
                  onHoverSwitch={setDiaSelecionado}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateSemana(1)}
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
              ) : caminhoesFiltradosPorBusca.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <Truck className="w-12 h-12 mb-3 opacity-30" />
                  <p className="font-medium">Nenhum caminhão encontrado para o filtro atual</p>
                  <p className="text-sm">Verifique a busca pelo número do pedido</p>
                </div>
              ) : (
                caminhoesFiltradosPorBusca.map((caminhao, index) => (
                  <ColunaCaminhao
                    key={caminhao.id}
                    caminhao={caminhao}
                    cor={CORES_CAMINHOES[index % CORES_CAMINHOES.length]}
                    dataAtual={dataAtual}
                    entregas={entregas || []}
                    vendas={vendas || []}
                    onClickEntrega={handleCardClick}
                    onNotificar={handleNotificarCaminhao}
                    onOtimizar={(entregasDoCaminhao) => setModalOtimizacao(entregasDoCaminhao)}
                    assistencias={assistencias || []}
                    activeEntrega={activeEntrega}
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


      {/* Modal Disparo de Confirmações - Por Caminhão */}
      <Dialog open={!!modalDisparo} onOpenChange={() => setModalDisparo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Confirmar Entregas - {modalDisparo?.caminhao?.nome || modalDisparo?.caminhao?.placa}
            </DialogTitle>
            <DialogDescription>
              {(modalDisparo?.totalNaoNotificadas || 0) > 0
                ? `Enviar mensagem de confirmação para ${modalDisparo.totalNaoNotificadas} cliente(s)?`
                : "Todos os clientes já foram solicitados para confirmação!"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {statusServidor === 'online'
              ? <div className="p-3 rounded bg-green-100 text-green-800 flex items-center gap-2"><Server className="w-5 h-5" /> <span>Automação Online!</span></div>
              : <div className="p-3 rounded bg-red-100 text-red-800 flex items-center gap-2"><WifiOff className="w-5 h-5" /> <span>Automação Offline</span></div>
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
              {loadingDisparo ? <Loader2 className="animate-spin" /> : `Encaminhar Confirmação (${modalDisparo?.totalNaoNotificadas || 0})`}
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
          onRotaAplicada={() => queryClient.invalidateQueries({ queryKey: ['entregas'] })}
        />
      )}

      {/* Modal Solicitar Reagendamento */}
      <Dialog open={!!modalReagendamento} onOpenChange={() => setModalReagendamento(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Calendar className="w-5 h-5" />
              Solicitar Reagendamento
            </DialogTitle>
            <DialogDescription>
              Por que o cliente não pode receber nesta data?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {modalReagendamento?.isMove && modalReagendamento?.novoAgendamento && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">Ao confirmar, o cliente sera notificado imediatamente sobre o ajuste de entrega.</p>
                    <p className="mt-1">
                      Nova previsao: <strong>{new Date(`${modalReagendamento.novoAgendamento.data_agendada}T12:00:00`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong> no turno <strong>{modalReagendamento.novoAgendamento.turno}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Textarea
              placeholder="Ex: Cliente estará viajando, pediu para entregar próxima semana..."
              value={motivoReagendamento}
              onChange={(e) => setMotivoReagendamento(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalReagendamento(null)}>Cancelar</Button>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!motivoReagendamento.trim()) return toast.error("Informe o motivo");
                  await atualizarEntregaMutation.mutateAsync({
                    id: modalReagendamento.entrega.id,
                    data: {
                      status: 'Aguardando Liberação',
                      observacoes: motivoReagendamento,
                      data_agendada: null,
                      turno: null,
                      caminhao_id: null,
                      ordem_rota: null
                    }
                  });
                  toast.success("Entrega movida para Aguardando Liberação");
                  setModalReagendamento(null);
                  setMotivoReagendamento("");
                  queryClient.invalidateQueries({ queryKey: ['entregas'] });
                }}
                className="bg-amber-600 hover:bg-amber-700 gap-1"
              >
                <Clock className="w-4 h-4" />
                Reservar (Aguardando)
              </Button>
              <Button onClick={confirmarReagendamento} className="bg-red-600 hover:bg-red-700">
                {modalReagendamento?.isMove ? 'Confirmar e Notificar Cliente' : 'Confirmar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}