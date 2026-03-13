
import React, { useState, useEffect } from "react";
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
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatarTelefone, formatarNome } from "@/utils/formatters";



export default function OrcamentoModal({ isOpen, onClose, onSave, orcamento, clientes, produtos, isLoading }) {
  const [formData, setFormData] = useState({
    numero_orcamento: "",
    data_orcamento: new Date().toISOString().split('T')[0],
    validade: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
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
  });

  const [searchProduto, setSearchProduto] = useState("");
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [quantidade, setQuantidade] = useState(1);

  const [searchCliente, setSearchCliente] = useState("");
  const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false);

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.ativa),
  });

  useEffect(() => {
    if (orcamento) {
      setFormData(orcamento);
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
        data_orcamento: new Date().toISOString().split('T')[0],
        validade: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
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
        cidade: "",
        bairro: "",
        endereco: "",
        valor_frete: 0,
      });
    }
  }, [orcamento, isOpen]);

  useEffect(() => {
    calcularTotal();
  }, [formData.itens, formData.desconto]);

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

  const adicionarProduto = () => {
    if (!selectedProduto || quantidade <= 0) return;

    const produto = produtos.find(p => p.id === selectedProduto);
    if (!produto) return;

    const subtotal = produto.preco_venda * quantidade;
    const novoItem = {
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade: quantidade,
      preco_unitario: produto.preco_venda,
      subtotal: subtotal
    };

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem]
    });

    setSelectedProduto(null);
    setQuantidade(1);
    setSearchProduto("");
  };

  const removerProduto = (index) => {
    setFormData({
      ...formData,
      itens: formData.itens.filter((_, i) => i !== index)
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

  const produtosFiltrados = produtos.filter(p =>
    p.nome?.toLowerCase().includes(searchProduto.toLowerCase()) && p.ativo
  );

  return (
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
                  type="date"
                  value={formData.data_orcamento}
                  onChange={(e) => setFormData({ ...formData, data_orcamento: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="validade">Válido até *</Label>
                <Input
                  id="validade"
                  type="date"
                  value={formData.validade}
                  onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
                  required
                />
                <div className="flex gap-1 mt-1">
                  {[7, 15, 30, 60].map(dias => (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => {
                        const novaValidade = new Date(Date.now() + dias * 86400000);
                        setFormData({ ...formData, validade: novaValidade.toISOString().split('T')[0] });
                      }}
                      className="px-2 py-0.5 text-[10px] rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600"
                    >
                      {dias}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <Label htmlFor="cliente">Cliente *</Label>
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
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => handleClienteChange(cliente.id)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-col"
                        >
                          <span className="font-medium text-green-900">{formatarNome(cliente.nome_completo)}</span>
                          <span className="text-xs text-gray-500">{cliente.cpf || 'CPF n/d'} • {formatarTelefone(cliente.telefone)}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500">Nenhum cliente encontrado</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="loja">Loja *</Label>
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

            <div className="border rounded-xl p-4" style={{ borderColor: '#E5E0D8' }}>
              <h4 className="font-semibold mb-4" style={{ color: '#07593f' }}>Produtos</h4>

              <div className="grid md:grid-cols-12 gap-3 mb-4">
                <div className="md:col-span-7">
                  <Label>Produto</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#8B8B8B' }} />
                    <Input
                      placeholder="Buscar produto..."
                      value={searchProduto}
                      onChange={(e) => {
                        setSearchProduto(e.target.value);
                        setSelectedProduto(null);
                      }}
                      className="pl-9"
                    />
                  </div>
                  {searchProduto && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {produtosFiltrados.map(produto => (
                        <button
                          key={produto.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduto(produto.id);
                            setSearchProduto(produto.nome);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50"
                        >
                          <p className="font-medium" style={{ color: '#07593f' }}>{produto.nome}</p>
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-3">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button
                    type="button"
                    onClick={adicionarProduto}
                    disabled={!selectedProduto}
                    className="w-full"
                    style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {formData.itens.length > 0 && (
                <div className="space-y-2">
                  {formData.itens.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium" style={{ color: '#07593f' }}>{item.produto_nome}</p>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                          {item.quantidade} x R$ {item.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold" style={{ color: '#07593f' }}>
                          R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerProduto(index)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
              <div>
                <Label htmlFor="valor_frete">Frete (R$)</Label>
                <Input
                  id="valor_frete"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_frete}
                  onChange={(e) => setFormData({ ...formData, valor_frete: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                />
              </div>
            </div>

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
  );
}
