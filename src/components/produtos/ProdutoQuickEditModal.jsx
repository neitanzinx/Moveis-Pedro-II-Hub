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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Package,
    Save,
    Loader2,
    Warehouse,
    ImageIcon,
    Ruler,
    FileText,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { CATEGORIAS, AMBIENTES } from '@/constants/productConstants';
import { getProductTotalStock, resolveStockField } from '@/utils/stockUtils';

const INITIAL_FORM_DATA = {
    nome: '',
    categoria: '',
    ambiente: '',
    fornecedor_nome: '',
    modelo_referencia: '',
    descricao: '',
    material: '',
    largura: '',
    altura: '',
    profundidade: '',
    ncm: '',
    cest: '',
    cfop: '',
    origem_mercadoria: '0',
    preco_venda: 0,
    preco_custo: 0,
    markup_aplicado: 0,
    quantidade_estoque: 0,
    estoque_cd: 0,
    estoque_minimo: 0,
    estoque_ideal: 0,
};

export default function ProdutoQuickEditModal({ isOpen, onClose, produto, onSave, lojaAtual }) {
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [saving, setSaving] = useState(false);

    const { user, isGerente } = useAuth();
    const isGerencial = isGerente?.() || user?.cargo === 'Gerente Geral' || user?.cargo === 'Administrador';
    const campoLojaAtual = resolveStockField(lojaAtual || 'CD');
    const estoqueLojaAtual = Number(produto?.[campoLojaAtual] || 0);
    const nomeExibicaoLoja = lojaAtual || 'CD';

    useEffect(() => {
        if (produto) {
            setFormData({
                ...INITIAL_FORM_DATA,
                nome: produto.nome || '',
                categoria: produto.categoria || '',
                ambiente: produto.ambiente || '',
                fornecedor_nome: produto.fornecedor_nome || '',
                modelo_referencia: produto.modelo_referencia || '',
                descricao: produto.descricao || '',
                material: produto.material || '',
                largura: produto.largura || '',
                altura: produto.altura || '',
                profundidade: produto.profundidade || '',
                // Fiscal
                ncm: produto.ncm || '',
                cest: produto.cest || '',
                cfop: produto.cfop || '',
                origem_mercadoria: produto.origem_mercadoria || '0',
                // Preços
                preco_venda: produto.preco_venda || 0,
                preco_custo: produto.preco_custo || 0,
                markup_aplicado: produto.markup_aplicado || 0,
                // Estoque
                quantidade_estoque: produto.quantidade_estoque || 0,
                estoque_cd: produto.estoque_cd || 0,
                estoque_minimo: produto.estoque_minimo || 0,
                estoque_ideal: produto.estoque_ideal || 0,
                estoque_loja_atual: estoqueLojaAtual,
            });
        } else {
            setFormData(INITIAL_FORM_DATA);
        }
    }, [produto, estoqueLojaAtual]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const getVal = (v) => parseInt(v) || 0;
            const estoqueLoja = getVal(formData.estoque_loja_atual);

            const updatedData = {
                ...formData,
                [campoLojaAtual]: estoqueLoja,
            };

            delete updatedData.estoque_loja_atual;

            // Recalcula o total agregado com base nos campos reais de estoque
            const produtoParaTotal = { ...produto, ...updatedData };
            updatedData.quantidade_estoque = getProductTotalStock(produtoParaTotal);

            await onSave(updatedData);
            toast.success('Produto atualizado com sucesso!');
            onClose();
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

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

                <div className="space-y-4 mt-4">
                    {/* Produto Info + Imagem */}
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Imagem (Adicionado a pedido do usuário) */}
                        <div className="w-full md:w-1/3 flex flex-col items-center">
                            <div className="w-48 h-48 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center shadow-sm">
                                {produto.fotos?.[0] ? (
                                    <img src={produto.fotos[0]} alt={formData.nome} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-gray-300 flex flex-col items-center">
                                        <ImageIcon className="w-12 h-12 mb-2" />
                                        <span className="text-sm">Sem Imagem</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-center px-4">
                                A imagem principal do produto é gerenciada na Central de Imagens.
                            </p>
                        </div>

                        {/* Campos Principais */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
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
                                <Label>Modelo / Referência</Label>
                                <Input
                                    value={formData.modelo_referencia}
                                    onChange={e => setFormData({ ...formData, modelo_referencia: e.target.value })}
                                    placeholder="Modelo ou referência"
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
                        </div>
                    </div>

                    {/* Descrição */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            Descrição do Produto
                        </Label>
                        <Textarea
                            value={formData.descricao}
                            onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                            placeholder="Descrição completa do produto..."
                            rows={4}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Características Técnicas */}
                        <Card className="bg-white border-gray-100">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Ruler className="w-4 h-4 text-purple-600" />
                                    Características Técnicas
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Material</Label>
                                    <Input
                                        value={formData.material}
                                        onChange={e => setFormData({ ...formData, material: e.target.value })}
                                        placeholder="Ex: MDF, Madeira Maciça, Tecido..."
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Largura (cm)</Label>
                                        <Input
                                            type="number"
                                            value={formData.largura}
                                            onChange={e => setFormData({ ...formData, largura: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Altura (cm)</Label>
                                        <Input
                                            type="number"
                                            value={formData.altura}
                                            onChange={e => setFormData({ ...formData, altura: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Profundidade (cm)</Label>
                                        <Input
                                            type="number"
                                            value={formData.profundidade}
                                            onChange={e => setFormData({ ...formData, profundidade: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dados Fiscais */}
                        <Card className="bg-white border-gray-100">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                                    Dados Fiscais
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs">NCM</Label>
                                        <Input
                                            value={formData.ncm}
                                            onChange={e => setFormData({ ...formData, ncm: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">CEST</Label>
                                        <Input
                                            value={formData.cest}
                                            onChange={e => setFormData({ ...formData, cest: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">CFOP Padrão</Label>
                                    <Input
                                        value={formData.cfop}
                                        onChange={e => setFormData({ ...formData, cfop: e.target.value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Preços - Só Gerencial vê Markup/Custo */}
                    <Card className="bg-white border-green-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Valores</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold text-green-700">Preço de Venda (R$)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="border-green-300 bg-green-50 font-medium"
                                        value={formData.preco_venda || 0}
                                        onChange={e => setFormData({ ...formData, preco_venda: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>

                                {isGerencial && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Preço de Custo (R$)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={formData.preco_custo || 0}
                                                onChange={e => setFormData({ ...formData, preco_custo: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Markup (%)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={formData.markup_aplicado || 0}
                                                onChange={e => setFormData({ ...formData, markup_aplicado: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Estoque Editável Indepentente de Variações */}
                    <Card className="bg-gray-50 border-gray-200">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Warehouse className="w-4 h-4 text-blue-600" />
                                    Gestão de Estoque
                                </CardTitle>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[10px] uppercase text-gray-400">Min</Label>
                                        <Input
                                            type="number"
                                            className="h-6 w-16 text-xs"
                                            value={formData.estoque_minimo || 0}
                                            onChange={e => setFormData({ ...formData, estoque_minimo: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[10px] uppercase text-gray-400">Ideal</Label>
                                        <Input
                                            type="number"
                                            className="h-6 w-16 text-xs"
                                            value={formData.estoque_ideal || 0}
                                            onChange={e => setFormData({ ...formData, estoque_ideal: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <div className="space-y-2 col-span-2 md:col-span-3 lg:col-span-2">
                                    <Label className="font-bold cursor-help text-xs" title="Quantidade de estoque da loja selecionada no PDV">Estoque Loja ({nomeExibicaoLoja})</Label>
                                    <div className="h-8 flex items-center px-3 bg-blue-50 border border-blue-100 rounded-md text-blue-700 font-bold">
                                        {parseInt(formData.estoque_loja_atual) || 0}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-gray-500 uppercase">Ajustar Estoque ({nomeExibicaoLoja})</Label>
                                    <Input
                                        type="number"
                                        className="h-8"
                                        value={formData.estoque_loja_atual || 0}
                                        onChange={e => setFormData({ ...formData, estoque_loja_atual: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>

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
