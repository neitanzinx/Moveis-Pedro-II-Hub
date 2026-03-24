import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  CheckCircle, Clock, Package, User, Calendar,

  ChevronLeft, ChevronRight, Truck, PartyPopper, ArrowDown, Sofa, AlertTriangle,
  UserCheck, Users, CheckSquare, Loader2, RotateCcw, MoreVertical, ArrowRightLeft, Info
} from "lucide-react";
import { toast } from "sonner";
import { whatsappService } from "@/services/whatsappService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function MontagemInterna() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [semanaOffset, setSemanaOffset] = React.useState(0);
  const [itemRecemConcluido, setItemRecemConcluido] = React.useState(null);

  // Determinar papel do usuário logado
  const isAdmin = user?.cargo === 'Administrador';
  const isMontador = ['Montador', 'Logística', 'Estoque'].includes(user?.cargo);

  // Estados para modal de atribuição (apenas Admin usa)
  const [montagemSelecionada, setMontagemSelecionada] = React.useState(null);
  const [modalAtribuirOpen, setModalAtribuirOpen] = React.useState(false);
  const [montadorSelecionado, setMontadorSelecionado] = React.useState('');

  // Estados para PIN
  const [pinDialogOpen, setPinDialogOpen] = React.useState(false);
  const [pinCallback, setPinCallback] = React.useState(null);
  const [pinInput, setPinInput] = React.useState('');

  // Calcular início e fim da semana (Segunda a Domingo)
  const getWeekRange = (offset = 0) => {
    const hoje = new Date();
    const diaNum = hoje.getDay(); // 0 (Dom) a 6 (Sáb)

    // Tratamento para Domingo (0): se hoje é domingo, queremos a semana que TERMINA hoje.
    // getDay() retorna 0 para domingo. Queremos recuar 6 dias para chegar na segunda.
    // Se não for domingo, recuamos (diaNum - 1) dias.
    const diffParaSegunda = diaNum === 0 ? 6 : diaNum - 1;

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diffParaSegunda + (offset * 7));
    inicioSemana.setHours(0, 0, 0, 0);

    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6); // Termina no Domingo
    fimSemana.setHours(23, 59, 59, 999);

    return { inicio: inicioSemana, fim: fimSemana };
  };

  const { inicio, fim } = getWeekRange(semanaOffset);

  // Buscar todas as montagens internas
  const { data: todasMontagens = [], isLoading } = useQuery({
    queryKey: ['montagens-internas-todas'],
    queryFn: async () => {
      const todas = await base44.entities.MontagemItem.list('-created_at');
      return todas.filter(m => m.tipo_montagem === 'interna');
    },
    refetchInterval: 3000 // Atualiza a cada 3 segundos
  });

  // Buscar montadores internos (Usuários de Logística, Estoque ou Montador)
  const { data: montadoresInternos = [] } = useQuery({
    queryKey: ['montadores-internos'],
    queryFn: async () => {
      const todos = await base44.entities.User.list();
      return todos
        .filter(m =>
          (m.cargo === 'Logística' || m.cargo === 'Estoque' || m.cargo === 'Montador') &&
          m.ativo !== false
        )
        .map(m => ({
          id: m.id,
          nome: m.full_name || m.email,
          nome_completo: m.full_name,
          pin_montagem: m.pin_montagem
        }));
    }
  });

  // Separar pendentes e concluídas
  const montagensInternas = todasMontagens.filter(m => m.status !== 'concluida');
  const montagensConcluidas = todasMontagens.filter(m => m.status === 'concluida').slice(0, 20);

  // Buscar entregas para pegar a data de entrega
  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas'],
    queryFn: () => base44.entities.Entrega.list('-data_agendada'),
    refetchInterval: 10000 // Atualiza a cada 10 segundos
  });

  // Buscar pedidos de mostruário pendentes de montagem
  const { data: pedidosMostruario = [] } = useQuery({
    queryKey: ['pedidos-mostruario-montagem'],
    queryFn: () => base44.entities.PedidoMostruario.list('-created_at'),
    refetchInterval: 5000
  });

  // Filtrar mostruários pendentes ou em montagem
  const mostruariosPendentes = React.useMemo(() => {
    return pedidosMostruario.filter(p =>
      p.status === 'Pendente' || p.status === 'Em Montagem'
    );
  }, [pedidosMostruario]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MontagemItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['montagens-internas-todas'] })
  });

  const updateMostruarioMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PedidoMostruario.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos-mostruario-montagem'] })
  });

  // Mapa de entregas para busca rápida por ID e Numero Pedido
  const entregasMaps = React.useMemo(() => {
    const byId = new Map();
    const byPedido = new Map();

    entregas.forEach(e => {
      byId.set(String(e.id), e);
      if (e.numero_pedido) byPedido.set(String(e.numero_pedido), e);
    });

    return { byId, byPedido };
  }, [entregas]);

  // Agrupar por dia de entrega
  const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const montagensData = React.useMemo(() => {
    const porDia = {};
    const outrasDatas = [];

    // Helper para formatar data local YYYY-MM-DD
    const getLocalDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Gerar todos os dias da semana
    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + i);
      const dataKey = getLocalDateString(dia);

      porDia[dataKey] = {
        data: dia,
        label: diasDaSemana[dia.getDay()],
        diaNumero: dia.getDate(),
        montagens: []
      };
    }

    // Distribuir montagens com base na data de entrega
    montagensInternas.forEach(montagem => {
      // Tentar encontrar a entrega (Pelo ID ou pelo Número do Pedido como fallback)
      let entrega = entregasMaps.byId.get(String(montagem.entrega_id));

      if (!entrega && montagem.numero_pedido) {
        entrega = entregasMaps.byPedido.get(String(montagem.numero_pedido));
      }

      if (entrega?.data_agendada) {
        const dataKey = entrega.data_agendada.split('T')[0];

        if (porDia[dataKey]) {
          porDia[dataKey].montagens.push({
            ...montagem,
            dataEntrega: entrega.data_agendada,
            turnoEntrega: entrega.turno
          });
        } else {
          // Agendada mas fora da semana atual
          outrasDatas.push({
            ...montagem,
            dataEntrega: entrega.data_agendada,
            turnoEntrega: entrega.turno
          });
        }
      }
    });

    return { porDia, outrasDatas };
  }, [montagensInternas, entregasMaps, inicio]);

  // Facil acesso para o render atual
  const montagensPorDia = montagensData.porDia;
  const montagensOutrasDatas = montagensData.outrasDatas;

  // Função para solicitar PIN do usuário logado
  const solicitarPin = (callback) => {
    // Buscar PIN do usuário logado na lista de montadores internos
    const montadorLogado = montadoresInternos.find(m => m.id?.toString() === user?.id?.toString());
    const pinDoUsuario = montadorLogado?.pin_montagem || user?.pin_montagem;

    // Se o usuário tem PIN configurado, pedir
    if (pinDoUsuario) {
      setPinCallback(() => callback);
      setPinInput('');
      setPinDialogOpen(true);
    } else {
      // Se não tem PIN, executar direto
      callback();
    }
  };

  const confirmarPin = () => {
    const montadorLogado = montadoresInternos.find(m => m.id?.toString() === user?.id?.toString());
    const pinDoUsuario = montadorLogado?.pin_montagem || user?.pin_montagem;
    if (pinDoUsuario === pinInput) {
      setPinDialogOpen(false);
      if (pinCallback) pinCallback();
      // Limpar estados sensíveis
      setPinInput('');
      setPinCallback(null);
    } else {
      toast.error("PIN incorreto");
      setPinInput('');
    }
  };

  // Auto-atribuir montagem ao usuário logado (para montadores)
  const autoAtribuirMontador = async (montagem) => {
    try {
      const { data, error } = await supabase
        .from('montagens_itens')
        .update({
          montador_id: user.id?.toString(),
          montador_nome: user.full_name || user.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', montagem.id)
        .is('montador_id', null)
        .neq('status', 'concluida')
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning('Esta montagem acabou de ser atribuida para outro montador.');
        queryClient.invalidateQueries({ queryKey: ['montagens-internas-todas'] });
        return;
      }

      toast.success(`Montagem atribuída a você (${user.full_name?.split(' ')[0] || 'Montador'})`);
      queryClient.invalidateQueries({ queryKey: ['montagens-internas-todas'] });
    } catch (error) {
      console.error('Erro ao auto-atribuir montador:', error);
      toast.error('Erro ao atribuir montagem');
    }
  };

  const desatribuirMontador = async (montagem) => {
    try {
      await updateMutation.mutateAsync({
        id: montagem.id,
        data: {
          montador_id: null,
          montador_nome: null,
          updated_at: new Date().toISOString()
        }
      });
      toast.success("Atribuição removida com sucesso!");
    } catch (error) {
      console.error('Erro ao remover atribuição:', error);
      toast.error('Erro ao remover atribuição');
    }
  };

  // Clique no card de montagem
  const handleClickMontagem = (montagem, event) => {
    event.stopPropagation();

    // Admin: abre modal de seleção (padrão antigo sem "Quem é você?")
    if (isAdmin) {
      setMontagemSelecionada(montagem);
      setMontadorSelecionado(montagem.montador_id?.toString() || '');
      setModalAtribuirOpen(true);
      return;
    }

    // Montador logado:
    if (isMontador) {
      const meuId = user.id?.toString();

      if (!montagem.montador_id) {
        // Sem montador atribuído → auto-atribuir com PIN
        solicitarPin(() => autoAtribuirMontador(montagem));
      } else if (montagem.montador_id?.toString() === meuId) {
        // Já atribuída a mim → confirmar para desatribuir
        if (window.confirm("Deseja remover sua atribuição desta montagem?")) {
          solicitarPin(() => desatribuirMontador(montagem));
        }
      } else {
        // Atribuída a outro montador
        toast.info(`Esta montagem está atribuída a ${montagem.montador_nome || 'outro montador'}.`);
      }
      return;
    }

    // Outros cargos: apenas visualizam
    toast.info('Sem permissão para alterar atribuição.');
  };

  // Função para Admin atribuir montador via modal
  const atribuirMontador = async () => {
    if (!montagemSelecionada) return;

    const executarAtribuicao = async () => {
      try {
        const id = montadorSelecionado === 'unassigned' ? null : montadorSelecionado;
        const montador = montadoresInternos.find(m => m.id === id);

        await updateMutation.mutateAsync({
          id: montagemSelecionada.id,
          data: {
            montador_id: id,
            montador_nome: montador ? (montador.nome_completo || montador.nome) : null
          }
        });

        setModalAtribuirOpen(false);
        setMontadorSelecionado("");
        toast.success("Atribuição atualizada com sucesso!");
      } catch (error) {
        console.error('Erro ao atribuir montador:', error);
        toast.error('Erro ao atribuir montador');
      }
    };

    executarAtribuicao();
  };

  const toggleMontado = async (montagem) => {
    const novoStatus = montagem.status === 'concluida' ? 'pendente' : 'concluida';

    const executarToggle = async () => {
      // Se é montador concluindo e a montagem não tem montador, auto-atribuir
      if (novoStatus === 'concluida' && !montagem.montador_id && isMontador) {
        await updateMutation.mutateAsync({
          id: montagem.id,
          data: {
            montador_id: user.id?.toString(),
            montador_nome: user.full_name || user.email
          }
        });
      } else if (novoStatus === 'concluida' && !montagem.montador_id && !isMontador) {
        toast.error("Para concluir, atribua um montador primeiro.");
        return;
      }

      // Se está marcando como concluído, ativar animação
      if (novoStatus === 'concluida') {
        setItemRecemConcluido(montagem.id);
        toast.success('✅ Montagem concluída!', {
          icon: <PartyPopper className="w-5 h-5 text-yellow-500" />
        });

        // Limpar animação após 2s
        setTimeout(() => setItemRecemConcluido(null), 2000);
      }

      await updateMutation.mutateAsync({
        id: montagem.id,
        data: {
          status: novoStatus,
          // Se concluindo, registrar data de conclusão e quem concluiu
          ...(novoStatus === 'concluida' && {
            updated_at: new Date().toISOString(),
            concluido_por: user.id?.toString(),
            concluido_por_nome: user.full_name || user.email
          }),
          // Se retornando para pendente, limpar quem concluiu
          ...(novoStatus === 'pendente' && {
            concluido_por: null,
            concluido_por_nome: null
          })
        }
      });

      // Verificar se TODAS as montagens internas dessa entrega foram concluídas
      if (novoStatus === 'concluida' && montagem.entrega_id) {
        const montagensDaEntrega = todasMontagens.filter(
          m => m.entrega_id === montagem.entrega_id && m.tipo_montagem === 'interna'
        );

        // Contar quantas já estão concluídas (incluindo a atual que acabamos de marcar)
        const jaConcluidasCount = montagensDaEntrega.filter(
          m => m.status === 'concluida' || m.id === montagem.id
        ).length;

        // Se todas estão concluídas, atualizar status da entrega
        if (jaConcluidasCount === montagensDaEntrega.length) {
          try {
            await base44.entities.Entrega.update(montagem.entrega_id, {
              montagem_status: 'Concluída',
              montagem_concluida_em: new Date().toISOString()
            });
            toast.success('🚚 Todas as montagens concluídas! Pedido pronto para enviar.', {
              duration: 4000
            });
            queryClient.invalidateQueries({ queryKey: ['entregas'] });
          } catch (err) {
            console.error('Erro ao atualizar status da entrega:', err);
          }
        }
      }
    };

    // Sempre pedir PIN do usuário logado para confirmar ação
    solicitarPin(executarToggle);
  };


  // Concluir em lote montagens de um montador
  const concluirEmLote = async (montadorId) => {
    const idParam = montadorId?.toString();
    const montagensDoMontador = montagensInternas.filter(m =>
      m.montador_id?.toString() === idParam && m.status !== 'concluida'
    );

    if (montagensDoMontador.length === 0) {
      toast.info('Nenhuma montagem pendente para concluir');
      return;
    }

    const executarLote = () => {
      toast.promise(
        Promise.all(
          montagensDoMontador.map(m =>
            updateMutation.mutateAsync({
              id: m.id,
              data: {
                status: 'concluida',
                updated_at: new Date().toISOString(),
                concluido_por: user.id?.toString(),
                concluido_por_nome: user.full_name || user.email
              }
            })
          )
        ),
        {
          loading: `Concluindo ${montagensDoMontador.length} montagens...`,
          success: `${montagensDoMontador.length} montagens concluídas!`,
          error: 'Erro ao concluir montagens'
        }
      );
    };

    solicitarPin(executarLote);
  };

  // Transferir para montagem externa
  const transferirParaExterno = async (montagem, transferirTodos = false) => {
    // Verificações de segurança
    if (montagem.montador_id) {
      toast.error('Não é possível transferir um item já atribuído a um montador interno.');
      return;
    }
    if (montagem.status === 'concluida') {
      toast.error('Não é possível transferir um item já montado.');
      return;
    }

    // Definir quais itens serão afetados
    let itensParaTransferir = [montagem];

    if (transferirTodos && montagem.venda_id) {
      // Buscar todos os itens dessa venda que estão pendentes e são internos
      itensParaTransferir = todasMontagens.filter(m =>
        m.venda_id === montagem.venda_id &&
        m.tipo_montagem === 'interna' &&
        !m.montador_id &&
        m.status !== 'concluida'
      );
    }

    if (itensParaTransferir.length === 0) {
      toast.info('Nenhum item elegível para transferência.');
      return;
    }

    const mensagemConfirmacao = transferirTodos
      ? `Transferir ${itensParaTransferir.length} itens deste pedido para Montagem Externa?`
      : `Transferir "${montagem.produto_nome}" para Montagem Externa?`;

    // Usar toast.promise para feedback visual
    toast.promise(
      Promise.all(
        itensParaTransferir.map(item =>
          updateMutation.mutateAsync({
            id: item.id,
            data: {
              tipo_montagem: 'terceirizada',
              montador_id: null,
              montador_nome: null,
              status: 'pendente',
              updated_at: new Date().toISOString()
            }
          })
        )
      ),
      {
        loading: 'Transferindo para montadores externos...',
        success: (data) => `${data.length} item(ns) transferido(s) com sucesso!`,
        error: 'Erro ao transferir itens'
      }
    );
  };

  // Resumo por montador
  const resumoPorMontador = React.useMemo(() => {
    const resumo = {};

    // Não atribuídas
    resumo['nao-atribuida'] = {
      id: 'nao-atribuida',
      nome: 'Não atribuídas',
      pendentes: montagensInternas.filter(m => !m.montador_id && m.status !== 'concluida').length
    };

    // Por montador
    montadoresInternos.forEach(montador => {
      resumo[montador.id] = {
        id: montador.id,
        nome: montador.nome,
        pendentes: montagensInternas.filter(m =>
          m.montador_id === montador.id.toString() && m.status !== 'concluida'
        ).length
      };
    });

    return Object.values(resumo).filter(r => r.pendentes > 0 || r.id !== 'nao-atribuida' || montagensInternas.some(m => !m.montador_id));
  }, [montagensInternas, montadoresInternos]);

  // Agrupar todas as montagens pendentes (independentemente da data) por montador para a listagem inferior
  const pendentesPorMontador = React.useMemo(() => {
    const grupos = {};
    const meuId = user?.id?.toString();

    montadoresInternos.forEach(montador => {
      // Se não for admin, mas for montador, ignora os outros
      if (!isAdmin && isMontador && montador.id.toString() !== meuId) {
        return;
      }

      const idStr = montador.id.toString();
      const itens = todasMontagens.filter(m =>
        m.montador_id?.toString() === idStr &&
        m.status !== 'concluida'
      );

      if (itens.length > 0) {
        grupos[idStr] = {
          montador,
          itens: itens.sort((a, b) => {
            // Ordenar por data de entrega se disponível
            const entregaA = entregasMaps.byId.get(String(a.entrega_id))?.data_agendada || '9999-12-31';
            const entregaB = entregasMaps.byId.get(String(b.entrega_id))?.data_agendada || '9999-12-31';
            return entregaA.localeCompare(entregaB);
          })
        };
      }
    });

    return Object.values(grupos);
  }, [todasMontagens, montadoresInternos, entregasMaps, isAdmin, isMontador, user]);

  const formatarSemana = () => {
    const inicioStr = inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const fimStr = fim.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${inicioStr} - ${fimStr}`;
  };

  const totalPendentes = Object.values(montagensPorDia).reduce(
    (acc, dia) => acc + dia.montagens.filter(m => m.status !== 'concluida').length, 0
  );

  const montagensSemData = React.useMemo(() => {
    return montagensInternas.filter(montagem => {
      let entrega = entregasMaps.byId.get(String(montagem.entrega_id));
      if (!entrega && montagem.numero_pedido) {
        entrega = entregasMaps.byPedido.get(String(montagem.numero_pedido));
      }
      return !entrega?.data_agendada; // Sem data agendada
    });
  }, [montagensInternas, entregasMaps]);

  // Componente do card de montagem
  const CardMontagem = ({ montagem, showDate = false }) => {
    const isAtribuida = !!montagem.montador_id;

    return (
      <div
        onClick={(e) => handleClickMontagem(montagem, e)}
        className={`p-2 rounded-lg border cursor-pointer transition-all duration-300 ${itemRecemConcluido === montagem.id
          ? 'animate-pulse bg-green-200 border-green-400 scale-95 opacity-50'
          : montagem.status === 'concluida'
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20'
            : isAtribuida
              ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 hover:border-blue-400'
              : 'bg-white border-orange-200 dark:bg-neutral-800 hover:border-orange-400'
          }`}
      >
        <div className="flex items-start gap-2">
          <Checkbox
            checked={montagem.status === 'concluida'}
            className="mt-0.5"
            onClick={(e) => { e.stopPropagation(); toggleMontado(montagem); }}
          />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium truncate ${montagem.status === 'concluida' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'
              }`}>
              {montagem.produto_nome}
            </p>
            <p className="text-xs text-gray-500">
              #{montagem.numero_pedido} • {montagem.quantidade}x
            </p>

            {/* Mostrar atribuição */}
            {montagem.montador_nome && montagem.status !== 'concluida' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                <UserCheck className="w-3 h-3" />
                <span className="truncate">{montagem.montador_nome}</span>
              </div>
            )}

            {showDate && montagem.dataEntrega && (
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                <Truck className="w-3 h-3" />
                <span>
                  Entrega: {(() => {
                    const d = montagem.dataEntrega?.split('T')[0];
                    return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-';
                  })()}
                  {montagem.turnoEntrega && ` (${montagem.turnoEntrega})`}
                </span>
              </div>
            )}
          </div>

          {/* Botão de atribuir */}
          {montagem.status !== 'concluida' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-blue-100"
              onClick={(e) => handleClickMontagem(montagem, e)}
              title={isAtribuida ? `Atribuída a ${montagem.montador_nome} - Clique para alterar` : 'Atribuir montador'}
            >
              <User className={`w-3 h-3 ${isAtribuida ? 'text-blue-600' : 'text-gray-400'}`} />
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-500" />
            Montagens Internas
          </h2>
          <p className="text-sm text-gray-500">
            Itens que precisam ser montados no galpão antes da entrega
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-100 text-orange-700 text-lg px-4 py-2">
            {totalPendentes} pendentes
          </Badge>
        </div>
      </div>

      {/* Navegação Semanal */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSemanaOffset(s => s - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <div className="text-center">
              <p className="font-bold text-lg text-gray-900 dark:text-white">
                {formatarSemana()}
              </p>
              {semanaOffset === 0 && (
                <Badge className="bg-green-100 text-green-700 text-xs">Semana Atual</Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSemanaOffset(s => s + 1)}
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Montagens Sem Data de Entrega */}
      {montagensSemData.length > 0 && (
        <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50/50 dark:from-yellow-900/10 dark:to-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
              <Clock className="w-5 h-5" />
              Aguardando Agendamento de Entrega
              <Badge className="bg-yellow-200 text-yellow-800">{montagensSemData.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {montagensSemData.map(montagem => (
                <CardMontagem key={montagem.id} montagem={montagem} />
              ))}
            </div>
            <p className="text-xs text-yellow-600 mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Estas montagens aparecerão no calendário quando a entrega for agendada
            </p>
          </CardContent>
        </Card>
      )}

      {/* Montagens Agendadas para Outras Datas */}
      {montagensOutrasDatas.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-900/10 dark:to-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
              <Calendar className="w-5 h-5" />
              Programadas para Outras Datas
              <Badge className="bg-blue-200 text-blue-800">{montagensOutrasDatas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {montagensOutrasDatas.map(montagem => (
                <CardMontagem key={montagem.id} montagem={montagem} showDate />
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-3 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Estas montagens estão agendadas para datas fora da semana visualizada acima.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grid Semanal */}
      <div className="grid grid-cols-7 gap-3">
        {Object.entries(montagensPorDia).map(([dataKey, dia]) => {
          const isHoje = new Date().toISOString().split('T')[0] === dataKey;
          const montagensPendentes = dia.montagens.filter(m => m.status !== 'concluida');

          return (
            <Card
              key={dataKey}
              className={`min-h-[300px] ${isHoje ? 'ring-2 ring-green-500 bg-green-50/50 dark:bg-green-900/10' : ''}`}
            >
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="text-center">
                  <p className={`text-xs font-medium ${isHoje ? 'text-green-600' : 'text-gray-500'}`}>
                    {dia.label}
                  </p>
                  <p className={`text-2xl font-bold ${isHoje ? 'text-green-700' : 'text-gray-900 dark:text-white'}`}>
                    {dia.diaNumero}
                  </p>
                  {montagensPendentes.length > 0 && (
                    <Badge className="mt-1 bg-orange-100 text-orange-700 text-xs">
                      {montagensPendentes.length} item(s)
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-2 space-y-2">
                {dia.montagens.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle className="w-8 h-8 mx-auto text-gray-200" />
                    <p className="text-xs text-gray-400 mt-1">Livre</p>
                  </div>
                ) : (
                  dia.montagens.map(montagem => (
                    <CardMontagem key={montagem.id} montagem={montagem} showDate />
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legenda */}
      <Card className="bg-gray-50 dark:bg-neutral-900 line-clamp-1 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-orange-300 bg-white" />
              <span className="text-gray-600">Não atribuída</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-blue-300 bg-blue-50" />
              <span className="text-gray-600">Atribuída</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-green-300 bg-green-100" />
              <span className="text-gray-600">Montada</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600 font-medium">Data de entrega</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listagem Individual por Montador - Próximas Montagens */}
      {pendentesPorMontador.length > 0 && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-2 border-b pb-2">
            <UserCheck className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Próximas Montagens por Montador
            </h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {pendentesPorMontador.map(({ montador, itens }) => (
              <Card key={montador.id} className="border-blue-100 bg-blue-50/10 hover:shadow-md transition-shadow dark:bg-blue-900/5">
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-blue-800 dark:text-blue-300">
                      Próximas montagens de {montador.nome_completo || montador.nome}
                    </CardTitle>
                    <p className="text-xs text-blue-600/70 font-medium mt-0.5">
                      {itens.length} item(s) pendente(s)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-blue-200 text-blue-700 hover:bg-blue-100"
                    onClick={() => concluirEmLote(montador.id)}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Concluir tudo
                  </Button>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {itens.map(item => (
                      <CardMontagem key={item.id} montagem={item} showDate />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Mostruário */}
      {mostruariosPendentes.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sofa className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Montagens de Mostruário
            </h3>
            <Badge className="bg-indigo-100 text-indigo-700">{mostruariosPendentes.length}</Badge>
          </div>

          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-neutral-900">
            <CardContent className="p-4">
              <div className="grid gap-3">
                {mostruariosPendentes.map(pedido => (
                  <div
                    key={pedido.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${pedido.status === 'Em Montagem'
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20'
                      : 'bg-white border-indigo-200 dark:bg-neutral-800 hover:border-indigo-400'
                      }`}
                    onClick={() => {
                      if (pedido.status === 'Pendente') {
                        updateMostruarioMutation.mutate({
                          id: pedido.id,
                          data: { status: 'Em Montagem', data_montagem: new Date().toISOString() }
                        });
                        toast.success('Montagem de mostruário iniciada!');
                      } else if (pedido.status === 'Em Montagem') {
                        updateMostruarioMutation.mutate({
                          id: pedido.id,
                          data: { status: 'Montado' }
                        });
                        toast.success('✅ Mostruário montado!');
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={pedido.status === 'Em Montagem'} />
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {pedido.produto_nome}
                          </p>
                          <p className="text-xs text-gray-500">
                            {pedido.quantidade}x • Loja {pedido.loja}
                          </p>
                        </div>
                      </div>
                      <Badge className={
                        pedido.status === 'Pendente'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }>
                        {pedido.status === 'Pendente' ? 'Iniciar' : 'Concluir'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Seção de Concluídas */}
      {montagensConcluidas.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDown className="w-5 h-5 text-green-500 animate-bounce" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Montagens Concluídas Recentes
            </h3>
            <Badge className="bg-green-100 text-green-700">{montagensConcluidas.length}</Badge>
          </div>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white dark:from-green-900/10 dark:to-neutral-900">
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-200">
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Produto</th>
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Pedido</th>
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Qtd</th>
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Montador</th>
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Data Entrega</th>
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Status</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {montagensConcluidas.map((montagem, index) => {
                      const entrega = entregas.find(e => String(e.id) === String(montagem.entrega_id));
                      return (
                        <tr
                          key={montagem.id}
                          className={`border-b border-green-100 transition-all ${itemRecemConcluido === montagem.id
                            ? 'animate-slide-in bg-green-100'
                            : ''
                            }`}
                          style={{
                            animationDelay: `${index * 50}ms`
                          }}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-gray-900 dark:text-white font-medium truncate max-w-[150px]">
                                {montagem.produto_nome}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-gray-600">#{montagem.numero_pedido}</td>
                          <td className="py-2 px-3 text-gray-600">{montagem.quantidade}x</td>
                          <td className="py-2 px-3">
                            {montagem.montador_nome ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1 text-blue-600">
                                  <UserCheck className="w-3 h-3" />
                                  <span>{montagem.montador_nome}</span>
                                </div>
                                {montagem.concluido_por_nome && montagem.concluido_por_nome !== montagem.montador_nome && (
                                  <div className="flex items-center gap-1 text-xs text-orange-600" title="Quem clicou para concluir">
                                    <CheckSquare className="w-3 h-3" />
                                    <span>Baixado por: {montagem.concluido_por_nome.split(' ')[0]}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {entrega?.data_agendada ? (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Truck className="w-3 h-3" />
                                <span>
                                  {new Date(entrega.data_agendada).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit'
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              ✓ Pronto
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                              onClick={() => toggleMontado(montagem)}
                              title="Retornar para pendente"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal para Atribuir Montador */}
      <Dialog open={modalAtribuirOpen} onOpenChange={setModalAtribuirOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              Atribuir Montador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {montagemSelecionada && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-800">
                <p className="font-medium">{montagemSelecionada.produto_nome}</p>
                <p className="text-sm text-gray-500">
                  #{montagemSelecionada.numero_pedido} • {montagemSelecionada.quantidade}x
                </p>
                {montagemSelecionada.montador_nome && (
                  <p className="text-sm text-blue-600 mt-1">
                    Atualmente atribuída a: {montagemSelecionada.montador_nome}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label>Selecionar Montador</Label>
              <Select value={montadorSelecionado} onValueChange={setMontadorSelecionado}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha um montador..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <span className="text-gray-500">Nenhum (remover atribuição)</span>
                  </SelectItem>
                  {montadoresInternos.map(montador => (
                    <SelectItem key={montador.id} value={montador.id.toString()}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        {montador.nome_completo || montador.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {montadoresInternos.length === 0 && (
                <p className="text-sm text-orange-600 mt-2">
                  ⚠️ Nenhum montador interno encontrado. Verifique se há colaboradores com o cargo &quot;Montador&quot;, &quot;Logística&quot; ou &quot;Estoque&quot;.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setModalAtribuirOpen(false);
              setMontagemSelecionada(null);
            }}>
              Cancelar
            </Button>
            <Button
              onClick={atribuirMontador}
              disabled={updateMutation.isPending || montadoresInternos.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                <><UserCheck className="w-4 h-4 mr-2" /> Confirmar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog PIN */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Confirmar Identidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center text-sm text-gray-500">
              Digite seu PIN de 4 dígitos para confirmar esta ação.
            </div>
            <Input
              type="password"
              className="text-center text-2xl tracking-widest"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              autoFocus
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:gap-0">
            <Button className="w-full" onClick={confirmarPin}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSS para animação */}
      <style>{`
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}