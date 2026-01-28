
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
    valor_total: 0,
    desconto: 0,
    status: "Pendente",
    observacoes: "",
  });

  const [searchProduto, setSearchProduto] = useState("");
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [quantidade, setQuantidade] = useState(1);

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.ativa),
  });

  useEffect(() => {
    if (orcamento) {
      setFormData(orcamento);
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
        valor_total: 0,
        desconto: 0,
        status: "Pendente",
        observacoes: "",
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
  };

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
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cliente">Cliente *</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={handleClienteChange}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
