import React, { useState, useEffect, useRef, useMemo } from "react";
import { normSearch } from "@/lib/utils";
import { base44, supabase } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
    ArrowLeft, ScanBarcode, Search, Save, CheckCircle2,
    Filter, Package, AlertTriangle, Loader2, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { obterCampoEstoqueDaLoja } from "@/constants/productConstants";

export default function InventarioContagem({ inventarioExistente, onVoltar, onSalvar, user }) {
    // --- State ---
    const [lojaId, setLojaId] = useState(inventarioExistente?.loja_id || "");
    const [responsavel, setResponsavel] = useState(inventarioExistente?.responsavel || user?.nome || "");
    const [observacoes, setObservacoes] = useState(inventarioExistente?.observacoes || "");
    const [dataInventario] = useState(
        inventarioExistente?.data_inventario || new Date().toISOString().split('T')[0]
    );

    // contagens: { [produto_id]: number | null }
    // null = não contado, number = contagem feita
    const [contagens, setContagens] = useState({});

    const [searchTerm, setSearchTerm] = useState("");
    const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
    const [filtroContagem, setFiltroContagem] = useState("todos"); // todos | nao_contados | divergentes
    const [isSaving, setIsSaving] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    const barcodeRef = useRef(null);
    const inputRefs = useRef({});

    // --- Queries ---
    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['produtos-inventario'],
        queryFn: () => base44.entities.Produto.list(),
    });

    const { data: lojasData = [], isLoading: loadingLojas } = useQuery({
        queryKey: ['lojas'],
        queryFn: () => base44.entities.Loja.list('nome'),
    });

    const lojasAtivas = useMemo(() => lojasData.filter(l => l.ativa), [lojasData]);

    const getLojaField = (id) => {
        const loja = lojasData.find(l => l.id === id);
        return obterCampoEstoqueDaLoja(loja || id);
    };

    const getLojaDisplayName = (id) => {
        const loja = lojasData.find(l => l.id === id);
        return loja ? loja.nome : id;
    };

    const getEstoquePorLoja = (produto, id) => {
        const field = getLojaField(id);
        return produto[field] || 0;
    };

    // --- Initialize from existing inventory ---
    useEffect(() => {
        if (inventarioExistente && !isInitialized && produtos.length > 0) {
            // Reconstruct loja from data
            if (inventarioExistente.loja_id) {
                setLojaId(inventarioExistente.loja_id);
            }
            // Reconstruct contagens from itens_contados
            if (inventarioExistente.itens_contados?.length > 0) {
                const restored = {};
                inventarioExistente.itens_contados.forEach(item => {
                    restored[item.produto_id] = item.quantidade_contada;
                });
                setContagens(restored);
            }
            setIsInitialized(true);
        }
    }, [inventarioExistente, produtos, isInitialized]);

    // --- Derived data ---
    const produtosDaLoja = useMemo(() => {
        if (!lojaId) return [];
        return produtos.filter(p => {
            const estoque = getEstoquePorLoja(p, lojaId);
            return estoque > 0 || contagens[p.id] !== undefined;
        });
    }, [produtos, lojaId, contagens]);

    const categoriasDaLoja = useMemo(() => {
        const cats = [...new Set(produtosDaLoja.map(p => p.categoria).filter(Boolean))].sort();
        return cats;
    }, [produtosDaLoja]);

    const produtosFiltrados = useMemo(() => {
        let result = produtosDaLoja;

        if (categoriaFiltro !== "todas") {
            result = result.filter(p => p.categoria === categoriaFiltro);
        }

        if (searchTerm.trim()) {
            const terms = normSearch(searchTerm).split(/\s+/).filter(Boolean);
            result = result.filter(p => {
                const searchString = [p.nome, p.codigo_barras, p.modelo_referencia].filter(Boolean).map(normSearch).join(' ');
                return terms.every(term => searchString.includes(term));
            });
        }

        if (filtroContagem === "nao_contados") {
            result = result.filter(p => contagens[p.id] === undefined || contagens[p.id] === null);
        } else if (filtroContagem === "divergentes") {
            result = result.filter(p => {
                if (contagens[p.id] === undefined || contagens[p.id] === null) return false;
                return contagens[p.id] !== getEstoquePorLoja(p, lojaId);
            });
        }

        return result;
    }, [produtosDaLoja, categoriaFiltro, searchTerm, filtroContagem, contagens, lojaId]);

    // Stats
    const totalProdutos = produtosDaLoja.length;
    const totalContados = produtosDaLoja.filter(p => contagens[p.id] !== undefined && contagens[p.id] !== null).length;
    const totalDivergentes = produtosDaLoja.filter(p => {
        if (contagens[p.id] === undefined || contagens[p.id] === null) return false;
        return contagens[p.id] !== getEstoquePorLoja(p, lojaId);
    }).length;
    const progresso = totalProdutos > 0 ? Math.round((totalContados / totalProdutos) * 100) : 0;

    // --- Handlers ---
    const handleContagemChange = (produtoId, value) => {
        const num = value === "" ? null : parseInt(value);
        setContagens(prev => ({
            ...prev,
            [produtoId]: num !== null && !isNaN(num) ? num : (value === "" ? null : prev[produtoId])
        }));
    };

    const handleBarcodeSubmit = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = e.target.value.trim();
            if (!code) return;

            const produto = produtos.find(p => p.codigo_barras === code);
            if (produto) {
                // Focus the counting input for this product
                const inputEl = inputRefs.current[produto.id];
                if (inputEl) {
                    inputEl.focus();
                    inputEl.select();
                    toast.success(`📦 ${produto.nome}`);
                } else {
                    // Product exists but not in current store filter
                    toast.warning(`Produto "${produto.nome}" encontrado mas sem estoque nesta loja.`);
                }
            } else {
                toast.error("Produto não encontrado com este código de barras.");
            }
            e.target.value = "";
        }
    };

    const buildItens = () => {
        return produtosDaLoja
            .filter(p => contagens[p.id] !== undefined && contagens[p.id] !== null)
            .map(p => {
                const qtdSistema = getEstoquePorLoja(p, lojaId);
                const qtdContada = contagens[p.id];
                return {
                    produto_id: p.id,
                    produto_nome: p.nome,
                    quantidade_sistema: qtdSistema,
                    quantidade_contada: qtdContada,
                    diferenca: qtdContada - qtdSistema,
                };
            });
    };

    const handleSalvar = async (finalizar = false) => {
        if (!lojaId || !responsavel) {
            toast.error("Preencha a loja e o responsável.");
            return;
        }

        const itens = buildItens();
        if (finalizar && itens.length === 0) {
            toast.error("Conte pelo menos um produto antes de finalizar.");
            return;
        }

        setIsSaving(true);
        try {
            const data = {
                numero_inventario: inventarioExistente?.numero_inventario || `INV-${Date.now()}`,
                loja: getLojaDisplayName(lojaId),
                loja_id: lojaId,
                data_inventario: dataInventario,
                responsavel,
                itens_contados: itens,
                total_itens: itens.length,
                total_divergencias: itens.filter(i => i.diferenca !== 0).length,
                status: finalizar ? "Concluído" : "Em Andamento",
                observacoes,
            };

            await onSalvar(data, inventarioExistente?.id);
            toast.success(finalizar ? "Inventário finalizado!" : "Inventário salvo. Pode continuar depois.");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar: " + err.message);
        } finally {
            setIsSaving(false);
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
                    <h2 className="text-xl font-bold" style={{ color: '#07593f' }}>
                        Novo Inventário — Selecionar Local
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
                    {loadingLojas ? (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                            Carregando lojas ativas...
                        </div>
                    ) : lojasAtivas.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-gray-500 bg-white border rounded-lg">
                            <p>Nenhuma loja ativa cadastrada.</p>
                            <p className="text-sm mt-1">Acesse as Configurações para adicionar lojas antes de iniciar um inventário.</p>
                        </div>
                    ) : lojasAtivas.map(loja => {
                        const field = obterCampoEstoqueDaLoja(loja);
                        const qtdProdutos = produtos.filter(p => (p[field] || 0) > 0).length;
                        return (
                            <Card
                                key={loja.id}
                                className="border-2 cursor-pointer transition-all hover:shadow-lg hover:border-green-400 active:scale-[0.98]"
                                style={{ borderColor: '#E5E0D8' }}
                                onClick={() => setLojaId(loja.id)}
                            >
                                <CardContent className="p-6 text-center">
                                    <div
                                        className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                                        style={{ backgroundColor: '#DBEAFE' }}
                                    >
                                        <Package className="w-7 h-7" style={{ color: '#1E40AF' }} />
                                    </div>
                                    <h3 className="font-bold text-lg mb-1" style={{ color: '#07593f' }}>{loja.nome}</h3>
                                    <p className="text-sm" style={{ color: '#8B8B8B' }}>
                                        {loadingProdutos ? '...' : `${qtdProdutos} produtos com estoque`}
                                    </p>
                                    <Badge className="mt-2" variant="secondary">
                                        Unidade
                                    </Badge>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- Phase 2: Counting screen ---
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onVoltar}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: '#07593f' }}>
                            Inventário — {getLojaDisplayName(lojaId)}
                        </h2>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            {dataInventario} • {responsavel || 'Sem responsável'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleSalvar(false)}
                        disabled={isSaving}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Parcial
                    </Button>
                    <Button
                        onClick={() => handleSalvar(true)}
                        disabled={isSaving}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Finalizar Inventário
                    </Button>
                </div>
            </div>

            {/* Responsável + Obs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <Label>Responsável pela Contagem *</Label>
                    <Input
                        value={responsavel}
                        onChange={(e) => setResponsavel(e.target.value)}
                        placeholder="Nome do responsável"
                    />
                </div>
                <div>
                    <Label>Observações</Label>
                    <Input
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        placeholder="Notas opcionais..."
                    />
                </div>
            </div>

            {/* Progress bar */}
            <Card className="border-0 shadow-sm" style={{ backgroundColor: '#f0f9ff' }}>
                <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium" style={{ color: '#07593f' }}>
                            Progresso da Contagem
                        </span>
                        <span className="text-sm font-bold" style={{ color: '#07593f' }}>
                            {totalContados} / {totalProdutos} produtos ({progresso}%)
                        </span>
                    </div>
                    <Progress value={progresso} className="h-3" />
                    <div className="flex gap-4 mt-2 text-xs" style={{ color: '#8B8B8B' }}>
                        <span>✅ {totalContados} contados</span>
                        <span>⚠️ {totalDivergentes} divergências</span>
                        <span>📦 {totalProdutos - totalContados} pendentes</span>
                    </div>
                </CardContent>
            </Card>

            {/* Barcode + Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Barcode */}
                <div className="relative flex-1 sm:max-w-xs">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8B8B8B' }} />
                    <Input
                        ref={barcodeRef}
                        className="pl-10"
                        placeholder="Bipar código de barras..."
                        onKeyDown={handleBarcodeSubmit}
                    />
                </div>

                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#8B8B8B' }} />
                    <Input
                        className="pl-10"
                        placeholder="Buscar por nome, código ou referência..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Category filter */}
                <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                    <SelectTrigger className="w-full sm:w-48">
                        <Filter className="w-4 h-4 mr-2" style={{ color: '#8B8B8B' }} />
                        <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todas">Todas Categorias</SelectItem>
                        {categoriasDaLoja.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Count status filter */}
                <Select value={filtroContagem} onValueChange={setFiltroContagem}>
                    <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="nao_contados">Não Contados</SelectItem>
                        <SelectItem value="divergentes">Divergentes</SelectItem>
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
                            ? "Nenhum produto com estoque nesta loja."
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
                        <div className="col-span-5 sm:col-span-4">Produto</div>
                        <div className="col-span-2 hidden sm:block">Categoria</div>
                        <div className="col-span-2 text-center">Sistema</div>
                        <div className="col-span-3 text-center">Contagem</div>
                        <div className="col-span-2 sm:col-span-1 text-center">Dif.</div>
                    </div>

                    {/* Table body */}
                    <div className="divide-y" style={{ borderColor: '#F0EDE8' }}>
                        {produtosFiltrados.map(produto => {
                            const qtdSistema = getEstoquePorLoja(produto, lojaId);
                            const contagem = contagens[produto.id];
                            const isContado = contagem !== undefined && contagem !== null;
                            const diferenca = isContado ? contagem - qtdSistema : null;
                            const hasDivergencia = diferenca !== null && diferenca !== 0;

                            return (
                                <div
                                    key={produto.id}
                                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors"
                                    style={{
                                        backgroundColor: hasDivergencia ? '#FEF3C7' : isContado ? '#F0FDF4' : '#FFFFFF',
                                    }}
                                >
                                    {/* Product info */}
                                    <div className="col-span-5 sm:col-span-4">
                                        <p className="font-medium text-sm leading-tight" style={{ color: '#1a1a1a' }}>
                                            {produto.nome}
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: '#8B8B8B' }}>
                                            {produto.modelo_referencia && <span>{produto.modelo_referencia} • </span>}
                                            {produto.codigo_barras && <span>COD: {produto.codigo_barras}</span>}
                                        </p>
                                    </div>

                                    {/* Category */}
                                    <div className="col-span-2 hidden sm:block">
                                        <Badge variant="secondary" className="text-xs font-normal">
                                            {produto.categoria || '-'}
                                        </Badge>
                                    </div>

                                    {/* System stock */}
                                    <div className="col-span-2 text-center">
                                        <span className="font-semibold text-sm" style={{ color: '#07593f' }}>
                                            {qtdSistema}
                                        </span>
                                    </div>

                                    {/* Count input */}
                                    <div className="col-span-3 flex justify-center">
                                        <Input
                                            ref={el => { if (el) inputRefs.current[produto.id] = el; }}
                                            type="number"
                                            min="0"
                                            className="w-20 text-center font-bold text-lg h-10"
                                            style={{
                                                borderColor: isContado ? (hasDivergencia ? '#F59E0B' : '#10B981') : '#E5E0D8',
                                                backgroundColor: isContado ? '#FFFFFF' : '#F9FAFB',
                                            }}
                                            value={contagem ?? ""}
                                            onChange={(e) => handleContagemChange(produto.id, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="—"
                                        />
                                    </div>

                                    {/* Difference */}
                                    <div className="col-span-2 sm:col-span-1 text-center">
                                        {isContado ? (
                                            <span
                                                className="font-bold text-sm"
                                                style={{
                                                    color: diferenca === 0 ? '#10B981' : diferenca > 0 ? '#F59E0B' : '#EF4444'
                                                }}
                                            >
                                                {diferenca === 0 ? '✓' : (diferenca > 0 ? `+${diferenca}` : diferenca)}
                                            </span>
                                        ) : (
                                            <span className="text-xs" style={{ color: '#C0C0C0' }}>—</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sticky footer */}
            <div
                className="sticky bottom-0 p-4 rounded-xl shadow-lg border flex flex-col sm:flex-row items-center justify-between gap-3"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D8' }}
            >
                <div className="flex gap-6 text-sm">
                    <span>
                        <strong style={{ color: '#07593f' }}>{totalContados}</strong>
                        <span style={{ color: '#8B8B8B' }}> / {totalProdutos} contados</span>
                    </span>
                    {totalDivergentes > 0 && (
                        <span className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <strong className="text-orange-600">{totalDivergentes}</strong>
                            <span style={{ color: '#8B8B8B' }}> divergências</span>
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleSalvar(false)}
                        disabled={isSaving}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Parcial
                    </Button>
                    <Button
                        onClick={() => {
                            if (confirm(`Finalizar inventário?\n\n${totalContados} produtos contados, ${totalDivergentes} divergências.\n\nA contagem será enviada para aprovação.`)) {
                                handleSalvar(true);
                            }
                        }}
                        disabled={isSaving || totalContados === 0}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Finalizar Inventário
                    </Button>
                </div>
            </div>
        </div>
    );
}
