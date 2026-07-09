import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, PackageCheck, XCircle, RotateCcw, Truck } from 'lucide-react';
import { toast } from 'sonner';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

export default function ConferenciaEntregas() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [modalAction, setModalAction] = useState('confirm');
  const [motivo, setMotivo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['entregas-conferencia'],
    queryFn: () => base44.entities.Entrega.list('-created_at')
  });

  const filteredDeliveries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entregas;
    return entregas.filter((item) => {
      const haystack = [
        item.numero_pedido,
        item.cliente_nome,
        item.cliente_telefone,
        item.endereco_entrega,
        item.observacoes,
        item.status,
        item.status_confirmacao
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [entregas, search]);

  const confirmDeliveryMutation = useMutation({
    mutationFn: async ({ id, payload }) => base44.entities.Entrega.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['entregas-conferencia'] });
      await queryClient.invalidateQueries({ queryKey: ['entregas'] });
      toast.success('Entrega confirmada com sucesso.');
      setSelectedDelivery(null);
      setMotivo('');
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error('Não foi possível atualizar a entrega.');
      setIsSubmitting(false);
    }
  });

  const openResolutionModal = (delivery, action = 'confirm') => {
    setSelectedDelivery(delivery);
    setModalAction(action);
    setMotivo('');
  };

  const handleConfirmDelivered = async () => {
    if (!selectedDelivery) return;
    setIsSubmitting(true);
    await confirmDeliveryMutation.mutateAsync({
      id: selectedDelivery.id,
      payload: {
        status: 'Entregue',
        status_confirmacao: 'confirmado',
        data_realizada: new Date().toISOString(),
        observacoes: [selectedDelivery.observacoes, motivo ? `Não entregue: ${motivo}` : ''].filter(Boolean).join('\n')
      }
    });
  };

  const handleMarkNotDelivered = async () => {
    if (!selectedDelivery) return;
    setIsSubmitting(true);
    await confirmDeliveryMutation.mutateAsync({
      id: selectedDelivery.id,
      payload: {
        status: 'Reagendada',
        status_confirmacao: 'nao_entregue',
        observacoes: [selectedDelivery.observacoes, motivo ? `Não entregue: ${motivo}` : 'Motivo não informado'].filter(Boolean).join('\n')
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Conferência de Entregas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-600">
                Confirme manualmente as entregas quando o rastreamento não estiver habilitado.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cliente, pedido ou endereço"
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Carregando entregas...
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              Nenhuma entrega disponível para conferência no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDeliveries.map((delivery) => {
                const statusLabel = delivery.status === 'Entregue' ? 'Entregue' : delivery.status_confirmacao === 'nao_entregue' ? 'Não entregue' : 'Pendente';
                return (
                  <div key={delivery.id} className="rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={delivery.status === 'Entregue' ? 'default' : 'secondary'}>{statusLabel}</Badge>
                          <span className="text-sm font-medium text-slate-700">#{delivery.numero_pedido || delivery.id}</span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">{delivery.cliente_nome || 'Cliente sem nome'}</p>
                          <p>{delivery.endereco_entrega || 'Endereço não informado'}</p>
                          <p className="flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            {formatDate(delivery.data_agendada)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => openResolutionModal(delivery, 'confirm')}>
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Confirmar entrega
                        </Button>
                        <Button variant="outline" onClick={() => openResolutionModal(delivery, 'not-delivered')}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Marcar como não entregue
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedDelivery)} onOpenChange={(open) => {
        if (!open) {
          setSelectedDelivery(null);
          setModalAction('confirm');
          setMotivo('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar confirmação</DialogTitle>
            <DialogDescription>
              Registre o resultado da visita para manter o histórico da entrega atualizado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{selectedDelivery?.cliente_nome || 'Cliente'}</p>
              <p>{selectedDelivery?.endereco_entrega || 'Endereço não informado'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Observações</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Descreva o que aconteceu na visita, como ausência, endereço incorreto ou reagendamento."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => {
              setSelectedDelivery(null);
              setModalAction('confirm');
              setMotivo('');
            }} disabled={isSubmitting}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button variant="outline" onClick={handleMarkNotDelivered} disabled={isSubmitting}>
              Marcar como não entregue
            </Button>
            <Button onClick={handleConfirmDelivered} disabled={isSubmitting}>
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
