import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { comprasService } from '@/services/comprasService';
import { useAuth } from '@/hooks/useAuth';

/**
 * Modal para Aprovação de OCs
 * Permite aprovar ou rejeitar uma OC com comentários
 */
export default function ApprovalModal({
  isOpen,
  onClose,
  oc = null,
  onSuccess,
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [action, setAction] = useState(null); // 'approve' or 'reject'
  const [comentarios, setComentarios] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleActionChange = (newAction) => {
    setAction(newAction);
    setComentarios('');
  };

  // Mutation: Aprovar OC
  const approveMutation = useMutation({
    mutationFn: async () => {
      setIsLoading(true);
      try {
        await comprasService.approveOc(oc.id, {
          comments: comentarios || 'Aprovado',
          approved_by: user?.id
        });
        toast.success(`OC ${oc.numero_pedido} aprovada com sucesso`);
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      setAction(null);
      setComentarios('');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao aprovar OC: ${error.message}`);
    },
  });

  // Mutation: Rejeitar OC
  const rejectMutation = useMutation({
    mutationFn: async () => {
      setIsLoading(true);
      try {
        await comprasService.rejectOc(oc.id, {
          comments: comentarios || 'Rejeitado',
          rejected_by: user?.id
        });
        toast.success(`OC ${oc.numero_pedido} rejeitada`);
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      setAction(null);
      setComentarios('');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao rejeitar OC: ${error.message}`);
    },
  });

  const handleApprove = async () => {
    if (!comentarios.trim()) {
      toast.warning('Por favor, adicione um comentário');
      return;
    }
    await approveMutation.mutateAsync();
  };

  const handleReject = async () => {
    if (!comentarios.trim()) {
      toast.warning('Por favor, adicione um motivo da rejeição');
      return;
    }
    await rejectMutation.mutateAsync();
  };

  const isProcessing = isLoading || approveMutation.isPending || rejectMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Aprovação de Ordem de Compra
          </DialogTitle>
          <DialogDescription>
            OC #{oc?.numero_pedido} - Fornecedor: {oc?.fornecedor_nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detalhes da OC */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Valor Total:</span>
              <span className="font-semibold">R$ {(oc?.valor_total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Data Previsão:</span>
              <span>{oc?.data_previsao_entrega ? new Date(oc.data_previsao_entrega).toLocaleDateString('pt-BR') : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Itens:</span>
              <span>{oc?.itens?.length || 0} produto(s)</span>
            </div>
          </div>

          {/* Seleção de Ação */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold">O que você deseja fazer?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleActionChange('approve')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  action === 'approve'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-green-300'
                }`}
              >
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">Aprovar</span>
              </button>

              <button
                onClick={() => handleActionChange('reject')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  action === 'reject'
                    ? 'border-red-500 bg-red-50'
                    : 'border-slate-200 hover:border-red-300'
                }`}
              >
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium">Rejeitar</span>
              </button>
            </div>
          </div>

          {/* Comentários */}
          {action && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                {action === 'approve' ? 'Comentários de Aprovação' : 'Motivo da Rejeição'}
              </label>
              <Textarea
                placeholder={action === 'approve' 
                  ? 'Ex: Verificado orçamento, confere com requisição...' 
                  : 'Ex: Valor fora do orçamento, prazo inadequado...'}
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                className="min-h-24 text-sm"
              />
              <p className="text-xs text-slate-500">
                {comentarios.length}/500 caracteres
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </Button>

          {action === 'approve' && (
            <Button 
              onClick={handleApprove} 
              disabled={isProcessing || !comentarios.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aprovando...
                </>
              ) : (
                'Aprovar'
              )}
            </Button>
          )}

          {action === 'reject' && (
            <Button 
              onClick={handleReject} 
              disabled={isProcessing || !comentarios.trim()}
              variant="destructive"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejeitando...
                </>
              ) : (
                'Rejeitar'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
