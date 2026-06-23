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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Package,
  CreditCard,
  Trash2,
  Plus,
  Loader2,
  Save,
  AlertTriangle,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { toMoneyNumber } from '@/utils/deliveryPayment';
import { buildProductDisplayName } from '@/utils/productReference';
import { validatePaymentSplit } from '@/services/paymentOrchestrator';
import { supabase } from '@/lib/supabase';
import { resolveStockField, getProductTotalStock, getVarianteEstoque, atualizarEstoqueVariante } from '@/utils/stockUtils';

const FORMAS_PAGAMENTO = [
  'Dinheiro',
  'PIX',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Boleto',
  'Transferência',
  'Cheque',
];

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

export default function EdicaoPedidoModal({ open, onClose, venda, onSalvar }) {
  const [itens, setItens] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [novoPagamento, setNovoPagamento] = useState({ forma_pagamento: 'PIX', valor: '', parcelas: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!venda || !open) return;
    setItens(
      (venda.itens || []).map((item) => ({ ...item }))
    );
    setPagamentos(
      Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0
        ? venda.pagamentos.map((p) => ({ ...p }))
        : [{ forma_pagamento: venda.forma_pagamento || 'PIX', valor: venda.valor_total || 0, parcelas: 1 }]
    );
    setNovoPagamento({ forma_pagamento: 'PIX', valor: '', parcelas: 1 });
  }, [venda, open]);

  if (!venda) return null;

  // Recalcular totais
  const subtotal = itens.reduce(
    (sum, item) => sum + (toMoneyNumber(item.preco_unitario) * (item.quantidade || 1)),
    0
  );
  const desconto = venda.desconto || 0;
  const valorTotal = Math.max(subtotal - desconto, 0);
  const totalPagamentos = pagamentos.reduce((sum, p) => sum + toMoneyNumber(p.valor), 0);
  const diferenca = valorTotal - totalPagamentos;

  const atualizarQtd = (idx, delta) => {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const novaQtd = Math.max(1, (item.quantidade || 1) + delta);
        return { ...item, quantidade: novaQtd, subtotal: item.preco_unitario * novaQtd };
      })
    );
  };

  const removerItem = (idx) => {
    if (itens.length <= 1) {
      toast.error('A venda precisa ter pelo menos 1 item.');
      return;
    }
    setItens((prev) => prev.filter((_, i) => i !== idx));
  };

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
    setNovoPagamento({ forma_pagamento: novoPagamento.forma_pagamento, valor: '', parcelas: 1 });
  };

  const removerPagamento = (idx) => {
    setPagamentos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSalvar = async () => {
    if (itens.length === 0) {
      toast.error('A venda precisa ter pelo menos 1 item.');
      return;
    }
    if (pagamentos.length === 0) {
      toast.error('Informe pelo menos uma forma de pagamento.');
      return;
    }

    setSaving(true);
    try {
      const novoSubtotal = itens.reduce(
        (sum, item) => sum + (toMoneyNumber(item.preco_unitario) * (item.quantidade || 1)),
        0
      );
      const novoTotal = Math.max(novoSubtotal - desconto, 0);
      const novoPago = pagamentos.reduce((sum, p) => sum + toMoneyNumber(p.valor), 0);
      const novoRestante = Math.max(novoTotal - novoPago, 0);
      const novoStatus = novoRestante <= 0.01 ? 'Pago' : 'Pagamento Pendente';

      const formaPrincipal =
        pagamentos.length === 1
          ? pagamentos[0].forma_pagamento
          : pagamentos.length > 1
            ? 'Múltiplos'
            : venda.forma_pagamento || 'Diversos';

      const payload = {
        itens,
        valor_total: novoTotal,
        valor_pago: novoPago,
        valor_restante: novoRestante,
        status: novoStatus,
        pagamentos,
        forma_pagamento: formaPrincipal,
        // Ao salvar edições, se o pedido estava devolvido, retorna para aguardando a conferência
        ...(venda.conferencia_caixa_status === 'devolvido' ? {
          conferencia_caixa_status: 'aguardando',
          conferencia_caixa_observacao: null,
          conferencia_caixa_at: null,
          conferencia_caixa_por: null,
          conferencia_caixa_por_id: null,
        } : {}),
      };

      // 1. Reconciliar estoque com base na diferença de quantidade de itens
      const itensAntigos = venda.itens || [];
      const itensNovos = itens;
      const obterChaveItem = (it) => `${it.produto_id}_${it.variante_id || ''}`;
      
      const qtdsAntigas = {};
      itensAntigos.forEach(it => {
        const key = obterChaveItem(it);
        qtdsAntigas[key] = (qtdsAntigas[key] || 0) + Number(it.quantidade || 0);
      });

      const qtdsNovas = {};
      itensNovos.forEach(it => {
        const key = obterChaveItem(it);
        qtdsNovas[key] = (qtdsNovas[key] || 0) + Number(it.quantidade || 0);
      });

      const todasChaves = Array.from(new Set([...Object.keys(qtdsAntigas), ...Object.keys(qtdsNovas)]));
      const lojaNome = venda.loja;
      
      // Buscar lojas para encontrar o lojaId
      const { data: lojas } = await supabase.from('lojas').select('id, nome');
      const lojaId = lojas?.find(l => String(l.nome).trim().toLowerCase() === String(lojaNome).trim().toLowerCase())?.id;

      for (const key of todasChaves) {
        const [produtoId, varianteId] = key.split('_');
        const qtdAntiga = qtdsAntigas[key] || 0;
        const qtdNova = qtdsNovas[key] || 0;
        const diff = qtdNova - qtdAntiga; // se > 0 reduziu estoque (vendeu mais), se < 0 devolveu estoque (vendeu menos)

        if (diff !== 0) {
          if (varianteId && lojaId) {
            const estoqueAtual = await getVarianteEstoque(supabase, varianteId, lojaId);
            const novaQtd = estoqueAtual - diff;
            await atualizarEstoqueVariante(supabase, varianteId, lojaId, novaQtd);
          } else if (produtoId) {
            const prod = await base44.entities.Produto.getById(produtoId);
            if (prod) {
              const itemOriginal = itensAntigos.find(it => obterChaveItem(it) === key) || 
                                   itensNovos.find(it => obterChaveItem(it) === key);
              const campoOrigem = itemOriginal?.origem_estoque_campo || resolveStockField(lojaNome);
              if (campoOrigem) {
                const estoqueOrigemAtual = Number(prod[campoOrigem] || 0);
                const estoqueLocalAposVenda = estoqueOrigemAtual - diff;
                
                const produtoAtualizado = {
                  ...prod,
                  [campoOrigem]: Math.max(0, estoqueLocalAposVenda)
                };
                const updates = {
                  [campoOrigem]: produtoAtualizado[campoOrigem],
                  quantidade_estoque: getProductTotalStock(produtoAtualizado)
                };
                await base44.entities.Produto.update(prod.id, updates);
              }
            }
          }
        }
      }

      await base44.entities.Venda.update(venda.id, payload);
      toast.success('Pedido atualizado! Aguardando conferência de caixa.');
      onSalvar?.(payload);
      onClose?.();
    } catch (err) {
      console.error('Erro ao atualizar pedido:', err);
      toast.error(err?.message || 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Editar Pedido #{venda.numero_pedido}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                O pedido ainda não foi conferido — você pode editar itens e pagamentos livremente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-1">
          <div className="space-y-5 py-4 pr-2">
            {/* Aviso devolução */}
            {venda.conferencia_caixa_status === 'devolvido' && venda.conferencia_caixa_observacao && (
              <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Pedido devolvido pelo caixa</p>
                  <p className="text-xs mt-1">{venda.conferencia_caixa_observacao}</p>
                </div>
              </div>
            )}

            {/* Itens */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-3">
                <Package className="w-3 h-3" /> Itens do Pedido
              </p>
              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {buildProductDisplayName(item.produto_nome, item.modelo_referencia)}
                      </p>
                      {item.variacao_nome && (
                        <p className="text-xs text-gray-400">{item.variacao_nome}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        Unitário: {formatCurrency(item.preco_unitario)}
                      </p>
                    </div>

                    {/* Controle de quantidade */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => atualizarQtd(idx, -1)}
                        className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm">
                        {item.quantidade || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => atualizarQtd(idx, 1)}
                        className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="font-bold text-sm text-gray-900 w-24 text-right">
                      {formatCurrency(item.preco_unitario * (item.quantidade || 1))}
                    </span>

                    <button
                      type="button"
                      onClick={() => removerItem(idx)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo de Valores */}
            <div className="rounded-xl border bg-gray-50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Desconto</span>
                  <span>- {formatCurrency(desconto)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                <span>Total</span>
                <span className="text-green-700">{formatCurrency(valorTotal)}</span>
              </div>
            </div>

            {/* Pagamentos */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-3">
                <CreditCard className="w-3 h-3" /> Formas de Pagamento
              </p>

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
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {pagamentos.length === 0 && (
                  <p className="text-xs text-center text-gray-400 py-2">
                    Nenhuma forma de pagamento
                  </p>
                )}
              </div>

              {/* Adicionar */}
              <div className="rounded-xl border border-dashed bg-gray-50/50 p-3 space-y-2">
                <p className="text-xs font-medium text-gray-500">Adicionar pagamento</p>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Forma</Label>
                    <Select
                      value={novoPagamento.forma_pagamento}
                      onValueChange={(v) => setNovoPagamento((p) => ({ ...p, forma_pagamento: v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 w-32">
                    <Label className="text-xs text-gray-500">Valor (R$)</Label>
                    <Input
                      className="h-9 text-right"
                      placeholder="0,00"
                      value={novoPagamento.valor}
                      onChange={(e) =>
                        setNovoPagamento((p) => ({ ...p, valor: formatarValorInput(e.target.value) }))
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

              {/* Conferência de total */}
              {pagamentos.length > 0 && (
                <div
                  className={`mt-2 rounded-lg border px-3 py-2 text-xs flex justify-between ${
                    Math.abs(diferenca) < 0.02
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <span>
                    {Math.abs(diferenca) < 0.02
                      ? '✅ Pagamento confere com o total'
                      : diferenca > 0
                        ? `⚠ Faltam ${formatCurrency(diferenca)}`
                        : `⚠ Excesso de ${formatCurrency(Math.abs(diferenca))}`}
                  </span>
                  <span className="font-semibold">{formatCurrency(totalPagamentos)} / {formatCurrency(valorTotal)}</span>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4 gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSalvar}
            disabled={saving || itens.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
