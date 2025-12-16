import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, User, Phone, Truck, CheckCircle, Clock, XCircle, MessageCircle, ThumbsUp, ThumbsDown, Edit2 } from "lucide-react";
import { format, isToday, isTomorrow, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import AgendarEntregaModal from "./AgendarEntregaModal";
import BotaoConfirmacaoWhatsApp from "./BotaoConfirmacaoWhatsApp";

export default function EntregasAgendadas({ entregas, vendas, clientes, mostrarBotaoRobo = false, titulo }) {
  const [modalAgendar, setModalAgendar] = useState({ open: false, entrega: null });
  const queryClient = useQueryClient();

  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes'],
    queryFn: () => base44.entities.Caminhao.list(),
    initialData: []
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

  // Estatísticas para o painel do topo
  const amanha = addDays(new Date(), 1);
  const dataAmanhaStr = format(amanha, 'yyyy-MM-dd');
  const entregasAmanha = entregas.filter(e => e.data_agendada === dataAmanhaStr);
  const countAguardando = entregasAmanha.filter(e => e.status_confirmacao === 'Aguardando Resposta').length;

  // Ações
  const confirmarAgendamento = (entrega) => {
    updateMutation.mutate({ id: entrega.id, data: { status_confirmacao: 'Confirmada' } });
  };

  const relatarProblema = (entrega) => {
    const motivo = prompt("Qual o problema relatado pelo cliente?");
    if (motivo) {
        updateMutation.mutate({ id: entrega.id, data: { status_confirmacao: 'Requer Atenção', observacoes: motivo } });
    }
  };

  const marcarEntregue = (entrega) => {
    if (confirm(`Confirmar entrega #${entrega.numero_pedido}?`)) {
      updateMutation.mutate({
        id: entrega.id,
        data: { status: 'Entregue', data_realizada: new Date().toISOString().split('T')[0] }
      });
    }
  };

  // Agrupamento por data
  const entregasPorData = entregas.reduce((acc, entrega) => {
    const data = entrega.data_agendada || 'sem-data';
    if (!acc[data]) acc[data] = [];
    acc[data].push(entrega);
    return acc;
  }, {});
  const datasOrdenadas = Object.keys(entregasPorData).sort();

  const getDataLabel = (dataStr) => {
    const data = new Date(dataStr + 'T12:00:00');
    if (isToday(data)) return '📅 Hoje';
    if (isTomorrow(data)) return '📅 Amanhã';
    return format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  return (
    <div className="space-y-8">
      
      {/* --- PAINEL DE CONTROLE (Só aparece na aba 'A Confirmar') --- */}
      {mostrarBotaoRobo && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-sm">
          <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                          <MessageCircle className="w-5 h-5" /> Central de Confirmações
                      </h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                          Você tem <strong>{entregasAmanha.length}</strong> entregas agendadas para amanhã.<br/>
                          Use o robô para confirmar presença automaticamente.
                      </p>
                  </div>
                  <div className="flex flex-col items-center justify-center border-l pl-6 border-blue-200 h-full">
                      <BotaoConfirmacaoWhatsApp entregas={entregasAmanha} vendas={vendas} />
                  </div>
              </div>
          </CardContent>
        </Card>
      )}

      {/* LISTA */}
      {entregas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Nenhum agendamento nesta categoria</p>
        </div>
      ) : (
        datasOrdenadas.map(dataStr => (
            <div key={dataStr}>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2 mt-6 sticky top-0 bg-gray-50 py-2 z-10">
                {getDataLabel(dataStr)}
                <Badge variant="secondary">{entregasPorData[dataStr].length}</Badge>
            </h3>
            
            <div className="grid gap-3">
                {entregasPorData[dataStr].map(entrega => {
                const venda = vendas.find(v => v.id === entrega.venda_id);
                const caminhao = caminhoes.find(c => c.id === entrega.caminhao_id);

                return (
                    <div key={entrega.id} className={`bg-white dark:bg-neutral-900 border rounded-lg p-4 shadow-sm transition-all ${
                        entrega.status_confirmacao === 'Confirmada' ? 'border-l-4 border-l-green-500' :
                        entrega.status_confirmacao === 'Requer Atenção' ? 'border-l-4 border-l-red-500' :
                        'border-l-4 border-l-yellow-500'
                    }`}>
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-bold text-lg">#{entrega.numero_pedido}</span>
                            <span className="text-gray-600 font-medium">- {entrega.cliente_nome}</span>
                            
                            {entrega.status_confirmacao === 'Aguardando Resposta' && <Badge className="bg-yellow-100 text-yellow-800"><MessageCircle className="w-3 h-3 mr-1"/> Aguardando</Badge>}
                            {entrega.status_confirmacao === 'Confirmada' && <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Confirmado</Badge>}
                            {entrega.status_confirmacao === 'Requer Atenção' && <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1"/> Atenção</Badge>}
                            
                            {entrega.turno && <Badge variant="outline" className="bg-white"><Clock className="w-3 h-3 mr-1"/> {entrega.turno}</Badge>}
                        </div>

                        <div className="text-sm text-gray-500 space-y-1">
                            <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-orange-500" /> {entrega.endereco_entrega}</div>
                            <div className="flex gap-4 text-xs">
                                {caminhao && <span><Truck className="w-3 h-3 inline"/> {caminhao.nome}</span>}
                            </div>
                        </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Ações de Confirmação (Só aparecem se não estiver confirmado) */}
                            {mostrarBotaoRobo && (
                                <>
                                    <Button size="sm" onClick={() => confirmarAgendamento(entrega)} className="h-8 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100" title="Confirmar Manualmente"><ThumbsUp className="w-4 h-4" /></Button>
                                    <Button size="sm" onClick={() => relatarProblema(entrega)} className="h-8 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" title="Relatar Problema"><ThumbsDown className="w-4 h-4" /></Button>
                                </>
                            )}
                            
                            {/* Botão de Entregue (Só aparece na aba Confirmadas) */}
                            {!mostrarBotaoRobo && (
                                <Button size="sm" onClick={() => marcarEntregue(entrega)} className="h-8 bg-blue-600 text-white hover:bg-blue-700"><CheckCircle className="w-4 h-4 mr-1"/> Entregue</Button>
                            )}

                            <Button size="sm" variant="ghost" onClick={() => setModalAgendar({ open: true, entrega })} className="h-8 w-8 p-0"><Edit2 className="w-4 h-4 text-gray-400" /></Button>
                        </div>
                    </div>
                    </div>
                );
                })}
            </div>
            </div>
        ))
      )}

      <AgendarEntregaModal
        isOpen={modalAgendar.open}
        onClose={() => setModalAgendar({ open: false, entrega: null })}
        entrega={modalAgendar.entrega}
      />
    </div>
  );
}