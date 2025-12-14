import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { Upload, X, Loader2, Plus, Trash2, Image as ImageIcon, Eye, Barcode, ArrowUp, ArrowDown, Tag, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const categorias = ["Sofá", "Cama", "Mesa", "Cadeira", "Armário", "Estante", "Rack", "Poltrona", "Escrivaninha", "Criado-mudo", "Buffet", "Aparador", "Banco", "Outros"];
const ambientes = ["Quarto", "Sala", "Cozinha", "Escritório", "Banheiro", "Área Externa", "Hall", "Varanda"];

export default function ProdutoModal({ isOpen, onClose, onSave, produto, isLoading }) {
  const [formData, setFormData] = useState({
    codigo_barras: "",
    nome: "",
    categoria: "",
    ambiente: "",
    descricao: "",
    largura: "",
    altura: "",
    profundidade: "",
    material: "",
    cor: "",
    tags: [],
    variacoes: [],
    fotos: [],
    preco_venda: "",
    preco_custo: "",
    quantidade_estoque: "",
    estoque_minimo: "5",
    ativo: true,
  });

  const [uploadingImages, setUploadingImages] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [buscandoCodigoBarras, setBuscandoCodigoBarras] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState({});
  const [novaVariacao, setNovaVariacao] = useState({
    tamanho: "",
    cor: "",
    codigo_variacao: "",
    preco_adicional: 0,
    estoque: 0
  });
  const [ultimoBuscado, setUltimoBuscado] = useState("");

  useEffect(() => {
    if (produto) {
      setFormData({
        ...produto,
        codigo_barras: produto.codigo_barras || "",
        largura: produto.largura || "",
        altura: produto.altura || "",
        profundidade: produto.profundidade || "",
        preco_venda: produto.preco_venda || "",
        preco_custo: produto.preco_custo || "",
        quantidade_estoque: produto.quantidade_estoque || "",
        estoque_minimo: produto.estoque_minimo || "5",
        fotos: produto.fotos || [],
        variacoes: produto.variacoes || [],
        tags: produto.tags || [],
      });
    } else {
      setFormData({
        codigo_barras: "",
        nome: "",
        categoria: "",
        ambiente: "",
        descricao: "",
        largura: "",
        altura: "",
        profundidade: "",
        material: "",
        cor: "",
        tags: [],
        variacoes: [],
        fotos: [],
        preco_venda: "",
        preco_custo: "",
        quantidade_estoque: "",
        estoque_minimo: "5",
        ativo: true,
      });
      setUltimoBuscado("");
    }
    setErrors({});
  }, [produto, isOpen]);

  const buscarPorCodigoBarras = async (codigo) => {
    if (!codigo || codigo.length < 8) return;
    if (codigo === ultimoBuscado) return;

    setBuscandoCodigoBarras(true);
    setUltimoBuscado(codigo);

    try {
      const produtosExistentes = await base44.entities.Produto.filter({ codigo_barras: codigo });
      
      if (produtosExistentes && produtosExistentes.length > 0) {
        const produtoExistente = produtosExistentes[0];
        alert(`❌ Produto já cadastrado:\n${produtoExistente.nome}`);
        setBuscandoCodigoBarras(false);
        return;
      }

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Busque informações sobre o produto com código de barras EAN/GTIN: ${codigo}

INSTRUÇÕES ESSENCIAIS:
1. Busque em sites brasileiros de produtos: Buscapé, Zoom, Cosmos, Magazine Luiza, Casas Bahia, Mobly, MadeiraMadeira, Lojas Americanas
2. Use o código EXATO: ${codigo}
3. Retorne APENAS se encontrar o produto com este código EXATO
4. Priorize móveis e produtos de decoração
5. Se não encontrar ou houver dúvida, retorne objeto vazio {}

FORMATO DE RETORNO (apenas se encontrar com certeza):
{
  "nome": "nome COMPLETO e DETALHADO do produto incluindo marca/modelo",
  "categoria": "categoria que mais se adequa dentre: Sofá, Cama, Mesa, Cadeira, Armário, Estante, Rack, Poltrona, Escrivaninha, Criado-mudo, Buffet, Aparador, Banco, Outros",
  "material": "material principal (Madeira, MDF, Metal, Vidro, etc)",
  "cor": "cor principal do produto",
  "descricao": "descrição completa com medidas e características"
}

EXEMPLO ESPERADO para código 7899665079291:
{
  "nome": "Balcão De Cozinha Intenza 40cm Com Tampo Mdp - Nicioli",
  "categoria": "Outros",
  "material": "MDP",
  "cor": "Branco",
  "descricao": "Balcão de cozinha Intenza com 40cm de largura, tampo em MDP, da marca Nicioli"
}

RETORNE {} SE:
- Não encontrar o produto
- Encontrar produto diferente
- For eletrônico/não-móvel
- Houver qualquer dúvida`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            nome: { type: "string" },
            categoria: { type: "string" },
            material: { type: "string" },
            cor: { type: "string" },
            descricao: { type: "string" }
          }
        }
      });

      if (response && response.nome && response.nome.trim() !== "") {
        setFormData(prev => ({
          ...prev,
          nome: response.nome,
          categoria: categorias.includes(response.categoria) ? response.categoria : prev.categoria,
          material: response.material || prev.material,
          cor: response.cor || prev.cor,
          descricao: response.descricao || prev.descricao,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          nome: "",
          categoria: "",
          material: "",
          cor: "",
          descricao: ""
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar código de barras:", error);
    }

    setBuscandoCodigoBarras(false);
  };

  // Busca automática quando o código tiver 13 dígitos
  useEffect(() => {
    if (formData.codigo_barras.length === 13 && formData.codigo_barras !== ultimoBuscado) {
      buscarPorCodigoBarras(formData.codigo_barras);
    }
  }, [formData.codigo_barras]);

  const validateForm = () => {
    const newErrors = {};

    if (formData.codigo_barras && formData.codigo_barras.length < 8) {
      newErrors.codigo_barras = "Código de barras deve ter pelo menos 8 dígitos";
    }

    if (!formData.nome || formData.nome.trim().length < 3) {
      newErrors.nome = "Nome deve ter pelo menos 3 caracteres";
    }

    if (!formData.categoria) {
      newErrors.categoria = "Selecione uma categoria";
    }

    const precoVenda = parseFloat(formData.preco_venda);
    if (!precoVenda || precoVenda <= 0) {
      newErrors.preco_venda = "Preço de venda deve ser maior que zero";
    }

    const precoCusto = parseFloat(formData.preco_custo);
    if (formData.preco_custo && precoCusto && precoCusto > precoVenda) {
      newErrors.preco_custo = "Preço de custo não pode ser maior que o de venda";
    }

    const estoque = parseInt(formData.quantidade_estoque);
    if (!estoque && estoque !== 0) {
      newErrors.quantidade_estoque = "Quantidade de estoque é obrigatória";
    }
    if (estoque < 0) {
      newErrors.quantidade_estoque = "Quantidade não pode ser negativa";
    }

    const estoqueMin = parseInt(formData.estoque_minimo);
    if (estoqueMin < 0) {
      newErrors.estoque_minimo = "Estoque mínimo não pode ser negativo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);

    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const urls = results.map(result => result.file_url);

      setFormData(prev => ({
        ...prev,
        fotos: [...(prev.fotos || []), ...urls]
      }));
    } catch (error) {
      console.error("Erro ao fazer upload das imagens:", error);
      alert("Erro ao fazer upload das imagens. Tente novamente.");
    }

    setUploadingImages(false);
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      fotos: prev.fotos.filter((_, i) => i !== index)
    }));
  };

  const moveImage = (index, direction) => {
    const newFotos = [...formData.fotos];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newFotos.length) return;
    
    [newFotos[index], newFotos[newIndex]] = [newFotos[newIndex], newFotos[index]];
    
    setFormData(prev => ({
      ...prev,
      fotos: newFotos
    }));
  };

  const adicionarTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    
    if (formData.tags.includes(tag)) {
      alert("Tag já adicionada");
      return;
    }

    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tag]
    }));
    setTagInput("");
  };

  const removerTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const adicionarVariacao = () => {
    if (!novaVariacao.tamanho && !novaVariacao.cor) {
      alert("Preencha pelo menos tamanho ou cor");
      return;
    }

    setFormData(prev => ({
      ...prev,
      variacoes: [...(prev.variacoes || []), { ...novaVariacao }]
    }));

    setNovaVariacao({
      tamanho: "",
      cor: "",
      codigo_variacao: "",
      preco_adicional: 0,
      estoque: 0
    });
  };

  const removerVariacao = (index) => {
    setFormData(prev => ({
      ...prev,
      variacoes: prev.variacoes.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert("Por favor, corrija os erros no formulário");
      return;
    }

    const dataToSave = {
      ...formData,
      largura: formData.largura ? parseFloat(formData.largura) : undefined,
      altura: formData.altura ? parseFloat(formData.altura) : undefined,
      profundidade: formData.profundidade ? parseFloat(formData.profundidade) : undefined,
      preco_venda: parseFloat(formData.preco_venda),
      preco_custo: formData.preco_custo ? parseFloat(formData.preco_custo) : undefined,
      quantidade_estoque: parseInt(formData.quantidade_estoque),
      estoque_minimo: parseInt(formData.estoque_minimo),
    };

    onSave(dataToSave);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: '#07593f' }}>
            {produto ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Informações Básicas */}
            <Card className="border-2" style={{ borderColor: '#E5E0D8' }}>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg mb-4" style={{ color: '#07593f' }}>
                  Informações Básicas
                </h3>
                
                <div>
                  <Label htmlFor="codigo_barras">Código de Barras / EAN</Label>
                  <div className="relative">
                    <Input
                      id="codigo_barras"
                      value={formData.codigo_barras}
                      onChange={(e) => {
                        const valor = e.target.value.replace(/\D/g, '');
                        setFormData({ ...formData, codigo_barras: valor });
                        setErrors(prev => ({ ...prev, codigo_barras: null }));
                      }}
                      placeholder="Digite ou escaneie o código (busca automática)"
                      maxLength={13}
                      className={errors.codigo_barras ? "border-red-500" : ""}
                    />
                    {buscandoCodigoBarras && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#f38a4c' }} />
                      </div>
                    )}
                  </div>
                  {errors.codigo_barras && (
                    <p className="text-xs text-red-500 mt-1">{errors.codigo_barras}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Barcode className="w-4 h-4" style={{ color: '#8B8B8B' }} />
                    <p className="text-xs" style={{ color: '#8B8B8B' }}>
                      {buscandoCodigoBarras ? "🔍 Buscando em sites de produtos brasileiros..." : "Busca automática ao digitar 13 dígitos"}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome do Móvel *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => {
                        setFormData({ ...formData, nome: e.target.value });
                        setErrors(prev => ({ ...prev, nome: null }));
                      }}
                      className={errors.nome ? "border-red-500" : ""}
                      required
                    />
                    {errors.nome && (
                      <p className="text-xs text-red-500 mt-1">{errors.nome}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="categoria">Categoria *</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(value) => {
                        setFormData({ ...formData, categoria: value });
                        setErrors(prev => ({ ...prev, categoria: null }));
                      }}
                      required
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
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ambiente">Ambiente</Label>
                    <Select
                      value={formData.ambiente}
                      onValueChange={(value) => setFormData({ ...formData, ambiente: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ambientes.map(amb => (
                          <SelectItem key={amb} value={amb}>{amb}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="material">Material</Label>
                    <Input
                      id="material"
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      placeholder="Ex: Madeira, MDF, Metal"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Tags */}
                <div>
                  <Label>Tags de Busca</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Digite uma tag e pressione Enter"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          adicionarTag();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={adicionarTag}
                      size="sm"
                      style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          className="flex items-center gap-1 px-3 py-1"
                          style={{ backgroundColor: '#07593f', color: 'white' }}
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                          <X
                            className="w-3 h-3 cursor-pointer hover:opacity-70"
                            onClick={() => removerTag(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs mt-1" style={{ color: '#8B8B8B' }}>
                    Tags ajudam na busca e organização de produtos
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Dimensões */}
            <Card className="border-2" style={{ borderColor: '#E5E0D8' }}>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4" style={{ color: '#07593f' }}>
                  Dimensões e Cor
                </h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="largura">Largura (cm)</Label>
                    <Input
                      id="largura"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.largura}
                      onChange={(e) => setFormData({ ...formData, largura: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="altura">Altura (cm)</Label>
                    <Input
                      id="altura"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.altura}
                      onChange={(e) => setFormData({ ...formData, altura: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="profundidade">Profund. (cm)</Label>
                    <Input
                      id="profundidade"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.profundidade}
                      onChange={(e) => setFormData({ ...formData, profundidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cor">Cor Principal</Label>
                    <Input
                      id="cor"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      placeholder="Ex: Marrom"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variações */}
            <Card className="border-2" style={{ borderColor: '#f38a4c' }}>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg mb-2" style={{ color: '#f38a4c' }}>
                  Variações do Produto
                </h3>
                <p className="text-sm mb-4" style={{ color: '#8B8B8B' }}>
                  Adicione variações como diferentes tamanhos, cores ou modelos do produto
                </p>

                {formData.variacoes && formData.variacoes.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formData.variacoes.map((variacao, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}
                      >
                        <div className="flex-1 grid grid-cols-5 gap-2 text-sm">
                          <div>
                            <span className="font-medium" style={{ color: '#8B8B8B' }}>Tamanho:</span>
                            <p style={{ color: '#07593f' }}>{variacao.tamanho || '-'}</p>
                          </div>
                          <div>
                            <span className="font-medium" style={{ color: '#8B8B8B' }}>Cor:</span>
                            <p style={{ color: '#07593f' }}>{variacao.cor || '-'}</p>
                          </div>
                          <div>
                            <span className="font-medium" style={{ color: '#8B8B8B' }}>Código:</span>
                            <p style={{ color: '#07593f' }}>{variacao.codigo_variacao || '-'}</p>
                          </div>
                          <div>
                            <span className="font-medium" style={{ color: '#8B8B8B' }}>Preço +:</span>
                            <p style={{ color: '#07593f' }}>R$ {variacao.preco_adicional?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div>
                            <span className="font-medium" style={{ color: '#8B8B8B' }}>Estoque:</span>
                            <p style={{ color: '#07593f' }}>{variacao.estoque || 0} un.</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerVariacao(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-4 rounded-lg border-2 border-dashed space-y-3" style={{ borderColor: '#f38a4c' }}>
                  <h4 className="font-medium text-sm" style={{ color: '#f38a4c' }}>Nova Variação</h4>
                  <div className="grid md:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs">Tamanho</Label>
                      <Input
                        placeholder="Ex: P, M, G"
                        value={novaVariacao.tamanho}
                        onChange={(e) => setNovaVariacao({ ...novaVariacao, tamanho: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cor</Label>
                      <Input
                        placeholder="Ex: Azul"
                        value={novaVariacao.cor}
                        onChange={(e) => setNovaVariacao({ ...novaVariacao, cor: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Código</Label>
                      <Input
                        placeholder="SKU"
                        value={novaVariacao.codigo_variacao}
                        onChange={(e) => setNovaVariacao({ ...novaVariacao, codigo_variacao: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Preço Adicional (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={novaVariacao.preco_adicional}
                        onChange={(e) => setNovaVariacao({ ...novaVariacao, preco_adicional: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Estoque</Label>
                      <Input
                        type="number"
                        min="0"
                        value={novaVariacao.estoque}
                        onChange={(e) => setNovaVariacao({ ...novaVariacao, estoque: parseInt(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={adicionarVariacao}
                    size="sm"
                    className="w-full"
                    style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Variação
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upload de Imagens */}
            <Card className="border-2" style={{ borderColor: '#E5E0D8' }}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg" style={{ color: '#07593f' }}>
                    Fotos do Produto
                  </h3>
                  <Badge variant="outline">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    {formData.fotos?.length || 0} foto(s)
                  </Badge>
                </div>

                <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">
                      Use as setas para reordenar as fotos. A primeira foto será a principal.
                    </p>
                  </div>
                </div>

                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 transition-all" style={{ borderColor: '#E5E0D8' }}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImages}
                  />
                  {uploadingImages ? (
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin" style={{ color: '#07593f' }} />
                      <p className="font-medium" style={{ color: '#07593f' }}>Enviando imagens...</p>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>Aguarde</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: '#f38a4c' }} />
                      <p className="font-medium" style={{ color: '#07593f' }}>Clique para fazer upload</p>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>Suporta múltiplas imagens (JPG, PNG)</p>
                    </div>
                  )}
                </label>

                {formData.fotos && formData.fotos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.fotos.map((foto, index) => (
                      <div 
                        key={index} 
                        className="relative group rounded-lg overflow-hidden border-2 hover:shadow-lg transition-all"
                        style={{ borderColor: index === 0 ? '#07593f' : '#E5E0D8' }}
                      >
                        <div className="aspect-square">
                          <img
                            src={foto}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => moveImage(index, 'up')}
                            disabled={index === 0}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            style={{ background: '#07593f' }}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => moveImage(index, 'down')}
                            disabled={index === formData.fotos.length - 1}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            style={{ background: '#07593f' }}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setPreviewImage(foto)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            style={{ background: '#07593f' }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => removeImage(index)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 h-8 w-8 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="absolute top-2 left-2">
                          <Badge 
                            className="text-xs" 
                            style={{ backgroundColor: index === 0 ? '#07593f' : '#8B8B8B', color: 'white' }}
                          >
                            {index === 0 ? '★ Principal' : `#${index + 1}`}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preços e Estoque */}
            <Card className="border-2" style={{ borderColor: '#E5E0D8' }}>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg mb-4" style={{ color: '#07593f' }}>
                  Preços e Estoque
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preco_custo">Preço de Custo (R$)</Label>
                    <Input
                      id="preco_custo"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.preco_custo}
                      onChange={(e) => {
                        setFormData({ ...formData, preco_custo: e.target.value });
                        setErrors(prev => ({ ...prev, preco_custo: null }));
                      }}
                      className={errors.preco_custo ? "border-red-500" : ""}
                    />
                    {errors.preco_custo && (
                      <p className="text-xs text-red-500 mt-1">{errors.preco_custo}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="preco_venda">Preço de Venda (R$) *</Label>
                    <Input
                      id="preco_venda"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.preco_venda}
                      onChange={(e) => {
                        setFormData({ ...formData, preco_venda: e.target.value });
                        setErrors(prev => ({ ...prev, preco_venda: null }));
                      }}
                      className={errors.preco_venda ? "border-red-500" : ""}
                      required
                    />
                    {errors.preco_venda && (
                      <p className="text-xs text-red-500 mt-1">{errors.preco_venda}</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantidade_estoque">Quantidade em Estoque *</Label>
                    <Input
                      id="quantidade_estoque"
                      type="number"
                      min="0"
                      value={formData.quantidade_estoque}
                      onChange={(e) => {
                        setFormData({ ...formData, quantidade_estoque: e.target.value });
                        setErrors(prev => ({ ...prev, quantidade_estoque: null }));
                      }}
                      className={errors.quantidade_estoque ? "border-red-500" : ""}
                      required
                    />
                    {errors.quantidade_estoque && (
                      <p className="text-xs text-red-500 mt-1">{errors.quantidade_estoque}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                    <Input
                      id="estoque_minimo"
                      type="number"
                      min="0"
                      value={formData.estoque_minimo}
                      onChange={(e) => {
                        setFormData({ ...formData, estoque_minimo: e.target.value });
                        setErrors(prev => ({ ...prev, estoque_minimo: null }));
                      }}
                      className={errors.estoque_minimo ? "border-red-500" : ""}
                    />
                    {errors.estoque_minimo && (
                      <p className="text-xs text-red-500 mt-1">{errors.estoque_minimo}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                produto ? "Atualizar Produto" : "Criar Produto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle style={{ color: '#07593f' }}>Preview da Imagem</DialogTitle>
            </DialogHeader>
            <div className="relative w-full h-[70vh]">
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}