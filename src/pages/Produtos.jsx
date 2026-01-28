import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Package,
  Filter,
  Grid3X3,
  List,
  Eye,
  Palette,
  Tag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Image as ImageIcon,
  Loader2,
  Upload,
  ChevronDown,
  ChevronUp,
  Ruler
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import ProdutoCadastroCompleto from "@/components/produtos/ProdutoCadastroCompleto";
import ProdutoQuickEditModal from "@/components/produtos/ProdutoQuickEditModal";
import ProdutoVariacoesModal from "@/components/produtos/ProdutoVariacoesModal";
import ImportProdutosModal from "@/components/produtos/ImportProdutosModal";
import { formatPrice } from "@/utils/productFormatters";
import { CATEGORIAS } from "@/constants/productConstants";

export default function Produtos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("todas");
  const [selectedStatus, setSelectedStatus] = useState("todos");
  const [viewMode, setViewMode] = useState("grid"); // grid ou list
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isVariacoesModalOpen, setIsVariacoesModalOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [selectedProdutoPai, setSelectedProdutoPai] = useState(null);
  const [savingProduto, setSavingProduto] = useState(false);
  const { user, loading } = useAuth();

  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list('nome'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Produto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success("Produto excluído com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    }
  });

  // Verificações de permissão
  const isAdmin = user?.cargo === 'Administrador';
  const isManager = user?.cargo === 'Gerente';
  const isWarehouse = user?.cargo === 'Estoque';
  const canEdit = isAdmin || isManager || isWarehouse;
  const canDelete = isAdmin || isManager;

  // Helper para calcular estoque total (CD + lojas mostruário)
  const getEstoqueTotal = (p) => {
    return (p?.estoque_cd || 0) +
      (p?.estoque_mostruario_mega_store || 0) +
      (p?.estoque_mostruario_centro || 0) +
      (p?.estoque_mostruario_ponte_branca || 0) +
      (p?.estoque_mostruario_futura || 0);
  };

  // Categorias únicas dos produtos
  const categoriasDisponiveis = useMemo(() => {
    // Pegar categorias apenas dos produtos pai
    const cats = new Set((produtos || []).filter(p => p.is_parent === true).map(p => p.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [produtos]);

  // Mapa de informações das variações por produto pai (contagem, preços, cores e estoque)
  const variationInfoMap = useMemo(() => {
    const map = {};
    (produtos || []).forEach(p => {
      if (p.parent_id) {
        if (!map[p.parent_id]) {
          map[p.parent_id] = {
            count: 0,
            prices: [],
            minPrice: null,
            maxPrice: null,
            allSamePrice: true,
            colorStock: {}, // { cor: estoque }
            totalStock: 0
          };
        }
        map[p.parent_id].count += 1;
        if (p.preco_venda) {
          map[p.parent_id].prices.push(p.preco_venda);
        }
        if (p.cor) {
          // Calcular estoque total: CD + todas as lojas mostruário
          const estoqueTotal = (p.estoque_cd || 0) +
            (p.estoque_mostruario_mega_store || 0) +
            (p.estoque_mostruario_centro || 0) +
            (p.estoque_mostruario_ponte_branca || 0) +
            (p.estoque_mostruario_futura || 0);
          if (!map[p.parent_id].colorStock[p.cor]) {
            map[p.parent_id].colorStock[p.cor] = 0;
          }
          map[p.parent_id].colorStock[p.cor] += estoqueTotal;
          map[p.parent_id].totalStock += estoqueTotal;
        }
      }
    });
    // Calcular min, max e verificar se todos os preços são iguais
    Object.keys(map).forEach(parentId => {
      const info = map[parentId];
      if (info.prices.length > 0) {
        info.minPrice = Math.min(...info.prices);
        info.maxPrice = Math.max(...info.prices);
        info.allSamePrice = info.minPrice === info.maxPrice;
      }
      // Converter colorStock para lista com formato "COR (QTD)"
      info.colorList = Object.entries(info.colorStock).map(([cor, qtd]) => `${cor} (${qtd})`);
      info.colorNames = Object.keys(info.colorStock);
    });
    return map;
  }, [produtos]);

  // Atalho para contagem (compatibilidade)
  const variationCountMap = useMemo(() => {
    const map = {};
    Object.keys(variationInfoMap).forEach(id => {
      map[id] = variationInfoMap[id].count;
    });
    return map;
  }, [variationInfoMap]);

  // Estatísticas - apenas produtos pai
  const stats = useMemo(() => {
    // Garantir que is_parent seja tratado como booleano
    const produtosPai = (produtos || []).filter(p => !!p.is_parent);
    const variacoes = (produtos || []).filter(p => !p.is_parent && p.parent_id);
    return {
      total: produtosPai.length,
      variacoes: variacoes.length,
      ativos: produtosPai.filter(p => p.ativo !== false).length,
      inativos: produtosPai.filter(p => p.ativo === false).length,
      semFoto: produtosPai.filter(p => !p.fotos?.length).length,
      semPreco: produtosPai.filter(p => !p.preco_venda).length,
    };
  }, [produtos]);

  // Filtragem - apenas produtos pai
  const filteredProdutos = useMemo(() => {
    return (produtos || [])
      .filter(produto => !!produto.is_parent) // Filtro robusto para Truthy
      .filter(produto => {
        // Busca multi-termo: cada palavra deve estar em algum campo
        const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        const searchableText = [
          produto.nome,
          produto.modelo_referencia,
          produto.categoria,
          produto.ambiente,
          produto.codigo_barras,
          produto.sku,
          produto.fornecedor_nome,
          produto.cor,
          String(produto.largura || ''),
          String(produto.altura || '')
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesSearch = searchTerms.length === 0 ||
          searchTerms.every(term => searchableText.includes(term));

        const matchesCategoria = selectedCategoria === "todas" || produto.categoria === selectedCategoria;

        const matchesStatus =
          selectedStatus === "todos" ||
          (selectedStatus === "ativo" && produto.ativo !== false) ||
          (selectedStatus === "inativo" && produto.ativo === false) ||
          (selectedStatus === "semFoto" && !produto.fotos?.length) ||
          (selectedStatus === "atencao" && produto.requer_atencao);

        return matchesSearch && matchesCategoria && matchesStatus;
      });
  }, [produtos, searchTerm, selectedCategoria, selectedStatus]);

  const handleEdit = (produto) => {
    setEditingProduto(produto);
    setIsQuickEditOpen(true);
  };

  const handleQuickSave = async (data) => {
    try {
      await base44.entities.Produto.update(editingProduto.id, data);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setIsQuickEditOpen(false);
      setEditingProduto(null);
    } catch (error) {
      throw error;
    }
  };

  const handleNew = () => {
    setEditingProduto(null);
    setIsModalOpen(true);
  };

  const handleDuplicate = (produto) => {
    // Cria uma cópia do produto para edição
    const copy = {
      ...produto,
      id: undefined,
      nome: `${produto.nome} (Cópia)`,
      codigo_barras: null,
    };
    setEditingProduto(copy);
    setIsModalOpen(true);
  };

  const handleDelete = async (produto) => {
    const confirmed = await confirm({
      title: "Excluir Produto",
      message: `Tem certeza que deseja excluir "${produto.nome}"? Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      variant: "destructive"
    });
    if (confirmed) {
      deleteMutation.mutate(produto.id);
    }
  };

  const handleSave = async (data) => {
    setSavingProduto(true);
    try {
      if (editingProduto?.id) {
        await base44.entities.Produto.update(editingProduto.id, data);
        toast.success("Produto atualizado com sucesso");
      } else {
        await base44.entities.Produto.create(data);
        toast.success("Produto cadastrado com sucesso");
      }
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setIsModalOpen(false);
      setEditingProduto(null);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar produto: " + error.message);
    } finally {
      setSavingProduto(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#07593f' }}>
              Catálogo de Produtos
            </h1>
            <p className="text-gray-500">
              Gerencie seu catálogo de produtos, categorias e variações
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                onClick={() => setIsImportModalOpen(true)}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Upload className="w-5 h-5" />
                Importar CSV
              </Button>
              <Button
                onClick={handleNew}
                size="lg"
                className="gap-2"
                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
              >
                <Plus className="w-5 h-5" />
                Novo Produto
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Card
            className={`cursor-pointer transition-all ${selectedStatus === 'todos' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
            onClick={() => setSelectedStatus('todos')}
          >
            <CardContent className="p-4 text-center">
              <Package className="w-6 h-6 mx-auto mb-1 text-gray-500" />
              <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${selectedStatus === 'ativo' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
            onClick={() => setSelectedStatus('ativo')}
          >
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
              <p className="text-xs text-gray-500">Ativos</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${selectedStatus === 'inativo' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
            onClick={() => setSelectedStatus('inativo')}
          >
            <CardContent className="p-4 text-center">
              <XCircle className="w-6 h-6 mx-auto mb-1 text-red-400" />
              <p className="text-2xl font-bold text-red-500">{stats.inativos}</p>
              <p className="text-xs text-gray-500">Inativos</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${selectedStatus === 'comVariacoes' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
            onClick={() => setSelectedStatus('comVariacoes')}
          >
            <CardContent className="p-4 text-center">
              <Palette className="w-6 h-6 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold text-purple-600">{stats.comVariacoes}</p>
              <p className="text-xs text-gray-500">Com Variações</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${selectedStatus === 'semFoto' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
            onClick={() => setSelectedStatus('semFoto')}
          >
            <CardContent className="p-4 text-center">
              <ImageIcon className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
              <p className="text-2xl font-bold text-yellow-600">{stats.semFoto}</p>
              <p className="text-xs text-gray-500">Sem Foto</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${selectedStatus === 'atencao' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
            onClick={() => setSelectedStatus('atencao')}
          >
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-orange-500" />
              <p className="text-2xl font-bold text-orange-600">{stats.semPreco}</p>
              <p className="text-xs text-gray-500">Sem Preço</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, código, categoria ou fornecedor..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Categorias</SelectItem>
                  {categoriasDisponiveis.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="px-3"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="px-3"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredProdutos.length === 0 && (
          <Card className="py-16 text-center">
            <CardContent>
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {searchTerm || selectedCategoria !== 'todas' || selectedStatus !== 'todos'
                  ? 'Nenhum produto encontrado'
                  : 'Nenhum produto cadastrado'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || selectedCategoria !== 'todas' || selectedStatus !== 'todos'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Comece cadastrando seu primeiro produto'}
              </p>
              {canEdit && !searchTerm && selectedCategoria === 'todas' && selectedStatus === 'todos' && (
                <Button onClick={handleNew} className="gap-2" style={{ backgroundColor: '#07593f' }}>
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Produto
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Grid View */}
        {!isLoading && filteredProdutos.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProdutos.map(produto => (
              <Card
                key={produto.id}
                className={`group overflow-hidden transition-all hover:shadow-lg cursor-pointer ${produto.ativo === false ? 'opacity-60' : ''}`}
                onClick={() => {
                  setSelectedProdutoPai(produto);
                  setIsVariacoesModalOpen(true);
                }}
              >
                {/* Image */}
                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                  {produto.fotos?.[0] ? (
                    <img
                      src={produto.fotos[0]}
                      alt={produto.nome}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-gray-300" />
                    </div>
                  )}

                  {/* Status badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {produto.ativo === false && (
                      <Badge className="bg-red-500 text-white">Inativo</Badge>
                    )}
                  </div>

                  {/* Quick actions overlay */}
                  {canEdit && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleEdit(produto)}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleDuplicate(produto)}
                        title="Duplicar"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleDelete(produto)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate" title={`${produto.nome}${produto.modelo_referencia ? ' ' + produto.modelo_referencia : ''}`}>
                        {produto.nome}{produto.modelo_referencia ? ` ${produto.modelo_referencia}` : ''}
                      </h3>
                      <p className="text-sm text-gray-500">{produto.categoria}</p>
                      {produto.largura && produto.altura && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Ruler className="w-3 h-3" />
                          {produto.largura}×{produto.altura}{produto.profundidade ? `×${produto.profundidade}` : ''} cm
                        </p>
                      )}
                      {produto.fornecedor_nome && (
                        <p className="text-xs text-gray-400 mt-0.5">{produto.fornecedor_nome}</p>
                      )}
                      {/* Lista de cores com estoque */}
                      {variationInfoMap[produto.id]?.colorList?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {variationInfoMap[produto.id].colorList.map((item, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#e8f5e9', color: '#07593f' }}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    {(() => {
                      const info = variationInfoMap[produto.id];
                      // Se tem variações com preços diferentes
                      if (info && !info.allSamePrice && info.minPrice && info.maxPrice) {
                        return (
                          <p className="text-sm text-gray-600">
                            <span className="font-bold" style={{ color: '#07593f' }}>
                              {formatPrice(info.minPrice)}
                            </span>
                            <span className="mx-1">-</span>
                            <span className="font-bold" style={{ color: '#07593f' }}>
                              {formatPrice(info.maxPrice)}
                            </span>
                          </p>
                        );
                      }
                      // Se tem variações com mesmo preço, usar o preço da variação
                      if (info && info.allSamePrice && info.minPrice) {
                        return (
                          <p className="text-lg font-bold" style={{ color: '#07593f' }}>
                            {formatPrice(info.minPrice)}
                          </p>
                        );
                      }
                      // Se não tem variações ou preço do pai
                      if (produto.preco_venda) {
                        return (
                          <p className="text-lg font-bold" style={{ color: '#07593f' }}>
                            {formatPrice(produto.preco_venda)}
                          </p>
                        );
                      }
                      // Sem preço definido
                      return (
                        <p className="text-sm text-gray-400 italic">Ver detalhes</p>
                      );
                    })()}
                    <Badge variant="outline" className="text-xs">
                      Est: {getEstoqueTotal(produto)}
                    </Badge>
                  </div>

                  {/* Tags indicativas */}
                  {(produto.requer_atencao || !produto.preco_venda) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {!produto.preco_venda && (
                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                          Sem preço
                        </Badge>
                      )}
                      {produto.requer_atencao && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          Atenção
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Footer com indicação de clique */}
                  <div className="mt-3 pt-3 border-t text-center">
                    <p className="text-xs text-gray-400">
                      {variationCountMap[produto.id] > 1
                        ? `Clique para ver ${variationCountMap[produto.id]} opções`
                        : 'Clique para ver detalhes'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* List View */}
        {!isLoading && filteredProdutos.length > 0 && viewMode === 'list' && (
          <Card>
            <div className="divide-y">
              {filteredProdutos.map(produto => (
                <div
                  key={produto.id}
                  className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${produto.ativo === false ? 'opacity-60' : ''}`}
                >
                  {/* Thumb */}
                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {produto.fotos?.[0] ? (
                      <img
                        src={produto.fotos[0]}
                        alt={produto.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {produto.nome}{produto.modelo_referencia ? ` ${produto.modelo_referencia}` : ''}
                      </h3>
                      {produto.ativo === false && (
                        <Badge className="bg-red-100 text-red-700">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {produto.categoria}
                      {produto.fornecedor_nome && ` • ${produto.fornecedor_nome}`}
                      {produto.largura && produto.altura && ` • ${produto.largura}×${produto.altura}${produto.profundidade ? `×${produto.profundidade}` : ''} cm`}
                    </p>
                    {/* Lista de cores com estoque */}
                    {variationInfoMap[produto.id]?.colorList?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {variationInfoMap[produto.id].colorList.map((item, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: '#e8f5e9', color: '#07593f' }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Price and Stock */}
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: '#07593f' }}>
                      {variationInfoMap[produto.id]?.minPrice
                        ? (variationInfoMap[produto.id].allSamePrice
                          ? formatPrice(variationInfoMap[produto.id].minPrice)
                          : `${formatPrice(variationInfoMap[produto.id].minPrice)} - ${formatPrice(variationInfoMap[produto.id].maxPrice)}`)
                        : formatPrice(produto.preco_venda)
                      }
                    </p>
                    <p className="text-sm text-gray-500">
                      Estoque: {variationInfoMap[produto.id]?.totalStock ?? getEstoqueTotal(produto)}
                    </p>
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(produto)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(produto)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(produto)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Results Count */}
        {!isLoading && filteredProdutos.length > 0 && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Exibindo {filteredProdutos.length} de {stats.total} produtos
          </p>
        )}
      </div>

      {/* Modal de Cadastro */}
      <ProdutoCadastroCompleto
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduto(null);
        }}
        onSave={handleSave}
        produto={editingProduto}
        isLoading={savingProduto}
      />

      {/* Modal de Edição Rápida */}
      <ProdutoQuickEditModal
        isOpen={isQuickEditOpen}
        onClose={() => {
          setIsQuickEditOpen(false);
          setEditingProduto(null);
        }}
        produto={editingProduto}
        onSave={handleQuickSave}
      />

      {/* Modal de Importação */}
      <ImportProdutosModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['produtos'] })}
      />

      {/* Modal de Variações */}
      <ProdutoVariacoesModal
        isOpen={isVariacoesModalOpen}
        onClose={() => {
          setIsVariacoesModalOpen(false);
          setSelectedProdutoPai(null);
        }}
        produtoPai={selectedProdutoPai}
        onEditVariacao={(variacao) => {
          setEditingProduto(variacao);
          setIsQuickEditOpen(true);
          setIsVariacoesModalOpen(false);
        }}
      />
    </div>
  );
}