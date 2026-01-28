import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Package,
    Palette,
    Ruler,
    Warehouse,
    ShoppingCart,
    Edit,
    Check,
    Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { getColorHex } from './FurnitureColorPicker';

export default function ProdutoVariacoesModal({ isOpen, onClose, produtoPai, onSelectVariacao, onEditVariacao }) {
    const [selectedVariacao, setSelectedVariacao] = useState(null);

    // Buscar variações (produtos filhos) deste produto pai
    const { data: variacoes = [], isLoading } = useQuery({
        queryKey: ['variacoes', produtoPai?.id],
        queryFn: async () => {
            if (!produtoPai?.id) return [];
            const result = await base44.entities.Produto.filter({ parent_id: produtoPai.id });
            return result || [];
        },
        enabled: isOpen && !!produtoPai?.id,
    });

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Agrupar cores únicas para seletor rápido
    const coresUnicas = useMemo(() => {
        const cores = new Set(variacoes.map(v => v.cor).filter(Boolean));
        return Array.from(cores);
    }, [variacoes]);

    // Calcular estoque total da variação
    const getEstoqueTotal = (v) => {
        return (v.estoque_cd || 0) +
            (v.estoque_mostruario_mega_store || 0) +
            (v.estoque_mostruario_centro || 0) +
            (v.estoque_mostruario_ponte_branca || 0);
    };

    // Preço mínimo para exibir no header
    const precoMinimo = useMemo(() => {
        if (!variacoes.length) return produtoPai?.preco_venda || 0;
        return Math.min(...variacoes.map(v => v.preco_venda || 0).filter(p => p > 0));
    }, [variacoes, produtoPai]);

    const handleCopySku = (sku) => {
        navigator.clipboard.writeText(sku);
        toast.success('SKU copiado!');
    };

    if (!produtoPai) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-green-600" />
                        {produtoPai.nome}{produtoPai.modelo_referencia ? ` ${produtoPai.modelo_referencia}` : ''}
                    </DialogTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                        {produtoPai.categoria && (
                            <Badge variant="outline">{produtoPai.categoria}</Badge>
                        )}
                        {produtoPai.ambiente && (
                            <Badge variant="outline">{produtoPai.ambiente}</Badge>
                        )}
                        {produtoPai.fornecedor_nome && (
                            <Badge variant="outline" className="bg-blue-50">{produtoPai.fornecedor_nome}</Badge>
                        )}
                    </div>
                    <p className="text-lg font-bold text-green-700 mt-1">
                        A partir de {formatCurrency(precoMinimo)}
                    </p>
                </DialogHeader>

                <Separator className="my-2" />

                {/* Seletor de Cores */}
                {coresUnicas.length > 1 && (
                    <div className="mb-4">
                        <p className="text-sm font-medium text-gray-600 mb-2">Selecione a cor:</p>
                        <div className="flex flex-wrap gap-2">
                            {coresUnicas.map(cor => {
                                const colorHex = getColorHex(cor);
                                const isSelected = selectedVariacao?.cor === cor;
                                return (
                                    <button
                                        key={cor}
                                        onClick={() => {
                                            const variacao = variacoes.find(v => v.cor === cor);
                                            setSelectedVariacao(variacao);
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${isSelected
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div
                                            className="w-6 h-6 rounded-full border shadow-sm"
                                            style={{ backgroundColor: colorHex || '#ddd' }}
                                        />
                                        <span className="text-sm font-medium">{cor}</span>
                                        {isSelected && <Check className="w-4 h-4 text-green-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Lista de Variações */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 gap-3">
                        {isLoading ? (
                            <div className="text-center py-8 text-gray-500">
                                Carregando variações...
                            </div>
                        ) : variacoes.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Palette className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                <p>Nenhuma variação cadastrada</p>
                            </div>
                        ) : (
                            variacoes.map((variacao) => {
                                const colorHex = getColorHex(variacao.cor);
                                const estoqueTotal = getEstoqueTotal(variacao);
                                const isSelected = selectedVariacao?.id === variacao.id;

                                return (
                                    <Card
                                        key={variacao.id}
                                        className={`cursor-pointer transition-all ${isSelected
                                            ? 'ring-2 ring-green-500 bg-green-50'
                                            : 'hover:bg-gray-50'
                                            }`}
                                        onClick={() => setSelectedVariacao(variacao)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-4">
                                                {/* Cor */}
                                                <div
                                                    className="w-12 h-12 rounded-lg border-2 shadow-sm shrink-0"
                                                    style={{ backgroundColor: colorHex || '#ddd' }}
                                                />

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold truncate">
                                                            {variacao.cor || 'Padrão'}
                                                        </p>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopySku(variacao.sku);
                                                            }}
                                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                                        >
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                {variacao.sku}
                                                            </Badge>
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>

                                                    {/* Dimensões */}
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                                        {(variacao.largura || variacao.altura || variacao.profundidade) && (
                                                            <span className="flex items-center gap-1">
                                                                <Ruler className="w-3 h-3" />
                                                                {variacao.largura} × {variacao.altura} × {variacao.profundidade} cm
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Estoque por loja */}
                                                    <div className="flex items-center gap-2 mt-2 text-xs">
                                                        <Warehouse className="w-3 h-3 text-gray-400" />
                                                        <span className="text-gray-500">CD: {variacao.estoque_cd || 0}</span>
                                                        <span className="text-gray-400">|</span>
                                                        <span className="text-gray-500">MS: {variacao.estoque_mostruario_mega_store || 0}</span>
                                                        <span className="text-gray-400">|</span>
                                                        <span className="text-gray-500">CT: {variacao.estoque_mostruario_centro || 0}</span>
                                                        <span className="text-gray-400">|</span>
                                                        <span className="text-gray-500">PB: {variacao.estoque_mostruario_ponte_branca || 0}</span>
                                                        <Badge variant={estoqueTotal > 0 ? 'default' : 'destructive'} className="ml-2">
                                                            Total: {estoqueTotal}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                {/* Preço */}
                                                <div className="text-right shrink-0">
                                                    <p className="text-xl font-bold text-green-700">
                                                        {formatCurrency(variacao.preco_venda)}
                                                    </p>
                                                    {isSelected && (
                                                        <Check className="w-5 h-5 text-green-600 ml-auto mt-1" />
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer com ações */}
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        {variacoes.length} {variacoes.length === 1 ? 'variação disponível' : 'variações disponíveis'}
                    </div>
                    <div className="flex gap-2">
                        {selectedVariacao && onEditVariacao && (
                            <Button
                                variant="outline"
                                onClick={() => onEditVariacao(selectedVariacao)}
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                            </Button>
                        )}
                        {selectedVariacao && onSelectVariacao && (
                            <Button
                                onClick={() => onSelectVariacao(selectedVariacao)}
                                style={{ backgroundColor: '#07593f' }}
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Selecionar
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
