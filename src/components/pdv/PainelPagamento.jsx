import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Receipt, CreditCard, Wallet, DollarSign, Plus, X, Loader2, Clock, Tag, Check, Percent, Truck, User, Package, Key, Ban, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44, supabase } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_OPTIONS_DELIVERY,
  isInstallmentPaymentMethod,
  normalizePaymentItem,
} from "@/services/paymentOrchestrator";

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
  disabled,
  cupomAplicado,
  setCupomAplicado,
  cliente,
  itensCount,
  prazo,
  tokenGerencial,
  setTokenGerencial
}) {
  const [novoPagamento, setNovoPagamento] = useState({ forma: "", valor: "", parcelas: 1 });
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [aplicandoCupom, setAplicandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");

  const [modalOrcamentoOpen, setModalOrcamentoOpen] = useState(false);
  const [validadeOrcamentoDias, setValidadeOrcamentoDias] = useState(30);

  // Estado para Token Gerencial
  const [tokenCodigo, setTokenCodigo] = useState("");
  const [aplicandoToken, setAplicandoToken] = useState(false);
  const [erroToken, setErroToken] = useState("");
  const [descontoPercent, setDescontoPercent] = useState(0);
  const [descontoValorDisplay, setDescontoValorDisplay] = useState("");

  // Formatador de moeda: "1171" → "11,71"
  const formatCurrencyMask = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    const padded = digits.padStart(3, "0");
    const cents = padded.slice(-2);
    const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${intFormatted},${cents}`;
  };

  const parseCurrencyToNumber = (formattedValue) => {
    if (!formattedValue) return 0;
    const normalized = String(formattedValue)
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.-]/g, "");
    return parseFloat(normalized) || 0;
  };


  // Buscar configurações de taxa/acréscimo
  const { data: configTaxas = [] } = useQuery({
    queryKey: ['configuracao_taxas'],
    queryFn: () => base44.entities.ConfiguracaoTaxa.list()
  });

  // Mapa de acréscimos por forma de pagamento
  const getAcrescimo = (forma) => {
    const taxa = configTaxas.find(t =>
      t.forma_pagamento?.toLowerCase().includes(forma.toLowerCase()) ||
      forma.toLowerCase().includes(t.forma_pagamento?.toLowerCase())
    );
    if (!taxa || !taxa.acrescimo || taxa.acrescimo === 0) return null;
    return {
      valor: taxa.acrescimo,
      tipo: taxa.acrescimo_tipo || 'porcentagem'
    };
  };

  // Calcular valor do acréscimo
  const calcularAcrescimo = (forma, valorBase) => {
    const acrescimo = getAcrescimo(forma);
    if (!acrescimo) return 0;
    if (acrescimo.tipo === 'porcentagem') {
      return (valorBase * acrescimo.valor) / 100;
    }
    return acrescimo.valor;
  };

  const handleAdd = async () => {
    if (!novoPagamento.valor) return;

    const valorBase = parseFloat(novoPagamento.valor);
    const valorAcrescimo = calcularAcrescimo(novoPagamento.forma, valorBase);
    const valorTotal = valorBase + valorAcrescimo;

    onAddPagamento(normalizePaymentItem({
      forma_pagamento: novoPagamento.forma,
      valor: valorTotal,
      valor_base: valorBase,
      acrescimo: valorAcrescimo,
      parcelas: novoPagamento.parcelas
    }));
    setNovoPagamento({ forma: "", valor: "", parcelas: 1 });
  };


  const handleAplicarCupom = async () => {
    if (!cupomCodigo.trim()) return;

    setAplicandoCupom(true);
    setErroCupom("");

    try {
      const cupons = await base44.entities.Cupom.list();
      const cupom = cupons.find(c => c.codigo === cupomCodigo.toUpperCase());

      if (!cupom) {
        setErroCupom("Cupom não encontrado");
        setAplicandoCupom(false);
        return;
      }

      if (!cupom.ativo) {
        setErroCupom("Cupom inativo");
        setAplicandoCupom(false);
        return;
      }

      const hojeIso = new Date().toLocaleDateString('en-CA');
      if (cupom.validade && cupom.validade.split('T')[0] < hojeIso) {
        setErroCupom("Cupom expirado");
        setAplicandoCupom(false);
        return;
      }

      if (cupom.quantidade_disponivel && (cupom.quantidade_usada || 0) >= cupom.quantidade_disponivel) {
        setErroCupom("Cupom esgotado");
        setAplicandoCupom(false);
        return;
      }

      // Calcular desconto
      let valorDesconto = 0;
      if (cupom.tipo === "porcentagem") {
        valorDesconto = (valores.subtotal * cupom.valor) / 100;
      } else {
        valorDesconto = Math.min(cupom.valor, valores.subtotal); // Não pode exceder o subtotal
      }

      setDesconto(valorDesconto);
      setCupomAplicado(cupom);
      setCupomCodigo("");

    } catch (error) {
      console.error("Erro ao validar cupom:", error);
      setErroCupom("Erro ao validar cupom");
    } finally {
      setAplicandoCupom(false);
    }
  };

  const handleRemoverCupom = () => {
    setCupomAplicado(null);
    setDesconto(0);
    setCupomCodigo("");
    setErroCupom("");
  };

  // Aplicar token gerencial
  const handleAplicarToken = async () => {
    if (!tokenCodigo.trim()) return;

    setAplicandoToken(true);
    setErroToken("");

    try {
      const tokens = await base44.entities.TokenGerencial.list();
      const token = tokens.find(t => t.codigo.toUpperCase() === tokenCodigo.toUpperCase());

      if (!token) {
        setErroToken("Token não encontrado");
        setAplicandoToken(false);
        return;
      }

      if (!token.ativo) {
        setErroToken("Token revogado");
        setAplicandoToken(false);
        return;
      }

      const hojeIso = new Date().toLocaleDateString('en-CA');
      if (token.expira_em && token.expira_em.split('T')[0] < hojeIso) {
        setErroToken("Token expirado");
        setAplicandoToken(false);
        return;
      }

      if (token.max_usos && token.usos_realizados >= token.max_usos) {
        setErroToken("Token já foi utilizado o máximo de vezes");
        setAplicandoToken(false);
        return;
      }

      setTokenGerencial(token);
      setTokenCodigo("");
      setDescontoPercent(0); // Inicia em 0, gerente ajusta
      setDescontoValorDisplay("");
      toast.success("Token autorizado! Ajuste o desconto desejado.");

    } catch (error) {
      console.error("Erro ao validar token:", error);
      setErroToken("Erro ao validar token");
    } finally {
      setAplicandoToken(false);
    }
  };

  const handleRemoverToken = () => {
    setTokenGerencial(null);
    setDescontoPercent(0);
    setDesconto(0);
    setDescontoValorDisplay("");
    setTokenCodigo("");
    setErroToken("");
  };

  // Atualizar desconto quando slider muda
  useEffect(() => {
    if (tokenGerencial && descontoPercent > 0) {
      const valorDesconto = (valores.subtotal * descontoPercent) / 100;
      setDesconto(valorDesconto);
      setDescontoValorDisplay(formatCurrencyMask(String(Math.round(valorDesconto * 100))));
    } else if (tokenGerencial && descontoPercent === 0) {
      setDesconto(0);
      setDescontoValorDisplay("");
    }
  }, [descontoPercent, valores.subtotal, tokenGerencial]);

  // Arredondamento logica
  const isArredondamento = !cupomAplicado && !tokenGerencial && desconto !== 0;

  const handleArredondar = () => {
    if (valores.subtotal <= 0) return;

    if (isArredondamento) {
      setDesconto(0);
      toast.info("Arredondamento removido");
    } else {
      const arredondado = Math.round(valores.subtotal / 10) * 10;
      const diff = valores.subtotal - arredondado;
      if (diff === 0) {
        toast.info("O valor já está arredondado!");
        return;
      }
      setDesconto(diff);
      if (cupomAplicado) handleRemoverCupom();
      if (tokenGerencial) handleRemoverToken();
      toast.success(`Total ajustado para R$ ${arredondado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
  };

  // [CORREÇÃO] Atualizar valor do 'Receber na Entrega' sempre que o restante mudar
  // E garantir que a forma de pagamento tenha um padrão se estiver vazio
  useEffect(() => {
    if (pagamentoEntrega.ativo) {
      setPagamentoEntrega(prev => ({
        ...prev,
        valor: valores.restante,
        forma: prev.forma || "Dinheiro" // Garante padrão caso venha vazio do storage
      }));
    }
  }, [valores.restante, pagamentoEntrega.ativo]);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800 p-4 h-full">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">

        {/* COLUNA ESQUERDA - RESUMO FINANCEIRO (md:col-span-4) */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-800 pb-4 md:pb-0 md:pr-4">

          {/* Resumo do Pedido (Novo) */}
          <div className="bg-green-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-green-100 dark:border-neutral-700/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-700 dark:text-green-400 font-bold">
                {cliente?.nome_completo?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-gray-100 line-clamp-1">{cliente?.nome_completo}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {itensCount} itens</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {prazo}</span>
                </div>
              </div>
            </div>
          </div>

          <h3 className="font-semibold text-sm uppercase text-gray-500 dark:text-gray-400 flex items-center justify-between mt-2 mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Resumo Financeiro
            </div>
            <Button
              variant={isArredondamento ? "default" : "outline"}
              size="sm"
              className={`h-6 text-xs px-2 transition-colors ${isArredondamento
                ? "bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 border-transparent shadow-sm"
                : "border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800"
                }`}
              onClick={handleArredondar}
              disabled={valores.subtotal <= 0 || loading || savingOrcamento}
              title={isArredondamento ? "Remover arredondamento" : "Arredondar para a dezena mais próxima"}
            >
              {isArredondamento ? "Arredondado" : "Arredondar"}
            </Button>
          </h3>

          <div className="flex-1 flex flex-col justify-center gap-6">
            {/* Start Jackpot Area */}
            <div className={`p-6 rounded-2xl text-center border-2 transition-all duration-500 ${valores.pago > 0
              ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800/30'
              : 'bg-white dark:bg-transparent border-gray-100 dark:border-neutral-800 shadow-sm'
              }`}>
              <AnimatePresence mode="wait">
                <motion.p
                  key={valores.pago > 0 ? 'restante' : 'total'}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`text-sm font-bold uppercase mb-2 ${valores.pago > 0
                    ? 'text-orange-800 dark:text-orange-400'
                    : 'text-green-800 dark:text-green-400'
                    }`}
                >
                  {valores.pago > 0 ? 'Valor Restante' : 'Total a Pagar'}
                </motion.p>
              </AnimatePresence>
              <JackpotNumber
                value={valores.pago > 0 ? valores.restante : valores.total}
                className={`text-4xl md:text-5xl ${valores.pago > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}`}
              />
            </div>

            <div className="space-y-3 px-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">R$ {valores.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>

              {desconto !== 0 && (
                <div className={`flex justify-between items-center text-sm ${desconto > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {desconto > 0 ? `Desconto ${cupomAplicado ? `(${cupomAplicado.codigo})` : ''}` : 'Arredondamento'}
                  </span>
                  <span className="font-bold">
                    {desconto > 0 ? '- ' : '+ '}
                    R$ {Math.abs(desconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Linha de Acréscimos */}
              {pagamentos.reduce((acc, p) => acc + (p.acrescimo || 0), 0) > 0 && (
                <div className="flex justify-between items-center text-sm text-blue-600 dark:text-blue-400">
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Acréscimos</span>
                  <span className="font-bold">+ R$ {pagamentos.reduce((acc, p) => acc + (p.acrescimo || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Pago</span>
                <span className="font-medium text-green-600">R$ {valores.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="h-px bg-gray-100 dark:bg-neutral-800 my-2" />

              {pagamentoEntrega.ativo && (
                <div className="flex justify-between items-center text-xs text-orange-600">
                  <span>Receber na Entrega ({pagamentoEntrega.forma})</span>
                  <span className="font-bold">R$ {pagamentoEntrega.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* Cupom Section Compacta */}
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800 mt-auto">
              {cupomAplicado ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 dark:bg-purple-800 p-1.5 rounded text-purple-600 dark:text-purple-300">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-purple-500 dark:text-purple-400 font-medium">Cupom Aplicado</p>
                      <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{cupomAplicado.codigo}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoverCupom}
                    className="p-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded text-purple-600 transition-colors"
                    title="Remover cupom"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-purple-500" />
                    <Input
                      placeholder="CÓDIGO DO CUPOM"
                      value={cupomCodigo}
                      onChange={(e) => {
                        setCupomCodigo(e.target.value.toUpperCase());
                        setErroCupom("");
                      }}
                      className="h-9 text-xs pl-7 uppercase font-mono bg-white dark:bg-neutral-800 border-purple-200 dark:border-purple-700 focus-visible:ring-purple-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleAplicarCupom()}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-9 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    onClick={handleAplicarCupom}
                    disabled={aplicandoCupom || !cupomCodigo.trim()}
                  >
                    {aplicandoCupom ? <Loader2 className="w-3 h-3 animate-spin" /> : "Aplicar"}
                  </Button>
                </div>
              )}
              {erroCupom && <p className="text-xs text-red-500 mt-1 pl-1">{erroCupom}</p>}
            </div>

            {/* Token Gerencial Section */}
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800">
              {tokenGerencial ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${tokenGerencial.tipo_token === 'SUPERVISOR_MODE' ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                        <span className="text-lg">{tokenGerencial.tipo_token === 'SUPERVISOR_MODE' ? '👑' : '🎫'}</span>
                      </div>
                      <div>
                        <p className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-1">
                          {tokenGerencial.tipo_token === 'SUPERVISOR_MODE' ? 'Modo Supervisor' : 'Token Único'}
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                            {tokenGerencial.permissao}
                          </span>
                        </p>
                        <p className="text-sm font-bold font-mono text-amber-700 dark:text-amber-300">{tokenGerencial.codigo}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoverToken}
                      className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded text-amber-600 transition-colors"
                      title="Remover token"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Slider de desconto - só mostra se permissão é DESCONTO ou ALTERACAO_PRECO */}
                  {/* Slider de desconto - só mostra se permissão é DESCONTO ou ALTERACAO_PRECO */}
                  {(tokenGerencial.permissao === 'DESCONTO' || tokenGerencial.permissao === 'ALTERACAO_PRECO') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-700 dark:text-amber-400 font-medium">Desconto Autorizado</span>
                        <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          Máx: {tokenGerencial.valor_limite || 30}%
                        </span>
                      </div>

                      <div className="flex gap-2 items-center">
                        {/* Input Porcentagem */}
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            value={descontoPercent}
                            onChange={(e) => {
                              let val = parseFloat(e.target.value);
                              if (isNaN(val)) val = 0;
                              const max = tokenGerencial.valor_limite || 30;
                              if (val > max) val = max;
                              if (val < 0) val = 0;
                              setDescontoPercent(val);
                            }}
                            className="h-8 text-xs pr-6"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                        </div>

                        {/* Input Valor (R$) */}
                        <div className="relative flex-[1.5]">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={descontoValorDisplay}
                            onChange={(e) => {
                              const formatted = formatCurrencyMask(e.target.value);
                              setDescontoValorDisplay(formatted);
                              
                              const valR = parseCurrencyToNumber(formatted);
                              if (isNaN(valR) || valR < 0) {
                                setDesconto(0);
                                setDescontoPercent(0);
                                return;
                              }

                              // Calcula a porcentagem equivalente
                              let newPercent = (valR / valores.subtotal) * 100;
                              const maxPercent = tokenGerencial.valor_limite || 30;

                              if (newPercent > maxPercent) {
                                // Se passar do limite, trava no limite
                                newPercent = maxPercent;
                                valR = (valores.subtotal * maxPercent) / 100;
                                toast.error(`Limite de <span>${maxPercent}%</span> atingido.`);
                                setDescontoValorDisplay(formatCurrencyMask(String(Math.round(valR * 100))));
                              }

                              setDescontoPercent(newPercent);
                              setDesconto(valR);
                            }}
                            className="h-8 text-xs pl-6"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <Slider
                        value={[descontoPercent]}
                        onValueChange={([v]) => setDescontoPercent(v)}
                        max={tokenGerencial.valor_limite || 30}
                        step={0.1} // Permitir frações para ajustes finos de valor
                        className="w-full"
                      />

                      <div className="text-center">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                          Total Desconto: R$ {desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Info adicional para SUPER_CAIXA */}
                  {tokenGerencial.permissao === 'SUPER_CAIXA' && (
                    <p className="text-xs text-purple-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Modo Super Caixa - Todas permissões liberadas
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Key className="w-3 h-3" /> Token do Gerente
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-amber-500" />
                      <Input
                        placeholder="G-XXXX"
                        value={tokenCodigo}
                        onChange={(e) => {
                          setTokenCodigo(e.target.value.toUpperCase());
                          setErroToken("");
                        }}
                        className="h-9 text-xs pl-7 uppercase font-mono bg-white dark:bg-neutral-800 border-amber-200 dark:border-amber-700 focus-visible:ring-amber-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAplicarToken()}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-9 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      onClick={handleAplicarToken}
                      disabled={aplicandoToken || !tokenCodigo.trim()}
                    >
                      {aplicandoToken ? <Loader2 className="w-3 h-3 animate-spin" /> : "Usar"}
                    </Button>
                  </div>
                  {erroToken && <p className="text-xs text-red-500">{erroToken}</p>}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* COLUNA DIREITA - AÇÕES (md:col-span-8) */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4 h-full">
          <div className="flex-1 flex flex-col gap-4">

            {/* Adicionar Pagamento */}
            <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-gray-100 dark:border-neutral-800">
              <Label className="text-xs font-semibold uppercase text-gray-500 mb-3 block">Adicionar Pagamento</Label>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full sm:w-auto">
                  <Label className="text-xs mb-1.5 block">Forma de Pagamento</Label>
                  <Select value={novoPagamento.forma} onValueChange={v => setNovoPagamento({ ...novoPagamento, forma: v })}>
                    <SelectTrigger className="h-10 bg-white dark:bg-neutral-800">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map(f => {
                        const acr = getAcrescimo(f);
                        return (
                          <SelectItem key={f} value={f}>
                            <span className="flex items-center gap-2">
                              {f}
                              {acr && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                  +{acr.tipo === 'porcentagem' ? `${acr.valor}%` : `R$${acr.valor}`}
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {isInstallmentPaymentMethod(novoPagamento.forma) && (
                  <div className="w-full sm:w-24">
                    <Label className="text-xs mb-1.5 block">Parcelas</Label>
                    <Select value={String(novoPagamento.parcelas)} onValueChange={v => setNovoPagamento({ ...novoPagamento, parcelas: Number(v) })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-neutral-800"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex-1 w-full sm:w-auto">
                  <Label className="text-xs mb-1.5 block">Valor (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <Input
                      type="number"
                      className="h-10 pl-9 text-lg font-bold bg-white dark:bg-neutral-800"
                      placeholder="0,00"
                      value={novoPagamento.valor}
                      onChange={e => setNovoPagamento({ ...novoPagamento, valor: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                  </div>
                  {/* Preview do acréscimo */}
                  {novoPagamento.valor && novoPagamento.forma && getAcrescimo(novoPagamento.forma) && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +R$ {calcularAcrescimo(novoPagamento.forma, parseFloat(novoPagamento.valor)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de acréscimo
                    </p>
                  )}
                </div>

                <Button
                  size="lg"
                  className="h-10 px-6 bg-green-600 hover:bg-green-700 text-white font-bold w-full sm:w-auto"
                  onClick={handleAdd}
                  disabled={!novoPagamento.valor || !novoPagamento.forma}
                >
                  <Plus className="w-5 h-5 mr-1" /> Adicionar
                </Button>
              </div>
            </div>

            {/* Lista de Pagamentos */}
            <div className="flex-1 bg-gray-50 dark:bg-neutral-800/30 rounded-xl border border-gray-100 dark:border-neutral-800 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/50">
                <Label className="text-xs font-semibold uppercase text-gray-500">Pagamentos Registrados</Label>
                <span className="text-xs bg-gray-200 dark:bg-neutral-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">{pagamentos.length}</span>
              </div>

              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {pagamentos.length === 0 && !pagamentoEntrega.ativo ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                    <Wallet className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">Nenhum pagamento registrado</p>
                  </div>
                ) : (
                  <>
                    {pagamentos.map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-100 dark:border-neutral-700/50 hover:border-green-200 dark:hover:border-green-900 transition-colors">
                        <div className="flex items-center gap-3">
                          <BadgePagamento tipo={p.forma_pagamento} />
                          <div>
                            <p className="font-medium text-sm">{p.forma_pagamento}</p>
                            <div className="flex items-center gap-2">
                              {p.parcelas > 1 && <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">{p.parcelas}x</span>}
                              {p.acrescimo > 0 && (
                                <span className="text-xs text-blue-600">
                                  R$ {(p.valor_base || p.valor - p.acrescimo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} + R$ {p.acrescimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} acréscimo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-700 dark:text-gray-200">R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <button onClick={() => onRemovePagamento(i)} className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Exibição do Pagamento na Entrega na lista também */}
                    {pagamentoEntrega.ativo && (
                      <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-800/30 border-dashed">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded flex items-center justify-center text-orange-600 border border-orange-200 dark:border-orange-800">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-orange-800 dark:text-orange-400">Receber na Entrega</p>
                            <div className="flex gap-2 mt-1">
                              <Select
                                value={pagamentoEntrega.forma || "Dinheiro"}
                                onValueChange={(val) => setPagamentoEntrega(prev => ({ ...prev, forma: val, parcelas: 1 }))}
                              >
                                <SelectTrigger className="h-6 text-xs w-[130px] bg-white/50 border-orange-200 focus:ring-orange-500 text-orange-700">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_METHOD_OPTIONS_DELIVERY.map((method) => (
                                    <SelectItem key={method} value={method}>{method}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {(pagamentoEntrega.forma === "Cartão de Crédito" || pagamentoEntrega.forma?.includes("Crédito")) && (
                                <Select
                                  value={String(pagamentoEntrega.parcelas || 1)}
                                  onValueChange={(val) => setPagamentoEntrega(prev => ({ ...prev, parcelas: Number(val) }))}
                                >
                                  <SelectTrigger className="h-6 text-xs w-[70px] bg-white/50 border-orange-200 focus:ring-orange-500 text-orange-700">
                                    <SelectValue placeholder="1x" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 12 }).map((_, i) => (
                                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}x</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-orange-700 dark:text-orange-400">R$ {pagamentoEntrega.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          {/* Checkbox de controle para remover */}
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={pagamentoEntrega.ativo}
                              onChange={e => setPagamentoEntrega({
                                ...pagamentoEntrega,
                                ativo: e.target.checked,
                                valor: e.target.checked ? valores.restante : 0,
                                forma: pagamentoEntrega.forma || "Dinheiro", // Define padrão ao ativar
                                parcelas: pagamentoEntrega.parcelas || 1
                              })}
                              className="accent-orange-500 w-4 h-4 cursor-pointer"
                              title={pagamentoEntrega.ativo ? "Remover pagamento na entrega" : "Adicionar pagamento na entrega"}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>


            {/* Opções Extras (Entrega e Obs) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {valores.restante > 0 && !pagamentoEntrega.ativo && (
                <div
                  onClick={() => setPagamentoEntrega({ ...pagamentoEntrega, ativo: true, valor: valores.restante })}
                  className="p-3 rounded-lg border border-dashed border-orange-300 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800 flex items-center gap-3 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-orange-800 dark:text-orange-400">Restante na Entrega?</p>
                    <p className="text-xs text-orange-600/80">Clique para adicionar R$ {valores.restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}

              <div className={valores.restante > 0 && !pagamentoEntrega.ativo ? "" : "md:col-span-2"}>
                <div className="relative">
                  <Label className="text-xs font-semibold uppercase text-gray-400 absolute -top-2 left-2 bg-white dark:bg-neutral-900 px-1">Observações</Label>
                  <Textarea
                    className="min-h-[50px] max-h-[80px] text-xs resize-none bg-white dark:bg-neutral-800 pt-3"
                    placeholder="Detalhes da entrega, observações internas..."
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <Button
              variant="outline"
              className="h-14 text-sm border-gray-200 hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => setModalOrcamentoOpen(true)}
              disabled={disabled || savingOrcamento}
            >
              {savingOrcamento ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
              Salvar Orçamento
            </Button>

            <Dialog open={modalOrcamentoOpen} onOpenChange={setModalOrcamentoOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Salvar Orçamento</DialogTitle>
                  <DialogDescription>
                    Defina a validade deste orçamento em dias.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Label>Validade (Dias)</Label>
                  <Input
                    type="number"
                    value={validadeOrcamentoDias}
                    onChange={(e) => setValidadeOrcamentoDias(Number(e.target.value))}
                    min={1}
                    max={365}
                    className="mt-2 h-10"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Válido até: <strong>{new Date(Date.now() + validadeOrcamentoDias * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</strong>
                  </p>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setModalOrcamentoOpen(false)}>Cancelar</Button>
                  <Button onClick={() => {
                    setModalOrcamentoOpen(false);
                    onOrcamento(validadeOrcamentoDias);
                  }} className="bg-green-600 hover:bg-green-700 text-white">Salvar Orçamento</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              className="h-14 bg-green-600 hover:bg-green-700 text-white font-bold text-lg shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all"
              onClick={onFinalizar}
              disabled={disabled || loading || (valores.restante > 0 && !pagamentoEntrega.ativo)}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Receipt className="w-5 h-5 mr-2" />}
              FINALIZAR VENDA
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgePagamento({ tipo }) {
  const icons = {
    Dinheiro: <Wallet className="w-3 h-3" />,
    Pix: <span className="font-bold text-[11px]">PIX</span>,
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