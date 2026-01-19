import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Plus,
    Trash2,
    Palette,
    Ruler,
    Shirt,
    Package,
    ChevronDown,
    Check,
    Copy,
    Edit2
} from 'lucide-react';
import {
    CORES_PADRAO,
    GRUPOS_CORES,
    TECIDOS,
    getTamanhosPorCategoria,
    categoriaTemTecido
} from '@/constants/productConstants';
import {
    generateSKU,
    generateVariationId,
    createEmptyVariation,
    normalizeColor
} from '@/utils/productFormatters';
import { cn } from '@/lib/utils';

export default function VariacoesManager({
    variacoes = [],
    onChange,
    categoria,
    produtoNome,
    disabled = false
}) {
    const [editingId, setEditingId] = useState(null);
    const [corCustom, setCorCustom] = useState('');
    const [showCorPicker, setShowCorPicker] = useState(null);

    const tamanhosPorCategoria = getTamanhosPorCategoria(categoria);
    const hasCategoriaTamanhos = tamanhosPorCategoria.length > 0;

    const adicionarVariacao = () => {
        const novaVariacao = createEmptyVariation();
        onChange([...variacoes, novaVariacao]);
        setEditingId(novaVariacao.id);
    };

    const removerVariacao = (id) => {
        onChange(variacoes.filter(v => v.id !== id));
    };

    const atualizarVariacao = (id, campo, valor) => {
        const novasVariacoes = variacoes.map(v => {
            if (v.id === id) {
                const updated = { ...v, [campo]: valor };
                // Regenera SKU se cor, tamanho ou tecido mudarem
                if (['cor', 'tamanho', 'tecido'].includes(campo)) {
                    updated.sku = generateSKU(
                        { nome: produtoNome, categoria },
                        updated
                    );
                }
                return updated;
            }
            return v;
        });
        onChange(novasVariacoes);
    };

    const duplicarVariacao = (variacao) => {
        const nova = {
            ...variacao,
            id: generateVariationId(),
            sku: generateSKU({ nome: produtoNome, categoria }, variacao)
        };
        onChange([...variacoes, nova]);
    };

    const aplicarCorEmTodos = (cor) => {
        const novasVariacoes = variacoes.map(v => ({
            ...v,
            cor: cor,
            sku: generateSKU({ nome: produtoNome, categoria }, { ...v, cor })
        }));
        onChange(novasVariacoes);
    };

    // Agrupa cores por grupo
    const coresAgrupadas = GRUPOS_CORES.map(grupo => ({
        ...grupo,
        cores: CORES_PADRAO.filter(c => c.grupo === grupo.id)
    }));

    // Busca flexível de cor por nome
    const findColorByName = (nome) => {
        if (!nome) return null;
        const n = nome.toLowerCase().trim();
        return CORES_PADRAO.find(c => c.nome.toLowerCase() === n)
            || CORES_PADRAO.find(c => c.nome.toLowerCase().includes(n))
            || CORES_PADRAO.find(c => n.includes(c.nome.toLowerCase()));
    };

    // Gera preview de cor (suporta combinações)
    const getColorPreview = (corNome) => {
        if (!corNome) return '#ccc';

        // Cor simples
        const corPadrao = CORES_PADRAO.find(c => c.nome === corNome);
        if (corPadrao) return corPadrao.hex;

        // Combinação
        const match = corNome.match(/(.+?)\s+com\s+(.+)/i);
        if (match) {
            const cor1 = findColorByName(match[1]);
            const cor2 = findColorByName(match[2]);
            if (cor1 && cor2) return `linear-gradient(135deg, ${cor1.hex} 50%, ${cor2.hex} 50%)`;
            if (cor1) return cor1.hex;
            if (cor2) return cor2.hex;
        }
        return '#ccc';
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold" style={{ color: '#07593f' }}>
                        Variações do Produto
                    </h3>
                    <p className="text-sm text-gray-500">
                        Adicione diferentes cores, tamanhos ou tecidos para este produto
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={adicionarVariacao}
                    disabled={disabled}
                    className="gap-2"
                    style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                >
                    <Plus className="w-4 h-4" />
                    Adicionar Variação
                </Button>
            </div>

            {/* Lista de Variações */}
            {variacoes.length === 0 ? (
                <Card className="border-2 border-dashed">
                    <CardContent className="py-12 text-center">
                        <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 mb-2">Nenhuma variação cadastrada</p>
                        <p className="text-sm text-gray-400">
                            Clique em "Adicionar Variação" para criar opções de cor, tamanho ou tecido
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {variacoes.map((variacao, index) => (
                        <Card
                            key={variacao.id}
                            className={cn(
                                "transition-all duration-200",
                                editingId === variacao.id ? "ring-2 ring-green-500 shadow-lg" : "hover:shadow-md"
                            )}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    {/* Número da variação */}
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                        style={{ backgroundColor: '#07593f' }}
                                    >
                                        {index + 1}
                                    </div>

                                    {/* Campos da variação */}
                                    <div className="flex-1 grid md:grid-cols-4 gap-4">
                                        {/* Cor */}
                                        <div>
                                            <Label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                <Palette className="w-3 h-3" /> Cor
                                            </Label>
                                            <Popover
                                                open={showCorPicker === variacao.id}
                                                onOpenChange={(open) => {
                                                    setShowCorPicker(open ? variacao.id : null);
                                                    if (!open) setCorCustom('');
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-between h-9 font-normal"
                                                        disabled={disabled}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {variacao.cor && (
                                                                <div
                                                                    className="w-4 h-4 rounded-full border flex-shrink-0"
                                                                    style={{ background: getColorPreview(variacao.cor) }}
                                                                />
                                                            )}
                                                            <span className={cn("truncate", variacao.cor ? "" : "text-gray-400")}>
                                                                {variacao.cor || "Selecionar"}
                                                            </span>
                                                        </div>
                                                        <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
                                                    {/* Busca e cor personalizada */}
                                                    <div className="p-3 border-b bg-gray-50">
                                                        <Input
                                                            placeholder="🔍 Buscar cor ou digitar personalizada..."
                                                            value={corCustom}
                                                            onChange={(e) => setCorCustom(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && corCustom.trim()) {
                                                                    atualizarVariacao(variacao.id, 'cor', normalizeColor(corCustom));
                                                                    setCorCustom('');
                                                                    setShowCorPicker(null);
                                                                }
                                                            }}
                                                            className="h-8"
                                                            autoFocus
                                                        />
                                                        {corCustom && !CORES_PADRAO.some(c => c.nome.toLowerCase().includes(corCustom.toLowerCase())) && (
                                                            <p className="text-[10px] text-green-600 mt-1">
                                                                ↵ Enter para salvar "{corCustom}" como cor personalizada
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Atalhos para criar combinações */}
                                                    {!corCustom && (
                                                        <div className="p-2 border-b bg-purple-50">
                                                            <p className="text-[10px] font-semibold text-purple-700 mb-1">
                                                                Combinação rápida:
                                                            </p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {['Off White com', 'Branco com', 'Cinza com', 'Preto com', 'Carvalho com'].map(prefix => (
                                                                    <button
                                                                        key={prefix}
                                                                        type="button"
                                                                        onClick={() => setCorCustom(prefix + ' ')}
                                                                        className="text-[10px] px-2 py-0.5 rounded bg-white border border-purple-200 hover:bg-purple-100 transition-colors"
                                                                    >
                                                                        {prefix}...
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Lista de cores por grupo */}
                                                    <div className="max-h-[300px] overflow-y-auto" style={{ overflowY: 'scroll' }}>
                                                        {coresAgrupadas
                                                            .map(grupo => ({
                                                                ...grupo,
                                                                cores: grupo.cores.filter(c =>
                                                                    !corCustom ||
                                                                    c.nome.toLowerCase().includes(corCustom.toLowerCase()) ||
                                                                    corCustom.toLowerCase().endsWith('com')
                                                                )
                                                            }))
                                                            .filter(grupo => grupo.cores.length > 0)
                                                            .map(grupo => (
                                                                <div key={grupo.id} className="p-2 border-b last:border-b-0">
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                                        {grupo.nome} ({grupo.cores.length})
                                                                    </p>
                                                                    <div className="grid grid-cols-4 gap-2">
                                                                        {grupo.cores.map(cor => (
                                                                            <button
                                                                                key={cor.nome}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    // Se já tem prefixo de combinação, completa
                                                                                    if (corCustom.trim().toLowerCase().endsWith('com')) {
                                                                                        const combinacao = `${corCustom.trim()} ${cor.nome}`;
                                                                                        atualizarVariacao(variacao.id, 'cor', combinacao);
                                                                                        setCorCustom('');
                                                                                        setShowCorPicker(null);
                                                                                    } else {
                                                                                        atualizarVariacao(variacao.id, 'cor', cor.nome);
                                                                                        setShowCorPicker(null);
                                                                                    }
                                                                                }}
                                                                                className={cn(
                                                                                    "flex flex-col items-center p-1.5 rounded-lg transition-all hover:bg-gray-100",
                                                                                    variacao.cor === cor.nome && "bg-green-50 ring-2 ring-green-500"
                                                                                )}
                                                                            >
                                                                                <div
                                                                                    className={cn(
                                                                                        "w-8 h-8 rounded-full border-2 shadow-sm",
                                                                                        variacao.cor === cor.nome ? "border-green-500" : "border-gray-200"
                                                                                    )}
                                                                                    style={{ backgroundColor: cor.hex }}
                                                                                >
                                                                                    {variacao.cor === cor.nome && (
                                                                                        <Check className={cn(
                                                                                            "w-5 h-5 mx-auto mt-1",
                                                                                            ['claros', 'beges'].includes(cor.grupo) ? "text-gray-700" : "text-white"
                                                                                        )} />
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-[9px] text-gray-600 mt-1 text-center leading-tight max-w-[70px] truncate" title={cor.nome}>
                                                                                    {cor.nome}
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                        {corCustom && !coresAgrupadas.some(g => g.cores.some(c => c.nome.toLowerCase().includes(corCustom.toLowerCase()))) && !corCustom.toLowerCase().endsWith('com') && (
                                                            <div className="p-4 text-center text-gray-500">
                                                                <p className="text-sm">Nenhuma cor encontrada</p>
                                                                <p className="text-[10px]">Pressione Enter para criar "{corCustom}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {/* Tamanho */}
                                        <div>
                                            <Label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                <Ruler className="w-3 h-3" /> Tamanho
                                            </Label>
                                            {hasCategoriaTamanhos ? (
                                                <Select
                                                    value={variacao.tamanho || ""}
                                                    onValueChange={(value) => atualizarVariacao(variacao.id, 'tamanho', value)}
                                                    disabled={disabled}
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue placeholder="Selecionar" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {tamanhosPorCategoria.map(tam => (
                                                            <SelectItem key={tam.valor} value={tam.valor}>
                                                                <div>
                                                                    <span>{tam.valor}</span>
                                                                    {tam.descricao && (
                                                                        <span className="text-xs text-gray-400 ml-2">
                                                                            ({tam.descricao})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input
                                                    value={variacao.tamanho || ''}
                                                    onChange={(e) => atualizarVariacao(variacao.id, 'tamanho', e.target.value)}
                                                    placeholder="Ex: Grande, 2m x 1m"
                                                    className="h-9"
                                                    disabled={disabled}
                                                />
                                            )}
                                        </div>

                                        {/* Tecido/Acabamento - apenas para categorias estofadas */}
                                        {categoriaTemTecido(categoria) && (
                                            <div>
                                                <Label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                    <Shirt className="w-3 h-3" /> Tecido/Acabamento
                                                </Label>
                                                <Select
                                                    value={variacao.tecido || "none"}
                                                    onValueChange={(value) => atualizarVariacao(variacao.id, 'tecido', value === "none" ? "" : value)}
                                                    disabled={disabled}
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue placeholder="Opcional" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Nenhum</SelectItem>
                                                        {TECIDOS.map(tecido => (
                                                            <SelectItem key={tecido.nome} value={tecido.nome}>
                                                                {tecido.nome}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {/* Estoque - sempre no final */}
                                        <div>
                                            <Label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                                <Package className="w-3 h-3" /> Estoque
                                            </Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={variacao.estoque || 0}
                                                onChange={(e) => atualizarVariacao(variacao.id, 'estoque', parseInt(e.target.value) || 0)}
                                                className="h-9"
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => duplicarVariacao(variacao)}
                                            disabled={disabled}
                                            title="Duplicar variação"
                                        >
                                            <Copy className="w-4 h-4 text-gray-400" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removerVariacao(variacao.id)}
                                            disabled={disabled}
                                            className="hover:text-red-500"
                                            title="Remover variação"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* SKU e Preço diferenciado (segunda linha) */}
                                <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">SKU:</span>
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {variacao.sku || 'Será gerado automaticamente'}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">Preço diferenciado:</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={variacao.preco_diferenciado || ''}
                                            onChange={(e) => atualizarVariacao(
                                                variacao.id,
                                                'preco_diferenciado',
                                                e.target.value ? parseFloat(e.target.value) : null
                                            )}
                                            placeholder="Usar preço base"
                                            className="h-7 w-32 text-sm"
                                            disabled={disabled}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Dica de uso */}
            {variacoes.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                    <p className="font-medium mb-1">💡 Dica:</p>
                    <p>
                        Cada variação terá seu próprio controle de estoque. O estoque total do produto
                        será a soma de todas as variações.
                    </p>
                </div>
            )}

            {/* Resumo */}
            {variacoes.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                            <strong>{variacoes.length}</strong> {variacoes.length === 1 ? 'variação' : 'variações'}
                        </span>
                        <span className="text-sm text-gray-600">
                            <strong>{variacoes.reduce((sum, v) => sum + (v.estoque || 0), 0)}</strong> unidades totais
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {variacoes.some(v => v.cor) && (
                            <Badge variant="outline" className="gap-1">
                                <Palette className="w-3 h-3" />
                                {new Set(variacoes.filter(v => v.cor).map(v => v.cor)).size} cores
                            </Badge>
                        )}
                        {variacoes.some(v => v.tamanho) && (
                            <Badge variant="outline" className="gap-1">
                                <Ruler className="w-3 h-3" />
                                {new Set(variacoes.filter(v => v.tamanho).map(v => v.tamanho)).size} tamanhos
                            </Badge>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
