import React, { useState, useEffect } from "react";
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
import { Loader2, Trash2, Check, ChevronsUpDown, ScanBarcode, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const lojas = ["Depósito / CD", "Centro", "Carangola", "Ponte Branca"];

export default function InventarioModal({ isOpen, onClose, onSave, produtos, isLoading, userLoja }) {
  const [formData, setFormData] = useState({
    numero_inventario: "",
    loja: userLoja || "",
    data_inventario: new Date().toISOString().split('T')[0],
    responsavel: "",
    itens: [],
    total_itens: 0,
    total_divergencias: 0,
    status: "Concluído",
    observacoes: "",
  });

  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidadeContada, setQuantidadeContada] = useState(0);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [openCombobox, setOpenCombobox] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const numeroInv = `INV-${Date.now()}`;
      setFormData({
        numero_inventario: numeroInv,
        loja: userLoja || "",
        data_inventario: new Date().toISOString().split('T')[0],
        responsavel: "",
        itens: [],
        total_itens: 0,
        total_divergencias: 0,
        status: "Concluído",
        observacoes: "",
      });
      setProdutoSelecionado("");
      setQuantidadeContada(0);
      setBarcodeInput("");
    }
  }, [isOpen, userLoja]);

  const handleBarcodeSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (!code) return;

      const produto = produtos.find(p => p.codigo_barras === code);
      if (produto) {
        if (formData.itens.some(i => i.produto_id === produto.id)) {
          toast.warning("Produto já adicionado à lista. Edite a quantidade se necessário.");
          // Optional: Highlight existing item
        } else {
          setProdutoSelecionado(produto.id);
          toast.success(`Produto encontrado: ${produto.nome}`);
          // Focus quantity input if possible, or just let user type
          document.getElementById('qtd-input')?.focus();
        }
      } else {
        toast.error("Produto não encontrado com este código de barras.");
      }
      setBarcodeInput(""); // Clear input for next scan
    }
  };

  const adicionarItem = () => {
    if (!produtoSelecionado || quantidadeContada < 0) {
      alert("Selecione um produto e informe a quantidade contada");
      return;
    }

    const produto = produtos.find(p => p.id === produtoSelecionado);
    if (!produto) return;

    // Verificar se já foi adicionado
    if (formData.itens.some(i => i.produto_id === produtoSelecionado)) {
      alert("Este produto já foi adicionado ao inventário");
      return;
    }

    const getEstoquePorLoja = (prod, loja) => {
      switch (loja) {
        case "Depósito / CD": return prod.estoque_cd || 0;
        case "Centro": return prod.estoque_loja_centro || 0;
        case "Carangola": return prod.estoque_loja_carangola || 0;
        case "Ponte Branca": return prod.estoque_loja_ponte_branca || 0;
        default: return prod.quantidade_estoque || 0;
      }
    };

    const qtdSistema = getEstoquePorLoja(produto, formData.loja);

    const novoItem = {
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade_sistema: qtdSistema,
      quantidade_contada: quantidadeContada,
      diferenca: quantidadeContada - qtdSistema,
      justificativa: ""
    };

    const novosItens = [...formData.itens, novoItem];
    const totalDivergencias = novosItens.filter(i => i.diferenca !== 0).length;

    setFormData({
      ...formData,
      itens: novosItens,
      total_itens: novosItens.length,
      total_divergencias: totalDivergencias
    });

    setProdutoSelecionado("");
    setQuantidadeContada(0);
  };

  const removerItem = (index) => {
    const novosItens = formData.itens.filter((_, i) => i !== index);
    const totalDivergencias = novosItens.filter(i => i.diferenca !== 0).length;

    setFormData({
      ...formData,
      itens: novosItens,
      total_itens: novosItens.length,
      total_divergencias: totalDivergencias
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.loja || !formData.responsavel || formData.itens.length === 0) {
      alert("Preencha todos os campos e adicione pelo menos um produto");
      return;
    }

    onSave(formData);
  };

  const produtosDisponiveis = produtos.filter(
    p => !formData.itens.some(i => i.produto_id === p.id)
  );

  const selectedProductDetails = produtos.find(p => p.id === produtoSelecionado);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: '#07593f' }}>
            Novo Inventário
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Alert style={{ backgroundColor: '#f0f9ff', borderColor: '#3b82f6' }}>
              <AlertDescription>
                Conte fisicamente o estoque e registre as quantidades. O sistema calculará as diferenças automaticamente.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Número do Inventário</Label>
                <Input value={formData.numero_inventario} disabled />
              </div>
              <div>
                <Label htmlFor="loja">Loja *</Label>
                <Select
                  value={formData.loja}
                  onValueChange={(value) => setFormData({ ...formData, loja: value })}
                  disabled={!!userLoja}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map(loja => (
                      <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data_inventario}
                  onChange={(e) => setFormData({ ...formData, data_inventario: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="responsavel">Responsável pela Contagem *</Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsável"
                required
              />
            </div>

            <div className="border rounded-xl p-4" style={{ borderColor: '#E5E0D8', backgroundColor: '#f0f9ff' }}>
              <h4 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#07593f' }}>
                <ScanBarcode className="w-5 h-5" />
                Adicionar Produto
              </h4>

              {/* Barcode Input */}
              <div className="mb-4">
                <Label htmlFor="barcode">Bipar Código de Barras (Enter para buscar)</Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeSubmit}
                    placeholder="Escaneie ou digite o código..."
                    className="bg-white"
                    autoFocus
                  />
                  <Button type="button" variant="secondary" onClick={() => handleBarcodeSubmit({ key: 'Enter', preventDefault: () => { } })}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-8 flex flex-col gap-1.5">
                  <Label>Buscar Produto (Nome ou Código)</Label>
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full justify-between bg-white"
                      >
                        {produtoSelecionado
                          ? produtos.find((p) => p.id === produtoSelecionado)?.nome
                          : "Selecione um produto..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar produto..." />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          <CommandGroup>
                            {produtosDisponiveis.map((produto) => (
                              <CommandItem
                                key={produto.id}
                                value={produto.nome}
                                onSelect={() => {
                                  setProdutoSelecionado(produto.id === produtoSelecionado ? "" : produto.id);
                                  setOpenCombobox(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    produtoSelecionado === produto.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {produto.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedProductDetails && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Estoque Atual: <strong>{selectedProductDetails.quantidade_estoque || 0}</strong> •
                      Ref: {selectedProductDetails.modelo_referencia || 'N/A'}
                    </p>
                  )}
                </div>
                <div className="md:col-span-3">
                  <Label htmlFor="qtd-input">Quantidade Contada</Label>
                  <Input
                    id="qtd-input"
                    type="number"
                    min="0"
                    value={quantidadeContada}
                    onChange={(e) => setQuantidadeContada(parseInt(e.target.value) || 0)}
                    className="bg-white"
                  />
                </div>
                <div className="md:col-span-1">
                  <Button
                    type="button"
                    onClick={adicionarItem}
                    disabled={!produtoSelecionado}
                    className="w-full"
                    style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {formData.itens.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium" style={{ color: '#07593f' }}>
                  Produtos Contados ({formData.itens.length})
                </h5>
                {formData.itens.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{
                      borderColor: item.diferenca !== 0 ? '#FCD34D' : '#E5E0D8',
                      backgroundColor: item.diferenca !== 0 ? '#FEF3C7' : '#FAF8F5'
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: '#07593f' }}>
                        {item.produto_nome}
                      </p>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        Sistema: {item.quantidade_sistema} | Contado: {item.quantidade_contada} |
                        Diferença: <strong className={item.diferenca !== 0 ? 'text-orange-600' : ''}>
                          {item.diferenca > 0 ? '+' : ''}{item.diferenca}
                        </strong>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removerItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
              <div className="flex justify-between">
                <span className="font-medium">Total de Itens:</span>
                <span className="font-bold" style={{ color: '#07593f' }}>{formData.total_itens}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="font-medium">Divergências:</span>
                <span className="font-bold text-orange-600">{formData.total_divergencias}</span>
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
              disabled={isLoading || formData.itens.length === 0}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Inventário"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}