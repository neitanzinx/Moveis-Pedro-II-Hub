import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

// Componentes
import BuscaProdutoAvancada from "../components/vendas/BuscaProdutoAvancada";
import CarrinhoVenda from "../components/pdv/CarrinhoVenda";
import SeletorCliente from "../components/pdv/SeletorCliente";
import PainelPagamento from "../components/pdv/PainelPagamento";
import {
  abrirNotaPedidoPDF,
  atualizarStatusNotaPedidoPDF,
  gerarNotaPedidoBase64,
  prepararNotaPedidoPDF,
  preencherEImprimirPDF,
  sinalizarErroNotaPedidoPDF
} from "../components/vendas/NotaPedidoPDF";
import { processarFidelidadeCompra } from "@/utils/fidelidadeEngine";
import { ZAP_API_URL } from "@/utils/zapApiUrl";
import { whatsappService } from "@/services/whatsappService";
import ProdutoQuickEditModal from "@/components/produtos/ProdutoQuickEditModal";

// Icons
import {
  Calendar, Store, Truck, ArrowLeft, ArrowRight, ShoppingCart,
  User, CreditCard, Check, Package, WifiOff, RefreshCw, Wifi, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { adicionarDias } from "@/utils/dateUtils";
import { formatarNome, formatarEndereco } from "@/utils/formatters";
import { getProductTotalStock, resolveStockField } from "@/utils/stockUtils";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

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

// --- FUNÇÃO PARA CONSTRUIR ENDEREÇO COMPLETO DE ENTREGA ---
const construirEnderecoEntrega = (cliente) => {
  if (!cliente) return "Endereço a definir";

  // Determinar qual endereço usar
  const usarMesmo = cliente.usar_mesmo_endereco !== false;

  const end = usarMesmo ? {
    rua: cliente.endereco,
    numero: cliente.numero,
    complemento: cliente.complemento,
    ponto_referencia: cliente.ponto_referencia,
    bairro: cliente.bairro,
    cidade: cliente.cidade,
    estado: cliente.estado
  } : {
    rua: cliente.endereco_entrega_rua,
    numero: cliente.endereco_entrega_numero,
    complemento: cliente.endereco_entrega_complemento,
    ponto_referencia: cliente.endereco_entrega_ponto_referencia,
    bairro: cliente.endereco_entrega_bairro,
    cidade: cliente.endereco_entrega_cidade,
    estado: cliente.endereco_entrega_estado
  };

  if (!end.rua) return "Endereço a definir";

  let endereco = `${formatarEndereco(end.rua)}, ${end.numero || 's/n'}`;
  if (end.complemento) endereco += ` - ${formatarEndereco(end.complemento)}`;
  if (end.bairro) endereco += ` - ${formatarEndereco(end.bairro)}`;
  if (end.cidade) endereco += `, ${formatarEndereco(end.cidade)}`;
  if (end.estado) endereco += `/${end.estado}`;
  if (end.ponto_referencia) endereco += ` (Ref: ${formatarEndereco(end.ponto_referencia)})`;

  return endereco;
};

const normalizarTexto = (valor = "") =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const formatarPrazoEntrega = (prazo) => {
  if (!prazo) return "";
  return `${prazo.quantidade_dias} dias ${prazo.tipo_dias === 'uteis' ? 'úteis' : 'corridos'}`;
};

const encontrarPrazoConfigurado = (prazos, valorSelecionado) => {
  if (!valorSelecionado) return null;

  const valorNormalizado = normalizarTexto(valorSelecionado);

  return prazos.find((prazo) => {
    const label = formatarPrazoEntrega(prazo);
    return [prazo.identificador, prazo.titulo, label]
      .filter(Boolean)
      .some((valor) => normalizarTexto(valor) === valorNormalizado);
  }) || null;
};

const obterPrazoEncomenda = (prazos) => {
  if (!Array.isArray(prazos) || prazos.length === 0) return null;

  return prazos.find((prazo) => normalizarTexto(prazo.identificador) === 'encomenda')
    || prazos.find((prazo) => normalizarTexto(prazo.titulo).includes('encomenda'))
    || [...prazos].sort((a, b) => (b.quantidade_dias || 0) - (a.quantidade_dias || 0))[0]
    || null;
};

// --- FUNÇÃO PARA CRIAR LANÇAMENTOS FINANCEIROS AUTOMÁTICOS ---
const criarLancamentosVenda = async (vendaData, taxas, vendaId) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];

    // 1. Receita Bruta da Venda
    await base44.entities.LancamentoFinanceiro.create({
      descricao: `Venda #${vendaData.numero_pedido} - ${formatarNome(vendaData.cliente_nome)}`,
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

    // 2.b Lançamento de Acréscimo/Arredondamento (se desconto for negativo)
    if (vendaData.desconto < 0) {
      await base44.entities.LancamentoFinanceiro.create({
        descricao: `Arredondamento Venda #${vendaData.numero_pedido}`,
        valor: Math.abs(vendaData.desconto),
        tipo: 'receita',
        data_vencimento: hoje,
        data_lancamento: hoje,
        pago: vendaData.status === 'Pago',
        categoria_nome: 'Vendas',
        forma_pagamento: vendaData.pagamentos?.[0]?.forma_pagamento || 'Diversos',
        status: vendaData.status === 'Pago' ? 'Pago' : 'Pendente',
        observacao: 'Acréscimo de arredondamento no PDV',
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

const medirDuracaoEtapa = async (nomeEtapa, operacao) => {
  const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    return await operacao();
  } finally {
    const fim = typeof performance !== 'undefined' ? performance.now() : Date.now();
    console.log(`[PDV] ${nomeEtapa} concluido em ${Math.round(fim - inicio)}ms`);
  }
};

const executarEmSegundoPlano = (nomeEtapa, operacao) => {
  Promise.resolve()
    .then(() => medirDuracaoEtapa(nomeEtapa, operacao))
    .catch((erro) => {
      console.error(`[PDV] Erro em ${nomeEtapa}:`, erro);
    });
};

const resolverFornecedorDoItem = (item, produtos = [], fornecedores = []) => {
  if (!item) return { fornecedor_id: null, fornecedor_nome: '' };

  const produtoCadastro = produtos.find((produto) => produto.id === item.produto_id);
  const fornecedorId = item.fornecedor_id || produtoCadastro?.fornecedor_id || null;

  let fornecedorNome = item.fornecedor_nome || produtoCadastro?.fornecedor_nome || '';

  if (!fornecedorNome && fornecedorId) {
    fornecedorNome = fornecedores.find((fornecedor) => fornecedor.id === fornecedorId)?.nome_empresa || '';
  }

  return {
    fornecedor_id: fornecedorId,
    fornecedor_nome: fornecedorNome
  };
};

const enriquecerItensEncomendaComFornecedor = (itens = [], produtos = [], fornecedores = []) =>
  itens.map((item) => {
    if (!item?.is_encomenda) return item;

    const fornecedorResolvido = resolverFornecedorDoItem(item, produtos, fornecedores);
    return {
      ...item,
      ...fornecedorResolvido
    };
  });

// Componente de checkbox personalizado para Restrições
const RestricaoCheckbox = ({ checked, onCheckedChange, label }) => (
  <div
    className="flex items-center space-x-2 cursor-pointer select-none group"
    onClick={() => onCheckedChange(!checked)}
  >
    <div className={`
      w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0
      ${checked
        ? 'bg-green-600 border-green-600 text-white'
        : 'bg-white border-gray-300 text-gray-400 group-hover:border-red-400 group-hover:text-red-400'
      }
    `}>
      {checked ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
    </div>
    <span className="text-sm font-medium leading-none text-gray-700 dark:text-gray-300">
      {label}
    </span>
  </div>
);

export default function PDV() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { state: sidebarState, isMobile } = useSidebar();

  // Ref para prevenir duplo-clique (mutex)
  const isProcessingRef = useRef(false);

  // --- ESTADO ONLINE/OFFLINE ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [vendasPendentes, setVendasPendentes] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [prazosConfig, setPrazosConfig] = useState([]);


  useEffect(() => {
    carregarVendasPendentes();
    carregarPrazos();
  }, []);

  // --- Realtime para Solicitação de Preços ---
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('pdv-solicitacoes-preco')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'solicitacoes_preco',
          filter: `vendedor_id=eq.${user.id}`
        },
        (payload) => {
          const { new: novaSolicitacao } = payload;

          if (novaSolicitacao.status === 'aprovado' || novaSolicitacao.status === 'rejeitado') {
            setItens(prevItens => {
              const newItens = [...prevItens];
              const index = newItens.findIndex(item => item.solicitacao_preco_id === novaSolicitacao.id);

              if (index !== -1) {
                if (novaSolicitacao.status === 'aprovado') {
                  newItens[index].preco_unitario = Number(novaSolicitacao.preco_sugerido);
                  newItens[index].subtotal = Number(novaSolicitacao.preco_sugerido) * (newItens[index].quantidade || 1);
                  toast.success(`Preço aprovado para ${newItens[index].produto_nome}!`);
                } else if (novaSolicitacao.status === 'rejeitado') {
                  toast.error(`Preço sugerido para ${newItens[index].produto_nome} foi rejeitado.`);
                }
                newItens[index].status_solicitacao_preco = novaSolicitacao.status;
              }
              return newItens;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handleStatusChange = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) carregarVendasPendentes();
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const carregarVendasPendentes = () => {
    const pendentes = getOfflineSales();
    setVendasPendentes(pendentes);
  };

  const carregarPrazos = async () => {
    try {
      const { data, error } = await supabase.from('prazos_entrega').select('*');
      if (error) throw error;
      setPrazosConfig(data || []);
    } catch (err) {
      console.error('Erro ao carregar prazos:', err);
    }
  };


  // Carregar estado inicial
  const getInitialState = () => {
    try {
      // 1. Tentar pegar estado de conversão de orçamento
      const orcamentoSaved = sessionStorage.getItem('moveispedroii_pdv_state');
      if (orcamentoSaved) {
        const parsed = JSON.parse(orcamentoSaved);
        // NÃO remover aqui — o componente pode re-montar (auth re-check)
        // A remoção será feita no useEffect após montagem estável

        return {
          etapa: 1, // Começa na primeira etapa para conferir itens
          clienteSelecionado: null, // Será buscado pelo ID logo em seguida através do useEffect
          itens: parsed.itens || [],
          pagamentos: parsed.pagamentos || [],
          configVenda: {
            data: new Date().toISOString().split('T')[0],
            loja: parsed.loja || "Centro",
            prazo: ""
          },
          desconto: parseFloat(parsed.desconto) || 0,
          observacoes: parsed.observacoes || "",
          pagamentoEntrega: {
            ativo: (parseFloat(parsed.valor_frete) > 0),
            valor: parseFloat(parsed.valor_frete) || 0,
            forma: ""
          },
          cidade: parsed.cidade || "",
          bairro: parsed.bairro || "",
          endereco: parsed.endereco || "",
          aguardandoLiberacao: false,
          _cliente_id_pendente: parsed.cliente_id // Guardar para buscar o objeto cliente completo
        };
      }

      // 2. Tentar pegar estado normal do PDV abandonado
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
          pagamentoEntrega: parsed.pagamentoEntrega || { ativo: false, valor: 0, forma: "" },
          aguardandoLiberacao: parsed.aguardandoLiberacao || false
        };
      }
    } catch (e) {
      console.error("Erro ao ler state", e);
    }
    return null;
  };

  const initialState = getInitialState();

  // --- ESTADOS DO PDV ---
  const [etapa, setEtapa] = useState((() => {
    // Força etapa 1 se vier de orçamento
    if (initialState?._cliente_id_pendente) return 1;
    return initialState?.etapa || 1;
  })());
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
  const [preferenciasEntrega, setPreferenciasEntrega] = useState(initialState?.preferenciasEntrega || { dias: [0, 1, 2, 3, 4, 5, 6], turnos: ['Manhã', 'Tarde', 'Comercial'], obs: "" });
  const [aguardandoLiberacao, setAguardandoLiberacao] = useState(initialState?.aguardandoLiberacao || false);
  const [modalPreferenciasOpen, setModalPreferenciasOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingOrcamento, setSavingOrcamento] = useState(false);
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [tokenGerencial, setTokenGerencial] = useState(null);
  const [editingProdutoPDV, setEditingProdutoPDV] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Flag para bloquear o auto-save enquanto dados do orçamento estão sendo carregados
  const isLoadingOrcamentoRef = useRef(false);
  const prevTodosItensSemEstoqueRef = useRef(false);

  // === DETECÇÃO DE ORÇAMENTO NO SESSIONSTORAGE ===
  // Este useEffect resolve o problema de SPA: quando o PDV já está montado
  // e o usuário navega de Orçamentos->PDV, o getInitialState não re-executa.
  // Por isso verificamos o sessionStorage a cada vez que o componente ganha foco.
  const carregarOrcamentoDoSessionStorage = async () => {
    const orcamentoSaved = sessionStorage.getItem('moveispedroii_pdv_state');
    if (!orcamentoSaved) return;

    // Bloquear auto-save para não sobrescrever com estado vazio
    isLoadingOrcamentoRef.current = true;

    try {
      const parsed = JSON.parse(orcamentoSaved);
      sessionStorage.removeItem('moveispedroii_pdv_state');

      console.log("📦 Carregando orçamento no PDV:", parsed);

      // Definir todos os estados de uma vez
      setItens(parsed.itens || []);
      setPagamentos(parsed.pagamentos || []);
      setDesconto(parseFloat(parsed.desconto) || 0);
      setObservacoes(parsed.observacoes || "");
      setEtapa(1);
      if (parsed.loja) {
        setConfigVenda(prev => ({ ...prev, loja: parsed.loja }));
      }
      setPagamentoEntrega({
        ativo: (parseFloat(parsed.valor_frete) > 0),
        valor: parseFloat(parsed.valor_frete) || 0,
        forma: ""
      });
      setAguardandoLiberacao(false);
      setCupomAplicado(null);
      setTokenGerencial(null);

      // Buscar o cliente completo pelo ID
      if (parsed.cliente_id) {
        try {
          const clienteList = await base44.entities.Cliente.list();
          const clienteObj = clienteList.find(c => c.id === parsed.cliente_id);
          if (clienteObj) {
            const clienteFinal = {
              ...clienteObj,
              cidade: parsed.cidade || clienteObj.cidade,
              bairro: parsed.bairro || clienteObj.bairro,
              endereco: parsed.endereco || clienteObj.endereco
            };
            setClienteSelecionado(clienteFinal);
          }
        } catch (e) {
          console.error("Erro ao carregar cliente do orçamento:", e);
        }
      }

      toast.success("Orçamento carregado no PDV!");
    } catch (e) {
      console.error("Erro ao parsear orçamento do sessionStorage:", e);
    } finally {
      // Liberar auto-save após um tick para os estados terem sido aplicados
      setTimeout(() => { isLoadingOrcamentoRef.current = false; }, 500);
    }
  };

  // Roda na montagem E quando o componente recebe sinal de orçamento
  useEffect(() => {
    // Limpar o sessionStorage de orçamento após montagem estável
    // (evita que o double-mount do auth consuma e perca os dados)
    const cleanupTimer = setTimeout(() => {
      sessionStorage.removeItem('moveispedroii_pdv_state');
    }, 1000);

    carregarOrcamentoDoSessionStorage();

    const handleFocus = () => carregarOrcamentoDoSessionStorage();
    window.addEventListener('focus', handleFocus);

    // Evento customizado disparado por Orcamentos.jsx/OrcamentoCard.jsx
    const handleOrcamentoEvent = () => {
      // Pequeno delay para garantir que o sessionStorage já foi escrito
      setTimeout(() => carregarOrcamentoDoSessionStorage(), 100);
    };
    window.addEventListener('orcamento-para-pdv', handleOrcamentoEvent);

    // Também verifica quando a aba/visibilidade muda
    const handleVisibility = () => {
      if (!document.hidden) carregarOrcamentoDoSessionStorage();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(cleanupTimer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('orcamento-para-pdv', handleOrcamentoEvent);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Busca o cliente completo caso tenha vindo apenas o ID do orçamento (montagem inicial)
  useEffect(() => {
    if (initialState?._cliente_id_pendente) {
      const carregarClienteOrcamento = async () => {
        try {
          const clienteList = await base44.entities.Cliente.list();
          const clienteObj = clienteList.find(c => c.id === initialState._cliente_id_pendente);
          if (clienteObj) {
            setClienteSelecionado(clienteObj);
          }
        } catch (e) {
          console.error("Erro ao carregar cliente do orçamento: ", e);
        }
      };
      carregarClienteOrcamento();
    }
  }, []);

  useEffect(() => {
    // Não salvar se estamos no meio do carregamento de um orçamento (race condition)
    if (isLoadingOrcamentoRef.current) return;
    const state = { etapa, clienteSelecionado, itens, pagamentos, configVenda, desconto, observacoes, pagamentoEntrega, preferenciasEntrega, aguardandoLiberacao };
    sessionStorage.setItem(PDV_STATE_KEY, JSON.stringify(state));
  }, [etapa, clienteSelecionado, itens, pagamentos, configVenda, desconto, observacoes, pagamentoEntrega, preferenciasEntrega, aguardandoLiberacao]);

  useEffect(() => {
    if (user && !initialState) {
      // Tenta setar a loja do usuário como padrão. 
      // O texto "Centro" é apenas o último fallback caso o usuário não tenha loja definida.
      const defaultLoja = user.loja || "Centro";
      setConfigVenda(prev => ({ ...prev, loja: defaultLoja }));
    }
  }, [user]);

  // --- REALTIME UPDATES: PRODUTOS ---
  useEffect(() => {
    // Só conecta se estiver online
    if (!isOnline) return;

    console.log("🔌 Conectando ao Realtime de Produtos...");

    const channel = supabase
      .channel('pdv-produtos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produtos' },
        (payload) => {
          const newProduto = payload.new;

          if (payload.eventType === 'DELETE') {
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            return;
          }

          console.log("🔄 Produto atualizado em realtime:", newProduto?.nome || payload.eventType);

          // 1. Atualiza o cache da lista de produtos (para a busca encontrar o preço novo)
          queryClient.invalidateQueries({ queryKey: ['produtos'] });

          // 2. Atualiza os itens que já estão no carrinho
          setItens(prevItens => {
            const hasItem = prevItens.some(i => i.produto_id == newProduto.id); // Loose equality for ID
            if (!hasItem) return prevItens;

            return prevItens.map(item => {
              if (item.produto_id == newProduto.id) {
                const novoPreco = parseFloat(newProduto.preco_venda);

                // Só notifica/atualiza se o preço realmente mudou
                if (item.preco_unitario !== novoPreco) {
                  toast.info(`Preço atualizado: ${newProduto.nome} agora é R$ ${novoPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

                  return {
                    ...item,
                    preco_unitario: novoPreco,
                    subtotal: item.quantidade * novoPreco
                  };
                }
              }
              return item;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, queryClient]);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list()
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
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

  const { data: taxasFinanceiras = [] } = useQuery({
    queryKey: ['configuracao_taxas'],
    queryFn: () => base44.entities.ConfiguracaoTaxa.list(),
    enabled: isOnline
  });

  // Buscar fornecedores (para validação de encomendas)
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list(),
    enabled: isOnline
  });

  const montarAtualizacaoEstoqueProduto = (produto, quantidadeLocalAtualizada, lojaNome) => {
    const campoLoja = resolveStockField(lojaNome);

    if (!campoLoja) {
      throw new Error('Nao foi possivel determinar a unidade de estoque do PDV.');
    }

    const produtoAtualizado = {
      ...produto,
      [campoLoja]: Math.max(0, quantidadeLocalAtualizada || 0)
    };

    return {
      [campoLoja]: produtoAtualizado[campoLoja],
      quantidade_estoque: getProductTotalStock(produtoAtualizado)
    };
  };

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
        const { offlineId, ...dadosVenda } = vendaOffline;
        delete dadosVenda.timestamp; // campo de metadado offline, não é campo da entidade Venda
        const vendaCriada = await criarVendaMutation.mutateAsync(dadosVenda);

        const itensVenda = dadosVenda.itens || [];
        for (const item of itensVenda) {
          if (item.is_encomenda || !item.produto_id) continue;

          const produtoAtual = await base44.entities.Produto.getById(item.produto_id);
          if (!produtoAtual) continue;

          const campoLoja = resolveStockField(dadosVenda.loja);
          const estoqueLocalAposVenda = Math.max(0, (produtoAtual[campoLoja] || 0) - (item.quantidade || 0));
          const updates = montarAtualizacaoEstoqueProduto(produtoAtual, estoqueLocalAposVenda, dadosVenda.loja);

          await base44.entities.Produto.update(item.produto_id, updates);
        }

        const itensEncomendaComFornecedor = enriquecerItensEncomendaComFornecedor(itensVenda, produtos, fornecedores);
        const itensEncomenda = itensEncomendaComFornecedor.filter(i => i.is_encomenda);
        const itensEncomendaInvalidos = itensEncomenda.filter(i => !i.fornecedor_id);
        const itensEncomendaValidos = itensEncomenda.filter(i => i.fornecedor_id);

        if (itensEncomendaInvalidos.length > 0) {
          console.warn('[PDV] Encomendas offline sem fornecedor foram ignoradas na sincronizacao', itensEncomendaInvalidos);
          toast.warning(`⚠️ ${itensEncomendaInvalidos.length} encomenda(s) sem fornecedor nao foram enviadas ao Compras. Conclua o cadastro dos produtos com fornecedor.`);
        }

        for (const item of itensEncomendaValidos) {
          await base44.entities.SolicitacaoEncomenda.create({
            venda_id: vendaCriada.id,
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            fornecedor_id: item.fornecedor_id || null,
            fornecedor_nome: item.fornecedor_nome || '',
            quantidade: item.quantidade,
            cliente_nome: dadosVenda.cliente_nome,
            numero_pedido: dadosVenda.numero_pedido,
            loja: dadosVenda.loja,
            loja_id: dadosVenda.loja_id || null,
            vendedor_id: dadosVenda.responsavel_id || user?.id || null,
            vendedor_nome: dadosVenda.responsavel_nome || user?.full_name || user?.email || null,
            status: 'pendente'
          });
        }

        // Tenta enviar mensagem do robô também na sincronização
        if (dadosVenda.cliente_telefone) {
          fetch(`${ZAP_API_URL}/mensagem-pos-venda`, {
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

    const fornecedorResolvido = resolverFornecedorDoItem({
      produto_id: produto.id,
      fornecedor_id: produto.fornecedor_id,
      fornecedor_nome: produto.fornecedor_nome
    }, produtos, fornecedores);

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
        newItens[exists].fornecedor_id = newItens[exists].fornecedor_id || fornecedorResolvido.fornecedor_id;
        newItens[exists].fornecedor_nome = newItens[exists].fornecedor_nome || fornecedorResolvido.fornecedor_nome;
        return newItens;
      }

      return [...prev, {
        produto_id: produto.id,
        produto_nome: `${produto.nome}${produto.modelo_referencia ? ' ' + produto.modelo_referencia : ''}`,
        quantidade: 1,
        preco_unitario: produto.preco_venda,
        subtotal: produto.preco_venda,
        fotos: produto.fotos || [], // Add fotos
        tipo_entrega: null, // null | 'entrega' | 'retira'
        tipo_montagem: null, // null | 'montado' | 'montagem_cliente'
        tipo_entrega_padrao: produto.tipo_entrega_padrao, // Salvar para usar no carrinho
        tipo_montagem_padrao: produto.tipo_montagem_padrao || null,
        tipo_montagem_padrao_por: produto.tipo_montagem_padrao_por || null,
        tipo_montagem_padrao_em: produto.tipo_montagem_padrao_em || null,
        tipo_montagem_padrao_via: produto.tipo_montagem_padrao_via || null,
        origem: produto.origem, // Store origin used for delivery flagging
        // Preserve metadata for provisional products
        is_solicitacao: produto.is_solicitacao,
        solicitacao_id: produto.solicitacao_id,
        detalhes_solicitacao: produto.detalhes_solicitacao,
        // Encomenda flag
        is_encomenda: produto.is_encomenda || false,
        fornecedor_id: fornecedorResolvido.fornecedor_id,
        fornecedor_nome: fornecedorResolvido.fornecedor_nome
      }];
    });
  };

  const handleVincularImagem = async (index, imageUrl) => {
    try {
      const item = itens[index];
      const produtoId = item.produto_id || item.id;

      // Update in database
      await base44.entities.Produto.update(produtoId, {
        fotos: [imageUrl]
      });

      // Update in cart immediately
      setItens(prev => {
        const newItens = [...prev];
        newItens[index].fotos = [imageUrl];
        return newItens;
      });

      // Update react query cache for the product search
      queryClient.invalidateQueries(['produtos']);

      return true;
    } catch (error) {
      console.error('Erro ao vincular imagem:', error);
      throw error;
    }
  };

  const handleEditProdutoPDV = (item) => {
    // Buscar o produto real da lista para ter todos os metadados (categoria, dimensões, etc)
    const produtoCompleto = produtos.find(p => p.id === item.produto_id);
    if (!produtoCompleto) {
      toast.error("Não foi possível encontrar os dados completos do produto.");
      return;
    }
    setEditingProdutoPDV(produtoCompleto);
    setIsEditModalOpen(true);
  };

  const handleSaveEditProdutoPDV = async (updatedData) => {
    try {
      // 1. Determine what changed for the Audit Log (before applying the update)
      const changes = {};
      Object.keys(updatedData).forEach(key => {
        // Ignorar o array "variacoes" se for muito complexo ou faça stringify
        if (JSON.stringify(updatedData[key]) !== JSON.stringify(editingProdutoPDV[key])) {
          changes[key] = {
            before: editingProdutoPDV[key],
            after: updatedData[key]
          };
        }
      });

      // 2. Update the product in the database
      await base44.entities.Produto.update(editingProdutoPDV.id, updatedData);

      // 3. Register Audit Log if there were changes
      if (Object.keys(changes).length > 0 && user) {
        try {
          await base44.entities.AuditLog.create({
            user_email: user.email,
            user_name: user.full_name || user.nome,
            user_cargo: user.cargo,
            action: 'UPDATE',
            entity_type: 'Produto',
            entity_id: editingProdutoPDV.id,
            entity_description: `Produto Atualizado via PDV (ID: ${editingProdutoPDV.id}) - ${updatedData.nome || editingProdutoPDV.nome}`,
            changes: changes,
            timestamp: new Date().toISOString()
          });
        } catch (logErr) {
          console.error("Failed to write audit log:", logErr);
        }
      }

      // 4. Update cart items if the edited product is already in the cart
      setItens(prevItens =>
        prevItens.map(item => {
          if (item.produto_id === editingProdutoPDV.id) {
            return {
              ...item,
              produto_nome: `${updatedData.nome || item.produto_nome}${updatedData.modelo_referencia ? ' ' + updatedData.modelo_referencia : ''}`,
              preco_unitario: updatedData.preco_venda || item.preco_unitario
            };
          }
          return item;
        })
      );

      // 5. Invalidate queries and close modal
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setIsEditModalOpen(false);
      setEditingProdutoPDV(null);
      toast.success("Produto atualizado com sucesso!");
    } catch (error) {
      console.error("Error saving product from PDV:", error);
      toast.error("Erro ao atualizar o produto: " + error.message);
    }
  };

  const handleAtualizarEstoque = async (index, novaQuantidade, estoqueAposVenda) => {
    try {
      const item = itens[index];
      const produtoId = item.produto_id || item.id;
      const produtoAtual = produtos.find(produto => produto.id === produtoId);

      if (!produtoAtual) {
        throw new Error('Produto nao encontrado para atualizar o estoque.');
      }

      const updates = montarAtualizacaoEstoqueProduto(produtoAtual, estoqueAposVenda, configVenda.loja);

      await base44.entities.Produto.update(produtoId, updates);

      // Atualizar o item do carrinho com informações de quem e quando atualizou
      setItens(prev => {
        const newItens = [...prev];
        newItens[index].estoque_atualizado_por = user?.full_name || user?.nome || 'Desconhecido';
        newItens[index].estoque_atualizado_em = new Date().toISOString();
        return newItens;
      });

      // Atualizar a lista de produtos em cache
      queryClient.invalidateQueries(['produtos']);

      return true;
    } catch (error) {
      console.error('Erro ao atualizar estoque:', error);
      throw error;
    }
  };

  const handleToggleEntrega = (index, tipo) => {
    setItens(prev => {
      const newItens = [...prev];
      newItens[index].tipo_entrega = tipo;
      // Se mudar para 'retira', limpa a seleção de montagem
      if (tipo === 'retira') {
        newItens[index].tipo_montagem = null;
      }
      // Se mudar para 'entrega'
      if (tipo === 'entrega') {
        if (newItens[index].tipo_entrega_padrao === 'nao_requer_montagem') {
          newItens[index].tipo_montagem = null; // não precisa de montagem
        } else if (newItens[index].tipo_montagem_padrao) {
          // Preenche com o padrão se existir
          newItens[index].tipo_montagem = newItens[index].tipo_montagem_padrao;
        }
      }
      return newItens;
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

  const handleAtualizarQuantidadeItem = (index, novaQuantidade) => {
    const quantidadeSegura = parseInt(novaQuantidade, 10);
    if (!Number.isFinite(quantidadeSegura) || quantidadeSegura < 1) return;

    setItens(prev => {
      const newItens = [...prev];
      const itemAtual = newItens[index];
      if (!itemAtual) return prev;

      newItens[index] = {
        ...itemAtual,
        quantidade: quantidadeSegura,
        subtotal: quantidadeSegura * (itemAtual.preco_unitario || 0)
      };

      return newItens;
    });
  };

  const handleSetMontagemPadrao = async (index, produtoId, tipoMontagem) => {
    try {
      const now = new Date().toISOString();
      const payload = {
        tipo_montagem_padrao: tipoMontagem,
        tipo_montagem_padrao_por: user?.full_name || 'Usuário Desconhecido',
        tipo_montagem_padrao_em: now,
        tipo_montagem_padrao_via: 'PDV'
      };

      // 1. Atualizar no banco de dados
      const { error } = await supabase
        .from('produtos')
        .update(payload)
        .eq('id', produtoId);

      if (error) throw error;

      // 2. Atualizar o item no carrinho atual para que o botão desapareça
      setItens(prev => {
        const newItens = [...prev];
        newItens[index].tipo_montagem_padrao = tipoMontagem;
        newItens[index].tipo_montagem_padrao_por = payload.tipo_montagem_padrao_por;
        newItens[index].tipo_montagem_padrao_em = payload.tipo_montagem_padrao_em;
        newItens[index].tipo_montagem_padrao_via = payload.tipo_montagem_padrao_via;
        return newItens;
      });

      // 3. Atualizar o cache de produtos para próximas adições
      queryClient.setQueryData(['produtos'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(p =>
          p.id === produtoId ? { ...p, ...payload } : p
        );
      });

      toast.success(`Definido como padrão com sucesso!`);
    } catch (err) {
      console.error('Erro ao salvar padrão de montagem:', err);
      toast.error('Erro ao salvar preferência. Tente novamente.');
    }
  };

  const subtotal = itens.reduce((acc, item) => acc + item.subtotal, 0);
  const total = Math.max(0, subtotal - desconto);
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const restante = Math.max(0, total - totalPago);

  // Verdadeiro quando TODOS os itens são retirada na loja
  // Usado para esconder campos irrelevantes (prazo, preferências, aguardar liberação)
  const todosRetiram = itens.length > 0 && itens.every(i => i.tipo_entrega === 'retira');
  const temEncomenda = itens.some(i => i.is_encomenda);
  const todosItensSemEstoque = itens.length > 0 && itens.every(i => i.is_encomenda);
  const conclusaoAutomatica = todosRetiram && !temEncomenda;
  const prazoEncomendaConfigurado = obterPrazoEncomenda(prazosConfig);
  const prazoEncomendaAutomatico = formatarPrazoEntrega(prazoEncomendaConfigurado);

  useEffect(() => {
    const entrouEmCarrinhoSemEstoque = todosItensSemEstoque && !prevTodosItensSemEstoqueRef.current;
    prevTodosItensSemEstoqueRef.current = todosItensSemEstoque;

    if (todosRetiram || !prazoEncomendaAutomatico || !todosItensSemEstoque) return;
    if (!entrouEmCarrinhoSemEstoque && configVenda.prazo) return;

    setConfigVenda((prev) => {
      if (prev.prazo === prazoEncomendaAutomatico) return prev;
      return { ...prev, prazo: prazoEncomendaAutomatico };
    });
  }, [todosItensSemEstoque, todosRetiram, prazoEncomendaAutomatico, configVenda.prazo]);

  // Helper: obter o tipo_montagem final para uso downstream
  const getTipoMontagemFinal = (item) => {
    if (item.tipo_entrega === 'retira') return 'retira';
    if (item.tipo_entrega === 'entrega') {
      if (item.tipo_entrega_padrao === 'nao_requer_montagem') return 'sem_montagem';
      return item.tipo_montagem; // 'montado' | 'montagem_cliente' | 'sem_montagem'
    }
    return null;
  };

  const podeAvancar = () => {
    return getMotivoBloqueioBotao() === null;
  };
  const getMotivoBloqueioBotao = () => {
    if (etapa === 1) {
      if (itens.length === 0) return 'Adicione produtos ao carrinho';
      const semEntrega = itens.filter(i => !i.tipo_entrega);
      if (semEntrega.length > 0) return `${semEntrega.length} item(ns) sem tipo de entrega`;
      const semPreco = itens.filter(i => !i.preco_unitario || i.preco_unitario <= 0);
      if (semPreco.length > 0) return `${semPreco.length} item(ns) com preço inválido`;
      const precoPendente = itens.filter(i => i.status_solicitacao_preco === 'pendente');
      if (precoPendente.length > 0) return `${precoPendente.length} item(ns) com preço pendente`;
      const semMontagem = itens.filter(i =>
        i.tipo_entrega === 'entrega' &&
        i.tipo_entrega_padrao !== 'nao_requer_montagem' &&
        !i.tipo_montagem
      );
      if (semMontagem.length > 0) return `${semMontagem.length} item(ns) sem tipo de montagem`;
    }
    if (etapa === 2) {
      if (!clienteSelecionado) return 'Selecione um cliente';
      if (!todosRetiram && !configVenda.prazo) return 'Defina o prazo de entrega';
    }
    return null;
  };

  const avancarEtapa = () => {
    if (etapa === 1) {
      if (itens.length === 0) return toast.warning("Adicione pelo menos um produto");

      const itensSemEntrega = itens.filter(i => !i.tipo_entrega);
      if (itensSemEntrega.length > 0) {
        return toast.warning("Escolha o tipo de entrega para todos os itens");
      }

      const itensSemMontagem = itens.filter(i =>
        i.tipo_entrega === 'entrega' &&
        i.tipo_entrega_padrao !== 'nao_requer_montagem' &&
        !i.tipo_montagem
      );
      if (itensSemMontagem.length > 0) {
        return toast.warning("Escolha o tipo de montagem para os itens com entrega");
      }

      const itensSemPreco = itens.filter(i => !i.preco_unitario || i.preco_unitario <= 0);
      if (itensSemPreco.length > 0) {
        return toast.error(`Existem ${itensSemPreco.length} produto(s) com preço inválido (R$ 0 ou indefinido). Solicite a revisão do preço a um supervisor .`);
      }

      const itensComSolicitacaoPendente = itens.filter(i => i.status_solicitacao_preco === 'pendente');
      if (itensComSolicitacaoPendente.length > 0) {
        return toast.error(`Existem ${itensComSolicitacaoPendente.length} produto(s) com solicitação de preço pendente. Aguarde a aprovação ou ajuste o preço.`);
      }
    }
    if (etapa === 2) {
      if (!clienteSelecionado) return toast.warning("Selecione um cliente");
      if (!todosRetiram && !configVenda.prazo) return toast.warning("Selecione o prazo de entrega");
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

    const itensSemPrecoFinal = itens.filter(i => !i.preco_unitario || i.preco_unitario <= 0);
    if (itensSemPrecoFinal.length > 0) {
      isProcessingRef.current = false;
      setLoading(false);
      return toast.error("A venda contém itens com preço inválido (R$ 0 ou indefinido). Solicite a revisão do preço a um supervisor .");
    }
    if (!todosRetiram && !configVenda.prazo) {
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

    // --- VALIDAÇÃO DE ENDEREÇO OBRIGATÓRIO ---
    // Se algum item requer entrega, o cliente precisa ter endereço
    const temEntrega = itens.some(i => i.tipo_entrega === 'entrega');
    if (temEntrega) {
      const enderecoCompleto = construirEnderecoEntrega(clienteSelecionado);
      if (!enderecoCompleto || enderecoCompleto === "Endereço a definir") {
        isProcessingRef.current = false;
        setLoading(false);
        return toast.error("Endereço obrigatório para entrega. Cadastre o endereço do cliente.");
      }
    }


    // 🖨️ ABRIR JANELA DE IMPRESSÃO AGORA (antes de qualquer operação async)
    // O navegador só permite window.open() direto no evento de clique.
    // Se movermos para depois das operações do banco, o popup é bloqueado.
    const printWindow = prepararNotaPedidoPDF();
    const atualizarProgressoPedido = (step, progress, label = 'Finalizando pedido...') => {
      atualizarStatusNotaPedidoPDF(printWindow, { label, step, progress });
    };

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

    // Garantir que pedidos online comecem a partir de 10000
    if (isOnline && lastNum < 10000) {
      lastNum = 9999; // Assim o próximo (lastNum + 1) será 10000
    }

    let novoNumero = isOnline
      ? String(lastNum + 1).padStart(5, '0')
      : `O-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;

    const formaPagamentoEntregaStr = pagamentoEntrega.ativo
      ? (pagamentoEntrega.forma === "Cartão de Crédito" || pagamentoEntrega.forma?.includes("Crédito")
        ? `${pagamentoEntrega.forma} (${pagamentoEntrega.parcelas || 1}x)`
        : pagamentoEntrega.forma || "")
      : "";

    // --- MAPEAMENTO DE LOJA_ID ---
    // Buscamos o ID da loja com base no nome selecionado em configVenda.loja
    const lojaObj = (lojas || []).find(l => l.nome === configVenda.loja);
    const lojaId = lojaObj?.id || user?.loja_id || null;

    const itensComFornecedorResolvido = enriquecerItensEncomendaComFornecedor(itens, produtos, fornecedores);
    const itensEncomenda = itensComFornecedorResolvido.filter(i => i.is_encomenda);
    const itensEncomendaInvalidos = itensEncomenda.filter(i => !i.fornecedor_id);

    if (itensEncomendaInvalidos.length > 0) {
      const nomes = itensEncomendaInvalidos
        .map(i => i.produto_nome)
        .filter(Boolean)
        .join(', ');

      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }

      toast.error(`Fornecedor obrigatorio para encomenda. Conclua o cadastro do produto e informe o fornecedor para: ${nomes}`);
      setLoading(false);
      isProcessingRef.current = false;
      return;
    }

    const vendaData = {
      numero_pedido: novoNumero,
      data_venda: configVenda.data,
      loja: configVenda.loja,
      loja_id: lojaId, // Adicionado campo vital para relatórios
      responsavel_id: user.id,
      responsavel_nome: user.full_name,
      cliente_id: clienteSelecionado.id,
      cliente_nome: clienteSelecionado.nome_completo,
      cliente_telefone: clienteSelecionado.telefone,
      itens: itensComFornecedorResolvido,
      valor_total: total,
      desconto,
      pagamentos,
      valor_pago: totalPago,
      valor_restante: restante,
      pagamento_na_entrega: pagamentoEntrega.ativo,
      valor_pagamento_entrega: pagamentoEntrega.ativo ? pagamentoEntrega.valor : 0,
      forma_pagamento_entrega: formaPagamentoEntregaStr,
      prazo_entrega: configVenda.prazo,
      status: restante <= 0 ? "Pago" : "Pagamento Pendente",
      observacoes: observacoes,
      cupom_codigo: cupomAplicado?.codigo || null,
      cupom_desconto: cupomAplicado ? desconto : 0,
      triagem_realizada: todosRetiram,
      data_triagem: todosRetiram ? new Date().toISOString() : null
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
      isProcessingRef.current = false;
      return;
    }

    try {
      atualizarProgressoPedido('Salvando venda...', 18);
      const vendaCriada = await medirDuracaoEtapa('criar venda', () =>
        criarVendaMutation.mutateAsync(vendaData)
      );

      atualizarProgressoPedido('Atualizando estoque...', 36);
      const itensSemEncomenda = itens.filter(item => !item.is_encomenda);
      const atualizarEstoquePromise = medirDuracaoEtapa('atualizar estoque', () =>
        Promise.all(itensSemEncomenda.map(async (item) => {
          const prod = produtos.find(p => p.id === item.produto_id);
          if (!prod) return null;

          const campoLoja = resolveStockField(configVenda.loja);
          const estoqueLocalAposVenda = Math.max(0, (prod[campoLoja] || 0) - item.quantidade);
          const updates = montarAtualizacaoEstoqueProduto(prod, estoqueLocalAposVenda, configVenda.loja);

          return base44.entities.Produto.update(prod.id, updates);
        }))
      );

      // Calcular prazo de entrega com base na configuração
      const prazoSelecionado = encontrarPrazoConfigurado(prazosConfig, configVenda.prazo);
      const dias = prazoSelecionado ? prazoSelecionado.quantidade_dias : 15;
      const tipoDias = prazoSelecionado ? prazoSelecionado.tipo_dias : 'uteis';
      const limite = adicionarDias(configVenda.data, dias, tipoDias);

      const enderecoCompleto = temEntrega ? construirEnderecoEntrega(clienteSelecionado) : `Retirado na loja: ${configVenda.loja}`;
      const todosRetiram = itens.every(i => i.tipo_entrega === 'retira');

      const itensParaMontagemInterna = itens
        .filter(i => getTipoMontagemFinal(i) === 'montado')
        .map(i => ({
          produto_nome: i.produto_nome,
          quantidade: i.quantidade,
          montado: false
        }));

      atualizarProgressoPedido('Criando entrega...', 56);
      const entregaCriada = await medirDuracaoEtapa('criar entrega', () =>
        base44.entities.Entrega.create({
          venda_id: vendaCriada.id,
          numero_pedido: novoNumero,
          cliente_nome: clienteSelecionado.nome_completo,
          cliente_telefone: clienteSelecionado.telefone,
          endereco_entrega: enderecoCompleto,
          data_limite: todosRetiram ? new Date().toISOString().split('T')[0] : limite.toISOString().split('T')[0],
          prazo_entrega: configVenda.prazo,
          status: todosRetiram
            ? (conclusaoAutomatica && restante <= 0 ? 'Entregue' : 'Retirado')
            : (aguardandoLiberacao ? 'Aguardando Liberação' : 'Pendente'),
          tipo_montagem: itens.length === 1 ? getTipoMontagemFinal(itens[0]) : 'Múltiplos Itens',
          montagem_status: (itens.some(i => {
            const tf = getTipoMontagemFinal(i);
            return tf === 'montado' || tf === 'montagem_cliente';
          })) ? 'Pendente' : null,
          itens_montagem_interna: itensParaMontagemInterna,
          pagamento_na_entrega: pagamentoEntrega.ativo,
          valor_a_receber: pagamentoEntrega.ativo ? pagamentoEntrega.valor : 0,
          forma_pagamento_entrega: pagamentoEntrega.ativo ? formaPagamentoEntregaStr : null,
          preferencias_entrega: preferenciasEntrega,
          loja_id: lojaId,
          vendedor_id: user.id
        })
      );

      const montagensParaCriar = itens
        .map((item) => {
          const tipoFinal = getTipoMontagemFinal(item);

          if (tipoFinal === 'montagem_cliente') {
            return {
              entrega_id: entregaCriada.id,
              venda_id: vendaCriada.id,
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              quantidade: item.quantidade,
              tipo_montagem: 'terceirizada',
              status: 'pendente',
              cliente_nome: clienteSelecionado.nome_completo,
              cliente_telefone: clienteSelecionado.telefone,
              endereco: enderecoCompleto,
              numero_pedido: novoNumero
            };
          }

          if (tipoFinal === 'montado') {
            return {
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
            };
          }

          return null;
        })
        .filter(Boolean);

      atualizarProgressoPedido('Registrando itens de montagem...', 72);
      const criarMontagensPromise = montagensParaCriar.length > 0
        ? medirDuracaoEtapa('criar montagens', () =>
          Promise.all(montagensParaCriar.map((payload) => base44.entities.MontagemItem.create(payload)))
        )
        : Promise.resolve([]);

      await Promise.all([atualizarEstoquePromise, criarMontagensPromise]);

      // Invalidar queries após TODAS as operações serem concluídas
      atualizarProgressoPedido('Atualizando paineis...', 88);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vendas'] }),
        queryClient.invalidateQueries({ queryKey: ['produtos'] }),
        queryClient.invalidateQueries({ queryKey: ['entregas'] }),
        queryClient.invalidateQueries({ queryKey: ['montagens'] }),
        queryClient.invalidateQueries({ queryKey: ['clientes'] }),
        queryClient.invalidateQueries({ queryKey: ['lojas'] })
      ]);

      // 4. IMPRESSÃO
      atualizarProgressoPedido('Preparando impressao...', 96);
      preencherEImprimirPDF(printWindow, { ...vendaData }, clienteSelecionado, user.full_name);

      toast.success("Venda finalizada com sucesso!");

      if (itensEncomenda.length > 0) {
        executarEmSegundoPlano('criar solicitações de encomenda', async () => {
          const resultados = await Promise.allSettled(itensEncomenda.map((item) =>
            base44.entities.SolicitacaoEncomenda.create({
              venda_id: vendaCriada.id,
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              fornecedor_id: item.fornecedor_id || null,
              fornecedor_nome: item.fornecedor_nome || '',
              quantidade: item.quantidade,
              cliente_nome: clienteSelecionado.nome_completo,
              numero_pedido: novoNumero,
              loja: configVenda.loja,
              loja_id: lojaId,
              vendedor_id: user?.id || null,
              vendedor_nome: user?.full_name || user?.email || null,
              status: 'pendente'
            })
          ));

          const falhas = resultados.filter((resultado) => resultado.status === 'rejected');
          if (falhas.length > 0) {
            console.error('Erro ao criar solicitações de encomenda:', falhas);
            toast.warning(`Venda concluida, mas ${falhas.length} encomenda(s) precisarao de revisao no Compras.`);
          } else {
            toast.info(`📦 ${itensEncomenda.length} item(ns) enviado(s) como encomenda ao Setor de Compras`);
          }

          await queryClient.invalidateQueries({ queryKey: ['solicitacoes_encomenda'] });
        });
      }

      if (cupomAplicado) {
        executarEmSegundoPlano('atualizar uso de cupom', async () => {
          await base44.entities.Cupom.update(cupomAplicado.id, {
            quantidade_usada: (cupomAplicado.quantidade_usada || 0) + 1
          });
        });
      }

      if (tokenGerencial) {
        executarEmSegundoPlano('registrar uso de token gerencial', async () => {
          await base44.entities.TokenGerencial.update(tokenGerencial.id, {
            usos_realizados: (tokenGerencial.usos_realizados || 0) + 1
          });

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
        });
      }

      executarEmSegundoPlano('criar lançamentos financeiros', async () => {
        await criarLancamentosVenda(vendaData, taxasFinanceiras, vendaCriada.id);
        await queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
      });

      executarEmSegundoPlano('processar fidelidade', async () => {
        const resultadoFidelidade = await processarFidelidadeCompra(
          clienteSelecionado,
          total,
          vendaData.numero_pedido
        );

        if (resultadoFidelidade?.coroasGanhas > 0) {
          console.log(`👑 Cliente ganhou ${resultadoFidelidade.coroasGanhas} Coroas!`);
        }

        await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      });

      // Captura variáveis para o closure do timeout antes do resetForm
      const zapTelefone = clienteSelecionado.telefone;
      const zapNome = clienteSelecionado.nome_completo;
      const zapPedido = novoNumero;
      const zapPrazo = configVenda.prazo;
      const zapItens = [...itens]; // Copia array

      // Limpa o PDV para próxima venda
      resetForm();

      // 5. ENVIO WHATSAPP EM "BACKGROUND" (Delay para não competir com renderização do print)
      if (zapTelefone) {
        toast.info("Emissão concluída. Tentando enviar comprovante pelo WhatsApp...");

        setTimeout(async () => {
          try {
            // Função para limpar nome do produto
            const limparNomeProduto = (nome) => {
              if (!nome) return '-';
              return nome
                .replace(/^\[SOLICITAÇÃO\]\s*/i, '')
                .replace(/^\[PENDENTE CADASTRO\]\s*/i, '');
            };

            // Formata lista de produtos
            const listaProdutos = zapItens.map(item => `• ${item.quantidade}x ${limparNomeProduto(item.produto_nome)}`).join('\n');

            console.log("📄 Gerando PDF para WhatsApp em background...");
            let pdfBase64 = null;
            try {
              // Nota: vendaData ainda está acessível no closure
              pdfBase64 = await gerarNotaPedidoBase64(vendaData, { ...clienteSelecionado }, user.full_name);

              if (pdfBase64) {
                console.log(`📄 PDF gerado com sucesso (${pdfBase64.length} bytes)`);
              } else {
                console.warn('⚠️ Falha ao gerar PDF base64 (retornou null)');
              }
            } catch (pdfErr) {
              console.error('Erro na geração do PDF background:', pdfErr);
            }

            // Envia para o Bot (com fallback offline automático)
            await whatsappService.sendSaleConfirmation({
              telefone: zapTelefone,
              nome: zapNome,
              pedido: zapPedido,
              prazo: zapPrazo,
              produtos: listaProdutos,
              pdf_base64: pdfBase64
            });

          } catch (bgErr) {
            console.error("Erro fatal no processo de background:", bgErr);
          }
        }, 1500); // 1.5s delay para garantir que o print dialog já abriu
      }

    } catch (err) {
      sinalizarErroNotaPedidoPDF(printWindow, 'A venda nao foi concluida. Verifique a conexao e tente novamente.');
      console.error(err);
      toast.error("Erro ao finalizar venda online. Verifique sua conexão.");
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleOrcamento = async (diasValidade = 30) => {
    if (!clienteSelecionado) return toast.warning("Selecione um cliente");
    if (!isOnline) return toast.warning("Orçamentos só podem ser salvos online.");

    setSavingOrcamento(true);
    try {
      const numero = String(Date.now()).slice(-5);
      await criarOrcamentoMutation.mutateAsync({
        numero_orcamento: numero,
        data_orcamento: configVenda.data,
        validade: new Date(Date.now() + diasValidade * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        loja: configVenda.loja,
        cliente_id: clienteSelecionado.id,
        cliente_nome: clienteSelecionado.nome_completo,
        cliente_telefone: clienteSelecionado.telefone,
        itens,
        valor_total: total,
        desconto,
        pagamentos,
        cidade: clienteSelecionado.cidade || "",
        bairro: clienteSelecionado.bairro || "",
        endereco: clienteSelecionado.endereco || "",
        valor_frete: pagamentoEntrega.ativo ? pagamentoEntrega.valor : 0,
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
    setPreferenciasEntrega({ dias: [0, 1, 2, 3, 4, 5, 6], turnos: ['Manhã', 'Tarde', 'Comercial'], obs: "" });
    setAguardandoLiberacao(false);
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
                <BuscaProdutoAvancada produtos={produtos} fornecedores={fornecedores} onSelectProduto={(p) => handleSelectProduto(p.is_solicitacao || p.is_encomenda ? p : p.id)} onEditProduto={handleEditProdutoPDV} user={user} />
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Carrinho ({itens.length})</h3>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Subtotal</p>
                    <p className="text-lg font-bold text-green-700">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <CarrinhoVenda
                  itens={itens}
                  onRemoveItem={handleRemoveItem}
                  onAtualizarQuantidade={handleAtualizarQuantidadeItem}
                  onToggleEntrega={handleToggleEntrega}
                  onToggleMontagem={handleToggleMontagem}
                  onSetMontagemPadrao={handleSetMontagemPadrao}
                  onVincularImagem={handleVincularImagem}
                  onEditProduto={handleEditProdutoPDV}
                  onAtualizarEstoque={handleAtualizarEstoque}
                />
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
                  {/* Prazo só aparece se houver pelo menos um item com entrega */}
                  {!todosRetiram && (
                    <div>
                      <Label className="text-xs mb-1.5 block font-medium">
                        Prazo de Entrega <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={configVenda.prazo}
                        onValueChange={v => setConfigVenda({ ...configVenda, prazo: v })}
                      >
                        <SelectTrigger className={`h-10 text-sm ${!configVenda.prazo ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {prazosConfig.map(p => {
                            const label = formatarPrazoEntrega(p);
                            return (
                              <SelectItem key={p.id} value={label}>
                                {label}
                              </SelectItem>
                            );
                          })}
                          <SelectItem value="Retirado na loja">Retirado na loja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Badge informativo quando todos os itens são retirada */}
                {todosRetiram && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-800 dark:text-green-300 text-sm">
                    <Store className="w-4 h-4 shrink-0" />
                    <span><strong>Retirada na loja</strong> — nenhuma configuração de entrega necessária.</span>
                  </div>
                )}

                {/* Opção Aguardando Liberação — só para pedidos com entrega */}
                {!todosRetiram && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="aguardar-liberacao"
                        checked={aguardandoLiberacao}
                        onCheckedChange={setAguardandoLiberacao}
                      />
                      <Label htmlFor="aguardar-liberacao" className="text-sm cursor-pointer text-blue-800 dark:text-blue-300">
                        <strong>Aguardar Liberação</strong>
                        <p className="text-xs opacity-70">Marque se o cliente pediu para segurar a entrega (ex: obra)</p>
                      </Label>
                    </div>
                    {aguardandoLiberacao && <Badge className="bg-blue-500">Ativado</Badge>}
                  </div>
                )}

                {/* Botão de Restrições de Entrega — só para pedidos com entrega */}
                {!todosRetiram && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModalPreferenciasOpen(true)}
                      className={`w-full justify-between ${(preferenciasEntrega.dias.length > 0 || preferenciasEntrega.turnos.length > 0 || preferenciasEntrega.obs) ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Preferências de Entrega / Restrições
                      </span>
                      {(preferenciasEntrega.dias.length > 0 || preferenciasEntrega.turnos.length > 0 || preferenciasEntrega.obs) && (
                        <Badge variant="secondary" className="bg-amber-200 text-amber-800 border-amber-300 hover:bg-amber-200">
                          Definido
                        </Badge>
                      )}
                    </Button>
                  </div>
                )}

                {/* Modal de Preferências */}
                <Dialog open={modalPreferenciasOpen} onOpenChange={setModalPreferenciasOpen}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Restrições de Entrega</DialogTitle>
                      <DialogDescription>
                        Informe quando o cliente <strong>PODE</strong> receber.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-3">
                        <Label>Dias da Semana Permitidos</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => (
                            <RestricaoCheckbox
                              key={idx}
                              label={dia}
                              checked={preferenciasEntrega.dias.includes(idx)} // 0=Dom, 1=Seg, ..., 6=Sab

                              onCheckedChange={(checked) => {
                                setPreferenciasEntrega(prev => ({
                                  ...prev,
                                  dias: checked
                                    ? [...prev.dias, idx]
                                    : prev.dias.filter(d => d !== idx)
                                }));

                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Turnos Permitidos</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Manhã', 'Tarde', 'Comercial'].map((turno) => (
                            <RestricaoCheckbox
                              key={turno}
                              label={turno}
                              checked={preferenciasEntrega.turnos.includes(turno)}
                              onCheckedChange={(checked) => {
                                setPreferenciasEntrega(prev => ({
                                  ...prev,
                                  turnos: checked
                                    ? [...prev.turnos, turno]
                                    : prev.turnos.filter(t => t !== turno)
                                }));
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Observação da Restrição</Label>
                        <Textarea
                          placeholder="Ex: Porteiro recebe, ou ligar antes..."
                          value={preferenciasEntrega.obs}
                          onChange={(e) => setPreferenciasEntrega(prev => ({ ...prev, obs: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setModalPreferenciasOpen(false)}>Confirmar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                disabled={!clienteSelecionado || itens.length === 0 || (!todosRetiram && !configVenda.prazo)}
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
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={avancarEtapa}
                disabled={!podeAvancar()}
                className="gap-1.5 bg-green-600 hover:bg-green-700 h-10 px-6"
              >
                Avançar
                <ArrowRight className="w-4 h-4" />
              </Button>
              {!podeAvancar() && getMotivoBloqueioBotao() && (
                <span className="text-sm text-red-500 font-medium animate-pulse">
                  {getMotivoBloqueioBotao()}
                </span>
              )}
            </div>
          )}
        </div>
      </footer>

      {/* Modal de Edição Rápida */}
      {isEditModalOpen && editingProdutoPDV && (
        <ProdutoQuickEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          produto={editingProdutoPDV}
          onSave={handleSaveEditProdutoPDV}
        />
      )}
    </div>
  );
}