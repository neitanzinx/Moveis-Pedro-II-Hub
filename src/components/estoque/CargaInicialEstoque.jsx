import React, { useState, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
    ArrowLeft, ScanBarcode, Search, Save, CheckCircle2,
    Filter, Package, Loader2, Warehouse
} from "lucide-react";
import { toast } from "sonner";
import { LOJAS_MOSTRUARIO, CAMPOS_ESTOQUE_LOJA } from "@/constants/productConstants";

function getLojaDisplayName(lojaId) {
    const loja = LOJAS_MOSTRUARIO.find(l => l.id === lojaId);
    return loja ? loja.nome : lojaId;
}

export default function CargaInicialEstoque({ onVoltar }) {
    const queryClient = useQueryClient();

    // --- State ---
    const [lojaId, setLojaId] = useState("");
    const [quantidades, setQuantidades] = useState({}); // { [produto_id]: number }
    const [searchTerm, setSearchTerm] = useState("");
    const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
    const [filtroPreenchimento, setFiltroPreenchimento] = useState("todos");
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
    const [visibleCount, setVisibleCount] = useState(50);

    const inputRefs = useRef({});

    // --- Queries ---
    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['produtos-carga-inicial'],
        queryFn: () => base44.entities.Produto.list(),
    });

    // --- Derived data ---
    const campoEstoque = CAMPOS_ESTOQUE_LOJA[lojaId] || "estoque_cd";

    const categorias = useMemo(() => {
        const cats = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();
        return cats;
    }, [produtos]);

    const produtosFiltrados = useMemo(() => {
        let result = [...produtos];

        if (categoriaFiltro !== "todas") {
            result = result.filter(p => p.categoria === categoriaFiltro);
        }

        if (searchTerm.trim()) {
            const terms = searchTerm.toLowerCase().split(' ').filter(t => t.trim() !== '');
            result = result.filter(p => {
                const searchString = `${p.nome || ''} ${p.codigo_barras || ''} ${p.modelo_referencia || ''}`.toLowerCase();
                return terms.every(term => searchString.includes(term));
            });
        }

        if (filtroPreenchimento === "preenchidos") {
            result = result.filter(p => quantidades[p.id] !== undefined && quantidades[p.id] !== null && quantidades[p.id] !== "");
        } else if (filtroPreenchimento === "vazios") {
            result = result.filter(p => quantidades[p.id] === undefined || quantidades[p.id] === null || quantidades[p.id] === "");
        }

        // Sort: by category, then name
        result.sort((a, b) => {
            const catA = a.categoria || "ZZZ";
            const catB = b.categoria || "ZZZ";
            if (catA !== catB) return catA.localeCompare(catB);
            return (a.nome || "").localeCompare(b.nome || "");
        });

        return result;
    }, [produtos, categoriaFiltro, searchTerm, filtroPreenchimento, quantidades]);

    // Reset pagination when filters change
    React.useEffect(() => {
        setVisibleCount(50);
    }, [categoriaFiltro, searchTerm, filtroPreenchimento]);

    const produtosVisiveis = produtosFiltrados.slice(0, visibleCount);

    // Stats
    const totalPreenchidos = produtos.filter(p =>
        quantidades[p.id] !== undefined && quantidades[p.id] !== null && quantidades[p.id] !== ""
    ).length;
    const totalProdutos = produtos.length;
    const progresso = totalProdutos > 0 ? Math.round((totalPreenchidos / totalProdutos) * 100) : 0;

    // --- Handlers ---
    const handleQtdChange = (produtoId, value) => {
        if (value === "") {
            setQuantidades(prev => ({ ...prev, [produtoId]: "" }));
        } else {
            const num = parseInt(value);
            if (!isNaN(num) && num >= 0) {
                setQuantidades(prev => ({ ...prev, [produtoId]: num }));
            }
        }
    };

    const handleBarcodeSubmit = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = e.target.value.trim();
            if (!code) return;

            const produto = produtos.find(p => p.codigo_barras === code);
            if (produto) {
                const inputEl = inputRefs.current[produto.id];
                if (inputEl) {
                    inputEl.focus();
                    inputEl.select();
                    toast.success(`📦 ${produto.nome}`);
                } else {
                    toast.info(`Produto "${produto.nome}" encontrado. Ajuste os filtros para vê-lo.`);
                }
            } else {
                toast.error("Produto não encontrado com este código de barras.");
            }
            e.target.value = "";
        }
    };

    const handleSalvar = async () => {
        const produtosParaSalvar = Object.entries(quantidades)
            .filter(([_, qtd]) => qtd !== undefined && qtd !== null && qtd !== "")
            .map(([id, qtd]) => ({ id: parseInt(id), qtd: parseInt(qtd) }));

        if (produtosParaSalvar.length === 0) {
            toast.error("Nenhuma quantidade preenchida para salvar.");
            return;
        }

        const confirmMsg = `Salvar estoque de ${produtosParaSalvar.length} produto(s) em "${getLojaDisplayName(lojaId)}"?\n\nIsso vai SUBSTITUIR o estoque atual desses produtos nesta unidade.`;
        if (!confirm(confirmMsg)) return;

        setIsSaving(true);
        setSaveProgress({ current: 0, total: produtosParaSalvar.length });

        let saved = 0;
        let errors = 0;

        // Save in batches of 5 to avoid overwhelming the API
        const batchSize = 5;
        for (let i = 0; i < produtosParaSalvar.length; i += batchSize) {
            const batch = produtosParaSalvar.slice(i, i + batchSize);
            const promises = batch.map(async ({ id, qtd }) => {
                try {
                    await base44.entities.Produto.update(id, { [campoEstoque]: qtd });
                    saved++;
                } catch (err) {
                    console.error(`Erro ao salvar produto ${id}:`, err);
                    errors++;
                }
            });
            await Promise.all(promises);
            setSaveProgress({ current: Math.min(i + batchSize, produtosParaSalvar.length), total: produtosParaSalvar.length });
        }

        setIsSaving(false);

        if (errors > 0) {
            toast.warning(`Salvo ${saved} produto(s), ${errors} erro(s). Verifique o console.`);
        } else {
            toast.success(`✅ Estoque atualizado para ${saved} produto(s) em "${getLojaDisplayName(lojaId)}"!`);
        }

        // Invalidate queries so the rest of the app sees the new stock
        queryClient.invalidateQueries(['produtos']);
        queryClient.invalidateQueries(['produtos-carga-inicial']);
        queryClient.invalidateQueries(['produtos-inventario']);
    };

    // Pre-fill with existing stock values when selecting a store
    const handleSelectLoja = (id) => {
        setLojaId(id);
        const campo = CAMPOS_ESTOQUE_LOJA[id];
        if (campo && produtos.length > 0) {
            const existing = {};
            produtos.forEach(p => {
                const val = p[campo];
                if (val !== undefined && val !== null && val > 0) {
                    existing[p.id] = val;
                }
            });
            setQuantidades(existing);
        } else {
            setQuantidades({});
        }
    };

    // --- Phase 1: Store selection ---
    if (!lojaId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onVoltar}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: '#07593f' }}>
                            Carga Inicial de Estoque
                        </h2>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            Selecione a unidade para cadastrar as quantidades em estoque
                        </p>
                    </div>
                </div>

                <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                    <p className="text-sm" style={{ color: '#92400E' }}>
                        <strong>⚠️ Use esta tela apenas para a carga inicial.</strong> Ela grava as quantidades diretamente no cadastro dos produtos.
                        Depois que o estoque estiver alimentado, use o <strong>Inventário</strong> para auditorias periódicas.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
                    {LOJAS_MOSTRUARIO.map(loja => {
                        const field = CAMPOS_ESTOQUE_LOJA[loja.id];
                        const qtdComEstoque = produtos.filter(p => (p[field] || 0) > 0).length;
                        return (
                            <Card
                                key={loja.id}
                                className="border-2 cursor-pointer transition-all hover:shadow-lg hover:border-green-400 active:scale-[0.98]"
                                style={{ borderColor: '#E5E0D8' }}
                                onClick={() => handleSelectLoja(loja.id)}
                            >
                                <CardContent className="p-6 text-center">
                                    <div
                                        className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                                        style={{ backgroundColor: loja.tipo === 'estoque' ? '#D1FAE5' : '#DBEAFE' }}
                                    >
                                        <Warehouse className="w-7 h-7" style={{ color: loja.tipo === 'estoque' ? '#065F46' : '#1E40AF' }} />
                                    </div>
                                    <h3 className="font-bold text-lg mb-1" style={{ color: '#07593f' }}>{loja.nome}</h3>
                                    <p className="text-sm" style={{ color: '#8B8B8B' }}>
                                        {loadingProdutos ? '...' : qtdComEstoque > 0
                                            ? `${qtdComEstoque} produtos já com estoque`
                                            : 'Nenhum estoque cadastrado'}
                                    </p>
                                    <Badge className="mt-2" variant={qtdComEstoque > 0 ? "default" : "secondary"}>
                                        {qtdComEstoque > 0 ? 'Já tem dados' : 'Vazio'}
                                    </Badge>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- Phase 2: Quantity entry screen ---
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => { setLojaId(""); setQuantidades({}); }}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: '#07593f' }}>
                            Carga Inicial — {getLojaDisplayName(lojaId)}
                        </h2>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            Campo: <code className="bg-gray-100 px-1 rounded text-xs">{campoEstoque}</code>
                        </p>
                    </div>
                </div>
                <Button
                    onClick={handleSalvar}
                    disabled={isSaving || totalPreenchidos === 0}
                    style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    className="min-w-[180px]"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Salvando {saveProgress.current}/{saveProgress.total}...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar Estoque ({totalPreenchidos} itens)
                        </>
                    )}
                </Button>
            </div>

            {/* Warning */}
            <div className="p-3 rounded-lg border" style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}>
                <p className="text-xs" style={{ color: '#92400E' }}>
                    💡 <strong>Dica:</strong> Preencha apenas o que tem na loja. Produtos deixados em branco ficarão com estoque 0.
                    Você pode voltar e editar depois. Use o leitor de código de barras para agilizar.
                </p>
            </div>

            {/* Progress bar */}
            <Card className="border-0 shadow-sm" style={{ backgroundColor: '#f0f9ff' }}>
                <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium" style={{ color: '#07593f' }}>
                            Progresso do Preenchimento
                        </span>
                        <span className="text-sm font-bold" style={{ color: '#07593f' }}>
                            {totalPreenchidos} / {totalProdutos} produtos ({progresso}%)
                        </span>
                    </div>
                    <Progress value={progresso} className="h-3" />
                </CardContent>
            </Card>

            {/* Barcode + Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 sm:max-w-xs">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8B8B8B' }} />
                    <Input
                        className="pl-10"
                        placeholder="Bipar código de barras..."
                        onKeyDown={handleBarcodeSubmit}
                    />
                </div>

                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8B8B8B' }} />
                    <Input
                        className="pl-10"
                        placeholder="Buscar por nome, código ou referência..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                    <SelectTrigger className="w-full sm:w-48">
                        <Filter className="w-4 h-4 mr-2" style={{ color: '#8B8B8B' }} />
                        <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todas">Todas Categorias</SelectItem>
                        {categorias.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filtroPreenchimento} onValueChange={setFiltroPreenchimento}>
                    <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="preenchidos">Preenchidos</SelectItem>
                        <SelectItem value="vazios">Não Preenchidos</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Products Table */}
            {loadingProdutos ? (
                <div className="text-center py-16">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: '#07593f' }} />
                    <p style={{ color: '#8B8B8B' }}>Carregando produtos...</p>
                </div>
            ) : produtosFiltrados.length === 0 ? (
                <div className="text-center py-16">
                    <Package className="w-12 h-12 mx-auto mb-3" style={{ color: '#C0C0C0' }} />
                    <p style={{ color: '#8B8B8B' }}>
                        {totalProdutos === 0
                            ? "Nenhum produto cadastrado no sistema."
                            : "Nenhum produto corresponde aos filtros."
                        }
                    </p>
                </div>
            ) : (
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#E5E0D8' }}>
                    {/* Table header */}
                    <div
                        className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: '#FAF8F5', color: '#8B8B8B' }}
                    >
                        <div className="col-span-5 sm:col-span-5">Produto</div>
                        <div className="col-span-3 hidden sm:block">Categoria</div>
                        <div className="col-span-4 sm:col-span-2 text-center">Estoque Atual</div>
                        <div className="col-span-3 sm:col-span-2 text-center">Nova Qtd.</div>
                    </div>

                    {/* Table body */}
                    <div className="divide-y" style={{ borderColor: '#F0EDE8' }}>
                        {produtosVisiveis.map(produto => {
                            const estoqueAtual = produto[campoEstoque] || 0;
                            const novaQtd = quantidades[produto.id];
                            const isPreenchido = novaQtd !== undefined && novaQtd !== null && novaQtd !== "";

                            return (
                                <div
                                    key={produto.id}
                                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors"
                                    style={{
                                        backgroundColor: isPreenchido ? '#F0FDF4' : '#FFFFFF',
                                    }}
                                >
                                    {/* Product info */}
                                    <div className="col-span-5 sm:col-span-5">
                                        <p className="font-medium text-sm leading-tight" style={{ color: '#1a1a1a' }}>
                                            {produto.nome}
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: '#8B8B8B' }}>
                                            {produto.modelo_referencia && <span>{produto.modelo_referencia} • </span>}
                                            {produto.codigo_barras && <span>COD: {produto.codigo_barras}</span>}
                                        </p>
                                    </div>

                                    {/* Category */}
                                    <div className="col-span-3 hidden sm:block">
                                        <Badge variant="secondary" className="text-xs font-normal">
                                            {produto.categoria || '-'}
                                        </Badge>
                                    </div>

                                    {/* Current stock */}
                                    <div className="col-span-4 sm:col-span-2 text-center">
                                        <span className="text-sm font-mono" style={{ color: estoqueAtual > 0 ? '#07593f' : '#C0C0C0' }}>
                                            {estoqueAtual}
                                        </span>
                                    </div>

                                    {/* New quantity input */}
                                    <div className="col-span-3 sm:col-span-2 flex justify-center">
                                        <Input
                                            ref={el => { if (el) inputRefs.current[produto.id] = el; }}
                                            type="number"
                                            min="0"
                                            className="w-20 text-center font-bold text-lg h-10"
                                            style={{
                                                borderColor: isPreenchido ? '#10B981' : '#E5E0D8',
                                                backgroundColor: isPreenchido ? '#FFFFFF' : '#F9FAFB',
                                            }}
                                            value={novaQtd ?? ""}
                                            onChange={(e) => handleQtdChange(produto.id, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="—"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Load More Button */}
            {produtosFiltrados.length > visibleCount && (
                <div className="flex justify-center py-4">
                    <Button
                        variant="outline"
                        onClick={() => setVisibleCount(prev => prev + 50)}
                        className="w-full sm:w-auto"
                    >
                        Carregar mais produtos ({produtosFiltrados.length - visibleCount} restantes)
                    </Button>
                </div>
            )}

            {/* Sticky footer */}
            <div
                className="sticky bottom-0 p-4 rounded-xl shadow-lg border flex flex-col sm:flex-row items-center justify-between gap-3"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D8' }}
            >
                <div className="flex gap-6 text-sm">
                    <span>
                        <strong style={{ color: '#07593f' }}>{totalPreenchidos}</strong>
                        <span style={{ color: '#8B8B8B' }}> / {totalProdutos} preenchidos</span>
                    </span>
                    <span style={{ color: '#8B8B8B' }}>
                        Loja: <strong>{getLojaDisplayName(lojaId)}</strong>
                    </span>
                </div>
                <Button
                    onClick={handleSalvar}
                    disabled={isSaving || totalPreenchidos === 0}
                    style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    className="min-w-[180px]"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Salvar Estoque ({totalPreenchidos})
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
