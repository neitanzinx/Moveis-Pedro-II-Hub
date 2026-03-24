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
import { Copy, Loader2, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { comprasService } from '@/services/comprasService';
import { base44 } from "@/api/base44Client";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import FornecedorModal from '@/components/cadastros/FornecedorModal';

function buildProductSummary(produto) {
  if (!produto) return '';

  const detalhes = [
    produto.modelo_referencia ? `Ref: ${produto.modelo_referencia}` : null,
    produto.cor ? `Cor: ${produto.cor}` : null,
    produto.material ? `Material: ${produto.material}` : null,
    produto.largura || produto.altura || produto.profundidade
      ? `Medidas: ${produto.largura || '-'}x${produto.altura || '-'}x${produto.profundidade || '-'} cm`
      : null,
  ].filter(Boolean);

  return detalhes.join(' | ');
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
    item?.modelo_referencia ? `Ref: ${item.modelo_referencia}` : null,
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

function formatarQuantidade(valor) {
  const numero = Number(valor) || 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(numero) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

function formatarData(data) {
  if (!data) return new Date().toLocaleDateString('pt-BR');
  return new Date(data).toLocaleDateString('pt-BR');
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
  const { user } = useAuth();
  const isNovoOuDuplicar = !oc || oc.duplicar;
  const isVer = modo === 'ver';

  // Estado do formulário
  const [formData, setFormData] = useState({
    fornecedor_id: null,
    fornecedor_nome: '',
    centro_custo_id: null,
    data_previsao_entrega: '',
    observacoes: '',
    pedido_faturado: false,
    data_faturamento: '',
  });

  const [itens, setItens] = useState([]);
  const [novoItem, setNovoItem] = useState({
    produto_id: null,
    produto_nome: '',
    quantidade_pedida: 1,
    preco_unitario: 0,
    preco_tabela: 0,
    modelo_referencia: '',
    cor: '',
    material: '',
    largura: '',
    altura: '',
    profundidade: '',
    observacoes_item: '',
  });

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

  // Query: produtos do fornecedor selecionado (busca direta, sem depender de cache global)
  const { data: produtosDoFornecedor = [], isLoading: carregandoProdutos } = useQuery({
    queryKey: ['produtos-fornecedor', formData.fornecedor_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco_custo, preco_venda, modelo_referencia, cor, material, categoria, largura, altura, profundidade, fornecedor_id, fornecedor_nome')
        .eq('fornecedor_id', formData.fornecedor_id)
        .order('nome', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.fornecedor_id,
    staleTime: 30000,
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
            pedido_faturado: Boolean(metadata.pedido_faturado),
            data_faturamento: metadata.data_faturamento || '',
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
    setFormData({
      fornecedor_id: oc?.fornecedor_id || null,
      fornecedor_nome: oc?.fornecedor_nome || '',
      centro_custo_id: oc?.centro_custo_id || user?.centro_custo_id || null,
      data_previsao_entrega: oc?.data_previsao_entrega || '',
      observacoes: oc?.observacoes || '',
      pedido_faturado: Boolean(metadata.pedido_faturado),
      data_faturamento: metadata.data_faturamento || '',
    });
    setItens(oc?.itens?.map(i => ({ ...i, id: undefined })) || []);
  }, [isOpen, oc, isNovoOuDuplicar, user?.centro_custo_id]);

  // Validação
  const isFormValido = formData.fornecedor_id && itens.length > 0;
  const podeEditarItens = !isVer && (isNovoOuDuplicar || ['Rascunho', 'Aguardando Envio'].includes(oc?.status));
  const valorTotal = useMemo(() => {
    return itens.reduce((sum, item) => sum + (item.quantidade_pedida * item.preco_unitario), 0);
  }, [itens]);

  const produtosFiltradosNovoItem = useMemo(() => {
    if (!formData.fornecedor_id || !produtosDoFornecedor.length) return [];
    let lista = produtosDoFornecedor;
    if (buscaProduto.trim()) {
      lista = lista.filter(p => matchProductByAnyOrder(p, buscaProduto));
    }
    return lista.slice(0, limiteProdutos);
  }, [produtosDoFornecedor, buscaProduto, formData.fornecedor_id, limiteProdutos]);

  const descricaoEstruturadaNovoItem = useMemo(() => {
    return buildStructuredItemDetails(novoItem);
  }, [novoItem]);

  // Handlers
  const handleFornecedorChange = (fornecedorId) => {
    if (itens.length > 0) {
      toast.error('Remova os itens da OC antes de trocar o fornecedor');
      return;
    }

    const fornecedor = fornecedores.find(f => String(f.id) === String(fornecedorId));
    setBuscaProduto('');
    setNovoItem({
      produto_id: null,
      produto_nome: '',
      quantidade_pedida: 1,
      preco_unitario: 0,
      preco_tabela: 0,
      modelo_referencia: '',
      cor: '',
      material: '',
      largura: '',
      altura: '',
      profundidade: '',
      observacoes_item: '',
      descricao_personalizada: '',
    });
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
    setNovoItem({
      produto_id: null,
      produto_nome: '',
      quantidade_pedida: 1,
      preco_unitario: 0,
      preco_tabela: 0,
      modelo_referencia: '',
      cor: '',
      material: '',
      largura: '',
      altura: '',
      profundidade: '',
      observacoes_item: '',
      descricao_personalizada: '',
    });
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

    setNovoItem(prev => ({
      ...prev,
      produto_id: produto.id,
      produto_nome: produto.nome || '',
      preco_tabela: produto.preco_venda || 0,
      preco_unitario: prev.preco_unitario > 0 ? prev.preco_unitario : precoCusto,
      ...camposProduto,
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
      return {
        ...item,
        [field]: value,
      };
    }));
  };

  const handleCopiarPedido = async () => {
    try {
      const linhasItens = (itens || []).length > 0
        ? itens.map((item, index) => {
            const nome = item.produto_nome || 'Produto sem nome';
            const quantidade = formatarQuantidade(item.quantidade_pedida || 0);
            return `${index + 1}. ${nome} - Qtd: ${quantidade}`;
          })
        : ['(Sem itens cadastrados)'];

      const textoPedido = [
        `Pedido para ${formData.fornecedor_nome || oc?.fornecedor_nome || 'Fornecedor não informado'}`,
        `OC: ${oc?.numero_pedido || 'Sem número'}`,
        `Data: ${formatarData(oc?.created_at || oc?.data_pedido)}`,
        '',
        ...linhasItens,
        '',
        `Total de itens: ${itens.length}`,
      ].join('\n');

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
              descricao_personalizada: item.descricao_personalizada || null,
              quantidade_pedida: item.quantidade_pedida,
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
            pedido_faturado: formData.pedido_faturado,
            data_faturamento: formData.data_faturamento || null,
            metadata: oc.metadata || {},
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
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Adicione observações sobre esta OC..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    observacoes: e.target.value,
                  }))}
                  disabled={isVer}
                  rows={3}
                />
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
                      <TableHead className="text-right w-24">Qtd</TableHead>
                      <TableHead className="text-right w-32">Preço Unit.</TableHead>
                      <TableHead className="text-right w-32">Subtotal</TableHead>
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
                          {podeEditarItens ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              value={item.preco_unitario}
                              onChange={(e) => handleItemChange(index, 'preco_unitario', parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            `R$ ${(item.preco_unitario || 0).toFixed(2)}`
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
                      <Label className="text-xs font-semibold text-gray-600">Produto *</Label>
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
                              <div className="px-3 py-3 text-xs text-gray-500">
                                {buscaProduto.trim()
                                  ? 'Nenhum item encontrado com esse termo.'
                                  : 'Nenhum produto cadastrado para este fornecedor.'}
                              </div>
                            ) : (
                              produtosFiltradosNovoItem.map((produto) => (
                                <button
                                  key={produto.id}
                                  type="button"
                                  onMouseDown={() => handleProdutoSelect(produto)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                                >
                                  <div className="font-semibold text-gray-800">{produto.nome}</div>
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

                    <div className="md:col-span-3 space-y-2">
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

                    <div className="md:col-span-3 space-y-2">
                      <Label className="text-xs font-semibold text-gray-600">Preço Unitário</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-9 bg-white"
                          value={novoItem.preco_unitario}
                          onChange={(e) => setNovoItem(prev => ({
                            ...prev,
                            preco_unitario: parseFloat(e.target.value) || 0,
                          }))}
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
                      <Label className="text-xs font-semibold text-gray-600">Cor</Label>
                      <Input
                        placeholder="Ex: Branco"
                        className="bg-white"
                        value={novoItem.cor || ''}
                        onChange={(e) => setNovoItem(prev => ({ ...prev, cor: e.target.value }))}
                      />
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

                  {/* Terceira Linha: Observações */}
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
    </>
  );
}
