import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Paperclip, Plus, Trash2, CheckCircle, Lock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { comprasService } from '@/services/comprasService';
import { useAuth } from '@/hooks/useAuth';

const FORMAS_PAGAMENTO = [
  { value: 'a_vista', label: 'A Vista' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'multiplo', label: 'Múltiplas Formas' },
  { value: 'outro', label: 'Outro' },
];

function FormaPagamentoLabel({ value }) {
  const found = FORMAS_PAGAMENTO.find(f => f.value === value);
  return found ? found.label : value || 'Não informado';
}

/**
 * Modal exclusivo do master para aprovar e registrar pagamento de OC
 */
export default function PaymentApprovalModal({ isOpen, onClose, oc }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formaMultipla, setFormaMultipla] = useState(false);
  const [formasMultiplas, setFormasMultiplas] = useState([
    { metodo: '', valor: '', parcelas: '', observacao: '' },
  ]);
  const [formData, setFormData] = useState({
    pagamento_forma_final: '',
    pagamento_parcelas: '',
    pagamento_valor_pago: '',
    pagamento_data_pagamento: '',
    pagamento_observacoes: '',
  });

  const valorTotalOc = oc?.valor_total || 0;

  const handleAddForma = () => {
    setFormasMultiplas(prev => [...prev, { metodo: '', valor: '', parcelas: '', observacao: '' }]);
  };

  const handleRemoveForma = (idx) => {
    setFormasMultiplas(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFormaChange = (idx, field, value) => {
    setFormasMultiplas(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const precisaParcelas = (forma) =>
    ['parcelado', 'cartao_credito'].includes(forma);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!formaMultipla && !formData.pagamento_forma_final) {
        throw new Error('Selecione a forma de pagamento');
      }
      if (formaMultipla && formasMultiplas.some(f => !f.metodo || !f.valor)) {
        throw new Error('Preencha método e valor em todas as formas de pagamento');
      }

      const payload = {
        aprovado_por: user?.id || null,
        pagamento_observacoes: formData.pagamento_observacoes || null,
        pagamento_data_pagamento: formData.pagamento_data_pagamento || null,
        pagamento_valor_pago: formData.pagamento_valor_pago ? parseFloat(formData.pagamento_valor_pago) : null,
      };

      if (formaMultipla) {
        payload.pagamento_forma_final = 'multiplo';
        payload.pagamento_formas_multiplas = formasMultiplas.map(f => ({
          metodo: f.metodo,
          valor: parseFloat(f.valor) || 0,
          parcelas: f.parcelas ? parseInt(f.parcelas) : null,
          observacao: f.observacao || null,
        }));
      } else {
        payload.pagamento_forma_final = formData.pagamento_forma_final;
        payload.pagamento_parcelas = formData.pagamento_parcelas ? parseInt(formData.pagamento_parcelas) : null;
        payload.pagamento_formas_multiplas = [];
      }

      return await comprasService.approvePayment(oc.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      toast.success(`Pagamento da OC ${oc?.numero_pedido} registrado com sucesso`);
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao registrar pagamento: ${error.message}`);
    },
  });

  if (!oc) return null;

  const anexosAprovacao = oc.anexos_aprovacao || [];
  const observacoesAprovacao = oc.observacoes_aprovacao;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Aprovar Pagamento — {oc.numero_pedido}
          </DialogTitle>
          <DialogDescription>
            {oc.fornecedor_nome} · R$ {(valorTotalOc).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Forma solicitada:{' '}
            <strong><FormaPagamentoLabel value={oc.forma_pagamento_oc} /></strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Seção: Observações do comprador (somente leitura) */}
          {(observacoesAprovacao || anexosAprovacao.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Informações enviadas pelo comprador
                </span>
              </div>
              {observacoesAprovacao && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{observacoesAprovacao}</p>
              )}
              {anexosAprovacao.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {anexosAprovacao.map((anexo, idx) => (
                    <a
                      key={idx}
                      href={anexo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs text-blue-600 hover:underline"
                    >
                      <Paperclip className="w-3 h-3" />
                      {anexo.nome || `Anexo ${idx + 1}`}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Toggle: múltiplas formas */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="formaMultipla"
              checked={formaMultipla}
              onChange={(e) => setFormaMultipla(e.target.checked)}
              className="w-4 h-4 accent-green-600"
            />
            <Label htmlFor="formaMultipla" className="cursor-pointer">
              Pagamento em múltiplas formas
            </Label>
          </div>

          {/* Forma única */}
          {!formaMultipla && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Forma de Pagamento Final *</Label>
                <Select
                  value={formData.pagamento_forma_final}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, pagamento_forma_final: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.filter(f => f.value !== 'multiplo').map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {precisaParcelas(formData.pagamento_forma_final) && (
                <div>
                  <Label>Número de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 3"
                    value={formData.pagamento_parcelas}
                    onChange={(e) => setFormData(prev => ({ ...prev, pagamento_parcelas: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )}

          {/* Múltiplas formas */}
          {formaMultipla && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Formas de Pagamento</Label>
              {formasMultiplas.map((f, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start border rounded-lg p-3 bg-gray-50">
                  <div className="col-span-4">
                    <Label className="text-xs">Método</Label>
                    <Select
                      value={f.metodo}
                      onValueChange={(v) => handleFormaChange(idx, 'metodo', v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.filter(fp => fp.value !== 'multiplo').map(fp => (
                          <SelectItem key={fp.value} value={fp.value}>{fp.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      className="h-8 text-sm"
                      value={f.valor}
                      onChange={(e) => handleFormaChange(idx, 'valor', e.target.value)}
                    />
                  </div>
                  {precisaParcelas(f.metodo) && (
                    <div className="col-span-2">
                      <Label className="text-xs">Parcelas</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        className="h-8 text-sm"
                        value={f.parcelas}
                        onChange={(e) => handleFormaChange(idx, 'parcelas', e.target.value)}
                      />
                    </div>
                  )}
                  <div className={precisaParcelas(f.metodo) ? 'col-span-2' : 'col-span-4'}>
                    <Label className="text-xs">Observação</Label>
                    <Input
                      placeholder="Opcional"
                      className="h-8 text-sm"
                      value={f.observacao}
                      onChange={(e) => handleFormaChange(idx, 'observacao', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 flex items-end pb-1">
                    {formasMultiplas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveForma(idx)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddForma}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                Adicionar forma
              </Button>
              {/* Total das formas múltiplas */}
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Total informado:</span>
                <span className={
                  Math.abs(formasMultiplas.reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0) - valorTotalOc) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                }>
                  R$ {formasMultiplas.reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {' '}/ R$ {valorTotalOc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (total OC)
                </span>
              </div>
            </div>
          )}

          {/* Campos comuns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Valor Pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={valorTotalOc.toFixed(2)}
                value={formData.pagamento_valor_pago}
                onChange={(e) => setFormData(prev => ({ ...prev, pagamento_valor_pago: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data do Pagamento</Label>
              <Input
                type="date" lang="pt-BR"
                value={formData.pagamento_data_pagamento}
                onChange={(e) => setFormData(prev => ({ ...prev, pagamento_data_pagamento: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>Observações do Master</Label>
            <Textarea
              placeholder="Notas internas sobre este pagamento..."
              value={formData.pagamento_observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, pagamento_observacoes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Resumo */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-widest">Pedido de Compra</p>
              <p className="font-mono font-bold text-gray-900">{oc.numero_pedido}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Valor Total</p>
              <p className="text-xl font-black text-gray-900">
                R$ {valorTotalOc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            {approveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Marcar como Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
