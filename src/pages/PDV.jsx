import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Componentes
import BuscaProdutoAvancada from "../components/vendas/BuscaProdutoAvancada";
import CarrinhoVenda from "../components/pdv/CarrinhoVenda";
import SeletorCliente from "../components/pdv/SeletorCliente";
import PainelPagamento from "../components/pdv/PainelPagamento";
import { abrirNotaPedidoPDF, enviarWhatsApp } from "../components/vendas/NotaPedidoPDF";

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

export default function PDV() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

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
    } catch (e) {}
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

  useEffect(() => {
    const state = { etapa, clienteSelecionado, itens, pagamentos, configVenda, desconto, observacoes, pagamentoEntrega };
    sessionStorage.setItem(PDV_STATE_KEY, JSON.stringify(state));
  }, [etapa, clienteSelecionado, itens, pagamentos, configVenda, desconto, observacoes, pagamentoEntrega]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!initialState) {
        setConfigVenda(prev => ({ ...prev, loja: u.loja || "Centro" }));
      }
    }).catch(console.error);
  }, []);

  const { data: produtos = [] } = useQuery({ 
    queryKey: ['produtos'], 
    queryFn: () => base44.entities.Produto.list(), 
    initialData: [],
    staleTime: 1000 * 60 * 60 
  });
  
  const { data: clientes = [] } = useQuery({ 
    queryKey: ['clientes'], 
    queryFn: () => base44.entities.Cliente.list(), 
    initialData: [],
    staleTime: 1000 * 60 * 60 
  });
  
  const { data: vendas = [] } = useQuery({ 
    queryKey: ['vendas'], 
    queryFn: () => base44.entities.Venda.list('-numero_pedido', 1), 
    initialData: [],
    enabled: isOnline 
  });

  const criarVendaMutation = useMutation({
    mutationFn: (data) => base44.entities.Venda.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    }
  });

  const criarOrcamentoMutation = useMutation({
    mutationFn: (data) => base44.entities.Orcamento.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orcamentos'] })
  });

  const sincronizarVendas = async () => {
    if (!isOnline || vendasPendentes.length === 0) return;
    
    if(!confirm(`Existem ${vendasPendentes.length} vendas salvas offline. Deseja sincronizar agora?`)) return;

    setSyncing(true);
    let sucessos = 0;

    for (const vendaOffline of vendasPendentes) {
      try {
        const { offlineId, timestamp, ...dadosVenda } = vendaOffline;
        await criarVendaMutation.mutateAsync(dadosVenda);
        
        // Tenta enviar mensagem do robô também na sincronização
        if (dadosVenda.cliente_telefone) {
             fetch('http://localhost:3001/mensagem-pos-venda', {
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
    if (sucessos > 0) alert(`${sucessos} vendas sincronizadas com sucesso!`);
  };

  const handleSelectProduto = (produtoId) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    setItens(prev => {
        const exists = prev.findIndex(i => i.produto_id === produto.id);
        if(exists >= 0) {
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
            subtotal: produto.preco_venda
        }];
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
    if (etapa === 1 && itens.length === 0) return alert("Adicione pelo menos um produto");
    if (etapa === 2) {
      if (!clienteSelecionado) return alert("Selecione um cliente");
      if (!configVenda.prazo) return alert("Selecione o prazo de entrega");
    }
    if (etapa < 3) setEtapa(etapa + 1);
  };

  const voltarEtapa = () => {
    if (etapa > 1) setEtapa(etapa - 1);
  };

  const handleFinalizar = async () => {
    if (!clienteSelecionado) return alert("Selecione um cliente");
    if (itens.length === 0) return alert("Adicione produtos");
    if (!configVenda.prazo) return alert("Selecione o prazo de entrega");
    if (restante > 0 && !pagamentoEntrega.ativo) {
        if(!confirm("Há um saldo restante pendente. Confirmar venda assim mesmo?")) return;
    }

    setLoading(true);

    const lastNum = (vendas.length > 0 && isOnline) ? parseInt(vendas[0].numero_pedido) : 0;
    let novoNumero = isOnline 
        ? String(lastNum + 1).padStart(5, '0') 
        : `OFF-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;

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
        observacoes: observacoes + (!isOnline ? " [Venda gerada OFFLINE]" : "")
    };

    if 
    (!isOnline) {
        const salvou = saveOfflineSale(vendaData);
        if (salvou) {
            alert("⚠️ Sem internet: Venda salva no dispositivo!\n\nEla será sincronizada automaticamente quando a conexão voltar.");
            abrirNotaPedidoPDF({...vendaData}, clienteSelecionado, user.full_name);
            resetForm();
            carregarVendasPendentes();
        } else {
            alert("Erro crítico ao salvar venda offline. Tire foto da tela.");
        }
        setLoading(false);
        return;
    }

    try {
        const vendaCriada = await criarVendaMutation.mutateAsync(vendaData);

        for (const item of itens) {
            const prod = produtos.find(p => p.id === item.produto_id);
            if(prod) {
                await base44.entities.Produto.update(prod.id, {
                    quantidade_estoque: prod.quantidade_estoque - item.quantidade
                });
            }
        }

        if(configVenda.prazo !== "Retirado na loja") {
            const dias = configVenda.prazo === "15 dias" ? 15 : 45;
            const limite = new Date();
            limite.setDate(limite.getDate() + dias);
            
            await base44.entities.Entrega.create({
                venda_id: vendaCriada.id,
                numero_pedido: novoNumero,
                cliente_nome: clienteSelecionado.nome_completo,
                cliente_telefone: clienteSelecionado.telefone,
                endereco_entrega: clienteSelecionado.endereco ? `${clienteSelecionado.endereco}, ${clienteSelecionado.numero} - ${clienteSelecionado.bairro}` : "Endereço a definir",
                data_limite: limite.toISOString().split('T')[0],
                status: "Pendente"
            });
        }

        // --- GATILHO DO ROBÔ DE FIDELIZAÇÃO (AQUI ESTAVA FALTANDO!) ---
        if (clienteSelecionado.telefone) {
            try {
                fetch('http://localhost:3001/mensagem-pos-venda', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: clienteSelecionado.telefone,
                        nome: clienteSelecionado.nome_completo,
                        pedido: novoNumero,
                        prazo: configVenda.prazo
                    })
                });
                console.log("Comando de mensagem enviado para o robô");
            } catch (err) {
                console.error("Erro ao chamar o robô:", err);
            }
        }
        // ----------------------------------------------------------------

        abrirNotaPedidoPDF({...vendaData}, clienteSelecionado, user.full_name);

        alert("Venda finalizada com sucesso!");
        resetForm();

    } catch (err) {
        console.error(err);
        alert("Erro ao finalizar venda online. Verifique sua conexão.");
    } finally {
        setLoading(false);
    }
  };

  const handleOrcamento = async () => {
      if (!clienteSelecionado) return alert("Selecione um cliente");
      if (!isOnline) return alert("Orçamentos só podem ser salvos online.");

      setSavingOrcamento(true);
      try {
        const numero = String(Date.now()).slice(-5);
        await criarOrcamentoMutation.mutateAsync({
            numero_orcamento: numero,
            data_orcamento: configVenda.data,
            validade: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
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
        alert("Orçamento salvo!");
        resetForm();
      } catch(err) {
          console.error(err);
          alert("Erro ao salvar orçamento");
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
    <div className="fixed inset-0 flex flex-col bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100">
      
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
               <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><Wifi className="w-3 h-3 mr-1"/> Online</Badge>
            ) : (
               <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><WifiOff className="w-3 h-3 mr-1"/> Offline</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">{user.full_name}</span>
            <div className="w-7 h-7 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-800 dark:text-green-400 font-bold text-xs">
                {user.full_name.charAt(0)}
            </div>
        </div>
      </header>

      <div className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-4 py-2 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {etapas.map((e, idx) => (
            <React.Fragment key={e.num}>
              <div 
                className={`flex items-center gap-2 cursor-pointer transition-all ${
                  etapa === e.num ? 'opacity-100' : etapa > e.num ? 'opacity-70' : 'opacity-40'
                }`}
                onClick={() => etapa > e.num && setEtapa(e.num)}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  etapa === e.num 
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
        <div className="max-w-3xl mx-auto">
          {etapa === 1 && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-green-600" />
                  Adicionar Produtos
                </h2>
                <BuscaProdutoAvancada produtos={produtos} onSelectProduto={(p) => handleSelectProduto(p.id)} />
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Carrinho ({itens.length})</h3>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Subtotal</p>
                    <p className="text-lg font-bold text-green-700">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <CarrinhoVenda itens={itens} onRemoveItem={handleRemoveItem} />
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
                      onChange={e => setConfigVenda({...configVenda, data: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block font-medium">
                      Prazo de Entrega <span className="text-red-500">*</span>
                    </Label>
                    <Select value={configVenda.prazo} onValueChange={v => setConfigVenda({...configVenda, prazo: v})}>
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
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border-l-4 border-l-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-green-800 dark:text-green-400">{clienteSelecionado?.nome_completo}</p>
                    <p className="text-xs text-green-600">{itens.length} itens • {configVenda.prazo}</p>
                  </div>
                  <p className="text-xl font-bold text-green-700">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-800">
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
                />
              </div>
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