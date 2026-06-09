
import React, { useState, useEffect, useDeferredValue, useMemo, useRef } from "react";
import { normSearch } from "@/lib/utils";
// Similar structure to VendaModal but for Orcamento
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Search, Pencil, UserPlus } from "lucide-react";
import ClienteModal from "@/components/clientes/ClienteModal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatarTelefone, formatarNome } from "@/utils/formatters";
import { buildProductDisplayName } from "@/utils/productReference";
import { formatDimensions } from "@/utils/productFormatters";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { obterDataLocalString } from "@/utils/dateUtils";
import BuscaProdutoAvancada from "@/components/vendas/BuscaProdutoAvancada";



export default function OrcamentoModal({ isOpen, onClose, onSave, orcamento, clientes, produtos, fornecedores, fornecedorSelecionado, isLoading }) {
  const queryClient = useQueryClient();
  const { getUserLoja, user } = useAuth();
  const [formData, setFormData] = useState({
    numero_orcamento: "",
    data_orcamento: obterDataLocalString(),
    validade: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return obterDataLocalString(d);
    })(),
    loja: "Centro",
    cliente_id: "",
    cliente_nome: "",
    cliente_telefone: "",
    itens: [],
    pagamentos: [],
    valor_total: 0,
    desconto: 0,
    status: "Pendente",
    observacoes: "",
    vendedor_id: user?.id || null,
  });

  const [quantidade, setQuantidade] = useState(1);
  const [fornecedorFilter, setFornecedorFilter] = useState(String(fornecedorSelecionado || "all"));

  const [searchCliente, setSearchCliente] = useState("");
  const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false);
  const [showNovoClienteForm, setShowNovoClienteForm] = useState(false);
  const [novoClienteData, setNovoClienteData] = useState({ nome_completo: "", telefone: "", sem_whatsapp: false });
  const [editandoCliente, setEditandoCliente] = useState(null);
  const [isCriandoCliente, setIsCriandoCliente] = useState(false);
  const [isEditClienteLoading, setIsEditClienteLoading] = useState(false);

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.ativa),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users_list'],
    queryFn: () => base44.entities.User.list(),
  });

  const hasMasterAccess = String(user?.cargo || '').toLowerCase().includes('admin') || String(user?.cargo || '').toLowerCase().includes('master');
  const vendedoresDisponiveis = (users || []).filter((u) => !!u?.id);

  const criarClienteMutation = useMutation({
    mutationFn: async (dados) => {
      const lojaOperacao = getUserLoja() || formData.loja || 'Centro';
      return base44.entities.Cliente.create({
        nome_completo: formatarNome(dados.nome_completo),
        telefone: dados.sem_whatsapp ? (dados.telefone || "") : dados.telefone,
        loja: lojaOperacao
      });
    },
    onSuccess: (novoCliente) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setFormData((prev) => ({
        ...prev,
        cliente_id: novoCliente.id,
        cliente_nome: novoCliente.nome_completo || "",
        cliente_telefone: novoCliente.telefone || ""
      }));
      setSearchCliente(formatarNome(novoCliente.nome_completo || ""));
      setIsClienteDropdownOpen(false);
      setShowNovoClienteForm(false);
      setNovoClienteData({ nome_completo: "", telefone: "", sem_whatsapp: false });
      toast.success("Cliente criado com sucesso!");
    },
    onError: (error) => {
      toast.error(error?.message || "Erro ao criar cliente");
    }
  });

  function handleAbrirNovoClienteForm() {
    setNovoClienteData({ nome_completo: formatarNome(searchCliente.trim()), telefone: "", sem_whatsapp: false });
    setShowNovoClienteForm(true);
  }

  function handleSubmitNovoCliente(e) {
    e.preventDefault();
    if (!novoClienteData.sem_whatsapp && !novoClienteData.telefone.trim()) {
      toast.error("Informe o telefone/WhatsApp ou marque \"cliente não possui WhatsApp\"");
      return;
    }
    criarClienteMutation.mutate(novoClienteData);
  }

  useEffect(() => {
    if (!isOpen) return;
    setFornecedorFilter(String(fornecedorSelecionado || "all"));
  }, [fornecedorSelecionado, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (orcamento) {
      setFormData({
        ...orcamento,
        vendedor_id: orcamento.vendedor_id || user?.id || null,
      });
      // Initialize search with client name if editing an existing quote
      if (orcamento.cliente_nome) {
        setSearchCliente(orcamento.cliente_nome);
      } else if (orcamento.cliente_id && clientes) {
        const cliente = clientes.find(c => c.id === orcamento.cliente_id);
        if (cliente) setSearchCliente(formatarNome(cliente.nome_completo));
      }
    } else {
      const numeroOrcamento = `ORC-${Math.floor(10000 + Math.random() * 90000)}`; // Fixed random number generation
      setFormData({
        numero_orcamento: numeroOrcamento,
        data_orcamento: obterDataLocalString(),
        validade: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return obterDataLocalString(d);
        })(),
        loja: getUserLoja() || user?.loja || "Centro",
        cliente_id: "",
        cliente_nome: "",
        cliente_telefone: "",
        itens: [],
        pagamentos: [],
        valor_total: 0,
        desconto: 0,
        status: "Pendente",
        observacoes: "",
        cidade: "",
        bairro: "",
        endereco: "",
        vendedor_id: user?.id || null,
      });
      setSearchCliente("");
    }
  }, [orcamento, isOpen]);

  useEffect(() => {
    calcularTotal();
  }, [formData.itens, formData.desconto]);

  // No productSearchRef setup needed anymore as BuscaProdutoAvancada handles it internally

  const handleClienteChange = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    setFormData({
      ...formData,
      cliente_id: clienteId,
      cliente_nome: cliente?.nome_completo || "",
      cliente_telefone: cliente?.telefone || ""
    });
    setSearchCliente(cliente?.nome_completo || "");
    setIsClienteDropdownOpen(false);
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nome_completo?.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.cpf?.includes(searchCliente) ||
    c.telefone?.includes(searchCliente)
  );

  const podeCriarCliente = searchCliente.trim().length >= 3 && clientesFiltrados.length === 0;

  const getItemCaracteristicas = (item) => {
    if (item.caracteristicas) return item.caracteristicas;

    const caracteristicas = [];
    const tamanho = String(item.tamanho || '').trim();
    const material = String(item.material || '').trim();
    const cor = String(item.cor || '').trim();
    const tamanhoValido = tamanho && !['n/a', 'na', '-', 'null', 'undefined'].includes(tamanho.toLowerCase());

    const dimensoesFormatadas = formatDimensions(item.largura, item.altura, item.profundidade);
    const dimensoesValidas = dimensoesFormatadas !== '-';
    const dimensoesCompactas = [item.largura, item.altura, item.profundidade].filter(Boolean).join('x');
    const tamanhoDuplicaDimensoes = tamanhoValido && dimensoesCompactas && tamanho.replace(/\s+/g, '').toLowerCase() === dimensoesCompactas.toLowerCase();

    if (tamanhoValido && !tamanhoDuplicaDimensoes) caracteristicas.push(`Tamanho: ${tamanho}`);
    if (material && !['n/a', 'na', '-', 'null', 'undefined'].includes(material.toLowerCase())) caracteristicas.push(`Material: ${material}`);
    if (cor && !['n/a', 'na', '-', 'null', 'undefined'].includes(cor.toLowerCase())) caracteristicas.push(`Cor: ${cor}`);
    if (dimensoesValidas) caracteristicas.push(`Medidas: ${dimensoesFormatadas}`);

    return caracteristicas.join(" | ");
  };

  const getItemFabricante = (item) => {
    return String(item.fornecedor_nome || fornecedoresById[String(item.fornecedor_id)] || '').trim();
  };

  const handleSelectProduto = (produto) => {
    if (!produto) return;

    const qty = quantidade || 1;
    const subtotal = produto.preco_venda * qty;
    
    const novoItem = {
      produto_id: produto.id,
      produto_nome: buildProductDisplayName(produto.nome, produto.modelo_referencia),
      fornecedor_id: produto.fornecedor_id || null,
      fornecedor_nome: fornecedoresById[String(produto.fornecedor_id)] || produto.fornecedor_nome || '',
      quantidade: qty,
      preco_unitario: produto.preco_venda,
      subtotal: subtotal,
      caracteristicas: getItemCaracteristicas(produto),
      cor: produto.cor,
      material: produto.material,
      tamanho: produto.tamanho,
      largura: produto.largura,
      altura: produto.altura,
      profundidade: produto.profundidade
    };

    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, novoItem]
    }));

    setQuantidade(1);
    toast.success(`${produto.nome} adicionado ao orçamento!`);
  };

  const removerProduto = (index) => {
    setFormData({
      ...formData,
      itens: formData.itens.filter((_, i) => i !== index)
    });
  };

  const alterarQuantidade = (index, novaQtd) => {
    const qty = Math.max(1, novaQtd);
    setFormData(prev => {
      const novosItens = [...prev.itens];
      const item = novosItens[index];
      const subtotal = item.preco_unitario * qty;
      novosItens[index] = {
        ...item,
        quantidade: qty,
        subtotal: subtotal
      };
      return {
        ...prev,
        itens: novosItens
      };
    });
  };

  const calcularTotal = () => {
    const subtotal = formData.itens.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - (formData.desconto || 0);
    setFormData(prev => ({ ...prev, valor_total: total }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.cliente_id || formData.itens.length === 0) {
      alert("Selecione um cliente e adicione pelo menos um produto");
      return;
    }
    onSave(formData);
  };

  // Mapear fornecedores por ID para resolver o nome
  const fornecedoresById = (fornecedores || []).reduce((acc, f) => {
    acc[String(f.id)] = f.nome_empresa;
    return acc;
  }, {});

  const produtosFiltradosPorFornecedor = useMemo(() => {
    if (fornecedorFilter === "all") return produtos;
    return (produtos || []).filter(p => String(p.fornecedor_id || "") === fornecedorFilter);
  }, [produtos, fornecedorFilter]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: '#07593f' }}>
            {orcamento ? "Editar Orçamento" : "Novo Orçamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Número do Orçamento</Label>
                <Input value={formData.numero_orcamento} disabled />
              </div>
              <div>
                <Label htmlFor="data_orcamento">Data *</Label>
                <Input
                  id="data_orcamento"
                  type="date" lang="pt-BR"
                  value={formData.data_orcamento}
                  onChange={(e) => setFormData({ ...formData, data_orcamento: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="validade">Válido até *</Label>
                <Input
                  id="validade"
                  type="date" lang="pt-BR"
                  value={formData.validade}
                  onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
                  required
                />
                <div className="flex gap-1 mt-1 items-center flex-wrap">
                  {[7, 15, 30, 60].map(dias => (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + dias);
                        setFormData({ ...formData, validade: obterDataLocalString(d) });
                      }}
                      className="px-2 py-0.5 text-[10px] rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600"
                    >
                      {dias}d
                    </button>
                  ))}
                  <div className="flex items-center gap-0.5 ml-1">
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      className="w-12 h-5 text-[10px] text-center border border-gray-200 rounded-l-full px-1 focus:outline-none focus:border-green-500"
                      id="validade_custom_num"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const num = parseInt(e.target.value);
                          const unidade = document.getElementById('validade_custom_unidade')?.value || 'd';
                          if (!num || num < 1) return;
                          const mult = unidade === 's' ? 7 : unidade === 'm' ? 30 : 1;
                          const d = new Date();
                          d.setDate(d.getDate() + num * mult);
                          setFormData({ ...formData, validade: obterDataLocalString(d) });
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseInt(e.target.value);
                        const unidade = document.getElementById('validade_custom_unidade')?.value || 'd';
                        if (!num || num < 1) return;
                        const mult = unidade === 's' ? 7 : unidade === 'm' ? 30 : 1;
                        const d = new Date();
                        d.setDate(d.getDate() + num * mult);
                        setFormData({ ...formData, validade: obterDataLocalString(d) });
                      }}
                    />
                    <select
                      id="validade_custom_unidade"
                      className="h-5 text-[10px] border border-l-0 border-gray-200 rounded-r-full px-1 focus:outline-none focus:border-green-500 bg-white text-gray-600"
                    >
                      <option value="d">dias</option>
                      <option value="s">sem</option>
                      <option value="m">mês</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="relative">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Button 
                    type="button" 
                    variant="link" 
                    className="h-auto p-0 text-green-700 text-xs"
                    onClick={() => {
                      setIsCriandoCliente(true);
                      setIsClienteDropdownOpen(false);
                    }}
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Novo Cliente
                  </Button>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome, CPF ou telefone..."
                    value={searchCliente || formData.cliente_nome}
                    onChange={(e) => {
                      setSearchCliente(e.target.value);
                      setIsClienteDropdownOpen(true);
                      if (formData.cliente_id) {
                        setFormData({ ...formData, cliente_id: "", cliente_nome: "", cliente_telefone: "" });
                      }
                    }}
                    onFocus={() => setIsClienteDropdownOpen(true)}
                    className="pl-9"
                    required={!formData.cliente_id}
                  />
                </div>
                {isClienteDropdownOpen && searchCliente && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {clientesFiltrados.length > 0 ? (
                      clientesFiltrados.map(cliente => (
                        <div key={cliente.id} className="flex items-center hover:bg-gray-50 group">
                          <button
                            type="button"
                            onClick={() => handleClienteChange(cliente.id)}
                            className="flex-1 text-left px-4 py-3 flex flex-col"
                          >
                            <span className="font-medium text-green-900">{formatarNome(cliente.nome_completo)}</span>
                            <span className="text-xs text-gray-500">{cliente.cpf || 'CPF n/d'} • {formatarTelefone(cliente.telefone)}</span>
                          </button>
                          <button
                            type="button"
                            title="Editar cadastro"
                            onClick={(e) => { e.stopPropagation(); setEditandoCliente(cliente); setIsClienteDropdownOpen(false); }}
                            className="pr-3 pl-1 py-3 text-gray-400 hover:text-green-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 space-y-2">
                        {!showNovoClienteForm ? (
                          <>
                            <div>Nenhum cliente encontrado</div>
                            {podeCriarCliente && (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-green-700"
                                onClick={handleAbrirNovoClienteForm}
                              >
                                {`Criar novo cliente com o nome "${formatarNome(searchCliente)}"`}
                              </Button>
                            )}
                          </>
                        ) : (
                          <form onSubmit={handleSubmitNovoCliente} className="space-y-3 pt-1">
                            <div className="font-medium text-gray-700 text-sm">Novo cliente</div>
                            <div>
                              <Label className="text-xs">Nome *</Label>
                              <Input
                                value={novoClienteData.nome_completo}
                                onChange={e => setNovoClienteData(prev => ({ ...prev, nome_completo: e.target.value }))}
                                placeholder="Nome completo"
                                className="h-8 text-sm mt-1"
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Telefone / WhatsApp {!novoClienteData.sem_whatsapp && <span className="text-red-500">*</span>}</Label>
                              <Input
                                value={novoClienteData.telefone}
                                onChange={e => setNovoClienteData(prev => ({ ...prev, telefone: formatarTelefone(e.target.value) }))}
                                placeholder="(00) 00000-0000"
                                className="h-8 text-sm mt-1"
                                disabled={novoClienteData.sem_whatsapp}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="sem_whatsapp_check"
                                checked={novoClienteData.sem_whatsapp}
                                onChange={e => setNovoClienteData(prev => ({ ...prev, sem_whatsapp: e.target.checked, telefone: e.target.checked ? "" : prev.telefone }))}
                                className="h-4 w-4 accent-green-700"
                              />
                              <label htmlFor="sem_whatsapp_check" className="text-xs text-gray-600 cursor-pointer">Cliente não possui WhatsApp</label>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button type="submit" size="sm" className="bg-green-700 hover:bg-green-800 text-white" disabled={criarClienteMutation.isPending}>
                                {criarClienteMutation.isPending ? "Salvando..." : "Salvar"}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setShowNovoClienteForm(false)}>
                                Cancelar
                              </Button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="loja">Loja *</Label>
                <div className="mt-2">
                  <Select
                    value={formData.loja}
                    onValueChange={(value) => setFormData({ ...formData, loja: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas.length === 0 ? (
                        <SelectItem value="Centro" disabled>Carregando...</SelectItem>
                      ) : (
                        lojas.map(loja => (
                          <SelectItem key={loja.id} value={loja.nome}>{loja.nome}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="vendedor">Vendedor *</Label>
                <div className="mt-2">
                  {hasMasterAccess ? (
                    <Select
                      value={formData.vendedor_id || user?.id || ''}
                      onValueChange={(value) => setFormData({ ...formData, vendedor_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedoresDisponiveis.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={(() => {
                        const selId = formData.vendedor_id || user?.id;
                        const u = users.find(x => x.id === selId);
                        return u ? (u.full_name || u.email) : (user?.full_name || user?.email || "");
                      })()}
                      disabled
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-4" style={{ borderColor: '#E5E0D8' }}>
              <h4 className="font-semibold mb-4" style={{ color: '#07593f' }}>Produtos</h4>

              <div className="mb-4">
                <Label>Filtrar por Fornecedor</Label>
                <Select value={fornecedorFilter} onValueChange={(value) => setFornecedorFilter(String(value))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione um fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Fornecedores</SelectItem>
                    {(fornecedores || []).map(f => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.nome_empresa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-12 gap-3 mb-4">
                <div className="md:col-span-9">
                  <Label>Buscar Produto</Label>
                  <div className="mt-2">
                    <BuscaProdutoAvancada
                      produtos={produtosFiltradosPorFornecedor}
                      fornecedores={fornecedores}
                      onSelectProduto={handleSelectProduto}
                      user={user}
                    />
                  </div>
                </div>
                <div className="md:col-span-3">
                  <Label htmlFor="quantidade_input">Qtd. a Adicionar</Label>
                  <Input
                    id="quantidade_input"
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                    className="mt-2 h-11"
                  />
                </div>
              </div>

              {formData.itens.length > 0 && (
                <div className="space-y-2">
                  {formData.itens.map((item, index) => (
                    <div key={index} className="p-3 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: '#07593f' }}>{item.produto_nome}</p>
                          {getItemFabricante(item) && (
                            <p className="text-xs mt-1 font-medium" style={{ color: '#8B8B8B' }}>
                              Fabricante: {getItemFabricante(item)}
                            </p>
                          )}
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            {item.quantidade} x R$ {item.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {getItemCaracteristicas(item) && (
                            <p className="text-xs mt-2 p-2 bg-gray-50 rounded" style={{ color: '#666' }}>
                              {getItemCaracteristicas(item)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-lg" style={{ color: '#07593f' }}>
                              R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removerProduto(index)}
                              className="text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="flex items-center gap-1 border border-gray-200 dark:border-neutral-800 rounded-lg p-0.5 bg-gray-50 dark:bg-neutral-900">
                            <button
                              type="button"
                              onClick={() => alterarQuantidade(index, item.quantidade - 1)}
                              disabled={item.quantidade <= 1}
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) => alterarQuantidade(index, parseInt(e.target.value) || 1)}
                              className="w-12 text-center bg-transparent border-0 font-semibold text-sm focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => alterarQuantidade(index, item.quantidade + 1)}
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="desconto">Desconto (R$)</Label>
                <Input
                  id="desconto"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.desconto}
                  onChange={(e) => setFormData({ ...formData, desconto: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {formData.cliente_id && (
              <div className="p-3 bg-gray-50 border rounded-lg">
                <Label className="text-gray-600 mb-1 block">Endereço do Cliente</Label>
                <div className="text-sm">
                  {(() => {
                    const cliente = clientes.find(c => c.id === formData.cliente_id);
                    if (!cliente) return "Endereço não encontrado";
                    const enderecoCompleto = [cliente.endereco, cliente.numero].filter(Boolean).join(", ");
                    const localidade = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - ");
                    const full = [enderecoCompleto, localidade].filter(Boolean).join(" | ");
                    return full || "Nenhum endereço cadastrado para este cliente.";
                  })()}
                </div>
              </div>
            )}

            <div className="flex items-end">
              <div className="w-full p-4 rounded-lg" style={{ backgroundColor: '#07593f', color: 'white' }}>
                <p className="text-sm mb-1">Valor Total</p>
                <p className="text-2xl font-bold">
                  R$ {formData.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.cliente_id || formData.itens.length === 0}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                orcamento ? "Atualizar" : "Criar Orçamento"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {(editandoCliente || isCriandoCliente) && (
      <ClienteModal
        isOpen={!!editandoCliente || isCriandoCliente}
        onClose={() => { setEditandoCliente(null); setIsCriandoCliente(false); }}
        cliente={editandoCliente}
        isLoading={isEditClienteLoading}
        clientes={clientes}
        onSave={async (dadosAtualizados) => {
          setIsEditClienteLoading(true);
          try {
            if (editandoCliente) {
              await base44.entities.Cliente.update(editandoCliente.id, dadosAtualizados);
              queryClient.invalidateQueries({ queryKey: ['clientes'] });
              if (formData.cliente_id === editandoCliente.id) {
                const telefoneWhatsApp = dadosAtualizados.telefone || "";
                setFormData(prev => ({
                  ...prev,
                  cliente_nome: dadosAtualizados.nome_completo || prev.cliente_nome,
                  cliente_telefone: telefoneWhatsApp,
                }));
                setSearchCliente(formatarNome(dadosAtualizados.nome_completo || ""));
              }
              toast.success("Cliente atualizado com sucesso!");
              setEditandoCliente(null);
            } else {
              const novoCliente = await base44.entities.Cliente.create(dadosAtualizados);
              queryClient.setQueryData(['clientes'], (old) => {
                if (old) return [...old, novoCliente];
                return [novoCliente];
              });
              queryClient.invalidateQueries({ queryKey: ['clientes'] });
              setFormData(prev => ({
                ...prev,
                cliente_id: novoCliente.id,
                cliente_nome: novoCliente.nome_completo || "",
                cliente_telefone: novoCliente.telefone || ""
              }));
              setSearchCliente(formatarNome(novoCliente.nome_completo || ""));
              setIsClienteDropdownOpen(false);
              toast.success("Cliente criado com sucesso!");
              setIsCriandoCliente(false);
            }
          } catch (err) {
            toast.error(err?.message || "Erro ao salvar cliente");
          } finally {
            setIsEditClienteLoading(false);
          }
        }}
      />
    )}
    </>
  );
}
