import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldCheck,
  CreditCard,
  Package,
  User,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { toMoneyNumber } from '@/utils/deliveryPayment';
import { buildProductDisplayName } from '@/utils/productReference';
import { formatarNome } from '@/utils/formatters';

const FORMAS_PAGAMENTO = [
  'Dinheiro',
  'PIX',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Boleto',
  'Transferência',
  'Cheque',
];

const createEmptyPagamento = (defaults = {}) => ({
  forma_pagamento: defaults.forma_pagamento || 'PIX',
  valor: defaults.valor || '',
  parcelas: 1,
});

const formatCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatarValorInput = (value) => {
  const digitsOnly = String(value ?? '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  return (Number(digitsOnly) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function ConferenciaCaixaModal({
  open,
  onClose,
  venda,
  onAprovar,
  onDevolver,
  isLoading = false,
}) {
  const [pagamentos, setPagamentos] = useState([]);
  const [novoPagamento, setNovoPagamento] = useState(createEmptyPagamento({ forma_pagamento: 'PIX' }));
  const [observacao, setObservacao] = useState('');
  const [motivoDevolucao, setMotivoDevolucao] = useState('');
  const [modo, setModo] = useState('conferir'); // 'conferir' | 'devolver'
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!venda || !open) return;
    // Inicializar com os pagamentos originais da venda
    const pags = Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0
      ? venda.pagamentos.map((p) => ({
          forma_pagamento: p.forma_pagamento || 'PIX',
          valor: p.valor || 0,
          parcelas: p.parcelas || 1,
        }))
      : [createEmptyPagamento({ forma_pagamento: venda.forma_pagamento || 'PIX', valor: venda.valor_total || 0 })];

    setPagamentos(pags);
    setNovoPagamento(createEmptyPagamento({ forma_pagamento: 'PIX' }));
    setObservacao('');
    setMotivoDevolucao('');
    setModo('conferir');
  }, [venda, open]);

  if (!venda) return null;

  const totalPagamentos = pagamentos.reduce((sum, p) => sum + toMoneyNumber(p.valor), 0);
  const totalVenda = venda.valor_total || 0;
  const diferenca = totalVenda - totalPagamentos;
  const totalOk = Math.abs(diferenca) < 0.02;

  const adicionarPagamento = () => {
    const valorNum = toMoneyNumber(novoPagamento.valor);
    if (!novoPagamento.forma_pagamento) {
      toast.error('Selecione uma forma de pagamento.');
      return;
    }
    if (valorNum <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    setPagamentos((prev) => [...prev, { ...novoPagamento, valor: valorNum }]);
    setNovoPagamento(createEmptyPagamento({ forma_pagamento: novoPagamento.forma_pagamento }));
  };

  const removerPagamento = (idx) => {
    setPagamentos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAprovar = async () => {
    if (pagamentos.length === 0) {
      toast.error('Informe pelo menos uma forma de pagamento.');
      return;
    }
    if (!totalOk && Math.abs(diferenca) > 0.02) {
      const confirmMsg =
        diferenca > 0
          ? `O total informado está R$ ${Math.abs(diferenca).toFixed(2)} abaixo do valor da venda. Confirmar assim mesmo?`
          : `O total informado está R$ ${Math.abs(diferenca).toFixed(2)} acima do valor da venda. Confirmar assim mesmo?`;
      if (!window.confirm(confirmMsg)) return;
    }
    setIsProcessing(true);
    try {
      await onAprovar({ pagamentos, observacao });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDevolver = async () => {
    if (!motivoDevolucao.trim()) {
      toast.error('Informe o motivo para devolver o pedido ao vendedor.');
      return;
    }
    setIsProcessing(true);
    try {
      await onDevolver({ motivo: motivoDevolucao });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Conferência de Caixa — Pedido #{venda.numero_pedido}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                Confirme o recebimento e a forma de pagamento antes de liberar o pedido.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-1">
          <div className="space-y-5 py-4 pr-2">
            {/* Cliente e Resumo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" /> Cliente
                </p>
                <p className="font-semibold text-sm">{formatarNome(venda.cliente_nome)}</p>
                {venda.cliente_telefone && (
                  <p className="text-xs text-gray-500">{venda.cliente_telefone}</p>
                )}
              </div>
              <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Valor Total
                </p>
                <p className="font-bold text-2xl text-green-700">{formatCurrency(totalVenda)}</p>
                <p className="text-xs text-gray-500">
                  Pagamento registrado: {venda.forma_pagamento || 'Não informado'}
                </p>
              </div>
            </div>

            {/* Itens do Pedido */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Package className="w-3 h-3" /> Itens do Pedido
              </p>
              <div className="rounded-xl border overflow-hidden">
                {(venda.itens || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 text-sm border-b last:border-0 bg-white"
                  >
                    <span className="flex-1 text-gray-800">
                      {item.quantidade}× {buildProductDisplayName(item.produto_nome, item.modelo_referencia)}
                      {item.variacao_nome && (
                        <span className="text-xs text-gray-400 ml-1">({item.variacao_nome})</span>
                      )}
                    </span>
                    <span className="font-semibold text-gray-900 ml-4">
                      {formatCurrency(item.subtotal || item.preco_unitario * item.quantidade)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Observação do vendedor retorno */}
            {venda.conferencia_caixa_status === 'devolvido' && venda.conferencia_caixa_observacao && (
              <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Devolvido anteriormente</p>
                  <p className="text-xs mt-1">{venda.conferencia_caixa_observacao}</p>
                </div>
              </div>
            )}

            {/* Modo: Conferir ou Devolver */}
            {modo === 'conferir' ? (
              <>
                {/* Pagamentos */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-3">
                    <CreditCard className="w-3 h-3" /> Formas de Pagamento Recebidas
                  </p>

                  {/* Lista atual */}
                  <div className="space-y-2 mb-3">
                    {pagamentos.map((pag, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2"
                      >
                        <span className="flex-1 text-sm font-medium">{pag.forma_pagamento}</span>
                        {pag.parcelas > 1 && (
                          <span className="text-xs text-gray-400">{pag.parcelas}×</span>
                        )}
                        <span className="font-semibold text-sm text-green-700">
                          {formatCurrency(pag.valor)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removerPagamento(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {pagamentos.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">
                        Nenhuma forma de pagamento adicionada
                      </p>
                    )}
                  </div>

                  {/* Adicionar nova forma */}
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-3">
                    <p className="text-xs font-medium text-gray-500">Adicionar forma de pagamento</p>
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Forma</Label>
                        <Select
                          value={novoPagamento.forma_pagamento}
                          onValueChange={(v) => setNovoPagamento((p) => ({ ...p, forma_pagamento: v }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMAS_PAGAMENTO.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 w-36">
                        <Label className="text-xs text-gray-500">Valor (R$)</Label>
                        <Input
                          className="h-9 text-right"
                          placeholder="0,00"
                          value={novoPagamento.valor}
                          onChange={(e) =>
                            setNovoPagamento((p) => ({
                              ...p,
                              valor: formatarValorInput(e.target.value),
                            }))
                          }
                          onKeyDown={(e) => e.key === 'Enter' && adicionarPagamento()}
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        className="h-9 w-9 bg-green-600 hover:bg-green-700"
                        onClick={adicionarPagamento}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Totalizador */}
                <div
                  className={`rounded-xl border p-3 space-y-2 ${
                    totalOk
                      ? 'border-green-200 bg-green-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total da venda</span>
                    <span className="font-semibold">{formatCurrency(totalVenda)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total informado</span>
                    <span className={`font-semibold ${totalOk ? 'text-green-700' : 'text-amber-700'}`}>
                      {formatCurrency(totalPagamentos)}
                    </span>
                  </div>
                  {!totalOk && (
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-amber-700 font-medium">
                        {diferenca > 0 ? 'Faltando' : 'Excesso'}
                      </span>
                      <span className="font-bold text-amber-700">
                        {formatCurrency(Math.abs(diferenca))}
                      </span>
                    </div>
                  )}
                  {totalOk && (
                    <div className="flex items-center gap-1 text-xs text-green-700 font-medium pt-1 border-t">
                      <Check className="w-3.5 h-3.5" /> Pagamento confere com o valor da venda
                    </div>
                  )}
                </div>

                {/* Observação */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Observação (opcional)
                  </Label>
                  <Textarea
                    placeholder="Alguma observação sobre o recebimento..."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="resize-none text-sm"
                    rows={2}
                  />
                </div>
              </>
            ) : (
              /* Modo devolução */
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>
                    O pedido será devolvido ao vendedor para correção. Informe o motivo para que
                    o vendedor saiba o que ajustar.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Motivo da devolução *</Label>
                  <Textarea
                    placeholder="Ex: Pagamento informado não corresponde ao recebido, cliente pagou com PIX mas foi lançado como dinheiro..."
                    value={motivoDevolucao}
                    onChange={(e) => setMotivoDevolucao(e.target.value)}
                    className="resize-none text-sm"
                    rows={4}
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4 gap-2 flex-wrap">
          {modo === 'conferir' ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={() => setModo('devolver')}
                disabled={isProcessing || isLoading}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Devolver ao Vendedor
              </Button>
              <Button
                type="button"
                onClick={handleAprovar}
                disabled={isProcessing || isLoading || pagamentos.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isProcessing || isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Aprovar e Liberar Pedido
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModo('conferir')}
                disabled={isProcessing}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleDevolver}
                disabled={isProcessing || !motivoDevolucao.trim()}
                variant="destructive"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mr-2" />
                )}
                Confirmar Devolução
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
