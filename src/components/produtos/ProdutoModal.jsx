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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Sparkles, Info, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { calculateSuggestedMarkup, calculateMarkupDetails } from "@/utils/markupCalculator";
const categorias = [
  "Sofa",
  "Cama",
  "Mesa",
  "Cadeira",
  "Armario",
  "Estante",
  "Rack",
  "Poltrona",
  "Escrivaninha",
  "Criado-mudo",
  "Buffet",
  "Aparador",
  "Banco",
  "Colchao",
  "Guarda-roupa",
  "Comoda",
  "Painel",
  "Outros"
];

export default function ProdutoModal({ isOpen, onClose, onSave, produto, isLoading }) {
  const [formData, setFormData] = useState({
    codigo_barras: "",
    nome: "",
    categoria: "",
    descricao: "",
    foto_url: "",
    preco_venda: "",
    preco_custo: "",
    quantidade_estoque: "",
    estoque_minimo: "5",
    tipo_entrega_padrao: "desmontado",
    ativo: true,
  });

  const [errors, setErrors] = useState({});

  // State for suggested markup
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [markupDetails, setMarkupDetails] = useState(null);

  // Recalculate suggestion whenever relevant fields change
  useEffect(() => {
    const hasCost = parseFloat(formData.preco_custo) > 0;
    if (hasCost && formData.categoria) {
      const suggestion = calculateSuggestedMarkup(formData);
      setSuggestedPrice(suggestion);
      const details = calculateMarkupDetails(formData);
      setMarkupDetails(details);
    } else {
      setSuggestedPrice(0);
      setMarkupDetails(null);
    }
  }, [formData.preco_custo, formData.categoria, formData.quantidade_estoque, formData.estoque_minimo, formData.fornecedor_id]);

  const applySuggestedMarkup = () => {
    if (suggestedPrice) {
      handleChange('preco_venda', suggestedPrice.toString());
    }
  };

  useEffect(() => {
    if (produto) {
      setFormData({
        codigo_barras: produto.codigo_barras || "",
        nome: produto.nome || "",
        categoria: produto.categoria || "",
        descricao: produto.descricao || "",
        foto_url: produto.fotos?.[0] || produto.foto_url || "",
        preco_venda: produto.preco_venda || "",
        preco_custo: produto.preco_custo || "",
        quantidade_estoque: produto.quantidade_estoque || "",
        estoque_minimo: produto.estoque_minimo || "5",
        tipo_entrega_padrao: produto.tipo_entrega_padrao || "desmontado",
        ativo: produto.ativo !== false,
      });
    } else {
      setFormData({
        codigo_barras: "",
        nome: "",
        categoria: "",
        descricao: "",
        foto_url: "",
        preco_venda: "",
        preco_custo: "",
        quantidade_estoque: "",
        estoque_minimo: "5",
        tipo_entrega_padrao: "desmontado",
        ativo: true,
      });
    }
    setErrors({});
  }, [produto, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nome || formData.nome.trim().length < 3) {
      newErrors.nome = "Nome deve ter pelo menos 3 caracteres";
    }

    if (!formData.categoria) {
      newErrors.categoria = "Selecione uma categoria";
    }

    const precoVenda = parseFloat(formData.preco_venda);
    if (!precoVenda || precoVenda <= 0) {
      newErrors.preco_venda = "Preco de venda deve ser maior que zero";
    }

    const precoCusto = parseFloat(formData.preco_custo);
    if (formData.preco_custo && precoCusto && precoCusto > precoVenda) {
      newErrors.preco_custo = "Preco de custo nao pode ser maior que o de venda";
    }

    const estoque = parseInt(formData.quantidade_estoque);
    if (isNaN(estoque)) {
      newErrors.quantidade_estoque = "Quantidade de estoque e obrigatoria";
    }
    if (estoque < 0) {
      newErrors.quantidade_estoque = "Quantidade nao pode ser negativa";
    }

    if (!formData.tipo_entrega_padrao) {
      newErrors.tipo_entrega_padrao = "Selecione o tipo de entrega padrão";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const dataToSave = {
      ...formData,
      preco_venda: parseFloat(formData.preco_venda),
      preco_custo: formData.preco_custo ? parseFloat(formData.preco_custo) : undefined,
      quantidade_estoque: parseInt(formData.quantidade_estoque),
      estoque_minimo: parseInt(formData.estoque_minimo) || 5,
      fotos: formData.foto_url ? [formData.foto_url] : [],
    };

    // Remove foto_url pois usamos fotos[] para compatibilidade
    delete dataToSave.foto_url;

    onSave(dataToSave);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {produto ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Codigo de Barras */}
          <div>
            <Label htmlFor="codigo_barras">Codigo de Barras</Label>
            <Input
              id="codigo_barras"
              value={formData.codigo_barras}
              onChange={(e) => handleChange("codigo_barras", e.target.value.replace(/\D/g, ''))}
              placeholder="Opcional"
              maxLength={13}
            />
          </div>

          {/* Nome */}
          <div>
            <Label htmlFor="nome">Nome do Produto *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              className={errors.nome ? "border-red-500" : ""}
            />
            {errors.nome && (
              <p className="text-xs text-red-500 mt-1">{errors.nome}</p>
            )}
          </div>

          {/* Categoria e Montagem Padrão */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="categoria">Categoria *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => handleChange("categoria", value)}
              >
                <SelectTrigger className={errors.categoria ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoria && (
                <p className="text-xs text-red-500 mt-1">{errors.categoria}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tipo_entrega_padrao">Entrega Padrão *</Label>
              <Select
                value={formData.tipo_entrega_padrao}
                onValueChange={(value) => handleChange("tipo_entrega_padrao", value)}
              >
                <SelectTrigger
                  className={`
                    ${errors.tipo_entrega_padrao ? "border-red-500" : ""}
                    ${formData.tipo_entrega_padrao === 'montado' ? 'bg-green-100 text-green-800 border-green-200 font-medium' : ''}
                    ${formData.tipo_entrega_padrao === 'desmontado' ? 'bg-orange-100 text-orange-800 border-orange-200 font-medium' : ''}
                  `}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desmontado" className="text-orange-700 focus:bg-orange-50 focus:text-orange-900">
                    Montagem no Local (envia na caixa)
                  </SelectItem>
                  <SelectItem value="montado" className="text-green-700 focus:bg-green-50 focus:text-green-900">
                    Entrega Montado (montagem interna)
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo_entrega_padrao && (
                <p className="text-xs text-red-500 mt-1">{errors.tipo_entrega_padrao}</p>
              )}
            </div>
          </div>

          {/* Precos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preco_custo">Preco de Custo (R$)</Label>
              <Input
                id="preco_custo"
                type="number"
                step="0.01"
                min="0"
                value={formData.preco_custo}
                onChange={(e) => handleChange("preco_custo", e.target.value)}
                placeholder="0,00"
                className={errors.preco_custo ? "border-red-500" : ""}
              />
              {errors.preco_custo && (
                <p className="text-xs text-red-500 mt-1">{errors.preco_custo}</p>
              )}
            </div>
            <div>
              <Label htmlFor="preco_venda">Preco de Venda (R$) *</Label>
              <Input
                id="preco_venda"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.preco_venda}
                onChange={(e) => handleChange("preco_venda", e.target.value)}
                placeholder="0,00"
                className={errors.preco_venda ? "border-red-500" : ""}
              />
              {/* Suggested markup */}
              {suggestedPrice > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-300 cursor-pointer hover:bg-green-200 transition-colors font-medium"
                      >
                        <Sparkles className="w-3 h-3" />
                        Sugerido: R$ {suggestedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <Info className="w-3 h-3 ml-1" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="p-3 border-b bg-gray-50">
                        <h4 className="font-semibold text-sm text-gray-800">Detalhes do Cálculo</h4>
                        <p className="text-xs text-gray-500">Custo base: R$ {markupDetails?.custo?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {markupDetails?.steps?.map((step, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="w-3 h-3 text-gray-400" />
                              <div>
                                <span className="font-medium text-gray-700">{step.label}</span>
                                <p className="text-xs text-gray-500">{step.description}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${step.factor.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {step.factor}
                              </span>
                              <p className="font-mono text-xs text-gray-600 mt-0.5">R$ {step.value.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 border-t bg-green-50">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-green-800">Preço Final</span>
                          <span className="font-bold text-lg text-green-700">
                            R$ {markupDetails?.precoFinal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || suggestedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button type="button" variant="secondary" size="sm" onClick={applySuggestedMarkup}>
                    Aplicar
                  </Button>
                </div>
              )}

              {errors.preco_venda && (
                <p className="text-xs text-red-500 mt-1">{errors.preco_venda}</p>
              )}
            </div>
          </div>

          {/* Estoque */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantidade_estoque">Quantidade em Estoque *</Label>
              <Input
                id="quantidade_estoque"
                type="number"
                min="0"
                value={formData.quantidade_estoque}
                onChange={(e) => handleChange("quantidade_estoque", e.target.value)}
                className={errors.quantidade_estoque ? "border-red-500" : ""}
              />
              {errors.quantidade_estoque && (
                <p className="text-xs text-red-500 mt-1">{errors.quantidade_estoque}</p>
              )}
            </div>
            <div>
              <Label htmlFor="estoque_minimo">Estoque Minimo</Label>
              <Input
                id="estoque_minimo"
                type="number"
                min="0"
                value={formData.estoque_minimo}
                onChange={(e) => handleChange("estoque_minimo", e.target.value)}
              />
            </div>
          </div>

          {/* Descricao */}
          <div>
            <Label htmlFor="descricao">Descricao</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange("descricao", e.target.value)}
              rows={2}
              placeholder="Descricao opcional do produto"
            />
          </div>

          {/* URL da Foto */}
          <div>
            <Label htmlFor="foto_url">URL da Foto</Label>
            <Input
              id="foto_url"
              value={formData.foto_url}
              onChange={(e) => handleChange("foto_url", e.target.value)}
              placeholder="https://exemplo.com/foto.jpg"
            />
            {formData.foto_url && (
              <div className="mt-2">
                <img
                  src={formData.foto_url}
                  alt="Preview"
                  className="h-20 w-20 object-cover rounded border"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="ativo">Produto ativo</Label>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => handleChange("ativo", checked)}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                produto ? "Salvar Alteracoes" : "Criar Produto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}