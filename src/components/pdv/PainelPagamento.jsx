import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Receipt, CreditCard, Wallet, DollarSign, Plus, X, Loader2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const formasPagamento = ["Dinheiro", "Crédito", "Débito", "Pix", "AFESP", "Multicrédito"];

export default function PainelPagamento({ 
  valores, 
  pagamentos = [], 
  onAddPagamento, 
  onRemovePagamento, 
  onFinalizar, 
  onOrcamento,
  loading,
  savingOrcamento,
  desconto,
  setDesconto,
  observacoes,
  setObservacoes,
  pagamentoEntrega,
  setPagamentoEntrega,
  disabled
}) {
  const [novoPagamento, setNovoPagamento] = useState({ forma: "Dinheiro", valor: "", parcelas: 1 });

  const handleAdd = () => {
    if (!novoPagamento.valor) return;
    onAddPagamento({
      forma_pagamento: novoPagamento.forma,
      valor: parseFloat(novoPagamento.valor),
      parcelas: novoPagamento.parcelas
    });
    setNovoPagamento({ forma: "Dinheiro", valor: "", parcelas: 1 });
  };

  return (
    <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800 flex flex-col gap-4 h-full">
      <div>
        <h3 className="font-semibold text-sm uppercase text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4" /> Financeiro
        </h3>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Subtotal</p>
            <p className="font-semibold text-lg">R$ {valores.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Desconto</p>
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-xs">R$</span>
              <input 
                type="number" 
                className="bg-transparent font-semibold w-full outline-none text-red-500"
                placeholder="0,00"
                value={desconto || ''}
                onChange={e => setDesconto(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-xl mb-4 text-center border transition-all duration-500 ${
          valores.pago > 0 
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/50' 
            : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50'
        }`}>
          <AnimatePresence mode="wait">
            <motion.p 
              key={valores.pago > 0 ? 'restante' : 'total'}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`text-xs font-bold uppercase mb-1 ${
                valores.pago > 0 
                  ? 'text-orange-800 dark:text-orange-400' 
                  : 'text-green-800 dark:text-green-400'
              }`}
            >
              {valores.pago > 0 ? 'Valor Restante' : 'Total a Pagar'}
            </motion.p>
          </AnimatePresence>
          <JackpotNumber 
            value={valores.pago > 0 ? valores.restante : valores.total} 
            className={valores.pago > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}
          />
        </div>

        {/* Lista de Pagamentos */}
        <div className="space-y-2 mb-4">
          {pagamentos.map((p, i) => (
            <div key={i} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-neutral-800 rounded-md">
              <div className="flex items-center gap-2">
                <BadgePagamento tipo={p.forma_pagamento} />
                <span>{p.forma_pagamento} {p.parcelas > 1 && `(${p.parcelas}x)`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <button onClick={() => onRemovePagamento(i)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Adicionar Pagamento */}
        <div className="flex gap-2 items-end mb-4 pb-4 border-b border-dashed border-gray-200 dark:border-neutral-800">
          <div className="flex-1">
            <Label className="text-xs mb-1 block">Forma</Label>
            <Select value={novoPagamento.forma} onValueChange={v => setNovoPagamento({...novoPagamento, forma: v})}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{formasPagamento.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Label className="text-xs mb-1 block">Valor</Label>
            <Input 
              type="number" 
              className="h-8 text-xs" 
              placeholder="0,00" 
              value={novoPagamento.valor} 
              onChange={e => setNovoPagamento({...novoPagamento, valor: e.target.value})}
            />
          </div>
          {['Crédito', 'Multicrédito', 'AFESP'].includes(novoPagamento.forma) && (
             <div className="w-16">
                <Label className="text-xs mb-1 block">Parc.</Label>
                <Select value={String(novoPagamento.parcelas)} onValueChange={v => setNovoPagamento({...novoPagamento, parcelas: Number(v)})}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {Array.from({length: 12}).map((_, i) => (
                            <SelectItem key={i+1} value={String(i+1)}>{i+1}x</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
          )}
          <Button size="sm" className="h-8 w-8 p-0 shrink-0 bg-orange-500 hover:bg-orange-600" onClick={handleAdd}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Restante e Pagamento na Entrega */}
        <div className="flex justify-between items-center mb-2 text-sm">
          <span className="text-gray-500">Pago:</span>
          <span className="font-semibold text-green-600">R$ {valores.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center mb-4 text-sm">
          <span className="text-gray-500">Restante:</span>
          <span className={`font-bold ${valores.restante > 0 ? 'text-red-500' : 'text-green-600'}`}>
            R$ {valores.restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {valores.restante > 0 && (
            <div className="mb-4 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                    <input 
                        type="checkbox" 
                        id="pg_entrega" 
                        checked={pagamentoEntrega.ativo}
                        onChange={e => setPagamentoEntrega({
                            ...pagamentoEntrega, 
                            ativo: e.target.checked,
                            valor: e.target.checked ? valores.restante : 0
                        })}
                        className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <Label htmlFor="pg_entrega" className="text-xs font-bold text-orange-800 dark:text-orange-400 cursor-pointer">Receber na Entrega?</Label>
                </div>
                {pagamentoEntrega.ativo && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                             <Label className="text-[10px]">Forma</Label>
                             <Select 
                                value={pagamentoEntrega.forma} 
                                onValueChange={v => setPagamentoEntrega({...pagamentoEntrega, forma: v})}
                             >
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>{formasPagamento.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                             </Select>
                        </div>
                        <div>
                             <Label className="text-[10px]">Valor</Label>
                             <Input 
                                type="number" 
                                className="h-7 text-xs" 
                                value={pagamentoEntrega.valor}
                                onChange={e => setPagamentoEntrega({...pagamentoEntrega, valor: parseFloat(e.target.value) || 0})}
                             />
                        </div>
                    </div>
                )}
            </div>
        )}
        
        <div className="mb-4">
            <Label className="text-xs mb-1 block text-gray-400">Observações (opcional)</Label>
            <Textarea 
                className="h-16 text-xs resize-none" 
                placeholder="Detalhes da entrega, observações..."
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
            />
        </div>

      </div>

      <div className="mt-auto grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="h-12 text-xs border-gray-300"
          onClick={onOrcamento}
          disabled={disabled || savingOrcamento}
        >
          {savingOrcamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
          Orçamento
        </Button>
        <Button 
          className="h-12 bg-green-700 hover:bg-green-800 text-white font-bold shadow-lg shadow-green-900/20"
          onClick={onFinalizar}
          disabled={disabled || loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
          FINALIZAR
        </Button>
      </div>
    </div>
  );
}

function BadgePagamento({ tipo }) {
    const icons = {
        Dinheiro: <Wallet className="w-3 h-3" />,
        Pix: <span className="font-bold text-[9px]">PIX</span>,
        default: <CreditCard className="w-3 h-3" />
    };
    return (
        <div className="w-5 h-5 bg-white dark:bg-neutral-900 rounded flex items-center justify-center text-gray-500 border border-gray-200">
            {icons[tipo] || icons.default}
        </div>
    );
}

// Componente de animação tipo jackpot
function JackpotNumber({ value, className }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  
  useEffect(() => {
    if (prevValue.current !== value) {
      // Animação de rolagem dos números
      const duration = 400;
      const startTime = Date.now();
      const startValue = prevValue.current;
      const endValue = value;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (endValue - startValue) * easeOut;
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
        }
      };
      
      requestAnimationFrame(animate);
      prevValue.current = value;
    }
  }, [value]);
  
  return (
    <motion.p 
      className={`text-3xl font-bold tabular-nums ${className}`}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.3 }}
      key={Math.floor(value)}
    >
      R$ {displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </motion.p>
  );
}