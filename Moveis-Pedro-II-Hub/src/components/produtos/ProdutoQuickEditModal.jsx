import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Package,
    Save,
    Loader2,
    Palette,
    Ruler,
    DollarSign,
    Warehouse,
    Edit2,
    Trash2,
    Plus,
    X,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getColorHex } from './FurnitureColorPicker';
import { CATEGORIAS, AMBIENTES } from '@/constants/productConstants';

export default function ProdutoQuickEditModal({ isOpen, onClose, produto, onSave }) {
    const [formData, setFormData] = useState({});
    const [variacoes, setVariacoes] = useState([]);
    const [saving, setSaving] = useState(false);
    const [expandedVariation, setExpandedVariation] = useState(null);
    const [editingVariation, setEditingVariation] = useState(null);

    const { user, isGerente } = useAuth();
    const isGerencial = isGerente?.() || user?.cargo === 'Gerente Geral' || user?.cargo === 'Administrador';

    useEffect(() => {
        if (produto) {
            setFormData({
                nome: produto.nome || '',
                categoria: produto.categoria || '',
                ambiente: produto.ambiente || '',
                fornecedor_nome: produto.fornecedor_nome || '',
                modelo_referencia: produto.modelo_referencia || '',
                preco_venda: produto.preco_venda || 0,
                preco_custo: produto.preco_custo || 0,
                markup_aplicado: produto.markup_aplicado || 0,
                quantidade_estoque: produto.quantidade_estoque || 0,
                estoque_cd: produto.estoque_cd || 0,
                estoque_mostruario_mega_store: produto.estoque_mostruario_mega_store || 0,
                estoque_mostruario_centro: produto.estoque_mostruario_centro || 0,
                estoque_mostruario_ponte_branca: produto.estoque_mostruario_ponte_branca || 0,
                ativo: produto.ativo !== false,
            });
            setVariacoes(produto.variacoes || []);
        }
    }, [produto]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedData = {
                ...formData,
                variacoes: variacoes,
            };
            await onSave(updatedData);
            toast.success('Produto atualizado com sucesso!');
            onClose();
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleVariationChange = (index, field, value) => {
        const updated = [...variacoes];
        updated[index] = { ...updated[index], [field]: value };
        setVariacoes(updated);
    };

    const handleDeleteVariation = (index) => {
        const updated = variacoes.filter((_, i) => i !== index);
        setVariacoes(updated);
    };

    // Gerar SKU para variação
    // Formato: PRODSKU-COR-NN (ex: ALT-POR-0010-MEL-01)
    const generateVariationSKU = (cor, index) => {
        const prodSku = produto?.codigo_barras || 'PRD-000';
        const corPart = (cor || 'VAR').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'VAR';
        const numPart = String(index + 1).padStart(2, '0');
        return `${prodSku}-${corPart}-${numPart}`;
    };

    const handleAddVariation = () => {
        const newIndex = variacoes.length;
        setVariacoes([
            ...variacoes,
            {
                sku: generateVariationSKU('', newIndex),
                cor: '',
                tamanho: '',
                largura: null,
                altura: null,
                profundidade: null,
                preco_custo: formData.preco_custo || 0,
                preco_venda: formData.preco_venda || 0,
                estoque_cd: 0,
                estoque_mostruario_mega_store: 0,
                estoque_mostruario_centro: 0,
                estoque_mostruario_ponte_branca: 0,
            }
        ]);
        setExpandedVariation(variacoes.length);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const totalEstoque = variacoes.reduce((sum, v) => {
        return sum + (v.estoque_cd || 0) + (v.estoque_mostruario_mega_store || 0) +
            (v.estoque_mostruario_centro || 0) + (v.estoque_mostruario_ponte_branca || 0);
    }, 0) || formData.quantidade_estoque || 0;

    if (!produto) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-green-600" />
                        Editar Produto
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="info" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="info">Informações Gerais</TabsTrigger>
                        <TabsTrigger value="variacoes" className="flex items-center gap-1">
                            <Palette className="w-4 h-4" />
                            Variações ({variacoes.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab: Informações Gerais */}
                    <TabsContent value="info" className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome do Produto</Label>
                                <Input
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Nome do produto"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Fornecedor</Label>
                                <Input
                                    value={formData.fornecedor_nome}
                                    onChange={e => setFormData({ ...formData, fornecedor_nome: e.target.value })}
                                    placeholder="Nome do fornecedor"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Select
                                    value={formData.categoria}
                                    onValueChange={v => setFormData({ ...formData, categoria: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIAS.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Ambiente</Label>
                                <Select
                                    value={formData.ambiente}
                                    onValueChange={v => setFormData({ ...formData, ambiente: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Diversos">Diversos</SelectItem>
                                        {AMBIENTES.map(amb => (
                                            <SelectItem key={amb} value={amb}>{amb}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Modelo / Referência</Label>
                                <Input
                                    value={formData.modelo_referencia}
                                    onChange={e => setFormData({ ...formData, modelo_referencia: e.target.value })}
                                    placeholder="Modelo ou referência"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Preço de Venda</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.preco_venda}
                                    onChange={e => setFormData({ ...formData, preco_venda: parseFloat(e.target.value) || 0 })}
                                />
                            </div>

                            {isGerencial && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Preço de Custo</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.preco_custo}
                                            onChange={e => setFormData({ ...formData, preco_custo: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Markup (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.markup_aplicado}
                                            onChange={e => setFormData({ ...formData, markup_aplicado: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Resumo de Estoque */}
                        <Card className="bg-gray-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Warehouse className="w-4 h-4" />
                                    Resumo de Estoque
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-center">
                                    <div>
                                        <p className="text-xs text-gray-500">CD</p>
                                        <p className="font-bold">{formData.estoque_cd || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Mega Store</p>
                                        <p className="font-bold">{formData.estoque_mostruario_mega_store || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Centro</p>
                                        <p className="font-bold">{formData.estoque_mostruario_centro || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Ponte Branca</p>
                                        <p className="font-bold">{formData.estoque_mostruario_ponte_branca || 0}</p>
                                    </div>
                                    <div className="bg-green-100 rounded p-1">
                                        <p className="text-xs text-green-600">TOTAL</p>
                                        <p className="font-bold text-green-700">{totalEstoque}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Variações */}
                    <TabsContent value="variacoes" className="mt-4">
                        <div className="space-y-3">
                            {variacoes.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Palette className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p>Nenhuma variação cadastrada</p>
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={handleAddVariation}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Adicionar Variação
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {variacoes.map((variacao, index) => {
                                        const varEstoque = (variacao.estoque_cd || 0) +
                                            (variacao.estoque_mostruario_mega_store || 0) +
                                            (variacao.estoque_mostruario_centro || 0) +
                                            (variacao.estoque_mostruario_ponte_branca || 0);
                                        const isExpanded = expandedVariation === index;
                                        const colorHex = getColorHex(variacao.cor);

                                        return (
                                            <Card key={index} className="overflow-hidden">
                                                {/* Header da Variação */}
                                                <div
                                                    className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => setExpandedVariation(isExpanded ? null : index)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-lg border-2 shadow-sm"
                                                            style={{ backgroundColor: colorHex || '#ccc' }}
                                                        />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium">
                                                                    {variacao.cor || 'Sem cor'}
                                                                    {variacao.tamanho && <span className="text-gray-500 ml-1">({variacao.tamanho})</span>}
                                                                </p>
                                                                <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-600 border-blue-200">
                                                                    {variacao.sku || `VAR-${String(index + 1).padStart(2, '0')}`}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-gray-500">
                                                                {[variacao.largura, variacao.altura, variacao.profundidade]
                                                                    .filter(d => d)
                                                                    .join(' × ')} cm
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        {isGerencial && (
                                                            <div className="text-right text-sm">
                                                                <p className="text-gray-500">Custo: {formatCurrency(variacao.preco_custo)}</p>
                                                            </div>
                                                        )}
                                                        <div className="text-right">
                                                            <p className="font-bold text-green-600">{formatCurrency(variacao.preco_venda)}</p>
                                                            <p className="text-xs text-gray-500">Est: {varEstoque}</p>
                                                        </div>
                                                        <Button variant="ghost" size="icon">
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Detalhes Expandidos */}
                                                {isExpanded && (
                                                    <CardContent className="p-4 border-t">
                                                        {/* SKU da Variação */}
                                                        <div className="mb-4 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="bg-white text-blue-700 border-blue-300 font-mono">
                                                                        {variacao.sku || generateVariationSKU(variacao.cor, index)}
                                                                    </Badge>
                                                                    <span className="text-xs text-blue-600">SKU da Variação</span>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 text-xs text-blue-600"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newSku = generateVariationSKU(variacao.cor, index);
                                                                        handleVariationChange(index, 'sku', newSku);
                                                                    }}
                                                                >
                                                                    Gerar SKU
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Cor</Label>
                                                                <Input
                                                                    value={variacao.cor || ''}
                                                                    onChange={e => handleVariationChange(index, 'cor', e.target.value)}
                                                                    placeholder="Cor"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Tamanho</Label>
                                                                <Input
                                                                    value={variacao.tamanho || ''}
                                                                    onChange={e => handleVariationChange(index, 'tamanho', e.target.value)}
                                                                    placeholder="Tamanho"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Preço Venda</Label>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={variacao.preco_venda || 0}
                                                                    onChange={e => handleVariationChange(index, 'preco_venda', parseFloat(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                            {isGerencial && (
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs">Preço Custo</Label>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={variacao.preco_custo || 0}
                                                                        onChange={e => handleVariationChange(index, 'preco_custo', parseFloat(e.target.value) || 0)}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <Separator className="my-4" />

                                                        <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs flex items-center gap-1">
                                                                    <Ruler className="w-3 h-3" /> Largura (cm)
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={variacao.largura || ''}
                                                                    onChange={e => handleVariationChange(index, 'largura', parseFloat(e.target.value) || null)}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Altura (cm)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={variacao.altura || ''}
                                                                    onChange={e => handleVariationChange(index, 'altura', parseFloat(e.target.value) || null)}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Profundidade (cm)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={variacao.profundidade || ''}
                                                                    onChange={e => handleVariationChange(index, 'profundidade', parseFloat(e.target.value) || null)}
                                                                />
                                                            </div>
                                                        </div>

                                                        <Separator className="my-4" />

                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Est. CD</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={variacao.estoque_cd || 0}
                                                                    onChange={e => handleVariationChange(index, 'estoque_cd', parseInt(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Mega Store</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={variacao.estoque_mostruario_mega_store || 0}
                                                                    onChange={e => handleVariationChange(index, 'estoque_mostruario_mega_store', parseInt(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Centro</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={variacao.estoque_mostruario_centro || 0}
                                                                    onChange={e => handleVariationChange(index, 'estoque_mostruario_centro', parseInt(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Ponte Branca</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={variacao.estoque_mostruario_ponte_branca || 0}
                                                                    onChange={e => handleVariationChange(index, 'estoque_mostruario_ponte_branca', parseInt(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 flex justify-end">
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDeleteVariation(index)}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-1" />
                                                                Excluir Variação
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                )}
                                            </Card>
                                        );
                                    })}

                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={handleAddVariation}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Adicionar Nova Variação
                                    </Button>
                                </>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-2"
                        style={{ backgroundColor: '#07593f' }}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
