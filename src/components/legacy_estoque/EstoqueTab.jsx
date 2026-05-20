import React, { useState, useEffect, useMemo } from "react";
import { normSearch } from "@/lib/utils";
import { base44, supabase } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MoreHorizontal, Trash2, Edit, ArrowRightLeft, Filter, Loader2, PackageOpen, Plus, AlertCircle, Ruler, Layers, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import ProdutoCadastroCompleto from "../produtos/ProdutoCadastroCompleto";
import ProdutoConferenciaModal from "./ProdutoConferenciaModal";
import ProductIncompleteIndicator from "../produtos/ProductIncompleteIndicator";
import { getColorHex } from "../produtos/FurnitureColorPicker";
import MovimentacaoModal from "./MovimentacaoModal";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";
import GeradorEtiquetasModal from "./GeradorEtiquetasModal";
import { useLojas } from "@/hooks/useLojas";
import { obterCampoEstoqueDaLoja } from "@/constants/productConstants";

export default function EstoqueTab({ user }) {
  const { data: lojasAtivas = [] } = useLojas();
  const lojasComCd = useMemo(() => {
    const hasCd = lojasAtivas.some((loja) => obterCampoEstoqueDaLoja(loja) === 'estoque_cd');
    if (hasCd) return lojasAtivas;
    return [{ id: 'cd-fallback', nome: 'Depósito / CD' }, ...lojasAtivas];
  }, [lojasAtivas]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("todas");
  const [selectedFabricante, setSelectedFabricante] = useState("todos");
  const [selectedOrdenacao, setSelectedOrdenacao] = useState("alfabetica");
  const [selectedDirecao, setSelectedDirecao] = useState("asc");
  const [filtroAtencao, setFiltroAtencao] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [cadastroProduto, setCadastroProduto] = useState(null);
  const [focusField, setFocusField] = useState(null);
  const [movingProduto, setMovingProduto] = useState(null);
  const [isCadastroModalOpen, setIsCadastroModalOpen] = useState(false);
  const [isConferenciaModalOpen, setIsConferenciaModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isGeradorEtiquetasOpen, setIsGeradorEtiquetasOpen] = useState(false);
  const [produtosParaEtiqueta, setProdutosParaEtiqueta] = useState([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Listen for header action event
  useEffect(() => {
    const handleAction = (e) => {
      if (e.detail === 'estoque') {
        setCadastroProduto(null);
        setFocusField(null);
        setIsCadastroModalOpen(true);
      }
    };
    window.addEventListener('estoque-header-action', handleAction);
    return () => window.removeEventListener('estoque-header-action', handleAction);
  }, []);

  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // Mantem a aba de estoque sincronizada entre operadores em tempo real.
  useEffect(() => {
    const channel = supabase
      .channel('estoque-tab-produtos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produtos' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['produtos-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['produtos-atencao-count'] });
          queryClient.invalidateQueries({ queryKey: ['categorias-produtos'] });
          queryClient.invalidateQueries({ queryKey: ['fabricantes-produtos'] });
          queryClient.invalidateQueries({ queryKey: ['fabricantes-e-map'] });
          queryClient.invalidateQueries({ queryKey: ['produtos'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // 1. Categories Query (Distinct)
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-produtos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('categoria').not('categoria', 'is', null);
      if (error) throw error;
      const cats = [...new Set(data?.map(p => p.categoria))].filter(Boolean).sort();
      return cats;
    },
    staleTime: 1000 * 60 * 5 // Cache for 5 mins
  });

  const { data: fabricantesInfo = { items: [], fornecedoresById: {} } } = useQuery({
    queryKey: ['fabricantes-e-map'],
    queryFn: async () => {
      const { data: produtos, error } = await supabase
        .from('produtos')
        .select('fornecedor_id, fornecedor_nome');

      if (error) throw error;

      const idsFornecedor = [...new Set(
        (produtos || [])
          .map((produto) => produto.fornecedor_id)
          .filter(Boolean)
      )];

      let fornecedoresById = {};
      if (idsFornecedor.length > 0) {
        try {
          const { data: fornecedores, error: fornecedoresError } = await supabase
            .from('fornecedores')
            .select('id, nome_empresa')
            .in('id', idsFornecedor);

          if (!fornecedoresError && fornecedores) {
            fornecedoresById = fornecedores.reduce((acc, fornecedor) => {
              const id = String(fornecedor.id || '');
              const nome = String(fornecedor.nome_empresa || '').trim();
              if (id && nome) acc[id] = nome;
              return acc;
            }, {});
          }
        } catch (_) {
          // Falha silenciosa: usa apenas fornecedor_nome texto como fallback
        }
      }

      const items = [...new Set(
        (produtos || [])
          .map((produto) => {
            const id = String(produto.fornecedor_id || '');
            const nomeDoId = id ? fornecedoresById[id] : '';
            return (nomeDoId || produto.fornecedor_nome || '').trim();
          })
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

      return { items, fornecedoresById };
    },
    staleTime: 1000 * 60 * 5
  });

  const fabricantes = fabricantesInfo.items || [];
  const fornecedoresById = fabricantesInfo.fornecedoresById || {};

  // 2. Attention Count Query
  // Note: This matches the filter logic used in the main query
  const { data: produtosComAtencao = 0 } = useQuery({
    queryKey: ['produtos-atencao-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('produtos')
        .select('*', { count: 'exact', head: true })
        .eq('requer_atencao', true);
      if (error) throw error;
      return count || 0;
    }
  });

  // 3. Main Infinite Query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ['produtos-paginated', debouncedSearch, selectedCategoria, filtroAtencao, selectedFabricante],
    queryFn: async ({ pageParam = 1 }) => {
      const filters = {};

      if (selectedCategoria !== 'todas') filters.categoria = selectedCategoria;
      if (filtroAtencao) filters.requer_atencao = 'true'; // converted to string due to object entry
      // Filtro de fabricante no servidor — evita o problema de paginação client-side
      // que deixava produtos de fornecedores alfabeticamente tardios (TOZZETO etc.) fora da tela
      if (selectedFabricante !== 'todos') filters.fornecedor_nome = selectedFabricante;

      return await base44.entities.Produto.search({
        page: pageParam,
        limit: 100,
        filters,
        search: debouncedSearch,
        orderBy: 'nome'
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      // lastPage is { data, count }
      const currentCount = allPages.flatMap(p => p.data).length;
      if (currentCount < lastPage.count) {
        return allPages.length + 1;
      }
      return undefined;
    },
    keepPreviousData: true
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Produto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-atencao-count'] });
      toast.success("Produto excluido com sucesso");
    }
  });

  const isAdmin = user?.cargo === 'Administrador';
  const isManager = user?.cargo === 'Gerente';
  const isWarehouse = user?.cargo === 'Estoque';
  const canEdit = isAdmin || isManager || isWarehouse;

  // Flatten pages to get all loaded products
  const flatProdutos = useMemo(
    () => data?.pages.flatMap(page => page.data) || [],
    [data]
  );
  const { produtosExibidos, isFuzzy } = useMemo(() => {
    let lista = [...flatProdutos];

    if (selectedFabricante !== 'todos') {
      lista = lista.filter((produto) => {
        const idFornecedor = String(produto.fornecedor_id || '');
        const fabricantePorId = idFornecedor ? fornecedoresById[idFornecedor] : '';
        const fabricante = (fabricantePorId || produto.fornecedor_nome || produto.marca || '').trim();
        return fabricante === selectedFabricante;
      });
    }

    // Quando há busca ativa, pontua os resultados do servidor por relevância
    if (debouncedSearch) {
      const termos = normSearch(debouncedSearch).split(/\s+/).filter(Boolean);
      if (termos.length > 0) {
        const scored = lista.map(p => {
          const texto = [p.nome, p.modelo_referencia, p.categoria, p.codigo_barras, p.sku, p.fornecedor_nome, p.cor]
            .filter(Boolean).map(normSearch).join(' ');
          const matches = termos.filter(t => texto.includes(t)).length;
          return { p, score: matches };
        });
        const exact = scored.filter(({ score }) => score === termos.length);
        const partials = scored.filter(({ score }) => score > 0 && score < termos.length);
        const fuzzy = exact.length === 0 && partials.length > 0;
        if (fuzzy) {
          return {
            produtosExibidos: partials.sort((a, b) => b.score - a.score).map(({ p }) => p),
            isFuzzy: true,
          };
        }
        lista = exact.map(({ p }) => p);
      }
    }

    switch (selectedOrdenacao) {
      case 'quantidade':
        lista.sort((a, b) => {
          const aQtd = a.quantidade_estoque || 0;
          const bQtd = b.quantidade_estoque || 0;
          return selectedDirecao === 'asc' ? aQtd - bQtd : bQtd - aQtd;
        });
        break;
      case 'preco':
        lista.sort((a, b) => {
          const aPreco = a.preco_venda || 0;
          const bPreco = b.preco_venda || 0;
          return selectedDirecao === 'asc' ? aPreco - bPreco : bPreco - aPreco;
        });
        break;
      case 'alfabetica':
      default:
        lista.sort((a, b) => {
          const comparacao = (a.nome || '').localeCompare((b.nome || ''), 'pt-BR', { sensitivity: 'base' });
          return selectedDirecao === 'asc' ? comparacao : comparacao * -1;
        });
        break;
    }

    return { produtosExibidos: lista, isFuzzy: false };
  }, [flatProdutos, fornecedoresById, debouncedSearch, selectedFabricante, selectedOrdenacao, selectedDirecao]);
  const totalCount = data?.pages[0]?.count || 0;

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Excluir Produto",
      message: "Tem certeza que deseja excluir este produto?",
      confirmText: "Excluir",
      variant: "destructive"
    });
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenProdutoEditor = (produto, nextFocusField = null) => {
    if (!produto) {
      setCadastroProduto(null);
      setFocusField(null);
      setIsCadastroModalOpen(true);
      return;
    }

    // Quando o clique vier do indicador de incompletude, mantemos o cadastro completo
    // para permitir corrigir todos os campos de produto.
    if (nextFocusField) {
      setCadastroProduto(produto);
      setFocusField(nextFocusField);
      setIsCadastroModalOpen(true);
      return;
    }

    // Fluxo principal da aba de estoque: conferencia + ajuste rapido.
    setEditingProduto(produto);
    setIsConferenciaModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
        <div className="p-4 border-b border-gray-100 dark:border-neutral-800 space-y-3">
          {/* Linha 1: Campo de busca full-width */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por palavras-chave: nome, cor, material, categoria, ambiente..."
              className="pl-10 h-11 text-base border-gray-200 dark:border-neutral-700"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Linha 2: Filtros e ações */}
          <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                <SelectTrigger className="w-48 border-gray-200 dark:border-neutral-700">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Categorias</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedFabricante} onValueChange={setSelectedFabricante}>
                <SelectTrigger className="w-48 border-gray-200 dark:border-neutral-700">
                  <SelectValue placeholder="Filtrar por fabricante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Fabricantes</SelectItem>
                  {fabricantes.map(fabricante => (
                    <SelectItem key={fabricante} value={fabricante}>{fabricante}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedOrdenacao} onValueChange={setSelectedOrdenacao}>
                <SelectTrigger className="w-48 border-gray-200 dark:border-neutral-700">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alfabetica">Ordem alfabetica (A-Z)</SelectItem>
                  <SelectItem value="quantidade">Quantidade</SelectItem>
                  <SelectItem value="preco">Preço</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedDirecao} onValueChange={setSelectedDirecao}>
                <SelectTrigger className="w-44 border-gray-200 dark:border-neutral-700">
                  <SelectValue placeholder="Direcao" />
                </SelectTrigger>
                <SelectContent>
                  {selectedOrdenacao === 'alfabetica' ? (
                    <>
                      <SelectItem value="asc">A-Z</SelectItem>
                      <SelectItem value="desc">Z-A</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="desc">Maior para menor</SelectItem>
                      <SelectItem value="asc">Menor para maior</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {produtosComAtencao > 0 && (
                <Button
                  variant={filtroAtencao ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroAtencao(!filtroAtencao)}
                  className={filtroAtencao ? "bg-yellow-600 hover:bg-yellow-700" : "border-yellow-400 text-yellow-700 hover:bg-yellow-50"}
                >
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Requer Atencao
                  <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">{produtosComAtencao}</Badge>
                </Button>
              )}
              {canEdit && (
                <>
                  <Button
                    onClick={() => { setProdutosParaEtiqueta([]); setIsGeradorEtiquetasOpen(true); }}
                    variant="outline"
                    className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Gerar Etiquetas
                  </Button>
                  <Button
                    onClick={() => handleOpenProdutoEditor(null)}
                    className="bg-green-700 hover:bg-green-800"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Produto
                  </Button>
                </>
              )}
            </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-neutral-950">
            <TableRow>
              <TableHead className="w-[300px]">Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">Estoque</TableHead>
              <TableHead className="text-right">Preco</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && produtosExibidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                    <p className="text-gray-500">Carregando estoque...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : produtosExibidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                      <PackageOpen className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">
                        {searchTerm ? "Nenhum produto encontrado" : "Estoque vazio"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {searchTerm ? `Nenhum resultado para "${searchTerm}"` : "Comece adicionando seu primeiro produto"}
                      </p>
                    </div>
                    {!searchTerm && canEdit && (
                      <Button
                        onClick={() => handleOpenProdutoEditor(null)}
                        className="mt-2 bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Produto
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              produtosExibidos.map(produto => {
                const quantidadeAtual = Number(produto.quantidade_estoque || 0);
                const estoqueMinimo = Number(produto.estoque_minimo || 0);
                const isOutOfStock = quantidadeAtual === 0;
                const isLowStock = quantidadeAtual > 0 && estoqueMinimo > 0 && quantidadeAtual <= estoqueMinimo;

                return (
                  <TableRow key={produto.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {produto.fotos?.[0] && (
                          <img
                            src={produto.fotos[0]}
                            alt={produto.nome}
                            className="w-10 h-10 rounded object-cover border"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {produto.nome}{produto.modelo_referencia ? ` ${produto.modelo_referencia}` : ''}
                            </p>
                            <ProductIncompleteIndicator
                              produto={produto}
                              canEdit={canEdit}
                              onSelectMissing={(missingItem) => handleOpenProdutoEditor(produto, missingItem.focusField)}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            {produto.codigo_barras && <span>COD: {produto.codigo_barras}</span>}
                            {!produto.ativo && <Badge variant="outline" className="text-red-600 border-red-200">Inativo</Badge>}
                            {produto.requer_atencao && (
                              <div className="flex flex-wrap gap-1">
                                {!produto.preco_venda && (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 text-[10px]">
                                    Sem preco
                                  </Badge>
                                )}
                                {!produto.fotos?.length && (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 text-[10px]">
                                    Sem foto
                                  </Badge>
                                )}
                                {!produto.ncm && (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 text-[10px]">
                                    Sem NCM
                                  </Badge>
                                )}
                                {!produto.categoria && (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 text-[10px]">
                                    Sem categoria
                                  </Badge>
                                )}
                                {produto.origem_nfe && (
                                  <Badge variant="outline" className="text-blue-600 border-blue-200 text-[10px]">
                                    Importado NFe
                                  </Badge>
                                )}
                              </div>
                            )}
                            {produto.origem_nfe && !produto.requer_atencao && (
                              <Badge variant="outline" className="text-blue-600 border-blue-200">NFe</Badge>
                            )}
                          </div>

                          {/* Detalhes do Produto (Dimensões, Material, Cor, Tamanho) */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 flex items-center" title="Dimensões (LxAxP)">
                              <Ruler className="w-3 h-3 mr-1 opacity-50" />
                              {(produto.largura || produto.altura || produto.profundidade)
                                ? `${produto.largura || '?'}x${produto.altura || '?'}x${produto.profundidade || '?'}`
                                : 'Dim: N/A'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center" title="Material">
                              <Layers className="w-3 h-3 mr-1 opacity-50" /> {produto.material || 'Mat: N/A'}
                            </span>
                            {produto.cor && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-100 flex items-center gap-1" title="Cor">
                                <div className="w-2 h-2 rounded-full border border-gray-300" style={{ background: getColorHex(produto.cor) }} />
                                {produto.cor}
                              </span>
                            )}
                            {produto.tamanho && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-100 flex items-center gap-1" title="Tamanho">
                                <Ruler className="w-3 h-3 mr-1 opacity-50" />
                                {produto.tamanho}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400">
                        {produto.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`font-medium ${(isLowStock || isOutOfStock) ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                          {produto.quantidade_estoque}
                        </span>
                        {isOutOfStock ? (
                          <Badge variant="destructive" className="h-4 px-1 text-[10px]">Zerado</Badge>
                        ) : isLowStock && (
                          <Badge variant="destructive" className="h-4 px-1 text-[10px]">Baixo</Badge>
                        )}
                        <div className="text-[10px] text-gray-500 flex gap-1 flex-wrap justify-center max-w-[120px]">
                          {lojasComCd.map(loja => {
                            const campo = obterCampoEstoqueDaLoja(loja);
                            const qtd = produto[campo];
                            if (qtd > 0) {
                              const sigla = loja.nome === "Depósito / CD" ? "CD" : 
                                            loja.nome === "Centro" ? "CN" :
                                            loja.nome === "Ponte Branca" ? "PB" :
                                            loja.nome.substring(0, 2).toUpperCase();
                              return (
                                <span key={loja.id} title={loja.nome}>
                                  {sigla}:{qtd}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-900 dark:text-white">
                      R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setProdutosParaEtiqueta([produto]); setIsGeradorEtiquetasOpen(true); }}>
                              <Printer className="mr-2 h-4 w-4" /> Imprimir Etiqueta
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setMovingProduto(produto); setIsMoveModalOpen(true); }}>
                              <ArrowRightLeft className="mr-2 h-4 w-4 text-blue-600" /> Movimentar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleOpenProdutoEditor(produto)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(produto.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Load More Trigger */}
      {hasNextPage && (
        <div className="flex justify-center py-6">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
            className="w-full sm:w-auto min-w-[200px]"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Carregando mais...
              </>
            ) : (
              <span className="flex items-center gap-2">
                {`Carregar mais (Visualizando ${produtosExibidos.length} de ${totalCount})`}
                {isFuzzy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">resultado mais próximo</span>}
              </span>
            )}
          </Button>
        </div>
      )}

      <ProdutoConferenciaModal
        isOpen={isConferenciaModalOpen}
        onClose={() => {
          setIsConferenciaModalOpen(false);
          setEditingProduto(null);
        }}
        produto={editingProduto}
        onSave={async (data) => {
          try {
            if (!editingProduto?.id) return;
            await base44.entities.Produto.update(editingProduto.id, data);
            queryClient.invalidateQueries({ queryKey: ['produtos-paginated'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            queryClient.invalidateQueries({ queryKey: ['produtos-atencao-count'] });
          } catch (error) {
            console.error("Erro ao salvar conferencia de estoque:", error);
            throw error;
          }
        }}
      />

      <ProdutoCadastroCompleto
        isOpen={isCadastroModalOpen}
        onClose={() => {
          setIsCadastroModalOpen(false);
          setCadastroProduto(null);
          setFocusField(null);
        }}
        produto={cadastroProduto}
        focusField={focusField}
        onSave={async (data) => {
          try {
            if (cadastroProduto) {
              await base44.entities.Produto.update(cadastroProduto.id, data);
              toast.success("Produto atualizado com sucesso");
            } else {
              await base44.entities.Produto.create(data);
              toast.success("Produto criado com sucesso");
            }
            queryClient.invalidateQueries({ queryKey: ['produtos-paginated'] });
            queryClient.invalidateQueries({ queryKey: ['produtos-atencao-count'] });
            queryClient.invalidateQueries({ queryKey: ['categorias-produtos'] }); // Update categories too
            queryClient.invalidateQueries({ queryKey: ['fabricantes-produtos'] });
            queryClient.invalidateQueries({ queryKey: ['fabricantes-produtos-v2'] });
            queryClient.invalidateQueries({ queryKey: ['fabricantes-e-map'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setIsCadastroModalOpen(false);
            setCadastroProduto(null);
            setFocusField(null);
          } catch (error) {
            console.error("Erro ao salvar produto:", error);
            toast.error("Erro ao salvar produto: " + error.message);
          }
        }}
      />

      <MovimentacaoModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        produto={movingProduto}
      />

      <GeradorEtiquetasModal
        isOpen={isGeradorEtiquetasOpen}
        onClose={() => setIsGeradorEtiquetasOpen(false)}
        produtosPreSelecionados={produtosParaEtiqueta}
        user={user}
      />
    </div>
  );
}