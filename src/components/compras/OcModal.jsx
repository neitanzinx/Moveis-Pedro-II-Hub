import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, Loader2, Lock, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { comprasService } from '@/services/comprasService';
import { base44 } from "@/api/base44Client";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { buildProductDisplayName } from '@/utils/productReference';
import FornecedorModal from '@/components/cadastros/FornecedorModal';
import ProdutoModal from '@/components/produtos/ProdutoModal';
import { gerarTextoPedidoOperacional } from '@/utils/orderFormatUtils';
import { calculateFinalPriceFromMarkup, toMultiplierFromPercent, toPercentFromMultiplier } from '@/utils/markupCalculator';

function buildProductSummary(produto) {
  if (!produto) return '';

  const detalhes = [
    produto.cor ? `Cor: ${produto.cor}` : null,
    produto.material ? `Material: ${produto.material}` : null,
    produto.largura || produto.altura || produto.profundidade
      ? `Medidas: ${produto.largura || '-'}x${produto.altura || '-'}x${produto.profundidade || '-'} cm`
      : null,
  ].filter(Boolean);

  return detalhes.join(' | ');
}

function buildNomeConsolidadoProduto(produto) {
  if (!produto || !produto.nome) return '';

  const nomePrincipal = produto.modelo_referencia
    ? `${produto.nome} - ${produto.modelo_referencia}`
    : produto.nome;

  const detalhes = [
    (produto.largura || produto.altura || produto.profundidade)
      ? `Medidas: ${produto.largura || '-'}x${produto.altura || '-'}x${produto.profundidade || '-'} cm`
      : null,
    produto.material ? `Material: ${produto.material}` : null,
  ].filter(Boolean);

  if (detalhes.length === 0) return nomePrincipal;
  return `${nomePrincipal} - ${detalhes.join(' | ')}`;
}

function extractItemFieldsFromProduct(produto) {
  return {
    modelo_referencia: produto?.modelo_referencia || '',
    cor: produto?.cor || '',
    material: produto?.material || '',
    largura: produto?.largura || '',
    altura: produto?.altura || '',
    profundidade: produto?.profundidade || '',
  };
}

function buildStructuredItemDetails(item) {
  const detalhes = [
    item?.cor ? `Cor: ${item.cor}` : null,
    item?.material ? `Material: ${item.material}` : null,
    item?.largura || item?.altura || item?.profundidade
      ? `Medidas: ${item.largura || '-'}x${item.altura || '-'}x${item.profundidade || '-'} cm`
      : null,
    item?.observacoes_item ? `Obs: ${item.observacoes_item}` : null,
  ].filter(Boolean);

  return detalhes.join(' | ');
}

function normalizeTerm(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchProductByAnyOrder(produto, termoBusca) {
  const termos = normalizeTerm(termoBusca)
    .split(/\s+/)
    .filter(Boolean);

  if (termos.length === 0) return true;

  const conteudoProduto = normalizeTerm([
    produto?.nome,
    produto?.modelo_referencia,
    produto?.cor,
    produto?.material,
    produto?.categoria,
  ].filter(Boolean).join(' '));

  return termos.every(termo => conteudoProduto.includes(termo));
}

function buildItemPricingFromCostAndMarkup(custo, markupMultiplicador, markupPercentual, additionalCosts = {}) {
  const custoNumerico = Number(custo) || 0;
  
  // Calcula o custo total considerando IPI, Frete e Montagem
  const custoTotal = calculateTotalCost(custoNumerico, additionalCosts);
  
  const precoSugerido = calculateFinalPriceFromMarkup(custoTotal, markupMultiplicador, markupPercentual);
  const precoFinal = precoSugerido > 0 ? precoSugerido : custoTotal;

  return {
    preco_custo_item: custoNumerico,
    custo_total: custoTotal,
    preco_final_sugerido: precoSugerido > 0 ? precoSugerido : null,
    preco_final_manual: precoFinal > 0 ? precoFinal : null,
    preco_unitario: precoFinal,
  };
}

function calculateTotalCost(precoCusto, additionalCosts = {}) {
  let total = precoCusto;
  const custos = {
    ipi_tipo: 'fixo',
    ipi_valor: 0,
    frete_tipo: 'fixo',
    frete_valor: 0,
    montagem_valor: 0,
    custo_total: 0,
    ...additionalCosts,
  };
    
  // IPI
  if (custos.ipi_tipo === 'fixo') {
    total += Number(custos.ipi_valor) || 0;
  } else if (custos.ipi_tipo === 'porcentagem') {
    total += precoCusto * ((Number(custos.ipi_valor) || 0) / 100);
  }
  
  // Frete
  if (custos.frete_tipo === 'fixo') {
    total += Number(custos.frete_valor) || 0;
  } else if (custos.frete_tipo === 'porcentagem') {
    total += precoCusto * ((Number(custos.frete_valor) || 0) / 100);
  }
  
  // Montagem (sempre fixo)
  total += Number(custos.montagem_valor) || 0;
  
  return total;
}

function createOcItemDefault() {
  return {
    produto_id: null,
    produto_nome: '',
    nome_completo_produto: '',
    quantidade_pedida: 1,
    preco_custo_item: 0,
    preco_unitario: 0,
    preco_tabela: 0,
    markup_multiplicador: '',
    markup_percentual: '',
    preco_final_sugerido: null,
    preco_final_manual: null,
    modelo_referencia: '',
    categoria: '',
    cor: '',
    cor_item: '',
    material: '',
    largura: '',
    altura: '',
    profundidade: '',
    observacoes_item: '',
    descricao_personalizada: '',
    tipo_item_oc: 'ORDEM_COMUM_ENCOMENDA',
    origem_solicitacao: 'VENDEDOR',
    pedido_origem_numero: '',
    reposicao_fabrica: false,
    motivo_assistencia: '',
    possui_imagens_videos: false,
    anexos_item: [],
  };
}


/**
 * Modal para CRUD de OCs (Ordens de Compra)
 * Modos:
 *  - Novo: cria nova OC
 *  - Editar: edita OC em status Rascunho
 *  - Duplicar: copia OC existente como nova
 *  - Ver Detalhes: apenas visualização
 */
export default function OcModal({
  isOpen,
  onClose,
  oc = null, // OC a editar (null = nova)
  onSuccess,
  onEnviar,
  modo = 'novo', // 'novo' | 'editar' | 'duplicar' | 'ver'
}) {
  const queryClient = useQueryClient();
  const { user, can } = useAuth();
  const { lojas } = useTenant();
  const isNovoOuDuplicar = !oc || oc.duplicar;
  const isVer = modo === 'ver';

  // Estado do formulário
  const [formData, setFormData] = useState({
    fornecedor_id: null,
    fornecedor_nome: '',
    centro_custo_id: null,
    data_previsao_entrega: '',
    observacoes: '',
    observacoes_internas: '',
    pedido_faturado: false,
    data_faturamento: '',
    forma_pagamento_oc: 'a_vista',
    observacoes_aprovacao: '',
    anexos_aprovacao: [],
    anexo_fornecedor: [],
    anexos_financeiro: [],
    canal_solicitacao: '',
    data_hora_criado: '',
    data_hora_enviado: '',
    canal_envio: '',
    quem_aceitou: '',
    pendencias: '',
  });

  const [uploadingAnexosAprovacao, setUploadingAnexosAprovacao] = useState(false);
  const [uploadingAnexoFornecedor, setUploadingAnexoFornecedor] = useState(false);
  const [uploadingAnexosFinanceiro, setUploadingAnexosFinanceiro] = useState(false);
  const [novoProdutoModalOpen, setNovoProdutoModalOpen] = useState(false);
  const [salvandoNovoProduto, setSalvandoNovoProduto] = useState(false);

  const [itens, setItens] = useState([]);
  const [novoItem, setNovoItem] = useState(createOcItemDefault());
  const [bulkMarkupPercentual, setBulkMarkupPercentual] = useState('');
  const [bulkFiltroSerieTipo, setBulkFiltroSerieTipo] = useState('todos');
  const [bulkFiltroSerieValor, setBulkFiltroSerieValor] = useState('todos');
  const [bulkPersistirCadastro, setBulkPersistirCadastro] = useState(false);

  const [showAlertDelete, setShowAlertDelete] = useState(false);
  const [itemParaDeleter, setItemParaDeleter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetalhes, setIsLoadingDetalhes] = useState(false);
  const [fornecedorModalOpen, setFornecedorModalOpen] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [mostrarSugestoesProduto, setMostrarSugestoesProduto] = useState(false);
  const [limiteProdutos, setLimiteProdutos] = useState(5);
  const descricaoNovoItemRef = useRef(null);
  const dropdownProdutoRef = useRef(null);

  // Query: fornecedores
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list('nome_empresa'),
  });

  // Query: produtos do fornecedor selecionado (suporta vínculo por ID e legados por nome)
  const { data: produtosDoFornecedor = [], isLoading: carregandoProdutos } = useQuery({
    queryKey: ['produtos-fornecedor', formData.fornecedor_id, formData.fornecedor_nome],
    queryFn: async () => {
      const selectColumns = 'id, nome, preco_custo, preco_venda, markup_aplicado, modelo_referencia, cor, material, categoria, largura, altura, profundidade, fornecedor_id, fornecedor_nome, parent_id, is_parent';

      const idFornecedor = formData.fornecedor_id;
      let dataPorId = [];

      if (idFornecedor !== null && idFornecedor !== undefined && String(idFornecedor).trim() !== '') {
        const { data, error } = await supabase
          .from('produtos')
          .select(selectColumns)
          .eq('fornecedor_id', idFornecedor)
          .order('nome', { ascending: true });

        if (error) {
          const erroFiltroInvalidoUuid =
            error.code === '22P02' ||
            /invalid input syntax for type uuid/i.test(String(error.message || ''));

          if (!erroFiltroInvalidoUuid) {
            throw error;
          }
        } else {
          dataPorId = data || [];
        }
      }

      const nomeFornecedor = String(formData.fornecedor_nome || '').trim();
      if (!nomeFornecedor) {
        return dataPorId || [];
      }

      const nomeFornecedorEscapado = nomeFornecedor.replace(/[%,]/g, '').trim();

      const { data: dataPorNome, error: errorPorNome } = await supabase
        .from('produtos')
        .select(selectColumns)
        .ilike('fornecedor_nome', `%${nomeFornecedorEscapado}%`)
        .order('nome', { ascending: true });

      if (errorPorNome) throw errorPorNome;

      const mapaPorId = new Map();
      [...(dataPorId || []), ...(dataPorNome || [])].forEach((produto) => {
        if (!produto?.id) return;
        mapaPorId.set(String(produto.id), produto);
      });

      return Array.from(mapaPorId.values());
    },
    enabled: !!(formData.fornecedor_id || String(formData.fornecedor_nome || '').trim()),
    staleTime: 30000,
  });

  // Query: variações de cor do produto selecionado (produto pai ou mesmo produto)
  const { data: coresProduto = [] } = useQuery({
    queryKey: ['cores-produto', novoItem.produto_id],
    queryFn: async () => {
      if (!novoItem.produto_id) return [];
      // Busca produto selecionado + todas variações (mesmo parent_id ou parent_id = produto)
      const { data, error } = await supabase
        .from('produtos')
        .select('id, cor')
        .or(`id.eq.${novoItem.produto_id},parent_id.eq.${novoItem.produto_id}`)
        .not('cor', 'is', null);
      if (error) return [];
      const cores = [...new Set((data || []).map(d => d.cor).filter(Boolean))].sort();
      return cores;
    },
    enabled: !!novoItem.produto_id,
    staleTime: 60000,
  });

  // Inicializar formulário ao abrir modal
  useEffect(() => {
    if (!isOpen) return;

    if (oc && !isNovoOuDuplicar) {
      setIsLoadingDetalhes(true);
      comprasService.getOcDetalhes(oc.id)
        .then((ocDetalhada) => {
          const metadata = ocDetalhada.metadata || {};
          setFormData({
            fornecedor_id: ocDetalhada.fornecedor_id,
            fornecedor_nome: ocDetalhada.fornecedor_nome,
            centro_custo_id: ocDetalhada.centro_custo_id,
            data_previsao_entrega: ocDetalhada.data_previsao_entrega || '',
            observacoes: ocDetalhada.observacoes || '',
            observacoes_internas: ocDetalhada.observacoes_internas || '',
            pedido_faturado: Boolean(metadata.pedido_faturado),
            data_faturamento: metadata.data_faturamento || '',
            forma_pagamento_oc: ocDetalhada.forma_pagamento_oc || 'a_vista',
            observacoes_aprovacao: ocDetalhada.observacoes_aprovacao || '',
            anexos_aprovacao: ocDetalhada.anexos_aprovacao || [],
            anexo_fornecedor: ocDetalhada.anexo_fornecedor || [],
            anexos_financeiro: ocDetalhada.anexos_financeiro || [],
            canal_solicitacao: metadata.canal_solicitacao || '',
            data_hora_criado: metadata.data_hora_criado || '',
            data_hora_enviado: metadata.data_hora_enviado || '',
            canal_envio: metadata.canal_envio || '',
            quem_aceitou: metadata.quem_aceitou || '',
            pendencias: metadata.pendencias || '',
          });
          setItens(ocDetalhada.itens || []);
        })
        .catch((error) => {
          toast.error(`Erro ao carregar detalhes da OC: ${error.message}`);
        })
        .finally(() => setIsLoadingDetalhes(false));
      return;
    }

    const metadata = oc?.metadata || {};
    const agora = new Date().toISOString();
    setFormData({
      fornecedor_id: oc?.fornecedor_id || null,
      fornecedor_nome: oc?.fornecedor_nome || '',
      centro_custo_id: oc?.centro_custo_id || user?.centro_custo_id || null,
      data_previsao_entrega: oc?.data_previsao_entrega || '',
      observacoes: oc?.observacoes || '',
      observacoes_internas: '',
      pedido_faturado: Boolean(metadata.pedido_faturado),
      data_faturamento: metadata.data_faturamento || '',
      forma_pagamento_oc: 'a_vista',
      observacoes_aprovacao: '',
      anexos_aprovacao: [],
      anexo_fornecedor: [],
      anexos_financeiro: [],
      canal_solicitacao: metadata.canal_solicitacao || '',
      data_hora_criado: metadata.data_hora_criado || agora,
      data_hora_enviado: metadata.data_hora_enviado || '',
      canal_envio: metadata.canal_envio || '',
      quem_aceitou: metadata.quem_aceitou || '',
      pendencias: metadata.pendencias || '',
    });
    setItens(oc?.itens?.map(i => ({ ...i, id: undefined })) || []);
  }, [isOpen, oc, isNovoOuDuplicar, user?.centro_custo_id]);

  // Cadastrar novo produto direto no OC
  const handleSalvarNovoProduto = async (data) => {
    setSalvandoNovoProduto(true);
    try {
      const produtoData = {
        ...data,
        fornecedor_id: formData.fornecedor_id || null,
        fornecedor_nome: formData.fornecedor_nome || null,
      };
      const novoProduto = await base44.entities.Produto.create(produtoData);
      toast.success(`Produto "${novoProduto.nome}" cadastrado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['produtos-fornecedor'] });
      // Auto-selecionar o produto recem cadastrado
      handleProdutoSelect(novoProduto);
      setNovoProdutoModalOpen(false);
    } catch (error) {
      toast.error('Erro ao cadastrar produto: ' + error.message);
    } finally {
      setSalvandoNovoProduto(false);
    }
  };

  // Validação
  const isFormValido = formData.fornecedor_id && itens.length > 0;
  const podeEditarItens = !isVer && (isNovoOuDuplicar || ['Rascunho', 'Aguardando Envio'].includes(oc?.status));
  const valorTotal = useMemo(() => {
    return itens.reduce((sum, item) => sum + (item.quantidade_pedida * item.preco_unitario), 0);
  }, [itens]);

  const produtosFiltradosNovoItem = useMemo(() => {
    if (!produtosDoFornecedor.length) return [];
    let lista = produtosDoFornecedor;
    if (buscaProduto.trim()) {
      lista = lista.filter(p => matchProductByAnyOrder(p, buscaProduto));
    }
    return lista.slice(0, limiteProdutos);
  }, [produtosDoFornecedor, buscaProduto, limiteProdutos]);

  const descricaoEstruturadaNovoItem = useMemo(() => {
    return buildStructuredItemDetails(novoItem);
  }, [novoItem]);

  const fornecedorSelecionado = useMemo(
    () => fornecedores.find((f) => String(f.id) === String(formData.fornecedor_id)),
    [fornecedores, formData.fornecedor_id]
  );

  const seriesDisponiveis = useMemo(() => {
    if (bulkFiltroSerieTipo === 'modelo') {
      return Array.from(new Set(itens.map((item) => item.modelo_referencia).filter(Boolean))).sort();
    }

    if (bulkFiltroSerieTipo === 'categoria') {
      return Array.from(new Set(itens.map((item) => item.categoria).filter(Boolean))).sort();
    }

    return [];
  }, [itens, bulkFiltroSerieTipo]);

  // Handlers
  const handleFornecedorChange = (fornecedorId) => {
    if (itens.length > 0) {
      toast.error('Remova os itens da OC antes de trocar o fornecedor');
      return;
    }

    const fornecedor = fornecedores.find(f => String(f.id) === String(fornecedorId));
    setBuscaProduto('');
    setNovoItem(createOcItemDefault());
    setLimiteProdutos(5);
    setMostrarSugestoesProduto(true); // Abre cascata automaticamente
    setFormData(prev => ({
      ...prev,
      fornecedor_id: fornecedor?.id || fornecedorId,
      fornecedor_nome: fornecedor?.nome_empresa || '',
    }));
  };

  const handleAddItem = () => {
    if (!novoItem.produto_id || novoItem.quantidade_pedida <= 0 || novoItem.preco_unitario <= 0) {
      toast.error('Preencha todos os campos do item');
      return;
    }

    setItens(prev => [...prev, {
      ...novoItem,
      descricao_personalizada: descricaoEstruturadaNovoItem,
      id: undefined,
    }]);
    setNovoItem(createOcItemDefault());
    setBuscaProduto('');
    setMostrarSugestoesProduto(false);
  };

  const handleRemoveItem = (index) => {
    setItens(prev => prev.filter((_, i) => i !== index));
    setShowAlertDelete(false);
  };

  const handleProdutoSelect = (produto) => {
    if (!produto) return;

    const camposProduto = extractItemFieldsFromProduct(produto);
    const precoCusto = Number(produto.preco_custo) || 0;

    const usarMarkupFornecedor = Boolean(fornecedorSelecionado?.usar_markup_padrao);
    const markupMultiplicador = produto.markup_multiplicador || (usarMarkupFornecedor ? fornecedorSelecionado?.markup_padrao_multiplicador : null);
    const markupPercentual = produto.markup_percentual || (usarMarkupFornecedor ? fornecedorSelecionado?.markup_padrao_percentual : null);
    const pricing = buildItemPricingFromCostAndMarkup(precoCusto, markupMultiplicador, markupPercentual, {});

    setNovoItem(prev => ({
      ...prev,
      produto_id: produto.id,
      produto_nome: buildProductDisplayName(produto.nome || '', produto.modelo_referencia),
      nome_completo_produto: buildNomeConsolidadoProduto(produto),
      preco_custo_item: precoCusto,
      preco_tabela: produto.preco_venda || 0,
      markup_multiplicador: markupMultiplicador ? String(markupMultiplicador) : '',
      markup_percentual: markupPercentual ? String(markupPercentual) : '',
      preco_final_sugerido: pricing.preco_final_sugerido,
      preco_final_manual: pricing.preco_final_manual,
      preco_unitario: prev.preco_unitario > 0 ? prev.preco_unitario : pricing.preco_unitario,
      ...camposProduto,
      categoria: produto.categoria || '',
      cor_item: camposProduto.cor || '',
      descricao_personalizada: buildStructuredItemDetails({
        ...prev,
        ...camposProduto,
      }),
    }));

    setBuscaProduto(produto.nome || '');
    setMostrarSugestoesProduto(false);
  };

  const handleItemChange = (index, field, value) => {
    setItens(prev => prev.map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      const itemAtualizado = {
        ...item,
        [field]: value,
      };

      // Recalculate pricing for any cost-related field
      const costRelatedFields = ['preco_custo_item', 'ipi_tipo', 'ipi_valor', 'frete_tipo', 'frete_valor', 'montagem_valor', 'markup_multiplicador', 'markup_percentual'];
      
      if (costRelatedFields.includes(field)) {
        const precoCusto = itemAtualizado.preco_custo_item || item.preco_custo_item || 0;
        const additionalCosts = {
          ipi_tipo: itemAtualizado.ipi_tipo || item.ipi_tipo || 'fixo',
          ipi_valor: itemAtualizado.ipi_valor !== undefined ? itemAtualizado.ipi_valor : (item.ipi_valor || 0),
          frete_tipo: itemAtualizado.frete_tipo || item.frete_tipo || 'fixo',
          frete_valor: itemAtualizado.frete_valor !== undefined ? itemAtualizado.frete_valor : (item.frete_valor || 0),
          montagem_valor: itemAtualizado.montagem_valor !== undefined ? itemAtualizado.montagem_valor : (item.montagem_valor || 0),
        };
        
        const multiplicador = itemAtualizado.markup_multiplicador !== undefined ? itemAtualizado.markup_multiplicador : (item.markup_multiplicador || '');
        const percentual = itemAtualizado.markup_percentual !== undefined ? itemAtualizado.markup_percentual : (item.markup_percentual || '');
        
        const pricing = buildItemPricingFromCostAndMarkup(precoCusto, multiplicador, percentual, additionalCosts);
        
        return {
          ...itemAtualizado,
          custo_total: pricing.custo_total,
          preco_final_sugerido: pricing.preco_final_sugerido,
          preco_final_manual: pricing.preco_final_manual,
          preco_unitario: pricing.preco_unitario,
        };
      }

      if (field === 'preco_final_manual') {
        return {
          ...itemAtualizado,
          preco_unitario: Number(value) || 0,
        };
      }

      if (field === 'preco_unitario') {
        return {
          ...itemAtualizado,
          preco_final_manual: Number(value) || 0,
        };
      }

      return itemAtualizado;
    }));
  };

  const itemAtendeFiltroLote = (item) => {
    if (bulkFiltroSerieTipo === 'todos') return true;
    if (bulkFiltroSerieValor === 'todos') return true;

    if (bulkFiltroSerieTipo === 'modelo') {
      return String(item.modelo_referencia || '') === String(bulkFiltroSerieValor);
    }

    if (bulkFiltroSerieTipo === 'categoria') {
      return String(item.categoria || '') === String(bulkFiltroSerieValor);
    }

    return true;
  };

  const applyBulkMarkup = async (escopo) => {
    const percentual = parseFloat(bulkMarkupPercentual || 0);
    if (!(percentual >= 0)) {
      toast.error('Informe um markup válido para aplicar em lote');
      return;
    }

    const multiplicador = toMultiplierFromPercent(percentual);
    const itensAtualizados = itens.map((item) => {
      const atendeFornecedor = escopo !== 'fornecedor' || String(item.fornecedor_id || formData.fornecedor_id) === String(formData.fornecedor_id);
      const atendeFiltro = itemAtendeFiltroLote(item);
      if (!atendeFornecedor || !atendeFiltro) {
        return item;
      }

      const additionalCosts = {
        ipi_tipo: item.ipi_tipo || 'fixo',
        ipi_valor: item.ipi_valor || 0,
        frete_tipo: item.frete_tipo || 'fixo',
        frete_valor: item.frete_valor || 0,
        montagem_valor: item.montagem_valor || 0,
      };
      const pricing = buildItemPricingFromCostAndMarkup(item.preco_custo_item || item.preco_unitario, multiplicador, percentual, additionalCosts);
      return {
        ...item,
        custo_total: pricing.custo_total,
        markup_percentual: percentual.toString(),
        markup_multiplicador: multiplicador.toString(),
        preco_final_sugerido: pricing.preco_final_sugerido,
        preco_final_manual: pricing.preco_final_manual,
        preco_unitario: pricing.preco_unitario,
      };
    });

    setItens(itensAtualizados);

    if (bulkPersistirCadastro) {
      const produtosAtualizar = itensAtualizados
        .filter((item) => item.produto_id && itemAtendeFiltroLote(item))
        .map((item) => item.produto_id);

      for (const produtoId of [...new Set(produtosAtualizar)]) {
        await base44.entities.Produto.update(produtoId, {
          markup_percentual: percentual,
          markup_multiplicador: multiplicador,
          usar_markup_fornecedor: false,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['produtos-fornecedor'] });
      toast.success('Markup aplicado na OC e persistido no cadastro dos produtos filtrados');
      return;
    }

    toast.success('Markup aplicado em lote nos itens da OC');
  };

  const handleCopiarPedido = async () => {
    try {
      // Obter nome da loja
      const lojaId = oc?.metadata?.loja_id || null;
      const lojaName = lojaId && lojas ? (lojas.find(l => l.id === lojaId)?.nome || '') : '';
      
      const textoPedido = gerarTextoPedidoOperacional(
        oc || { fornecedor_nome: formData.fornecedor_nome, numero_pedido: '', data_pedido: null, metadata: {} },
        itens,
        user,
        lojaName
      );
      await navigator.clipboard.writeText(textoPedido);
      toast.success('Pedido copiado para a área de transferência');
    } catch (error) {
      console.error('Erro ao copiar pedido:', error);
      toast.error('Não foi possível copiar o pedido');
    }
  };

  // Mutation: criar/editar OC
  const saveMutation = useMutation({
    mutationFn: async () => {
      setIsLoading(true);
      try {
        if (isNovoOuDuplicar) {
          // Criar nova OC
          const novaOc = await comprasService.createOc({
            ...formData,
            data_previsao_entrega: formData.data_previsao_entrega || null,
            itens,
            loja_id: user?.loja_id || null,
            forma_pagamento_oc: formData.forma_pagamento_oc || 'a_vista',
            observacoes_internas: formData.observacoes_internas || null,
            observacoes_aprovacao: formData.observacoes_aprovacao || null,
            anexos_aprovacao: formData.anexos_aprovacao || [],
            anexo_fornecedor: formData.anexo_fornecedor || [],
            anexos_financeiro: formData.anexos_financeiro || [],
            metadata: {
              pedido_faturado: formData.pedido_faturado,
              data_faturamento: formData.data_faturamento || null,
            },
          });
          toast.success(`OC ${novaOc.numero_pedido} criada com sucesso`);
          return novaOc;
        } else if (podeEditarItens) {
          const ocAtualizada = await comprasService.editarOc(oc.id, {
            fornecedor_id: formData.fornecedor_id,
            fornecedor_nome: formData.fornecedor_nome,
            itens,
            centro_custo_id: formData.centro_custo_id,
            data_previsao_entrega: formData.data_previsao_entrega || null,
            observacoes: formData.observacoes,
            observacoes_internas: formData.observacoes_internas || null,
            forma_pagamento_oc: formData.forma_pagamento_oc,
            observacoes_aprovacao: formData.observacoes_aprovacao || null,
            anexos_aprovacao: formData.anexos_aprovacao || [],
            anexo_fornecedor: formData.anexo_fornecedor || [],
            anexos_financeiro: formData.anexos_financeiro || [],
            metadata: {
              ...(oc.metadata || {}),
              pedido_faturado: formData.pedido_faturado,
              data_faturamento: formData.data_faturamento || null,
            },
          });

          await supabase
            .from('compras_oc_itens')
            .delete()
            .eq('ordem_compra_id', oc.id);

          for (const item of itens) {
            await base44.entities.ComprasOcItem.create({
              ordem_compra_id: oc.id,
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              nome_completo_produto: item.nome_completo_produto || item.produto_nome || null,
              cor_item: item.cor_item || item.cor || null,
              descricao_personalizada: item.descricao_personalizada || null,
              tipo_item_oc: item.tipo_item_oc || 'ORDEM_COMUM_ENCOMENDA',
              origem_solicitacao: item.origem_solicitacao || 'VENDEDOR',
              pedido_origem_numero: item.pedido_origem_numero || null,
              reposicao_fabrica: item.reposicao_fabrica || false,
              motivo_assistencia: item.motivo_assistencia || null,
              possui_imagens_videos: item.possui_imagens_videos || false,
              anexos_item: item.anexos_item || [],
              quantidade_pedida: item.quantidade_pedida,
              preco_custo_item: item.preco_custo_item || null,
              markup_multiplicador: item.markup_multiplicador ? parseFloat(item.markup_multiplicador) : null,
              markup_percentual: item.markup_percentual ? parseFloat(item.markup_percentual) : null,
              preco_final_sugerido: item.preco_final_sugerido || null,
              preco_final_manual: item.preco_final_manual || null,
              preco_unitario: item.preco_unitario,
              preco_tabela: item.preco_tabela,
            });
          }

          toast.success(`OC ${oc.numero_pedido} atualizada com sucesso`);
          return ocAtualizada;
        } else {
          const ocAtualizada = await comprasService.updateOcTracking(oc.id, {
            fornecedor_id: formData.fornecedor_id,
            fornecedor_nome: formData.fornecedor_nome,
            centro_custo_id: formData.centro_custo_id,
            data_previsao_entrega: formData.data_previsao_entrega || null,
            observacoes: formData.observacoes,
            observacoes_internas: formData.observacoes_internas || null,
            pedido_faturado: formData.pedido_faturado,
            data_faturamento: formData.data_faturamento || null,
            metadata: oc.metadata || {},
          });

          // Salvar campos de pagamento/anexos separadamente (updateOcTracking não os cobre)
          await comprasService.updateOcPaymentFields(oc.id, {
            forma_pagamento_oc: formData.forma_pagamento_oc,
            observacoes_aprovacao: formData.observacoes_aprovacao || null,
            anexos_aprovacao: formData.anexos_aprovacao || [],
            anexo_fornecedor: formData.anexo_fornecedor || [],
            anexos_financeiro: formData.anexos_financeiro || [],
          });

          toast.success(`Acompanhamento da OC ${oc.numero_pedido} atualizado`);
          return ocAtualizada;
        }
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar OC: ${error.message}`);
    },
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNovoOuDuplicar ? 'Nova Ordem de Compra' : `Editar OC ${oc?.numero_pedido}`}
            </DialogTitle>
            <DialogDescription>
              {isVer ? 'Visualizando detalhes da OC' : 'Preencha os dados da ordem de compra'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Seção: Fornecedor e Dados Gerais */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="font-semibold">Dados Gerais</h3>

              {/* Fornecedor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fornecedor">Fornecedor *</Label>
                  <Select
                    value={formData.fornecedor_id?.toString() || ''}
                    onValueChange={handleFornecedorChange}
                    disabled={isVer}
                  >
                    <SelectTrigger id="fornecedor">
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map(f => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                          {f.nome_empresa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isVer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFornecedorModalOpen(true)}
                      className="mt-1 h-7 px-2"
                    >
                      + Novo fornecedor
                    </Button>
                  )}
                </div>

                {/* Data Previsão */}
                <div>
                  <Label htmlFor="data_previsao">Data Previsão Entrega</Label>
                  <Input
                    id="data_previsao"
                    type="date"
                    value={formData.data_previsao_entrega}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      data_previsao_entrega: e.target.value,
                    }))}
                    disabled={isVer}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pedido_faturado">Pedido Faturado</Label>
                  <Select
                    value={formData.pedido_faturado ? 'sim' : 'nao'}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      pedido_faturado: value === 'sim',
                    }))}
                    disabled={isVer}
                  >
                    <SelectTrigger id="pedido_faturado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não faturado</SelectItem>
                      <SelectItem value="sim">Faturado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="data_faturamento">Data do Faturamento</Label>
                  <Input
                    id="data_faturamento"
                    type="date"
                    value={formData.data_faturamento}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      data_faturamento: e.target.value,
                    }))}
                    disabled={isVer || !formData.pedido_faturado}
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label htmlFor="observacoes">Observações (para o fornecedor)</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações que irão para o fornecedor..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    observacoes: e.target.value,
                  }))}
                  disabled={isVer}
                  rows={3}
                />
              </div>

              {/* Observações Internas */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="observacoes_internas" className="text-blue-800 font-semibold text-sm">Observações Internas</Label>
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">Não vai para o fornecedor</span>
                </div>
                <Textarea
                  id="observacoes_internas"
                  placeholder="Anotações internas da equipe (visível para todos os colaboradores)..."
                  value={formData.observacoes_internas}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    observacoes_internas: e.target.value,
                  }))}
                  disabled={isVer}
                  rows={2}
                  className="border-blue-300 focus:border-blue-500 bg-white"
                />
              </div>

              {/* Forma de Pagamento */}
              <div>
                <Label htmlFor="forma_pagamento_oc">Forma de Pagamento</Label>
                <Select
                  value={formData.forma_pagamento_oc || 'a_vista'}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    forma_pagamento_oc: value,
                  }))}
                  disabled={isVer}
                >
                  <SelectTrigger id="forma_pagamento_oc">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_vista">A Vista</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                    <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                    <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                    <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="a_definir">A Definir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campos visíveis apenas quando pagamento não é a vista */}
              {formData.forma_pagamento_oc !== 'a_vista' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                      Informações para Aprovação (visível apenas ao master)
                    </span>
                  </div>

                  {/* Observações para Aprovação */}
                  <div>
                    <Label htmlFor="observacoes_aprovacao">Observações para Aprovação</Label>
                    <Textarea
                      id="observacoes_aprovacao"
                      placeholder="Detalhe informações sobre o pagamento, condições negociadas, etc..."
                      value={formData.observacoes_aprovacao || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        observacoes_aprovacao: e.target.value,
                      }))}
                      disabled={isVer}
                      rows={3}
                    />
                  </div>

                  {/* Anexos para Aprovação */}
                  {!isVer && (
                    <div className="space-y-2">
                      <Label>Anexos para Aprovação</Label>
                      <div className="flex flex-wrap gap-2">
                        {(formData.anexos_aprovacao || []).map((anexo, idx) => (
                          <div key={idx} className="relative group">
                            {anexo.tipo?.startsWith('image/') ? (
                              <div className="relative w-20 h-20 border rounded overflow-hidden bg-gray-100">
                                <img
                                  src={anexo.url}
                                  alt={anexo.nome}
                                  className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                                  title={anexo.nome}
                                  onClick={() => window.open(anexo.url, '_blank')}
                                />
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    anexos_aprovacao: prev.anexos_aprovacao.filter((_, i) => i !== idx),
                                  }))}
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs">
                                <Paperclip className="w-3 h-3 text-gray-500" />
                                <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[120px] truncate">
                                  {anexo.nome || 'Anexo'}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    anexos_aprovacao: prev.anexos_aprovacao.filter((_, i) => i !== idx),
                                  }))}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        <label className={`flex items-center gap-1 cursor-pointer bg-white border border-dashed rounded px-2 py-1 text-xs text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors ${uploadingAnexosAprovacao ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          {uploadingAnexosAprovacao ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                          {uploadingAnexosAprovacao ? 'Enviando...' : 'Anexar'}
                          <input
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                            multiple
                            disabled={uploadingAnexosAprovacao}
                            className="hidden"
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (!files.length) return;
                              setUploadingAnexosAprovacao(true);
                              const uploads = [];
                              for (const file of files) {
                                try {
                                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                  uploads.push({ nome: file.name, url: file_url, tipo: file.type, uploaded_at: new Date().toISOString() });
                                } catch (err) {
                                  console.error('Upload error:', err);
                                  toast.error(`Falha ao enviar ${file.name}`);
                                }
                              }
                              setUploadingAnexosAprovacao(false);
                              if (uploads.length > 0) {
                                setFormData(prev => ({
                                  ...prev,
                                  anexos_aprovacao: [...(prev.anexos_aprovacao || []), ...uploads],
                                }));
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {/* Modo visualização: mostrar anexos como links */}
                  {isVer && (formData.anexos_aprovacao || []).length > 0 && (
                    <div className="space-y-2">
                      <Label>Anexos para Aprovação</Label>
                      <div className="flex flex-wrap gap-2">
                        {formData.anexos_aprovacao.map((anexo, idx) => (
                          <a key={idx} href={anexo.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs text-blue-600 hover:underline">
                            <Paperclip className="w-3 h-3" />
                            {anexo.nome || 'Anexo'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Anexos para Financeiro (editável mesmo após enviado) */}
                  {!isVer && oc && (
                    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <Label className="text-blue-900 font-semibold">Anexos para Financeiro</Label>
                      <p className="text-xs text-blue-700">Documentos para visualização e análise do financeiro</p>
                      <div className="flex flex-wrap gap-2">
                        {(formData.anexos_financeiro || []).map((anexo, idx) => (
                          <div key={idx} className="relative group">
                            {anexo.tipo?.startsWith('image/') ? (
                              <div className="relative w-20 h-20 border rounded overflow-hidden bg-gray-100">
                                <img
                                  src={anexo.url}
                                  alt={anexo.nome}
                                  className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                                  title={anexo.nome}
                                  onClick={() => window.open(anexo.url, '_blank')}
                                />
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    anexos_financeiro: prev.anexos_financeiro.filter((_, i) => i !== idx),
                                  }))}
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs">
                                <Paperclip className="w-3 h-3 text-gray-500" />
                                <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[120px] truncate">
                                  {anexo.nome || 'Anexo'}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    anexos_financeiro: prev.anexos_financeiro.filter((_, i) => i !== idx),
                                  }))}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        <label className={`flex items-center gap-1 cursor-pointer bg-white border border-dashed rounded px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors ${uploadingAnexosFinanceiro ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          {uploadingAnexosFinanceiro ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                          {uploadingAnexosFinanceiro ? 'Enviando...' : 'Anexar'}
                          <input
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                            multiple
                            disabled={uploadingAnexosFinanceiro}
                            className="hidden"
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (!files.length) return;
                              setUploadingAnexosFinanceiro(true);
                              const uploads = [];
                              for (const file of files) {
                                try {
                                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                  uploads.push({ nome: file.name, url: file_url, tipo: file.type, uploaded_at: new Date().toISOString() });
                                } catch (err) {
                                  console.error('Upload error:', err);
                                  toast.error(`Falha ao enviar ${file.name}`);
                                }
                              }
                              setUploadingAnexosFinanceiro(false);
                              if (uploads.length > 0) {
                                setFormData(prev => ({
                                  ...prev,
                                  anexos_financeiro: [...(prev.anexos_financeiro || []), ...uploads],
                                }));
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {/* Modo visualização: mostrar anexos do financeiro */}
                  {isVer && (formData.anexos_financeiro || []).length > 0 && (
                    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <Label className="text-blue-900 font-semibold">Anexos para Financeiro</Label>
                      <div className="flex flex-wrap gap-2">
                        {formData.anexos_financeiro.map((anexo, idx) => (
                          <a key={idx} href={anexo.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs text-blue-600 hover:underline">
                            <Paperclip className="w-3 h-3" />
                            {anexo.nome || 'Anexo'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Documento do Fornecedor (sempre visível) */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-600">
                    Documento do Fornecedor
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(formData.anexo_fornecedor || []).map((anexo, idx) => (
                    <div key={idx} className="relative group">
                      {anexo.tipo?.startsWith('image/') ? (
                        <div className="relative w-20 h-20 border rounded overflow-hidden bg-white">
                          <img
                            src={anexo.url}
                            alt={anexo.nome}
                            className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                            title={anexo.nome}
                            onClick={() => window.open(anexo.url, '_blank')}
                          />
                          {!isVer && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                anexo_fornecedor: prev.anexo_fornecedor.filter((_, i) => i !== idx),
                              }))}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs">
                          <Paperclip className="w-3 h-3 text-gray-500" />
                          <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[140px] truncate">
                            {anexo.nome || 'Documento'}
                          </a>
                          {!isVer && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                anexo_fornecedor: prev.anexo_fornecedor.filter((_, i) => i !== idx),
                              }))}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {!isVer && (
                    <label className={`flex items-center gap-1 cursor-pointer bg-white border border-dashed rounded px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors ${uploadingAnexoFornecedor ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {uploadingAnexoFornecedor ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                      {uploadingAnexoFornecedor ? 'Enviando...' : 'Anexar PDF / Doc'}
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                        multiple
                        disabled={uploadingAnexoFornecedor}
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setUploadingAnexoFornecedor(true);
                          const uploads = [];
                          for (const file of files) {
                            try {
                              const { file_url } = await base44.integrations.Core.UploadFile({ file });
                              uploads.push({ nome: file.name, url: file_url, tipo: file.type, uploaded_at: new Date().toISOString() });
                            } catch (err) {
                              console.error('Upload error:', err);
                              toast.error(`Falha ao enviar ${file.name}`);
                            }
                          }
                          setUploadingAnexoFornecedor(false);
                          if (uploads.length > 0) {
                            setFormData(prev => ({
                              ...prev,
                              anexo_fornecedor: [...(prev.anexo_fornecedor || []), ...uploads],
                            }));
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {(formData.anexo_fornecedor || []).length === 0 && isVer && (
                    <span className="text-xs text-gray-400">Nenhum documento anexado</span>
                  )}
                </div>
              </div>
            </div>

            {/* Seção: Itens */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Itens da OC</h3>
                <Badge variant="outline">{itens.length} items</Badge>
              </div>

              {isLoadingDetalhes ? (
                <div className="flex items-center justify-center py-10 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Carregando itens da OC...
                </div>
              ) : (
              <>
              {/* Lista de itens existentes */}
              <div className="space-y-3 mt-8">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 px-1">
                  Itens da Ordem de Compra
                </h4>
                <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Produto</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead className="text-right w-20">Qtd</TableHead>
                      <TableHead className="text-right w-20">Preço</TableHead>
                      <TableHead className="text-right w-20">IPI</TableHead>
                      <TableHead className="text-right w-20">Frete</TableHead>
                      <TableHead className="text-right w-20">Montagem</TableHead>
                      <TableHead className="text-right w-24">Custo Total</TableHead>
                      <TableHead className="text-right w-20">Markup %</TableHead>
                      <TableHead className="text-right w-28">Preço Final</TableHead>
                      <TableHead className="text-right w-28">Subtotal</TableHead>
                      {podeEditarItens && <TableHead className="w-12">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm min-w-[220px]">
                          {podeEditarItens ? (
                            <Input
                              value={item.produto_nome || ''}
                              onChange={(e) => handleItemChange(index, 'produto_nome', e.target.value)}
                            />
                          ) : (
                            <div className="font-medium">{item.produto_nome}</div>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[260px]">
                          {podeEditarItens ? (
                            <Textarea
                              value={item.descricao_personalizada || ''}
                              onChange={(e) => handleItemChange(index, 'descricao_personalizada', e.target.value)}
                              rows={2}
                              placeholder="Modelo, cor, medidas e observações do item"
                            />
                          ) : (
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {item.descricao_personalizada || 'Sem detalhes adicionais'}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {podeEditarItens ? (
                            <Input
                              type="number"
                              min="1"
                              className="text-right"
                              value={item.quantidade_pedida}
                              onChange={(e) => handleItemChange(index, 'quantidade_pedida', parseInt(e.target.value, 10) || 1)}
                            />
                          ) : (
                            item.quantidade_pedida
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {podeEditarItens && can('manage_cost_prices') ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              value={item.preco_custo_item || 0}
                              onChange={(e) => handleItemChange(index, 'preco_custo_item', parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            `R$ ${(Number(item.preco_custo_item || 0)).toFixed(2)}`
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm">
                          {podeEditarItens && can('manage_cost_prices') ? (
                            <div className="flex gap-1">
                              <Select value={item.ipi_tipo || 'fixo'} onValueChange={(tipo) => handleItemChange(index, 'ipi_tipo', tipo)}>
                                <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixo">R$</SelectItem>
                                  <SelectItem value="porcentagem">%</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="text-right h-8 text-xs"
                                value={item.ipi_valor || 0}
                                onChange={(e) => handleItemChange(index, 'ipi_valor', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          ) : (
                            `${item.ipi_tipo === 'porcentagem' ? item.ipi_valor + '%' : 'R$ ' + Number(item.ipi_valor || 0).toFixed(2)}`
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm">
                          {podeEditarItens && can('manage_cost_prices') ? (
                            <div className="flex gap-1">
                              <Select value={item.frete_tipo || 'fixo'} onValueChange={(tipo) => handleItemChange(index, 'frete_tipo', tipo)}>
                                <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixo">R$</SelectItem>
                                  <SelectItem value="porcentagem">%</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="text-right h-8 text-xs"
                                value={item.frete_valor || 0}
                                onChange={(e) => handleItemChange(index, 'frete_valor', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          ) : (
                            `${item.frete_tipo === 'porcentagem' ? item.frete_valor + '%' : 'R$ ' + Number(item.frete_valor || 0).toFixed(2)}`
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm">
                          {podeEditarItens && can('manage_cost_prices') ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right text-xs"
                              value={item.montagem_valor || 0}
                              onChange={(e) => handleItemChange(index, 'montagem_valor', parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            `R$ ${(Number(item.montagem_valor || 0)).toFixed(2)}`
                          )}
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm font-semibold">
                          R$ {(Number(item.custo_total || 0)).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {podeEditarItens ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right text-xs"
                              value={item.markup_percentual || ''}
                              onChange={(e) => handleItemChange(index, 'markup_percentual', e.target.value)}
                            />
                          ) : (
                            `${Number(item.markup_percentual || 0).toFixed(2)}%`
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {podeEditarItens ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              value={item.preco_final_manual || item.preco_unitario || 0}
                              onChange={(e) => handleItemChange(index, 'preco_final_manual', parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            `R$ ${(Number(item.preco_final_manual || item.preco_unitario || 0)).toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          R$ {((item.quantidade_pedida || 0) * (item.preco_unitario || 0)).toFixed(2)}
                        </TableCell>
                        {podeEditarItens && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setItemParaDeleter(index);
                                setShowAlertDelete(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {podeEditarItens && itens.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-blue-800">Aplicação de Markup em Lote</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Markup (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkMarkupPercentual}
                      onChange={(e) => setBulkMarkupPercentual(e.target.value)}
                      placeholder="Ex: 45"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Filtro de Série</Label>
                    <Select
                      value={bulkFiltroSerieTipo}
                      onValueChange={(value) => {
                        setBulkFiltroSerieTipo(value);
                        setBulkFiltroSerieValor('todos');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="modelo">Modelo/Referência</SelectItem>
                        <SelectItem value="categoria">Categoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Valor do Filtro</Label>
                    <Select value={bulkFiltroSerieValor} onValueChange={setBulkFiltroSerieValor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {seriesDisponiveis.map((valor) => (
                          <SelectItem key={valor} value={valor}>{valor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-2">
                    <Button type="button" variant="outline" onClick={() => applyBulkMarkup('todos')}>
                      Aplicar em Todos
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => applyBulkMarkup('fornecedor')}>
                      Só Fornecedor
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="bulkPersistirCadastro"
                    type="checkbox"
                    checked={bulkPersistirCadastro}
                    onChange={(e) => setBulkPersistirCadastro(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="bulkPersistirCadastro" className="text-xs">
                    Persistir também no cadastro dos produtos afetados
                  </Label>
                </div>
              </div>
            )}

              {/* Adicionar novo item */}
              {podeEditarItens && (
                <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-200">
                  <div className="bg-blue-50/20 p-6 rounded-2xl border border-blue-100/50 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2">
                        <Plus size={16} className="text-blue-500" /> Adicionar Novo Item à Ordem
                      </h4>
                      <span className="text-[10px] text-blue-400 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                        Preenchimento obrigatório *
                      </span>
                    </div>

                  {/* Primeira Linha: Seleção e Financeiro */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-gray-600">Produto *</Label>
                        <button
                          type="button"
                          onClick={() => setNovoProdutoModalOpen(true)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                          title="Cadastrar novo produto"
                        >
                          <Plus size={11} /> Cadastrar novo
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          placeholder="Buscar produto por nome, ref, cor..."
                          className="bg-white"
                          value={buscaProduto}
                          onChange={(e) => {
                            if (!formData.fornecedor_id) {
                              toast.warning('Selecione o fornecedor antes de buscar o item');
                              return;
                            }
                            setBuscaProduto(e.target.value);
                            setLimiteProdutos(5);
                            setMostrarSugestoesProduto(true);
                          }}
                          onFocus={() => {
                            if (!formData.fornecedor_id) {
                              setMostrarSugestoesProduto(false);
                              toast.info('Selecione o fornecedor para carregar os itens');
                              return;
                            }
                            setMostrarSugestoesProduto(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => setMostrarSugestoesProduto(false), 500);
                          }}
                        />

                        {mostrarSugestoesProduto && (
                          <div
                            ref={dropdownProdutoRef}
                            className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-white shadow-xl"
                            onScroll={(e) => {
                              const el = e.currentTarget;
                              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
                                setLimiteProdutos(prev => prev + 5);
                              }
                            }}
                          >
                            {!buscaProduto && formData.fornecedor_id && produtosFiltradosNovoItem.length > 0 && (
                              <div className="px-3 py-1.5 bg-blue-50 text-[10px] font-bold text-blue-600 uppercase border-b sticky top-0 z-10 flex justify-between items-center">
                                <span>Sugestões do Fornecedor</span>
                                <span className="text-[9px] font-normal text-blue-400">Exibindo {produtosFiltradosNovoItem.length} itens</span>
                              </div>
                            )}
                            {!formData.fornecedor_id ? (
                              <div className="px-3 py-3 text-xs text-amber-700 bg-amber-50">
                                Selecione o fornecedor para listar os itens.
                              </div>
                            ) : carregandoProdutos ? (
                              <div className="px-3 py-3 text-xs text-gray-500 flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" /> Carregando produtos...
                              </div>
                            ) : produtosFiltradosNovoItem.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-gray-500 space-y-2">
                                <div>{buscaProduto.trim() ? 'Nenhum item encontrado com esse termo.' : 'Nenhum produto cadastrado para este fornecedor.'}</div>
                                <button
                                  type="button"
                                  onMouseDown={() => { setMostrarSugestoesProduto(false); setNovoProdutoModalOpen(true); }}
                                  className="w-full text-left text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                >
                                  <Plus size={11} /> Cadastrar novo produto
                                </button>
                              </div>
                            ) : (
                              produtosFiltradosNovoItem.map((produto) => (
                                <button
                                  key={produto.id}
                                  type="button"
                                  onMouseDown={() => handleProdutoSelect(produto)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                                >
                                  <div className="font-semibold text-gray-800">
                                    {produto.nome}{produto.modelo_referencia ? ` - ${produto.modelo_referencia}` : ''}
                                  </div>
                                  <div className="text-[10px] text-gray-500 uppercase">
                                    {buildProductSummary(produto) || 'Sem detalhes técnicos'}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Quantidade</Label>
                      <Input
                        type="number"
                        min="1"
                        className="bg-white"
                        value={novoItem.quantidade_pedida}
                        onChange={(e) => setNovoItem(prev => ({
                          ...prev,
                          quantidade_pedida: parseInt(e.target.value) || 1,
                        }))}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Preço de Custo</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className={can('manage_cost_prices') ? "bg-white" : "bg-gray-100"}
                        value={novoItem.preco_custo_item || 0}
                        disabled={!can('manage_cost_prices')}
                        onChange={(e) => {
                          if (!can('manage_cost_prices')) return;
                          const precoCusto = parseFloat(e.target.value) || 0;
                          const multiplicador = novoItem.markup_multiplicador || '';
                          const percentual = novoItem.markup_percentual || '';
                          const additionalCosts = {
                            ipi_tipo: novoItem.ipi_tipo || 'fixo',
                            ipi_valor: novoItem.ipi_valor || 0,
                            frete_tipo: novoItem.frete_tipo || 'fixo',
                            frete_valor: novoItem.frete_valor || 0,
                            montagem_valor: novoItem.montagem_valor || 0,
                          };
                          const pricing = buildItemPricingFromCostAndMarkup(precoCusto, multiplicador, percentual, additionalCosts);
                          setNovoItem(prev => ({
                            ...prev,
                            preco_custo_item: precoCusto,
                            ...pricing,
                          }));
                        }}
                      />
                    </div>

                    <div className="md:col-span-1 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Markup %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="bg-white"
                        value={novoItem.markup_percentual || ''}
                        onChange={(e) => {
                          const percentual = e.target.value;
                          const multiplicador = percentual === '' ? '' : toMultiplierFromPercent(percentual).toString();
                          const pricing = buildItemPricingFromCostAndMarkup(novoItem.preco_custo_item, multiplicador, percentual);
                          setNovoItem(prev => ({
                            ...prev,
                            markup_percentual: percentual,
                            markup_multiplicador: multiplicador,
                            ...pricing,
                          }));
                        }}
                      />
                    </div>

                    <div className="md:col-span-1 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Markup x</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="1"
                        className="bg-white"
                        value={novoItem.markup_multiplicador || ''}
                        onChange={(e) => {
                          const multiplicador = e.target.value;
                          const percentual = multiplicador === '' ? '' : toPercentFromMultiplier(multiplicador).toString();
                          const additionalCosts = {
                            ipi_tipo: novoItem.ipi_tipo || 'fixo',
                            ipi_valor: novoItem.ipi_valor || 0,
                            frete_tipo: novoItem.frete_tipo || 'fixo',
                            frete_valor: novoItem.frete_valor || 0,
                            montagem_valor: novoItem.montagem_valor || 0,
                          };
                          const pricing = buildItemPricingFromCostAndMarkup(novoItem.preco_custo_item, multiplicador, percentual, additionalCosts);
                          setNovoItem(prev => ({
                            ...prev,
                            markup_percentual: percentual,
                            markup_multiplicador: multiplicador,
                            ...pricing,
                          }));
                        }}
                      />
                    </div>

                    <div className="md:col-span-1 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">IPI</Label>
                      <div className="flex gap-2">
                        <Select value={novoItem.ipi_tipo || 'fixo'} onValueChange={(tipo) => {
                          const additionalCosts = {
                            ipi_tipo: tipo,
                            ipi_valor: novoItem.ipi_valor || 0,
                            frete_tipo: novoItem.frete_tipo || 'fixo',
                            frete_valor: novoItem.frete_valor || 0,
                            montagem_valor: novoItem.montagem_valor || 0,
                          };
                          const pricing = buildItemPricingFromCostAndMarkup(novoItem.preco_custo_item, novoItem.markup_multiplicador, novoItem.markup_percentual, additionalCosts);
                          setNovoItem(prev => ({
                            ...prev,
                            ipi_tipo: tipo,
                            ...pricing,
                          }));
                        }}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixo">Fixo</SelectItem>
                            <SelectItem value="porcentagem">%</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="bg-white flex-1"
                          placeholder={novoItem.ipi_tipo === 'porcentagem' ? '%' : 'R$'}
                          value={novoItem.ipi_valor || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const additionalCosts = {
                              ipi_tipo: novoItem.ipi_tipo || 'fixo',
                              ipi_valor: val,
                              frete_tipo: novoItem.frete_tipo || 'fixo',
                              frete_valor: novoItem.frete_valor || 0,
                              montagem_valor: novoItem.montagem_valor || 0,
                            };
                            const pricing = buildItemPricingFromCostAndMarkup(novoItem.preco_custo_item, novoItem.markup_multiplicador, novoItem.markup_percentual, additionalCosts);
                            setNovoItem(prev => ({
                              ...prev,
                              ipi_valor: val,
                              ...pricing,
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Frete</Label>
                      <div className="flex gap-2">
                        <Select value={novoItem.frete_tipo || 'fixo'} onValueChange={(tipo) => {
                          const additionalCosts = {
                            ipi_tipo: novoItem.ipi_tipo || 'fixo',
                            ipi_valor: novoItem.ipi_valor || 0,
                            frete_tipo: tipo,
                            frete_valor: novoItem.frete_valor || 0,
                            montagem_valor: novoItem.montagem_valor || 0,
                          };
                          const pricing = buildItemPricingFromCostAndMarkup(novoItem.preco_custo_item, novoItem.markup_multiplicador, novoItem.markup_percentual, additionalCosts);
                          setNovoItem(prev => ({
                            ...prev,
                            frete_tipo: tipo,
                            ...pricing,
                          }));
                        }}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixo">Fixo</SelectItem>
                            <SelectItem value="porcentagem">%</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="bg-white flex-1"
                          placeholder={novoItem.frete_tipo === 'porcentagem' ? '%' : 'R$'}
                          value={novoItem.frete_valor || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const additionalCosts = {
                              ipi_tipo: novoItem.ipi_tipo || 'fixo',
                              ipi_valor: novoItem.ipi_valor || 0,
                              frete_tipo: novoItem.frete_tipo || 'fixo',
                              frete_valor: val,
                              montagem_valor: novoItem.montagem_valor || 0,
                            };
                            const pricing = buildItemPricingFromCostAndMarkup(novoItem.preco_custo_item, novoItem.markup_multiplicador, novoItem.markup_percentual, additionalCosts);
                            setNovoItem(prev => ({
                              ...prev,
                              frete_valor: val,
                              ...pricing,
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-1 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Montagem (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="bg-white"
                        value={novoItem.montagem_valor || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const additionalCosts = {
                            ipi_tipo: novoItem.ipi_tipo || 'fixo',
                            ipi_valor: novoItem.ipi_valor || 0,
                            frete_tipo: novoItem.frete_tipo || 'fixo',
                            frete_valor: novoItem.frete_valor || 0,
                            montagem_valor: val,
                          };
                          const pricing = buildItemPricingFromCostAndMarkup(novoItem.preco_custo_item, novoItem.markup_multiplicador, novoItem.markup_percentual, additionalCosts);
                          setNovoItem(prev => ({
                            ...prev,
                            montagem_valor: val,
                            ...pricing,
                          }));
                        }}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Preço Final (editável)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-9 bg-white"
                          value={novoItem.preco_final_manual ?? novoItem.preco_unitario}
                          onChange={(e) => {
                            const precoFinal = parseFloat(e.target.value) || 0;
                            setNovoItem(prev => ({
                              ...prev,
                              preco_final_manual: precoFinal,
                              preco_unitario: precoFinal,
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Segunda Linha: Detalhes Técnicos */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Referência</Label>
                      <Input
                        placeholder="Ex: MOD-123"
                        className="bg-white"
                        value={novoItem.modelo_referencia || ''}
                        onChange={(e) => setNovoItem(prev => ({ ...prev, modelo_referencia: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Cor do Item *</Label>
                      {coresProduto.length > 0 && novoItem.cor_item !== '__nova_cor__' ? (
                        <Select
                          value={novoItem.cor_item || ''}
                          onValueChange={(value) => {
                            if (value === '__nova_cor__') {
                              setNovoItem(prev => ({ ...prev, cor_item: '__nova_cor__' }));
                            } else {
                              setNovoItem(prev => ({ ...prev, cor_item: value, cor: value }));
                            }
                          }}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione a cor" />
                          </SelectTrigger>
                          <SelectContent>
                            {coresProduto.map(cor => (
                              <SelectItem key={cor} value={cor}>{cor}</SelectItem>
                            ))}
                            <SelectItem value="__nova_cor__">+ Outra cor...</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-1">
                          <Input
                            placeholder="Ex: Cedro/Areia"
                            className="bg-white"
                            value={novoItem.cor_item === '__nova_cor__' ? '' : (novoItem.cor_item || '')}
                            onChange={(e) => setNovoItem(prev => ({ ...prev, cor_item: e.target.value, cor: e.target.value }))}
                            autoFocus={novoItem.cor_item === '__nova_cor__'}
                          />
                          {coresProduto.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="px-2 shrink-0"
                              onClick={() => setNovoItem(prev => ({ ...prev, cor_item: '' }))}
                              title="Voltar para lista"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Material</Label>
                      <Input
                        placeholder="Ex: MDF"
                        className="bg-white"
                        value={novoItem.material || ''}
                        onChange={(e) => setNovoItem(prev => ({ ...prev, material: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Medidas (L x A x P)</Label>
                      <div className="grid grid-cols-3 gap-1">
                        <Input
                          placeholder="L"
                          className="bg-white"
                          value={novoItem.largura || ''}
                          onChange={(e) => setNovoItem(prev => ({ ...prev, largura: e.target.value }))}
                        />
                        <Input
                          placeholder="A"
                          className="bg-white"
                          value={novoItem.altura || ''}
                          onChange={(e) => setNovoItem(prev => ({ ...prev, altura: e.target.value }))}
                        />
                        <Input
                          placeholder="P"
                          className="bg-white"
                          value={novoItem.profundidade || ''}
                          onChange={(e) => setNovoItem(prev => ({ ...prev, profundidade: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Terceira Linha: Classificação e Origem */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Tipo do Item *</Label>
                      <Select
                        value={novoItem.tipo_item_oc}
                        onValueChange={(value) => setNovoItem(prev => ({ ...prev, tipo_item_oc: value }))}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ORDEM_COMUM_ENCOMENDA">Ordem Comum de Compra</SelectItem>
                          <SelectItem value="ASSISTENCIA_REPOSICAO_PECAS">Assistência - Reposição de Peças</SelectItem>
                          <SelectItem value="ASSISTENCIA_VENDA_CLIENTE">Assistência - Venda para Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Origem da Solicitação *</Label>
                      <Select
                        value={novoItem.origem_solicitacao}
                        onValueChange={(value) => setNovoItem(prev => ({ ...prev, origem_solicitacao: value }))}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                          <SelectItem value="ESTOQUE">Estoque</SelectItem>
                          <SelectItem value="ASSISTENCIA">Assistência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Nº Pedido de Origem</Label>
                      <Input
                        placeholder="Ex: 2809"
                        className="bg-white"
                        value={novoItem.pedido_origem_numero || ''}
                        onChange={(e) => setNovoItem(prev => ({ ...prev, pedido_origem_numero: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Campos de Assistência (exibir apenas quando for assistência) */}
                  {novoItem.tipo_item_oc !== 'ORDEM_COMUM_ENCOMENDA' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                        Dados da Assistência
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-600">Reposição pela fábrica?</Label>
                          <Select
                            value={novoItem.reposicao_fabrica ? 'sim' : 'nao'}
                            onValueChange={(value) => setNovoItem(prev => ({ ...prev, reposicao_fabrica: value === 'sim' }))}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">Sim</SelectItem>
                              <SelectItem value="nao">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-600">Possui imagens / vídeos?</Label>
                          <Select
                            value={novoItem.possui_imagens_videos ? 'sim' : 'nao'}
                            onValueChange={(value) => setNovoItem(prev => ({ ...prev, possui_imagens_videos: value === 'sim' }))}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sim">Sim</SelectItem>
                              <SelectItem value="nao">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Motivo da Assistência *</Label>
                        <Input
                          placeholder="Ex: Lascado na ponta"
                          className="bg-white"
                          value={novoItem.motivo_assistencia || ''}
                          onChange={(e) => setNovoItem(prev => ({ ...prev, motivo_assistencia: e.target.value }))}
                        />
                      </div>
                      {/* Upload de Anexos */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Anexos</Label>
                        <div className="flex flex-wrap gap-2">
                          {(novoItem.anexos_item || []).map((anexo, idx) => (
                            <div key={idx} className="relative group">
                              {anexo.tipo?.startsWith('image/') ? (
                                <div className="relative w-20 h-20 border rounded overflow-hidden bg-gray-100">
                                  <img
                                    src={anexo.url}
                                    alt={anexo.nome}
                                    className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                                    title={anexo.nome}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setNovoItem(prev => ({
                                      ...prev,
                                      anexos_item: prev.anexos_item.filter((_, filterIdx) => filterIdx !== idx),
                                    }))}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs">
                                  <Paperclip className="w-3 h-3 text-gray-500" />
                                  <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[120px] truncate">
                                    {anexo.nome || 'Anexo'}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setNovoItem(prev => ({
                                      ...prev,
                                      anexos_item: prev.anexos_item.filter((_, filterIdx) => filterIdx !== idx),
                                    }))}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          <label className="flex items-center gap-1 cursor-pointer bg-white border border-dashed rounded px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
                            <Paperclip className="w-3 h-3" />
                            Anexar
                            <input
                              type="file"
                              accept="image/*,video/*,.pdf"
                              multiple
                              className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (!files.length) return;
                                const uploads = [];
                                for (const file of files) {
                                  try {
                                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                    uploads.push({ nome: file.name, url: file_url, tipo: file.type, uploaded_at: new Date().toISOString() });
                                  } catch (error) {
                                    console.error('Upload error:', error);
                                    toast.error(`Falha ao enviar ${file.name}`);
                                  }
                                }
                                if (uploads.length > 0) {
                                  setNovoItem(prev => ({
                                    ...prev,
                                    anexos_item: [...(prev.anexos_item || []), ...uploads],
                                    possui_imagens_videos: true,
                                  }));
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Observações */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Observações Adicionais</Label>
                    <Textarea
                      ref={descricaoNovoItemRef}
                      placeholder="Alguma instrução especial para o fornecedor sobre este item?"
                      className="bg-white resize-none"
                      value={novoItem.observacoes_item || ''}
                      onChange={(e) => setNovoItem(prev => ({
                        ...prev,
                        observacoes_item: e.target.value,
                      }))}
                      rows={2}
                    />
                  </div>

                  {/* Quarta Linha: Ações */}
                  <div className="flex flex-col md:flex-row items-center justify-end pt-4 border-t border-gray-100">
                    <Button 
                      onClick={handleAddItem} 
                      className="w-full md:w-auto px-10 h-11 shadow-lg shadow-blue-900/10 transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </div>
                </div>
              </div>
            )}

              {/* Resumo de valores */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 flex flex-col items-end gap-1 shadow-sm mt-8">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total da Ordem de Compra</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-medium text-gray-500">R$</span>
                  <span className="text-3xl font-black text-gray-900 tracking-tighter">
                    {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              </>
              )}
            </div>

            {/* Resumo do Andamento - Apenas em modo "ver" */}
            {isVer && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-green-900 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full" />
                    Histórico de Andamento
                  </h3>

                  {/* Timeline de eventos */}
                  <div className="space-y-3 ml-1">
                    {/* Criação */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                        <div className="w-0.5 h-12 bg-green-200 mt-1"></div>
                      </div>
                      <div className="pb-3 pt-0.5">
                        <p className="text-sm font-semibold text-gray-800">Pedido Criado</p>
                        <p className="text-xs text-gray-500">
                          {formData.data_hora_criado ? new Date(formData.data_hora_criado).toLocaleString('pt-BR') : 'Data não registrada'}
                        </p>
                        {formData.canal_solicitacao && (
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="inline-block px-2 py-0.5 bg-white rounded border border-gray-300 text-gray-700">
                              Canal: {formData.canal_solicitacao}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Envio */}
                    {formData.data_hora_enviado && (
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                          <div className="w-0.5 h-12 bg-blue-200 mt-1"></div>
                        </div>
                        <div className="pb-3 pt-0.5">
                          <p className="text-sm font-semibold text-gray-800">Pedido Enviado ao Fornecedor</p>
                          <p className="text-xs text-gray-500">
                            {new Date(formData.data_hora_enviado).toLocaleString('pt-BR')}
                          </p>
                          {formData.canal_envio && (
                            <p className="text-xs text-gray-600 mt-1">
                              <span className="inline-block px-2 py-0.5 bg-white rounded border border-gray-300 text-gray-700">
                                Via: {formData.canal_envio}
                              </span>
                            </p>
                          )}
                          {formData.quem_aceitou && (
                            <p className="text-xs text-gray-600 mt-1">
                              <span className="inline-block px-2 py-0.5 bg-white rounded border border-gray-300 text-gray-700">
                                Aceito por: {formData.quem_aceitou}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Faturamento */}
                    {formData.pedido_faturado && (
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                          {!formData.data_hora_enviado && <div className="w-0.5 h-12 bg-amber-200 mt-1"></div>}
                        </div>
                        <div className="pt-0.5">
                          <p className="text-sm font-semibold text-gray-800">Pedido Faturado</p>
                          <p className="text-xs text-gray-500">
                            {formData.data_faturamento ? new Date(formData.data_faturamento).toLocaleString('pt-BR') : 'Data não registrada'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pendências */}
                    {formData.pendencias && (
                      <div className="flex gap-3 mt-4 p-3 bg-amber-100 rounded-lg border border-amber-300">
                        <div>
                          <p className="text-sm font-semibold text-amber-900">Pendências Identificadas</p>
                          <p className="text-xs text-amber-800 mt-1">{formData.pendencias}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumo de status */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-green-200">
                    <Badge variant="outline" className="bg-white">
                      Status: {oc?.status || 'Desconhecido'}
                    </Badge>
                    {formData.pedido_faturado && (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        Faturado
                      </Badge>
                    )}
                    {formData.data_hora_enviado && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                        Enviado
                      </Badge>
                    )}
                    {formData.pendencias && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                        Com Pendências
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {isVer ? 'Fechar' : 'Cancelar'}
            </Button>
            {!isVer && (
              <>
                {!isNovoOuDuplicar && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopiarPedido}
                    disabled={itens.length === 0 || isLoading}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Pedido
                  </Button>
                )}
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!isFormValido || isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isNovoOuDuplicar ? 'Criar OC' : 'Atualizar OC'}
                </Button>
                {/* Botão Enviar para Fornecedor (apenas se Rascunho e não é novo) */}
                {!isNovoOuDuplicar && oc?.status === 'Rascunho' && (
                  <Button
                    onClick={() => onEnviar?.(oc)}
                    disabled={isLoading}
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Enviar para Fornecedor
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog para deletar item */}
      <AlertDialog open={showAlertDelete} onOpenChange={setShowAlertDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item da OC?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleRemoveItem(itemParaDeleter)}
              className="text-red-600"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FornecedorModal
        open={fornecedorModalOpen}
        onOpenChange={setFornecedorModalOpen}
        onSuccess={(novoFornecedor) => {
          if (!novoFornecedor) return;
          setFormData(prev => ({
            ...prev,
            fornecedor_id: novoFornecedor.id,
            fornecedor_nome: novoFornecedor.nome_empresa || '',
          }));
          toast.success(`Fornecedor ${novoFornecedor.nome_empresa || ''} selecionado na OC`);
        }}
      />

      <ProdutoModal
        isOpen={novoProdutoModalOpen}
        onClose={() => setNovoProdutoModalOpen(false)}
        onSave={handleSalvarNovoProduto}
        isLoading={salvandoNovoProduto}
      />
    </>
  );
}
