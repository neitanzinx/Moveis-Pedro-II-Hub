import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Receipt, CreditCard, Wallet, DollarSign, Plus, X, Loader2, Clock, Tag, Check, Percent, Truck, User, Package, Link2, QrCode, Copy, Download, MessageCircle, ExternalLink, Key, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44, supabase } from "@/api/base44Client";
import { toast } from "sonner";

const formasPagamento = ["Dinheiro", "Crédito", "Débito", "Pix", "AFESP", "Multicrédito", "Link de Pagamento"];

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
  const [novoPagamento, setNovoPagamento] = useState({ forma: "Dinheiro", valor: "", parcelas: 1 });
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [aplicandoCupom, setAplicandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");

  // Estado para Token Gerencial
  const [tokenCodigo, setTokenCodigo] = useState("");
  const [aplicandoToken, setAplicandoToken] = useState(false);
  const [erroToken, setErroToken] = useState("");
  const [descontoPercent, setDescontoPercent] = useState(0);

  // Estado para Link de Pagamento
  const [linkPagamentoData, setLinkPagamentoData] = useState(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [numeroAlternativo, setNumeroAlternativo] = useState("");

  const handleAdd = async () => {
    if (!novoPagamento.valor) return;

    // Se for Link de Pagamento, gerar o link primeiro
    if (novoPagamento.forma === "Link de Pagamento") {
      await gerarLinkPagamento(parseFloat(novoPagamento.valor));
      return;
    }

    onAddPagamento({
      forma_pagamento: novoPagamento.forma,
      valor: parseFloat(novoPagamento.valor),
      parcelas: novoPagamento.parcelas
    });
    setNovoPagamento({ forma: "Dinheiro", valor: "", parcelas: 1 });
  };

  const gerarLinkPagamento = async (valor) => {
    setGerandoLink(true);
    try {
      // Payload para Stone Payment Link
      const payload = {
        venda_id: null, // Será preenchido após criação da venda
        valor: valor,
        descricao: `PDV - Móveis Pedro II`,
        cliente_nome: cliente?.nome_completo || "Cliente",
        cliente_email: cliente?.email || null,
        cliente_documento: cliente?.cpf || null,
        payment_methods: ['pix', 'credit_card', 'boleto'],
        max_installments: 12,
        expires_in_days: 7
      };

      const { data, error } = await supabase.functions.invoke('stone-payment-link', {
        body: payload
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      // Normalizar resposta da Stone
      const normalizedData = {
        link_pagamento: data.payment_url,
        qr_code_url: data.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.payment_url)}`,
        payment_link_id: data.id,
        stone_id: data.stone_id,
        valor: valor
      };

      setLinkPagamentoData(normalizedData);

      // Adicionar como pagamento pendente
      onAddPagamento({
        forma_pagamento: "Link de Pagamento",
        valor: valor,
        parcelas: 1,
        link_pagamento: normalizedData.link_pagamento,
        status: "AGUARDANDO"
      });

      setNovoPagamento({ forma: "Dinheiro", valor: "", parcelas: 1 });
      toast.success("Link de pagamento gerado!");
    } catch (err) {
      console.error("Erro ao gerar link:", err);
      toast.error(err.message || "Erro ao gerar link de pagamento");
    } finally {
      setGerandoLink(false);
    }
  };


  const copiarLink = async () => {
    if (!linkPagamentoData?.link_pagamento) return;
    try {
      await navigator.clipboard.writeText(linkPagamentoData.link_pagamento);
      setLinkCopiado(true);
      toast.success("Link copiado!");
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch (err) {
      toast.error("Erro ao copiar");
    }
  };

  const downloadQrCode = async () => {
    if (!linkPagamentoData?.qr_code_url) return;
    try {
      const response = await fetch(linkPagamentoData.qr_code_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode_pagamento.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("QR Code baixado!");
    } catch (err) {
      toast.error("Erro ao baixar");
    }
  };

  const enviarWhatsAppPara = async (numero, isAlternativo = false) => {
    if (!linkPagamentoData?.link_pagamento || !numero) {
      toast.error("Número de telefone não fornecido");
      return;
    }

    const telefone = numero.replace(/\D/g, '');
    const telefoneFormatado = telefone.startsWith('55') ? telefone : `55${telefone}`;

    // Se for número alternativo diferente do cadastrado, salvar no cliente
    if (isAlternativo && cliente?.id && cliente?.telefone) {
      const telefoneClienteNormalizado = cliente.telefone.replace(/\D/g, '');
      if (telefone !== telefoneClienteNormalizado) {
        try {
          await base44.entities.Cliente.update(cliente.id, {
            telefone_alternativo: telefone
          });
          toast.success("Contato alternativo salvo!");
        } catch (err) {
          console.error("Erro ao salvar contato alternativo:", err);
        }
      }
    }

    const nomeCliente = cliente?.nome_completo?.split(' ')[0] || 'Cliente';
    const mensagem = encodeURIComponent(
      `Olá ${nomeCliente}! 👋\n\n` +
      `Segue o link para pagamento:\n\n` +
      `💰 Valor: R$ ${linkPagamentoData.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `🔗 Link: ${linkPagamentoData.link_pagamento}\n\n` +
      `Você pode pagar com Pix, Cartão ou Boleto.\n\n` +
      `- Móveis Pedro II`
    );
    window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, '_blank');
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

      if (cupom.validade && new Date(cupom.validade) < new Date()) {
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

      if (token.validade && new Date(token.validade) < new Date()) {
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
    setTokenCodigo("");
    setErroToken("");
  };

  // Atualizar desconto quando slider muda
  useEffect(() => {
    if (tokenGerencial && descontoPercent > 0) {
      const valorDesconto = (valores.subtotal * descontoPercent) / 100;
      setDesconto(valorDesconto);
    } else if (tokenGerencial && descontoPercent === 0) {
      setDesconto(0);
    }
  }, [descontoPercent, valores.subtotal, tokenGerencial]);

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

          <h3 className="font-semibold text-sm uppercase text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-2">
            <DollarSign className="w-4 h-4" /> Resumo Financeiro
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

              {desconto > 0 && (
                <div className="flex justify-between items-center text-sm text-purple-600 dark:text-purple-400">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Desconto {cupomAplicado && `(${cupomAplicado.codigo})`}</span>
                  <span className="font-bold">- R$ {desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
                      <div className="bg-amber-100 dark:bg-amber-800 p-1.5 rounded text-amber-600 dark:text-amber-300">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-amber-500 dark:text-amber-400 font-medium">Token Gerencial</p>
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-700 dark:text-amber-400">Desconto Gerencial</span>
                      <span className="font-bold text-amber-800 dark:text-amber-300">
                        {descontoPercent}% = R$ {((valores.subtotal * descontoPercent) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Slider
                      value={[descontoPercent]}
                      onValueChange={([v]) => setDescontoPercent(v)}
                      max={tokenGerencial.desconto_max_percent || 30}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-amber-600">
                      <span>0%</span>
                      <span>Máx: {tokenGerencial.desconto_max_percent || 30}%</span>
                    </div>
                  </div>

                  {tokenGerencial.permite_venda_sem_estoque && (
                    <p className="text-[10px] text-green-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Venda sem estoque autorizada
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
                    <SelectTrigger className="h-10 bg-white dark:bg-neutral-800"><SelectValue /></SelectTrigger>
                    <SelectContent>{formasPagamento.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {['Crédito', 'Multicrédito', 'AFESP'].includes(novoPagamento.forma) && (
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
                </div>

                <Button
                  size="lg"
                  className="h-10 px-6 bg-green-600 hover:bg-green-700 text-white font-bold w-full sm:w-auto"
                  onClick={handleAdd}
                  disabled={!novoPagamento.valor}
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

              <div className="overflow-y-auto flex-1 p-2 space-y-2 max-h-[200px] lg:max-h-[300px]">
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
                            {p.parcelas > 1 && <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded mr-2">{p.parcelas}x</span>}
                            <span className="text-xs text-gray-400">Registrado agora</span>
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
                            <span className="text-xs text-orange-600/70">{pagamentoEntrega.forma}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-orange-700 dark:text-orange-400">R$ {pagamentoEntrega.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          {/* Checkbox de controle para remover */}
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={pagamentoEntrega.ativo}
                              onChange={e => setPagamentoEntrega({ ...pagamentoEntrega, ativo: e.target.checked, valor: e.target.checked ? valores.restante : 0 })}
                              className="accent-orange-500 w-4 h-4 cursor-pointer"
                              title="Remover pagamento na entrega"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Link de Pagamento - QR Code Inline Display */}
            {linkPagamentoData && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50 p-4"
              >
                <div className="flex items-start gap-4">
                  {/* QR Code */}
                  <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 shadow-sm border">
                    <img
                      src={linkPagamentoData.qr_code_url}
                      alt="QR Code"
                      className="w-28 h-28"
                    />
                  </div>

                  {/* Info e Ações */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Link2 className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-sm text-blue-800 dark:text-blue-400">Link de Pagamento Gerado</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        R$ {linkPagamentoData.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Link Copiável */}
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-lg p-2 border text-xs">
                      <input
                        type="text"
                        value={linkPagamentoData.link_pagamento}
                        readOnly
                        className="flex-1 bg-transparent border-none focus:outline-none text-gray-500 font-mono truncate"
                      />
                      <Button size="sm" variant="ghost" onClick={copiarLink} className="h-7 px-2">
                        {linkCopiado ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Button size="sm" variant="outline" onClick={downloadQrCode} className="h-8 text-xs gap-1">
                        <Download className="w-3.5 h-3.5" /> Baixar QR
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => window.open(linkPagamentoData.link_pagamento, '_blank')} className="h-8 text-xs gap-1 text-blue-600">
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir
                      </Button>
                    </div>

                    {/* WhatsApp Options */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800/50 space-y-2">
                      <p className="text-xs font-semibold text-green-800 dark:text-green-400 flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" /> Enviar via WhatsApp
                      </p>

                      {/* Option 1: Send to registered client */}
                      {cliente?.telefone && (
                        <Button
                          size="sm"
                          onClick={() => enviarWhatsAppPara(cliente.telefone)}
                          className="w-full h-9 text-xs gap-2 bg-green-600 hover:bg-green-700 justify-start"
                        >
                          <User className="w-3.5 h-3.5" />
                          Enviar para {cliente?.nome_completo?.split(' ')[0]} ({cliente.telefone})
                        </Button>
                      )}

                      {/* Option 2: Send to custom number */}
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Input
                            type="tel"
                            placeholder="Outro número (ex: 11999998888)"
                            value={numeroAlternativo}
                            onChange={(e) => setNumeroAlternativo(e.target.value.replace(/\D/g, ''))}
                            className="h-9 text-xs pl-8"
                          />
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">+55</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => enviarWhatsAppPara(numeroAlternativo, true)}
                          disabled={!numeroAlternativo || numeroAlternativo.length < 10}
                          className="h-9 text-xs gap-1 bg-green-600 hover:bg-green-700 shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Enviar
                        </Button>
                      </div>

                      {numeroAlternativo && cliente?.telefone && numeroAlternativo !== cliente.telefone.replace(/\D/g, '') && (
                        <p className="text-[10px] text-green-700 dark:text-green-400 italic">
                          💾 Este número será salvo como contato alternativo do cliente
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

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
                  <Label className="text-[10px] font-semibold uppercase text-gray-400 absolute -top-2 left-2 bg-white dark:bg-neutral-900 px-1">Observações</Label>
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
              onClick={onOrcamento}
              disabled={disabled || savingOrcamento}
            >
              {savingOrcamento ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
              Salvar Orçamento
            </Button>
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