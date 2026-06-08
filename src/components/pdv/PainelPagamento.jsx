import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Receipt, CreditCard, Wallet, DollarSign, Plus, X, Loader2, Clock, Tag, Check, Percent, Truck, User, Package, Key, Ban, TrendingUp, RefreshCw, Search, ShoppingBag, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44, supabase } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_OPTIONS_DELIVERY,
  LINK_PAYMENT_SUBTYPES,
  isInstallmentPaymentMethod,
  isLinkPaymentMethod,
  normalizePaymentMethod,
  normalizePaymentItem,
} from "@/services/paymentOrchestrator";

// Formas base + subtypes do Link — não devem aparecer como opções extras
const BASE_OPTIONS_SET = new Set([...PAYMENT_METHOD_OPTIONS, ...LINK_PAYMENT_SUBTYPES]);

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
  setTokenGerencial,
  margemNegociavel = 0,
  onDescontoMargemChange,
  hideActions = false,
  vendas = [],
  itens = [],
  onAtualizarItem,
  descontoMaxProduto = 0,
  isProdutoComDesconto
}) {
  const [novoPagamento, setNovoPagamento] = useState({ forma: "", valor: "", parcelas: 1, linkSubtipo: "" });
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [aplicandoCupom, setAplicandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");

  // Estado para Modal de Troca
  const [modalTrocaOpen, setModalTrocaOpen] = useState(false);
  const [buscaPedido, setBuscaPedido] = useState("");
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [itensTrocaChecked, setItensTrocaChecked] = useState({});

  const isTrocaPayment = (forma) => String(forma || "").toLowerCase() === "troca";

  const [modalOrcamentoOpen, setModalOrcamentoOpen] = useState(false);
  const [validadeOrcamentoDias, setValidadeOrcamentoDias] = useState(30);

  // Estado para Token Gerencial
  const [tokenCodigo, setTokenCodigo] = useState("");
  const [aplicandoToken, setAplicandoToken] = useState(false);
  const [erroToken, setErroToken] = useState("");
  const [descontoPercent, setDescontoPercent] = useState(0);
  const [descontoValorDisplay, setDescontoValorDisplay] = useState("");

  // Estado para Margem Negociável
  const [descontoMargemPercent, setDescontoMargemPercent] = useState(0);
  const [descontoMargemValorDisplay, setDescontoMargemValorDisplay] = useState("");

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

  // Formas customizadas criadas pela loja (não presentes na lista base do PDV)
  const customPaymentOptions = useMemo(() =>
    configTaxas
      .filter(t => t.ativa && !BASE_OPTIONS_SET.has(t.forma_pagamento))
      .map(t => t.forma_pagamento)
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [configTaxas]
  );

  const allPaymentOptions = useMemo(() =>
    [...PAYMENT_METHOD_OPTIONS, ...customPaymentOptions],
    [customPaymentOptions]
  );

  const normalizeKey = (value = "") =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  // Mapa de acréscimos por forma de pagamento — match canônico exato
  const getAcrescimo = (forma) => {
    const formaKey = normalizeKey(normalizePaymentMethod(forma));
    const taxa = configTaxas.find(
      (t) => normalizeKey(normalizePaymentMethod(t.forma_pagamento || "")) === formaKey
    );
    if (!taxa || Number(taxa.acrescimo) === 0) return null;
    return { valor: Number(taxa.acrescimo), tipo: taxa.acrescimo_tipo || 'porcentagem' };
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

  // Resolve a forma canônica final considerando sub-tipo (Link) e parcelamento (Crédito)
  const resolverForma = (forma, parcelas) => {
    if (isLinkPaymentMethod(forma)) return novoPagamento.linkSubtipo;
    if (forma === "Crédito") return parcelas > 1 ? "Crédito Parcelado" : "Crédito 1x";
    return forma;
  };

  const handleAdd = async () => {
    if (!novoPagamento.valor) return;
    if (isTrocaPayment(novoPagamento.forma)) {
      setModalTrocaOpen(true);
      return;
    }

    const formaResolvida = resolverForma(novoPagamento.forma, novoPagamento.parcelas);

    const valorBase = parseFloat(novoPagamento.valor);
    const valorAcrescimo = calcularAcrescimo(formaResolvida, valorBase);
    const valorTotal = valorBase + valorAcrescimo;

    onAddPagamento(normalizePaymentItem({
      forma_pagamento: formaResolvida,
      valor: valorTotal,
      valor_base: valorBase,
      acrescimo: valorAcrescimo,
      parcelas: novoPagamento.parcelas
    }));
    setNovoPagamento({ forma: "", valor: "", parcelas: 1, linkSubtipo: "" });
  };

  const handleConfirmarTroca = () => {
    if (!pedidoSelecionado) return;
    const itensPedido = pedidoSelecionado.itens || [];
    const itensSelecionados = itensPedido.filter((_, idx) => itensTrocaChecked[idx]);
    if (itensSelecionados.length === 0) {
      toast.warning("Selecione pelo menos um item para trocar.");
      return;
    }
    itensSelecionados.forEach((item) => {
      const valorItem = Number(item.preco_unitario || 0) * Number(item.quantidade || 1);
      onAddPagamento(normalizePaymentItem({
        forma_pagamento: "Troca",
        valor: valorItem,
        parcelas: 1,
        troca_pedido_numero: pedidoSelecionado.numero_pedido,
        troca_pedido_id: pedidoSelecionado.id,
        troca_produto_nome: item.produto_nome || item.nome,
        troca_produto_id: item.produto_id,
        troca_quantidade: item.quantidade,
      }));
    });
    toast.success(`${itensSelecionados.length} item(ns) de troca adicionados!`);
    setModalTrocaOpen(false);
    setPedidoSelecionado(null);
    setBuscaPedido("");
    setItensTrocaChecked({});
    setNovoPagamento({ forma: "", valor: "", parcelas: 1, linkSubtipo: "" });
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
      // Limpa desconto de margem (mutuamente exclusivos)
      setDescontoMargemPercent(0);
      setDescontoMargemValorDisplay("");
      if (onDescontoMargemChange) onDescontoMargemChange(0);

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
      // Limpa desconto de margem (mutuamente exclusivos)
      setDescontoMargemPercent(0);
      setDescontoMargemValorDisplay("");
      if (onDescontoMargemChange) onDescontoMargemChange(0);
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

  // ---- Margem Negociável ----
  const handleAplicarDescontoMargem = (percent, valorR) => {
    if (percent > margemNegociavel) {
      toast.error(`Limite de ${margemNegociavel}% atingido.`);
      return;
    }
    setDesconto(valorR);
    if (onDescontoMargemChange) onDescontoMargemChange(percent);
    if (cupomAplicado) handleRemoverCupom();
    if (tokenGerencial) handleRemoverToken();
  };

  const handleRemoverDescontoMargem = () => {
    setDescontoMargemPercent(0);
    setDescontoMargemValorDisplay("");
    setDesconto(0);
    if (onDescontoMargemChange) onDescontoMargemChange(0);
  };

  // ---- Desconto por item ----
  const handleDescontoItem = (index, item, percentStr) => {
    let percent = parseFloat(percentStr);
    if (isNaN(percent) || percent < 0) percent = 0;
    if (percent > descontoMaxProduto) {
      toast.error(`Limite de ${descontoMaxProduto}% atingido.`);
      percent = descontoMaxProduto;
    }
    const precoOriginal = item.preco_original ?? item.preco_unitario;
    const novoPrecoUnit = precoOriginal * (1 - percent / 100);
    const novoSubtotal = novoPrecoUnit * (item.quantidade || 1);
    if (onAtualizarItem) {
      onAtualizarItem(index, {
        desconto_item_percent: percent,
        desconto_item_valor: precoOriginal * (percent / 100) * (item.quantidade || 1),
        preco_original: precoOriginal,
        preco_unitario: novoPrecoUnit,
        subtotal: novoSubtotal
      });
    }
  };

  const handleRemoverDescontoItem = (index, item) => {
    const precoOriginal = item.preco_original ?? item.preco_unitario;
    if (onAtualizarItem) {
      onAtualizarItem(index, {
        desconto_item_percent: 0,
        desconto_item_valor: 0,
        preco_unitario: precoOriginal,
        subtotal: precoOriginal * (item.quantidade || 1)
      });
    }
  };

  // Sincronizar desconto de margem quando o subtotal muda
  useEffect(() => {
    if (descontoMargemPercent > 0 && !cupomAplicado && !tokenGerencial) {
      const valorDesconto = (valores.subtotal * descontoMargemPercent) / 100;
      setDesconto(valorDesconto);
      setDescontoMargemValorDisplay(formatCurrencyMask(String(Math.round(valorDesconto * 100))));
    }
  }, [valores.subtotal, descontoMargemPercent]);

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
  const isDescontoMargem = !cupomAplicado && !tokenGerencial && desconto > 0 && descontoMargemPercent > 0;
  const isArredondamento = !cupomAplicado && !tokenGerencial && !isDescontoMargem && desconto !== 0;

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
      if (descontoMargemPercent > 0) handleRemoverDescontoMargem();
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

  const creditoDisponivel = Number(cliente?.saldo_credito || 0);
  const creditoJaAplicado = pagamentos.some((p) => p.forma_pagamento === 'Crédito de Loja');
  const valorCreditoAplicavel = Math.min(creditoDisponivel, Math.max(0, valores.restante));

  const handleAplicarCredito = () => {
    if (creditoJaAplicado || valorCreditoAplicavel <= 0) return;
    onAddPagamento(normalizePaymentItem({
      forma_pagamento: 'Crédito de Loja',
      valor: valorCreditoAplicavel,
      parcelas: 1,
    }));
  };

  const handleFinalizarComCredito = async () => {
    const pagamentoCredito = pagamentos.find((p) => p.forma_pagamento === 'Crédito de Loja');
    if (pagamentoCredito && cliente?.id && pagamentoCredito.valor > 0) {
      try {
        const saldoAtual = Number(cliente.saldo_credito || 0);
        const novoSaldo = Math.max(0, saldoAtual - pagamentoCredito.valor);
        await base44.entities.Cliente.update(cliente.id, { saldo_credito: novoSaldo });
      } catch (err) {
        console.warn('Erro ao debitar crédito do cliente:', err);
      }
    }
    onFinalizar();
  };

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

          {/* Lista de Itens com Desconto por Produto */}
          {itens.length > 0 && (
            <div className="bg-gray-50 dark:bg-neutral-800/30 rounded-xl p-3 border border-gray-100 dark:border-neutral-700/50 max-h-[180px] overflow-y-auto">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Itens do Pedido</h4>
              <div className="space-y-2">
                {itens.map((item, index) => {
                  const eligible = isProdutoComDesconto && isProdutoComDesconto(item);
                  return (
                    <div key={index} className="flex flex-col gap-1 p-2 bg-white dark:bg-neutral-900 rounded border border-gray-100 dark:border-neutral-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight flex-1">
                          {item.quantidade}x {item.produto_nome}
                        </p>
                        <div className="text-right whitespace-nowrap">
                          {(item.desconto_item_percent || 0) > 0 && item.preco_original ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-400 line-through">
                                R$ {(item.preco_original * (item.quantidade || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Desconto do Item */}
                      {eligible && (
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-gray-100 dark:border-neutral-800">
                          <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            Desconto (máx {descontoMaxProduto}%)
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                max={descontoMaxProduto}
                                step={0.5}
                                value={item.desconto_item_percent || 0}
                                onChange={(e) => handleDescontoItem(index, item, e.target.value)}
                                className="h-6 w-16 text-[11px] pr-5 border-emerald-200 focus-visible:ring-emerald-500"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">%</span>
                            </div>
                            {(item.desconto_item_percent || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRemoverDescontoItem(index, item)}
                                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                                title="Remover desconto"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

                              let valR = parseCurrencyToNumber(formatted);
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
                                toast.error(`Limite de ${maxPercent}% atingido.`);
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

            {/* Margem Negociável — só aparece se a loja tiver margem configurada */}
            {margemNegociavel > 0 && (
              <div className={`p-3 rounded-lg border transition-all ${isDescontoMargem
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-green-50/60 dark:bg-green-950/20 border-green-100 dark:border-green-900/40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                    <Percent className="w-3 h-3" /> Desconto Negociável
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                      máx {margemNegociavel}%
                    </span>
                  </p>
                  {isDescontoMargem && (
                    <button
                      onClick={handleRemoverDescontoMargem}
                      className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded text-green-600 transition-colors"
                      title="Remover desconto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Input
                        type="number"
                        value={descontoMargemPercent}
                        onChange={(e) => {
                          let val = parseFloat(e.target.value);
                          if (isNaN(val) || val < 0) val = 0;
                          if (val > margemNegociavel) val = margemNegociavel;
                          const valorR = (valores.subtotal * val) / 100;
                          setDescontoMargemPercent(val);
                          setDescontoMargemValorDisplay(formatCurrencyMask(String(Math.round(valorR * 100))));
                          handleAplicarDescontoMargem(val, valorR);
                        }}
                        className="h-8 text-xs pr-6 border-green-200 dark:border-green-700"
                        placeholder="0"
                        min={0}
                        max={margemNegociavel}
                        step={0.1}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={descontoMargemValorDisplay}
                        onChange={(e) => {
                          const formatted = formatCurrencyMask(e.target.value);
                          setDescontoMargemValorDisplay(formatted);
                          let valR = parseCurrencyToNumber(formatted);
                          if (isNaN(valR) || valR < 0) valR = 0;
                          let percent = valores.subtotal > 0 ? (valR / valores.subtotal) * 100 : 0;
                          if (percent > margemNegociavel) {
                            percent = margemNegociavel;
                            valR = (valores.subtotal * margemNegociavel) / 100;
                            toast.error(`Limite de ${margemNegociavel}% atingido.`);
                            setDescontoMargemValorDisplay(formatCurrencyMask(String(Math.round(valR * 100))));
                          }
                          setDescontoMargemPercent(percent);
                          handleAplicarDescontoMargem(percent, valR);
                        }}
                        className="h-8 text-xs pl-7 border-green-200 dark:border-green-700"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <Slider
                    value={[descontoMargemPercent]}
                    onValueChange={([v]) => {
                      setDescontoMargemPercent(v);
                      const valorR = (valores.subtotal * v) / 100;
                      setDescontoMargemValorDisplay(formatCurrencyMask(String(Math.round(valorR * 100))));
                      handleAplicarDescontoMargem(v, valorR);
                    }}
                    max={margemNegociavel}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* COLUNA DIREITA - AÇÕES (md:col-span-8) */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4 h-full">
          <div className="flex-1 flex flex-col gap-4">

            {/* Modal de Troca de Mercadoria */}
            <Dialog open={modalTrocaOpen} onOpenChange={(open) => {
              setModalTrocaOpen(open);
              if (!open) {
                setPedidoSelecionado(null);
                setBuscaPedido("");
                setItensTrocaChecked({});
                setNovoPagamento(prev => ({ ...prev, forma: "" }));
              }
            }}>
              <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-teal-600" />
                    Troca de Mercadoria
                  </DialogTitle>
                  <DialogDescription>
                    Busque um pedido anterior e selecione os itens que serão aceitos como crédito na venda atual.
                  </DialogDescription>
                </DialogHeader>

                {/* Busca de Pedido */}
                {!pedidoSelecionado && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Digite o número do pedido (ex: 10001)"
                        value={buscaPedido}
                        onChange={(e) => setBuscaPedido(e.target.value)}
                        className="pl-9 h-10"
                        autoFocus
                      />
                    </div>

                    {/* Resultados da Busca */}
                    {buscaPedido.trim().length >= 1 && (() => {
                      const termo = buscaPedido.trim().toLowerCase();
                      const encontrados = vendas.filter(v =>
                        String(v.numero_pedido || "").toLowerCase().includes(termo) ||
                        String(v.cliente_nome || "").toLowerCase().includes(termo)
                      ).slice(0, 8);
                      return (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {encontrados.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">Nenhum pedido encontrado</p>
                          ) : (
                            encontrados.map((venda) => (
                              <button
                                key={venda.id}
                                type="button"
                                onClick={() => {
                                  setPedidoSelecionado(venda);
                                  const initialChecked = {};
                                  (venda.itens || []).forEach((_, idx) => { initialChecked[idx] = false; });
                                  setItensTrocaChecked(initialChecked);
                                }}
                                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">Pedido #{venda.numero_pedido}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{venda.cliente_nome}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                                      R$ {Number(venda.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {venda.data_venda ? new Date(venda.data_venda + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                                      {venda.status && ` · ${venda.status}`}
                                    </p>
                                  </div>
                                </div>
                                {(venda.itens || []).length > 0 && (
                                  <p className="text-xs text-gray-400 mt-1">{venda.itens.length} item(ns)</p>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      );
                    })()}

                    {buscaPedido.trim().length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4 flex items-center justify-center gap-2">
                        <Search className="w-4 h-4" /> Digite para buscar pedidos
                      </p>
                    )}
                  </div>
                )}

                {/* Itens do Pedido Selecionado */}
                {pedidoSelecionado && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-teal-700 dark:text-teal-400">Pedido #{pedidoSelecionado.numero_pedido}</p>
                        <p className="text-sm text-gray-500">{pedidoSelecionado.cliente_nome}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPedidoSelecionado(null);
                          setBuscaPedido("");
                          setItensTrocaChecked({});
                        }}
                        className="text-xs text-teal-600 hover:underline flex items-center gap-1"
                      >
                        <Search className="w-3 h-3" /> Buscar outro pedido
                      </button>
                    </div>

                    <div className="bg-teal-50 dark:bg-teal-900/10 rounded-lg p-2 border border-teal-100 dark:border-teal-800">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-xs font-semibold uppercase text-teal-600 dark:text-teal-400">Itens do Pedido</p>
                        <button
                          type="button"
                          className="text-xs text-teal-600 hover:underline"
                          onClick={() => {
                            const allChecked = (pedidoSelecionado.itens || []).every((_, i) => itensTrocaChecked[i]);
                            const newState = {};
                            (pedidoSelecionado.itens || []).forEach((_, i) => { newState[i] = !allChecked; });
                            setItensTrocaChecked(newState);
                          }}
                        >
                          {(pedidoSelecionado.itens || []).every((_, i) => itensTrocaChecked[i]) ? 'Desmarcar todos' : 'Selecionar todos'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(pedidoSelecionado.itens || []).map((item, idx) => {
                          const valorItem = Number(item.preco_unitario || 0) * Number(item.quantidade || 1);
                          const isChecked = !!itensTrocaChecked[idx];
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setItensTrocaChecked(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${isChecked
                                ? 'bg-teal-100 dark:bg-teal-900/30 border-teal-400 dark:border-teal-600'
                                : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:border-teal-300'
                                }`}
                            >
                              <div className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 mt-0.5 transition-colors ${isChecked
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'bg-white dark:bg-neutral-700 border-gray-300 dark:border-neutral-500'
                                }`}>
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                                  {item.produto_nome || item.nome || 'Produto'}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Qtd: {item.quantidade || 1} · R$ {Number(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cada
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`font-bold text-sm ${isChecked ? 'text-teal-700 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                  R$ {valorItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Resumo da seleção */}
                    {(() => {
                      const selecionados = (pedidoSelecionado.itens || []).filter((_, i) => itensTrocaChecked[i]);
                      const totalTroca = selecionados.reduce((acc, item) => acc + Number(item.preco_unitario || 0) * Number(item.quantidade || 1), 0);
                      return selecionados.length > 0 ? (
                        <div className="bg-teal-600 text-white rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{selecionados.length} item(ns) selecionado(s)</p>
                            <p className="text-xs opacity-80">Crédito total de troca</p>
                          </div>
                          <p className="text-xl font-bold">R$ {totalTroca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-2">Selecione ao menos um item para prosseguir</p>
                      );
                    })()}
                  </div>
                )}

                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => {
                    setModalTrocaOpen(false);
                    setPedidoSelecionado(null);
                    setBuscaPedido("");
                    setItensTrocaChecked({});
                    setNovoPagamento(prev => ({ ...prev, forma: "" }));
                  }}>Cancelar</Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={!pedidoSelecionado || !(pedidoSelecionado.itens || []).some((_, i) => itensTrocaChecked[i])}
                    onClick={handleConfirmarTroca}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Confirmar Troca
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Adicionar Pagamento */}
            <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-gray-100 dark:border-neutral-800">
              <Label className="text-xs font-semibold uppercase text-gray-500 mb-3 block">Adicionar Pagamento</Label>
              <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                <div className="flex-1 w-full sm:w-auto">
                  <Label className="text-xs mb-1.5 block">Forma de Pagamento</Label>
                  <Select value={novoPagamento.forma} onValueChange={v => {
                    setNovoPagamento({ forma: v, valor: "", parcelas: 1, linkSubtipo: "" });
                    if (v === "Troca") {
                      setModalTrocaOpen(true);
                    }
                  }}>
                    <SelectTrigger className="h-10 bg-white dark:bg-neutral-800">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPaymentOptions.map(f => {
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

                {/* Sub-select para Link de Pagamento */}
                {isLinkPaymentMethod(novoPagamento.forma) && (
                  <div className="w-full sm:w-36">
                    <Label className="text-xs mb-1.5 block">Tipo do Link</Label>
                    <Select value={novoPagamento.linkSubtipo} onValueChange={v => setNovoPagamento({ ...novoPagamento, linkSubtipo: v, parcelas: 1 })}>
                      <SelectTrigger className="h-10 bg-white dark:bg-neutral-800">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {LINK_PAYMENT_SUBTYPES.map(sub => (
                          <SelectItem key={sub} value={sub}>{sub.replace('Link - ', '')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isInstallmentPaymentMethod(
                  isLinkPaymentMethod(novoPagamento.forma) ? novoPagamento.linkSubtipo : novoPagamento.forma
                ) && (
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

                {/* Campo de Valor — oculto para Troca */}
                {!isTrocaPayment(novoPagamento.forma) && (
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
                    {(() => {
                      const formaPreview = resolverForma(novoPagamento.forma, novoPagamento.parcelas);
                      return novoPagamento.valor && formaPreview && getAcrescimo(formaPreview) ? (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          +R$ {calcularAcrescimo(formaPreview, parseFloat(novoPagamento.valor)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de acréscimo
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Botão especial de Troca */}
                {isTrocaPayment(novoPagamento.forma) ? (
                  <Button
                    size="lg"
                    className="h-10 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold w-full sm:w-auto"
                    onClick={() => setModalTrocaOpen(true)}
                  >
                    <RefreshCw className="w-5 h-5 mr-1" /> Selecionar Pedido
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="h-10 px-6 bg-green-600 hover:bg-green-700 text-white font-bold w-full sm:w-auto"
                    onClick={handleAdd}
                    disabled={!novoPagamento.valor || !novoPagamento.forma || (isLinkPaymentMethod(novoPagamento.forma) && !novoPagamento.linkSubtipo)}
                  >
                    <Plus className="w-5 h-5 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
            </div>

            {creditoDisponivel > 0 && !creditoJaAplicado && valorCreditoAplicavel > 0 && (
              <button
                type="button"
                onClick={handleAplicarCredito}
                className="w-full p-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 flex items-center gap-3 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors text-left mb-2"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-blue-800 dark:text-blue-400">Crédito disponível na loja</p>
                  <p className="text-xs text-blue-600/80">
                    Saldo: R$ {creditoDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — Clique para aplicar R$ {valorCreditoAplicavel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </button>
            )}
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
                      <div key={i} className={`flex justify-between items-center p-3 rounded-lg shadow-sm border transition-colors ${p.forma_pagamento === 'Troca'
                        ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/50 hover:border-teal-300'
                        : 'bg-white dark:bg-neutral-800 border-gray-100 dark:border-neutral-700/50 hover:border-green-200 dark:hover:border-green-900'
                        }`}>
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
                              {p.forma_pagamento === 'Troca' && p.troca_produto_nome && (
                                <span className="text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                                  {p.troca_produto_nome}{p.troca_pedido_numero ? ` · Ped. #${p.troca_pedido_numero}` : ''}
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

          {!hideActions && (
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
                onClick={handleFinalizarComCredito}
                disabled={disabled || loading || (valores.restante > 0 && !pagamentoEntrega.ativo)}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Receipt className="w-5 h-5 mr-2" />}
                FINALIZAR VENDA
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BadgePagamento({ tipo }) {
  const icons = {
    Dinheiro: <Wallet className="w-3 h-3" />,
    Pix: <span className="font-bold text-[11px]">PIX</span>,
    Troca: <RefreshCw className="w-3 h-3" />,
    default: <CreditCard className="w-3 h-3" />
  };
  return (
    <div className={`w-5 h-5 rounded flex items-center justify-center border ${tipo === 'Troca'
      ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 border-teal-300 dark:border-teal-700'
      : 'bg-white dark:bg-neutral-900 text-gray-500 border-gray-200'
      }`}>
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