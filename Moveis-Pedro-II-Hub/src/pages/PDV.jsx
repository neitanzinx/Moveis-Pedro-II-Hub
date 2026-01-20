import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/components/ui/sidebar";

// Componentes
import BuscaProdutoAvancada from "../components/vendas/BuscaProdutoAvancada";
import CarrinhoVenda from "../components/pdv/CarrinhoVenda";
import SeletorCliente from "../components/pdv/SeletorCliente";
import PainelPagamento from "../components/pdv/PainelPagamento";
import { abrirNotaPedidoPDF, enviarWhatsApp, gerarNotaPedidoBase64, prepararNotaPedidoPDF, preencherEImprimirPDF } from "../components/vendas/NotaPedidoPDF";
import { processarFidelidadeCompra } from "@/utils/fidelidadeEngine";

// Icons
import {
  Calendar, Store, Truck, ArrowLeft, ArrowRight, ShoppingCart,
  User, CreditCard, Check, Package, WifiOff, RefreshCw, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

// Chaves para persistência
const PDV_STATE_KEY = 'pdv_state';
const OFFLINE_SALES_KEY = 'pending_sales_offline';

// --- FUNÇÕES AUXILIARES DE OFFLINE ---
const saveOfflineSale = (vendaData) => {
  try {
    const pending = JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || '[]');
    const vendaOffline = { ...vendaData, offlineId: Date.now(), timestamp: new Date().toISOString() };
    pending.push(vendaOffline);
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(pending));
    return true;
  } catch (e) {
    console.error("Erro ao salvar offline:", e);
    return false;
  }
};

const getOfflineSales = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || '[]');
  } catch (e) { return []; }
};

const removeOfflineSale = (offlineId) => {
  const pending = getOfflineSales().filter(s => s.offlineId !== offlineId);
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(pending));
};

// --- FUNÇÃO PARA CRIAR LANÇAMENTOS FINANCEIROS AUTOMÁTICOS ---
const criarLancamentosVenda = async (vendaData, taxas, vendaId) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];

    // 1. Receita Bruta da Venda
    await base44.entities.LancamentoFinanceiro.create({
      descricao: `Venda #${vendaData.numero_pedido} - ${vendaData.cliente_nome}`,
      valor: vendaData.valor_total + (vendaData.desconto || 0),
      tipo: 'receita',
      data_vencimento: hoje,
      data_lancamento: hoje,
      pago: vendaData.status === 'Pago',
      categoria_nome: 'Vendas',
      forma_pagamento: vendaData.pagamentos?.[0]?.forma_pagamento || 'Diversos',
      status: vendaData.status === 'Pago' ? 'Pago' : 'Pendente',
      observacao: `Pedido ${vendaData.numero_pedido}`,
      venda_id: vendaId, // Vinculado à venda
      numero_pedido: vendaData.numero_pedido
    });

    // 2. Lançamento de Desconto (se houver)
    if (vendaData.desconto > 0) {
      await base44.entities.LancamentoFinanceiro.create({
        descricao: `Desconto Venda #${vendaData.numero_pedido}${vendaData.cupom_codigo ? ` (Cupom: ${vendaData.cupom_codigo})` : ''}`,
        valor: -vendaData.desconto,
        tipo: 'despesa',
        data_vencimento: hoje,
        data_lancamento: hoje,
        pago: true,
        categoria_nome: 'Descontos Concedidos',
        status: 'Pago',
        observacao: vendaData.cupom_codigo ? `Cupom: ${vendaData.cupom_codigo}` : 'Desconto manual',
        venda_id: vendaId,
        numero_pedido: vendaData.numero_pedido
      });
    }

    // 3. Lançamentos de Taxas de Cartão (para cada pagamento)
    for (const pagamento of vendaData.pagamentos || []) {
      const taxa = taxas.find(t => {
        if (pagamento.forma_pagamento === 'Crédito' && pagamento.parcelas > 1) {
          return t.forma_pagamento === 'Crédito Parcelado';
        }
        return t.forma_pagamento === pagamento.forma_pagamento ||
          t.forma_pagamento === pagamento.forma_pagamento.replace(' 1x', '');
      });

      if (taxa && taxa.valor > 0) {
        let valorTaxa = 0;
        if (taxa.tipo_taxa === 'porcentagem') {
          valorTaxa = (pagamento.valor * taxa.valor) / 100;
        } else {
          valorTaxa = taxa.valor;
        }

        if (valorTaxa > 0) {
          await base44.entities.LancamentoFinanceiro.create({
            descricao: `Taxa ${pagamento.forma_pagamento} - Venda #${vendaData.numero_pedido}`,
            valor: -valorTaxa,
            tipo: 'despesa',
            data_vencimento: hoje,
            data_lancamento: hoje,
            pago: true,
            categoria_nome: 'Taxas de Cartão',
            forma_pagamento: pagamento.forma_pagamento,
            status: 'Pago',
            observacao: `${taxa.valor}${taxa.tipo_taxa === 'porcentagem' ? '%' : ' R$'} sobre R$ ${pagamento.valor.toFixed(2)}`,
            venda_id: vendaId,
            numero_pedido: vendaData.numero_pedido
          });
        }
      }
    }

    console.log('✅ Lançamentos financeiros criados para venda', vendaData.numero_pedido);
  } catch (error) {
    console.error('❌ Erro ao criar lançamentos financeiros:', error);
  }
};

export default function PDV() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { state: sidebarState, isMobile } = useSidebar();

  // Ref para prevenir duplo-clique (mutex)
  const isProcessingRef = useRef(false);

  // --- ESTADO ONLINE/OFFLINE ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [vendasPendentes, setVendasPendentes] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleStatusChange = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) carregarVendasPendentes();
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    // Checagem inicial
    carregarVendasPendentes();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const carregarVendasPendentes = () => {
    const pendentes = getOfflineSales();
    setVendasPendentes(pendentes);
  };

  // Carregar estado inicial
  const getInitialState = () => {
    try {
      const saved = sessionStorage.getItem(PDV_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          etapa: parsed.etapa || 1,
          clienteSelecionado: parsed.clienteSelecionado || null,
          itens: parsed.itens || [],
          pagamentos: parsed.pagamentos || [],
          configVenda: parsed.configVenda || {
            data: new Date().toISOString().split('T')[0],
            loja: "Centro",
            prazo: ""
          },
          desconto: parsed.desconto || 0,
          observacoes: parsed.observacoes || "",
          pagamentoEntrega: parsed.pagamentoEntrega || { ativo: false, valor: 0, forma: "" }
        };
      }
    } catch (e) { }
    return null;
  };

  const initialState = getInitialState();

  // --- ESTADOS DO PDV ---
  const [etapa, setEtapa] = useState(initialState?.etapa || 1);
  const [clienteSelecionado, setClienteSelecionado] = useState(initialState?.clienteSelecionado || null);
  const [itens, setItens] = useState(initialState?.itens || []);
  const [pagamentos, setPagamentos] = useState(initialState?.pagamentos || []);
  const [configVenda, setConfigVenda] = useState(initialState?.configVenda || {
    data: new Date().toISOString().split('T')[0],
    loja: "Centro",
    prazo: ""
  });
  const [desconto, setDesconto] = useState(initialState?.desconto || 0);
  const [observacoes, setObservacoes] = useState(initialState?.observacoes || "");
  const [pagamentoEntrega, setPagamentoEntrega] = useState(initialState?.pagamentoEntrega || { ativo: false, valor: 0, forma: "" });
  const [loading, setLoading] = useState(false);
  const [savingOrcamento, setSavingOrcamento] = useState(false);
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [tokenGerencial, setTokenGerencial] = useState(null);

  useEffect(() => {
    const state = { etapa, clienteSelecionado, itens, pagamentos, configVenda, desconto, observacoes, pagamentoEntrega };
    sessionStorage.setItem(PDV_STATE_KEY, JSON.stringify(state));
  }, [etapa, clienteSelecionado, itens, pagamentos, configVenda, desconto, observacoes, pagamentoEntrega]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!initialState && u) {
        setConfigVenda(prev => ({ ...prev, loja: u.loja || "Centro" }));
      }
    }).catch(console.error);
  }, []);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list()
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list()
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-data_venda', 50),
    enabled: isOnline
  });

  // Buscar configuração de taxas
  const { data: taxasFinanceiras = [] } = useQuery({
    queryKey: ['configuracao_taxas'],
    queryFn: () => base44.entities.ConfiguracaoTaxa.list(),
    enabled: isOnline
  });

  const criarVendaMutation = useMutation({
    mutationFn: (data) => base44.entities.Venda.create(data)
  });

  const criarOrcamentoMutation = useMutation({
    mutationFn: (data) => base44.entities.Orcamento.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orcamentos'] })
  });

  const sincronizarVendas = async () => {
    if (!isOnline || vendasPendentes.length === 0) return;

    const confirmed = await confirm({
      title: "Sincronizar Vendas",
      message: `Existem ${vendasPendentes.length} vendas salvas offline. Deseja sincronizar agora?`,
      confirmText: "Sincronizar"
    });
    if (!confirmed) return;

    setSyncing(true);
    let sucessos = 0;

    for (const vendaOffline of vendasPendentes) {
      try {
        const { offlineId, timestamp, ...dadosVenda } = vendaOffline;
        await criarVendaMutation.mutateAsync(dadosVenda);

        // Tenta enviar mensagem do robô também na sincronização
        if (dadosVenda.cliente_telefone) {
          fetch(`${import.meta.env.VITE_ZAP_API_URL}/mensagem-pos-venda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telefone: dadosVenda.cliente_telefone,
              nome: dadosVenda.cliente_nome,
              pedido: dadosVenda.numero_pedido,
              prazo: dadosVenda.prazo_entrega
            })
          }).catch(e => console.log("Robô offline na sincronização"));
        }

        removeOfflineSale(offlineId);
        sucessos++;
      } catch (erro) {
        console.error("Erro ao sincronizar venda:", erro);
      }
    }

    setSyncing(false);
    carregarVendasPendentes();
    if (sucessos > 0) toast.success(`${sucessos} vendas sincronizadas com sucesso!`);
  };

  // MODIFIED: Accepts ID (string) OR Full Product Object (provisional)
  const handleSelectProduto = (produtoOrId) => {
    let produto = null;

    if (typeof produtoOrId === 'string' || typeof produtoOrId === 'number') {
      produto = produtos.find(p => p.id === produtoOrId);
    } else if (typeof produtoOrId === 'object') {
      produto = produtoOrId; // Provisional product passed directly
    }

    if (!produto) return;

    setItens(prev => {
      // For provisional products, we might want unique entries based on solicitacao_id to avoid merging different requests?
      // Or just merge if same ID? 
      // If it's the Generic Product ID, we must check if it's the SAME solicitation.

      const exists = prev.findIndex(i => {
        if (produto.is_solicitacao) {
          return i.solicitacao_id === produto.solicitacao_id;
        }
        return i.produto_id === produto.id;
      });

      if (exists >= 0) {
        const newItens = [...prev];
        newItens[exists].quantidade += 1;
        newItens[exists].subtotal = newItens[exists].quantidade * newItens[exists].preco_unitario;
        return newItens;
      }

      return [...prev, {
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: 1,
        preco_unitario: produto.preco_venda,
        subtotal: produto.preco_venda,
        // Default to 'retira' for showroom items, otherwise respect product default or 'montado'
        tipo_montagem: (produto.origem === 'mostruario') ? 'retira' : (produto.tipo_entrega_padrao || 'montado'),
        origem: produto.origem, // Store origin used for delivery flagging
        // Preserve metadata for provisional products
        is_solicitacao: produto.is_solicitacao,
        solicitacao_id: produto.solicitacao_id,
        detalhes_solicitacao: produto.detalhes_solicitacao
      }];
    });
  };

  const handleToggleMontagem = (index, tipo) => {
    setItens(prev => {
      const newItens = [...prev];
      newItens[index].tipo_montagem = tipo;
      return newItens;
    });
  };

  const handleRemoveItem = (index) => {
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = itens.reduce((acc, item) => acc + item.subtotal, 0);
  const total = Math.max(0, subtotal - desconto);
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const restante = Math.max(0, total - totalPago);

  const podeAvancar = () => {
    if (etapa === 1) return itens.length > 0;
    if (etapa === 2) return clienteSelecionado && configVenda.prazo;
    return true;
  };

  const avancarEtapa = () => {
    if (etapa === 1 && itens.length === 0) return toast.warning("Adicione pelo menos um produto");
    if (etapa === 2) {
      if (!clienteSelecionado) return toast.warning("Selecione um cliente");
      if (!configVenda.prazo) return toast.warning("Selecione o prazo de entrega");
    }
    if (etapa < 3) setEtapa(etapa + 1);
  };

  const voltarEtapa = () => {
    if (etapa > 1) setEtapa(etapa - 1);
  };

  const handleFinalizar = async () => {
    // 🛡️ Proteção contra duplo-clique (mutex imediato)
    if (isProcessingRef.current || loading) {
      console.log('⚠️ Venda já em processamento, ignorando clique duplicado');
      return;
    }
    isProcessingRef.current = true;
    setLoading(true);

    // Validações
    if (!clienteSelecionado) {
      isProcessingRef.current = false;
      setLoading(false);
      return toast.warning("Selecione um cliente");
    }
    if (itens.length === 0) {
      isProcessingRef.current = false;
      setLoading(false);
      return toast.warning("Adicione produtos");
    }
    if (!configVenda.prazo) {
      isProcessingRef.current = false;
      setLoading(false);
      return toast.warning("Selecione o prazo de entrega");
    }
    if (restante > 0 && !pagamentoEntrega.ativo) {
      const confirmed = await confirm({
        title: "Saldo Pendente",
        message: "Há um saldo restante pendente. Confirmar venda assim mesmo?",
        confirmText: "Confirmar Venda"
      });
      if (!confirmed) {
        isProcessingRef.current = false;
        setLoading(false);
        return;
      }
    }

    // 🖨️ ABRIR JANELA DE IMPRESSÃO AGORA (antes de qualquer operação async)
    // Isso evita que o navegador bloqueie o popup
    const printWindow = prepararNotaPedidoPDF();

    // Gerar número do pedido com fallback para evitar NaN
    // Gerar número do pedido sequencial (pula OFF e O-)
    let lastNum = 0;
    if (vendas.length > 0 && isOnline) {
      // Encontrar o maior número de pedido VÁLIDO e SEQUENCIAL (ignorando offline)
      const numerosvalidos = vendas
        .map(v => v.numero_pedido)
        .filter(n => n && !n.startsWith('OFF') && !n.startsWith('O-') && !n.includes('NaN'))
        .map(n => parseInt(n))
        .filter(n => !isNaN(n));

      if (numerosvalidos.length > 0) {
        lastNum = Math.max(...numerosvalidos);
      }
    }

    let novoNumero = isOnline
      ? String(lastNum + 1).padStart(5, '0')
      : `O-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;

    const vendaData = {
      numero_pedido: novoNumero,
      data_venda: configVenda.data,
      loja: configVenda.loja,
      responsavel_id: user.id,
      responsavel_nome: user.full_name,
      cliente_id: clienteSelecionado.id,
      cliente_nome: clienteSelecionado.nome_completo,
      cliente_telefone: clienteSelecionado.telefone,
      itens,
      valor_total: total,
      desconto,
      pagamentos,
      valor_pago: totalPago,
      valor_restante: restante,
      pagamento_na_entrega: pagamentoEntrega.ativo,
      valor_pagamento_entrega: pagamentoEntrega.ativo ? pagamentoEntrega.valor : 0,
      forma_pagamento_entrega: pagamentoEntrega.ativo ? pagamentoEntrega.forma : "",
      prazo_entrega: configVenda.prazo,
      status: restante <= 0 ? "Pago" : "Pagamento Pendente",
      observacoes: observacoes,
      cupom_codigo: cupomAplicado?.codigo || null,
      cupom_desconto: cupomAplicado ? desconto : 0
    };

    if
      (!isOnline) {
      const salvou = saveOfflineSale(vendaData);
      if (salvou) {
        toast.warning("⚠️ Sem internet: Venda salva no dispositivo! Será sincronizada quando a conexão voltar.");
        abrirNotaPedidoPDF({ ...vendaData }, clienteSelecionado, user.full_name);
        resetForm();
        carregarVendasPendentes();
      } else {
        toast.error("Erro crítico ao salvar venda offline. Tire foto da tela.");
      }
      setLoading(false);
      return;
    }

    try {
      const vendaCriada = await criarVendaMutation.mutateAsync(vendaData);

      for (const item of itens) {
        const prod = produtos.find(p => p.id === item.produto_id);
        if (prod) {
          await base44.entities.Produto.update(prod.id, {
            quantidade_estoque: prod.quantidade_estoque - item.quantidade
          });
        }
      }

      if (configVenda.prazo !== "Retirado na loja") {
        const dias = configVenda.prazo === "15 dias" ? 15 : 45;
        const limite = new Date();
        limite.setDate(limite.getDate() + dias);
        const enderecoCompleto = clienteSelecionado.endereco ? `${clienteSelecionado.endereco}, ${clienteSelecionado.numero} - ${clienteSelecionado.bairro}` : "Endereço a definir";

        const entregaCriada = await base44.entities.Entrega.create({
          venda_id: vendaCriada.id,
          numero_pedido: novoNumero,
          cliente_nome: clienteSelecionado.nome_completo,
          cliente_telefone: clienteSelecionado.telefone,
          endereco_entrega: enderecoCompleto,
          data_limite: limite.toISOString().split('T')[0],
          status: "Pendente",
          item_mostruario: itens.some(i => i.origem === 'mostruario') // Flag if any item is showroom
        });

        // Criar itens de montagem conforme o tipo selecionado
        for (const item of itens) {
          if (item.tipo_montagem === 'montagem_cliente') {
            // Requer Montagem Externa (Terceirizada)
            await base44.entities.MontagemItem.create({
              entrega_id: entregaCriada.id,
              venda_id: vendaCriada.id,
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              quantidade: item.quantidade,
              tipo_montagem: 'terceirizada', // Manter compatibilidade com MontadorExterno
              status: 'pendente',
              cliente_nome: clienteSelecionado.nome_completo,
              cliente_telefone: clienteSelecionado.telefone,
              endereco: enderecoCompleto,
              numero_pedido: novoNumero
            });
          } else if (item.tipo_montagem === 'montado') {
            // Montagem Interna
            await base44.entities.MontagemItem.create({
              entrega_id: entregaCriada.id,
              venda_id: vendaCriada.id,
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              quantidade: item.quantidade,
              tipo_montagem: 'interna',
              status: 'pendente',
              cliente_nome: clienteSelecionado.nome_completo,
              cliente_telefone: clienteSelecionado.telefone,
              endereco: enderecoCompleto,
              numero_pedido: novoNumero
            });
          }
          // Se for 'retira', não cria montagem
        }
      } else {
        // Cliente Retira na Loja - Criar registro para arquivo
        await base44.entities.Entrega.create({
          venda_id: vendaCriada.id,
          numero_pedido: novoNumero,
          cliente_nome: clienteSelecionado.nome_completo,
          cliente_telefone: clienteSelecionado.telefone,
          endereco_entrega: `Retirado na loja: ${configVenda.loja}`,
          tipo_entrega: 'Retirada',
          status: 'Retirado',
          data_realizada: new Date().toISOString(),
          data_limite: new Date().toISOString().split('T')[0],
          observacoes_entrega: `Cliente retirou na loja ${configVenda.loja}`
        });
      }


      // Incrementar uso do cupom
      if (cupomAplicado) {
        await base44.entities.Cupom.update(cupomAplicado.id, {
          quantidade_usada: (cupomAplicado.quantidade_usada || 0) + 1
        });
      }

      // Incrementar uso do token gerencial e registrar log
      if (tokenGerencial) {
        try {
          // Atualizar contador de usos
          await base44.entities.TokenGerencial.update(tokenGerencial.id, {
            usos_realizados: (tokenGerencial.usos_realizados || 0) + 1
          });

          // Registrar log de uso
          await base44.entities.LogUsoToken.create({
            token_id: tokenGerencial.id,
            venda_id: vendaCriada.id,
            vendedor_id: user?.id,
            vendedor_nome: user?.full_name || user?.email,
            acao_realizada: 'desconto_gerencial',
            detalhes: {
              desconto_aplicado: desconto,
              desconto_percent: (desconto / subtotal * 100).toFixed(1),
              subtotal_venda: subtotal,
              numero_pedido: novoNumero
            }
          });
        } catch (logError) {
          console.error('Erro ao registrar uso do token:', logError);
          // Não impede a venda de continuar
        }
      }

      // --- LANÇAMENTOS FINANCEIROS AUTOMÁTICOS ---
      await criarLancamentosVenda(vendaData, taxasFinanceiras, vendaCriada.id);

      // --- MOTOR DE FIDELIDADE (Coroas) ---
      try {
        const resultadoFidelidade = await processarFidelidadeCompra(
          clienteSelecionado,
          total,
          vendaData.numero_pedido
        );
        if (resultadoFidelidade.coroasGanhas > 0) {
          console.log(`👑 Cliente ganhou ${resultadoFidelidade.coroasGanhas} Coroas!`);
        }
      } catch (fidErr) {
        console.error('Erro no motor de fidelidade:', fidErr);
        // Não impede a venda de continuar
      }

      // --- GATILHO DO ROBÔ DE FIDELIZAÇÃO + ENVIO DE PDF ---
      if (clienteSelecionado.telefone) {
        try {
          // Função para limpar nome do produto (remove prefixos internos)
          const limparNomeProduto = (nome) => {
            if (!nome) return '-';
            return nome
              .replace(/^\[SOLICITAÇÃO\]\s*/i, '')
              .replace(/^\[PENDENTE CADASTRO\]\s*/i, '');
          };

          // Formata lista de produtos para a mensagem (com nomes limpos)
          const listaProdutos = itens.map(item => `• ${item.quantidade}x ${limparNomeProduto(item.produto_nome)}`).join('\n');

          // Gerar PDF base64 para enviar junto
          let pdfBase64 = null;
          try {
            pdfBase64 = await gerarNotaPedidoBase64(vendaData, clienteSelecionado, user.full_name);
            console.log('📄 PDF gerado para enviar ao cliente');
          } catch (pdfErr) {
            console.error('Erro ao gerar PDF (continuando sem PDF):', pdfErr);
          }

          fetch(`${import.meta.env.VITE_ZAP_API_URL}/mensagem-pos-venda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telefone: clienteSelecionado.telefone,
              nome: clienteSelecionado.nome_completo,
              pedido: novoNumero,
              prazo: configVenda.prazo,
              produtos: listaProdutos,
              pdf_base64: pdfBase64
            })
          });
          console.log("Comando de mensagem enviado para o robô" + (pdfBase64 ? ' (com PDF)' : ''));
        } catch (err) {
          console.error("Erro ao chamar o robô:", err);
        }
      }
      // ----------------------------------------------------------------

      // Invalidar queries após TODAS as operações serem concluídas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vendas'] }),
        queryClient.invalidateQueries({ queryKey: ['produtos'] }),
        queryClient.invalidateQueries({ queryKey: ['entregas'] }),
        queryClient.invalidateQueries({ queryKey: ['clientes'] })
      ]);

      // Usar a janela que já foi aberta no início para evitar bloqueio de popup
      preencherEImprimirPDF(printWindow, { ...vendaData }, clienteSelecionado, user.full_name);

      toast.success("Venda finalizada com sucesso!");
      resetForm();

    } catch (err) {
      // ❌ Se der erro, fecha a janela que abriu
      if (typeof printWindow !== 'undefined' && printWindow) {
        printWindow.close();
      }
      console.error(err);
      toast.error("Erro ao finalizar venda online. Verifique sua conexão.");
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleOrcamento = async () => {
    if (!clienteSelecionado) return toast.warning("Selecione um cliente");
    if (!isOnline) return toast.warning("Orçamentos só podem ser salvos online.");

    setSavingOrcamento(true);
    try {
      const numero = String(Date.now()).slice(-5);
      await criarOrcamentoMutation.mutateAsync({
        numero_orcamento: numero,
        data_orcamento: configVenda.data,
        validade: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        loja: configVenda.loja,
        cliente_id: clienteSelecionado.id,
        cliente_nome: clienteSelecionado.nome_completo,
        cliente_telefone: clienteSelecionado.telefone,
        itens,
        valor_total: total,
        desconto,
        status: "Pendente",
        observacoes
      });
      toast.success("Orçamento salvo!");
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar orçamento");
    } finally {
      setSavingOrcamento(false);
    }
  };

  const resetForm = () => {
    setClienteSelecionado(null);
    setItens([]);
    setPagamentos([]);
    setDesconto(0);
    setObservacoes("");
    setPagamentoEntrega({ ativo: false, valor: 0, forma: "" });
    setConfigVenda(prev => ({ ...prev, data: new Date().toISOString().split('T')[0], prazo: "" }));
    setCupomAplicado(null);
    setEtapa(1);
    sessionStorage.removeItem(PDV_STATE_KEY);
  };

  if (!user) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800" /></div>;

  const etapas = [
    { num: 1, titulo: "Produtos", icon: Package },
    { num: 2, titulo: "Cliente & Entrega", icon: User },
    { num: 3, titulo: "Pagamento", icon: CreditCard },
  ];

  return (
    <div
      className="fixed inset-y-0 right-0 flex flex-col bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 transition-[left] duration-200 ease-linear"
      style={{ left: isMobile ? '0px' : (sidebarState === 'expanded' ? '16rem' : '3rem') }}
    >

      {!isOnline && (
        <div className="bg-red-600 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2">
          <WifiOff className="w-3 h-3" />
          MODO OFFLINE ATIVADO - As vendas serão salvas neste dispositivo
        </div>
      )}
      {isOnline && vendasPendentes.length > 0 && (
        <div className="bg-orange-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 cursor-pointer hover:bg-orange-600" onClick={sincronizarVendas}>
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? "Sincronizando..." : `VOCÊ ESTÁ ONLINE! Clique aqui para enviar ${vendasPendentes.length} vendas salvas offline.`}
        </div>
      )}

      <header className="h-12 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-500 font-bold text-lg">
            <Store className="w-5 h-5" />
            PDV
          </div>
          <div className="h-5 w-px bg-gray-200 dark:bg-neutral-800" />
          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded">
              <Store className="w-3 h-3 text-gray-400" />
              <span className="font-medium">{configVenda.loja}</span>
            </div>
            {isOnline ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><Wifi className="w-3 h-3 mr-1" /> Online</Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><WifiOff className="w-3 h-3 mr-1" /> Offline</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Usa o email se o nome não carregar */}
          <span className="text-xs text-gray-500 hidden sm:inline">
            {user.full_name || user.email}
          </span>
          <div className="w-7 h-7 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-800 dark:text-green-400 font-bold text-xs">
            {/* Pega a 1ª letra do nome OU do email, ou usa 'U' se tudo falhar */}
            {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-4 py-2 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {etapas.map((e, idx) => (
            <React.Fragment key={e.num}>
              <div
                className={`flex items-center gap-2 cursor-pointer transition-all ${etapa === e.num ? 'opacity-100' : etapa > e.num ? 'opacity-70' : 'opacity-40'
                  }`}
                onClick={() => etapa > e.num && setEtapa(e.num)}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${etapa === e.num
                  ? 'bg-green-600 text-white'
                  : etapa > e.num
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-neutral-800'
                  }`}>
                  {etapa > e.num ? <Check className="w-3 h-3" /> : e.num}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${etapa === e.num ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                  {e.titulo}
                </span>
              </div>
              {idx < etapas.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded-full ${etapa > e.num ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className={`mx-auto transition-all duration-300 ${etapa === 3 ? 'max-w-[95%] xl:max-w-7xl' : 'max-w-3xl'}`}>
          {etapa === 1 && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-green-600" />
                  Adicionar Produtos
                </h2>
                <BuscaProdutoAvancada produtos={produtos} onSelectProduto={(p) => handleSelectProduto(p.is_solicitacao ? p : p.id)} user={user} />
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Carrinho ({itens.length})</h3>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Subtotal</p>
                    <p className="text-lg font-bold text-green-700">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <CarrinhoVenda itens={itens} onRemoveItem={handleRemoveItem} onToggleMontagem={handleToggleMontagem} />
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-green-600" />
                  Selecionar Cliente
                </h2>
                {!isOnline && clientes.length === 0 && (
                  <Alert className="mb-2 bg-yellow-50 border-yellow-200">
                    <AlertDescription className="text-yellow-800 text-xs">
                      Modo Offline: Somente clientes já carregados anteriormente podem ser buscados.
                    </AlertDescription>
                  </Alert>
                )}
                <SeletorCliente
                  clienteSelecionado={clienteSelecionado}
                  setClienteSelecionado={setClienteSelecionado}
                  clientes={clientes}
                />
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-green-600" />
                  Configuração de Entrega
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block font-medium">Data da Venda</Label>
                    <input
                      type="date"
                      className="w-full h-10 text-sm border rounded-lg px-3 bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700"
                      value={configVenda.data}
                      onChange={e => setConfigVenda({ ...configVenda, data: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block font-medium">
                      Prazo de Entrega <span className="text-red-500">*</span>
                    </Label>
                    <Select value={configVenda.prazo} onValueChange={v => setConfigVenda({ ...configVenda, prazo: v })}>
                      <SelectTrigger className={`h-10 text-sm ${!configVenda.prazo ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15 dias">15 dias úteis</SelectItem>
                        <SelectItem value="45 dias">45 dias úteis</SelectItem>
                        <SelectItem value="Retirado na loja">Retirado na loja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="bg-gray-100 dark:bg-neutral-800/50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{itens.length} itens no carrinho</p>
                  </div>
                  <p className="text-lg font-bold text-green-700">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className={`space-y-4 h-full ${etapa === 3 ? 'flex flex-col' : ''}`}>
              <PainelPagamento
                valores={{ subtotal, total, pago: totalPago, restante }}
                pagamentos={pagamentos}
                onAddPagamento={p => setPagamentos([...pagamentos, p])}
                onRemovePagamento={i => setPagamentos(pagamentos.filter((_, idx) => idx !== i))}
                onFinalizar={handleFinalizar}
                onOrcamento={handleOrcamento}
                loading={loading}
                savingOrcamento={savingOrcamento}
                desconto={desconto}
                setDesconto={setDesconto}
                observacoes={observacoes}
                setObservacoes={setObservacoes}
                pagamentoEntrega={pagamentoEntrega}
                setPagamentoEntrega={setPagamentoEntrega}
                disabled={!clienteSelecionado || itens.length === 0 || !configVenda.prazo}
                cupomAplicado={cupomAplicado}
                setCupomAplicado={setCupomAplicado}
                cliente={clienteSelecionado}
                itensCount={itens.length}
                prazo={configVenda.prazo}
                tokenGerencial={tokenGerencial}
                setTokenGerencial={setTokenGerencial}
              />
            </div>
          )}
        </div>
      </div>

      <footer className="h-16 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 px-4 flex-shrink-0 flex items-center justify-between">
        {etapa > 1 ? (
          <Button variant="outline" size="sm" onClick={voltarEtapa} className="gap-1.5 h-10">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">{itens.length} itens</p>
            <p className="font-bold text-base text-green-700">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          {etapa < 3 && (
            <Button
              onClick={avancarEtapa}
              disabled={!podeAvancar()}
              className="gap-1.5 bg-green-600 hover:bg-green-700 h-10 px-6"
            >
              Avançar
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}