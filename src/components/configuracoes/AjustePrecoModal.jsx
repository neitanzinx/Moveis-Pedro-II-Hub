import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    TrendingUp,
    TrendingDown,
    Loader2,
    CheckCircle,
    ShieldAlert,
    RotateCcw,
    Percent,
    DollarSign,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
    BULK_PRICE_CONSTANTS,
    applyExceptionMode,
    buildSimulation,
    filterProductsByCriteria,
} from "@/utils/bulkPriceAdjustment";

const UNDO_KEY = "bulk_price_last_batch_v1";
const UNDO_WINDOW_MS = 15 * 60 * 1000;

const defaultCriteria = {
    fabricantes: "",
    categorias: "",
    searchTerm: "",
    precoMin: "",
    precoMax: "",
    status: BULK_PRICE_CONSTANTS.STATUS_OPTIONS.TODOS,
    estoqueMin: "",
    estoqueMax: "",
    createdFrom: "",
    createdTo: "",
    updatedFrom: "",
    updatedTo: "",
};

const PREVIEW_PAGE_SIZE = 100;

export default function AjustePrecoModal({ isOpen, onClose, produtos = [] }) {
    const [targetField, setTargetField] = useState("preco_venda");
    const [tipoAjuste, setTipoAjuste] = useState("porcentagem");
    const [operacao, setOperacao] = useState("aumentar");
    const [percentual, setPercentual] = useState("");
    const [valorFixo, setValorFixo] = useState("");
    const [criteria, setCriteria] = useState(defaultCriteria);
    const [exceptionMode, setExceptionMode] = useState(BULK_PRICE_CONSTANTS.EXCEPTION_MODES.INCLUDE_FILTER_EXCLUDE_ITEMS);
    const [exceptionSearch, setExceptionSearch] = useState("");
    const [exceptionIds, setExceptionIds] = useState([]);
    const [simulation, setSimulation] = useState(null);
    const [lastBatch, setLastBatch] = useState(null);
    const [aplicando, setAplicando] = useState(false);
    const [previewPage, setPreviewPage] = useState(1);
    const [selectedExecutionIds, setSelectedExecutionIds] = useState([]);
    const [editCadastroOpen, setEditCadastroOpen] = useState(false);
    const [editCadastroItem, setEditCadastroItem] = useState(null);
    const [editPrecoCusto, setEditPrecoCusto] = useState("");
    const [editPrecoVenda, setEditPrecoVenda] = useState("");
    const [salvandoEdicaoCadastro, setSalvandoEdicaoCadastro] = useState(false);

    const { user, can } = useAuth();
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const adjustmentValue = tipoAjuste === "porcentagem" ? percentual : valorFixo;

    const uniqueManufacturers = useMemo(() => {
        return [...new Set(
            produtos
                .map((produto) => produto.fornecedor_nome || produto.marca)
                .filter(Boolean)
                .map((value) => String(value).trim())
        )].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    }, [produtos]);

    const uniqueCategories = useMemo(() => {
        return [...new Set(
            produtos
                .map((produto) => produto.categoria)
                .filter(Boolean)
                .map((value) => String(value).trim())
        )].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    }, [produtos]);

    const filteredProducts = useMemo(() => {
        return filterProductsByCriteria(produtos, criteria, targetField);
    }, [produtos, criteria, targetField]);

    const eligibleProducts = useMemo(() => {
        return applyExceptionMode({
            produtos,
            filteredProducts,
            exceptionMode,
            exceptionIds,
        });
    }, [produtos, filteredProducts, exceptionMode, exceptionIds]);

    const exceptionSuggestions = useMemo(() => {
        const normalized = String(exceptionSearch || "").trim().toLowerCase();
        if (!normalized) return [];

        return produtos
            .filter((produto) => {
                const blob = [
                    produto.nome,
                    produto.id,
                    produto.codigo_barras,
                    produto.modelo_referencia,
                ].join(" ").toLowerCase();
                return blob.includes(normalized);
            })
            .slice(0, 8);
    }, [produtos, exceptionSearch]);

    const exceptionProducts = useMemo(() => {
        const selected = new Set(exceptionIds);
        return produtos.filter((produto) => selected.has(produto.id));
    }, [exceptionIds, produtos]);

    const executionRows = simulation?.executableRows || [];
    const blockedRows = simulation?.blockedRows || [];
    const selectedExecutableRows = useMemo(() => {
        if (!simulation) return [];
        const selectedSet = new Set(selectedExecutionIds);
        return executionRows.filter((row) => selectedSet.has(row.id));
    }, [simulation, executionRows, selectedExecutionIds]);

    const formatMoney = (value) => {
        if (!value && value !== 0) return "R$ 0,00";
        return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    };

    const toggleException = (produtoId) => {
        setExceptionIds((prev) =>
            prev.includes(produtoId)
                ? prev.filter((id) => id !== produtoId)
                : [...prev, produtoId]
        );
    };

    const removeException = (produtoId) => {
        setExceptionIds((prev) => prev.filter((id) => id !== produtoId));
    };

    useEffect(() => {
        setSimulation(null);
        setSelectedExecutionIds([]);
    }, [criteria, exceptionMode, exceptionIds, tipoAjuste, operacao, percentual, valorFixo, targetField]);

    useEffect(() => {
        setPreviewPage(1);
    }, [simulation, criteria, exceptionMode, exceptionIds, tipoAjuste, operacao, percentual, valorFixo, targetField]);

    useEffect(() => {
        if (!isOpen) return;

        const raw = localStorage.getItem(UNDO_KEY);
        if (!raw) {
            setLastBatch(null);
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            const elapsed = Date.now() - new Date(parsed.timestamp).getTime();
            if (elapsed > UNDO_WINDOW_MS) {
                localStorage.removeItem(UNDO_KEY);
                setLastBatch(null);
                return;
            }
            setLastBatch(parsed);
        } catch (_error) {
            localStorage.removeItem(UNDO_KEY);
            setLastBatch(null);
        }
    }, [isOpen]);

    const minutosRestantesDesfazer = useMemo(() => {
        if (!lastBatch?.timestamp) return 0;
        const elapsed = Date.now() - new Date(lastBatch.timestamp).getTime();
        return Math.max(0, Math.ceil((UNDO_WINDOW_MS - elapsed) / 60000));
    }, [lastBatch]);

    const gerarSimulacao = () => {
        const numericValue = parseFloat(adjustmentValue);
        if (!numericValue || numericValue <= 0) {
            toast.error("Informe um valor de reajuste válido");
            return;
        }

        if (tipoAjuste === "porcentagem" && numericValue > BULK_PRICE_CONSTANTS.MAX_ADJUSTMENT_PERCENT) {
            toast.error(`Limite máximo por operação: ${BULK_PRICE_CONSTANTS.MAX_ADJUSTMENT_PERCENT}%`);
            return;
        }

        if (tipoAjuste === "multiplicador" && numericValue === 1) {
            toast.error("Informe um multiplicador diferente de 1");
            return;
        }

        const result = buildSimulation({
            produtos: eligibleProducts,
            targetField,
            adjustmentType: tipoAjuste,
            operation: operacao,
            adjustmentValue,
        });

        setSimulation(result);
        setSelectedExecutionIds(result.executableRows.map((row) => row.id));
        toast.success(`Simulação gerada: ${result.summary.totalExecutaveis} item(ns) executáveis`);
    };

    const selecionarTodosElegiveis = () => {
        if (!simulation) return;
        setSelectedExecutionIds(executionRows.map((row) => row.id));
    };

    const limparSelecaoElegiveis = () => {
        setSelectedExecutionIds([]);
    };

    const toggleExecucaoSelecionada = (produtoId) => {
        setSelectedExecutionIds((prev) =>
            prev.includes(produtoId)
                ? prev.filter((id) => id !== produtoId)
                : [...prev, produtoId]
        );
    };

    const abrirEditarCadastro = (produto) => {
        setEditCadastroItem(produto);
        setEditPrecoCusto(String(produto?.preco_custo_tabela ?? produto?.preco_custo ?? 0));
        setEditPrecoVenda(String(produto?.preco_venda ?? 0));
        setEditCadastroOpen(true);
    };

    const salvarEdicaoCadastro = async () => {
        if (!editCadastroItem?.id) return;

        const custo = Number(editPrecoCusto);
        const venda = Number(editPrecoVenda);

        if (!(custo >= 0) || !(venda >= 0)) {
            toast.error("Informe valores válidos de custo e venda");
            return;
        }

        setSalvandoEdicaoCadastro(true);
        try {
            await base44.entities.Produto.update(editCadastroItem.id, {
                preco_custo_tabela: custo,
                preco_custo: custo,
                preco_venda: venda,
            });

            queryClient.invalidateQueries({ queryKey: ["produtos"] });
            setSimulation(null);
            setSelectedExecutionIds([]);
            setEditCadastroOpen(false);
            toast.success("Cadastro do item atualizado. Gere nova simulação.");
        } catch (error) {
            toast.error("Erro ao atualizar cadastro: " + error.message);
        } finally {
            setSalvandoEdicaoCadastro(false);
        }
    };

    const salvarSnapshotDesfazer = (snapshot) => {
        const payload = {
            targetField,
            rows: snapshot,
            timestamp: new Date().toISOString(),
            userName: user?.nome || user?.full_name || user?.email || "Sistema",
        };
        localStorage.setItem(UNDO_KEY, JSON.stringify(payload));
        setLastBatch(payload);
    };

    const desfazerUltimoLote = async () => {
        if (!lastBatch?.rows?.length) {
            toast.error("Nenhum lote disponível para desfazer");
            return;
        }

        if (minutosRestantesDesfazer <= 0) {
            toast.error("Janela de desfazer expirada");
            localStorage.removeItem(UNDO_KEY);
            setLastBatch(null);
            return;
        }

        const confirmed = await confirm({
            title: "Desfazer último lote",
            message: `Isso irá restaurar ${lastBatch.rows.length} item(ns) para o valor anterior em ${lastBatch.targetField}.`,
            confirmText: "Desfazer",
            variant: "destructive",
        });

        if (!confirmed) return;

        setAplicando(true);
        let restored = 0;
        const errors = [];

        for (const row of lastBatch.rows) {
            try {
                await base44.entities.Produto.update(row.id, {
                    [lastBatch.targetField]: row.oldValue,
                });

                await base44.entities.HistoricoPrecos?.create?.({
                    organization_id: row.organizationId || "00000000-0000-0000-0000-000000000001",
                    produto_id: row.id,
                    preco_antigo: row.newValue,
                    preco_novo: row.oldValue,
                    tipo: lastBatch.targetField === "preco_venda" ? "venda" : "custo",
                    motivo: "Desfazer reajuste em massa",
                    usuario_nome: user?.nome || user?.full_name || user?.email || "Sistema",
                });

                restored += 1;
            } catch (error) {
                errors.push(`${row.id}: ${error.message}`);
            }
        }

        try {
            await base44.entities.AuditLog.create({
                user_email: user?.email,
                user_name: user?.full_name || user?.nome,
                user_cargo: user?.cargo,
                action: "BULK_PRICE_UNDO",
                entity_type: "Produto",
                entity_id: `${restored}`,
                entity_description: `Desfazer reajuste em massa (${restored} restaurados, ${errors.length} erros)`,
                changes: {
                    targetField: lastBatch.targetField,
                    restored,
                    errors,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (_error) {
            // Nao bloquear fluxo por erro de auditoria
        }

        localStorage.removeItem(UNDO_KEY);
        setLastBatch(null);
        queryClient.invalidateQueries({ queryKey: ["produtos"] });
        setAplicando(false);

        if (errors.length) {
            toast.warning(`Desfazer parcial: ${restored} restaurados, ${errors.length} com erro`);
            return;
        }

        toast.success(`Desfazer concluído: ${restored} item(ns)`);
    };

    const aplicarAjuste = async () => {
        if (!can("manage_bulk_price_adjustment")) {
            toast.error("Você não possui permissão para reajuste em massa");
            return;
        }

        if (!simulation) {
            toast.error("Gere a simulação antes de executar");
            return;
        }

        if (!selectedExecutableRows.length) {
            toast.error("Nenhum item executável na simulação");
            return;
        }

        const firstConfirm = await confirm({
            title: "Confirmar reajuste",
            message: `Executar reajuste em ${selectedExecutableRows.length} item(ns) no campo ${targetField}?\nItens bloqueados: ${blockedRows.length}`,
            confirmText: "Continuar",
            variant: "destructive",
        });
        if (!firstConfirm) return;

        if (selectedExecutableRows.length > 100) {
            const secondConfirm = await confirm({
                title: "Lote grande detectado",
                message: "Esta operação afeta mais de 100 itens. Confirme novamente para executar.",
                confirmText: "Executar lote",
                variant: "destructive",
            });
            if (!secondConfirm) return;
        }

        setAplicando(true);
        const snapshot = [];
        const errors = [];

        try {
            const batchSize = 25;
            for (let i = 0; i < selectedExecutableRows.length; i += batchSize) {
                const batch = selectedExecutableRows.slice(i, i + batchSize);

                await Promise.all(batch.map(async (row) => {
                    try {
                        await base44.entities.Produto.update(row.id, {
                            [targetField]: row.adjusted,
                        });

                        await base44.entities.HistoricoPrecos?.create?.({
                            organization_id: row.produto.organization_id || "00000000-0000-0000-0000-000000000001",
                            produto_id: row.id,
                            preco_antigo: row.current,
                            preco_novo: row.adjusted,
                            tipo: targetField === "preco_venda" ? "venda" : "custo",
                            motivo: "Reajuste em massa flexível",
                            usuario_nome: user?.nome || user?.full_name || user?.email || "Sistema",
                        });

                        snapshot.push({
                            id: row.id,
                            oldValue: row.current,
                            newValue: row.adjusted,
                            organizationId: row.produto.organization_id || "00000000-0000-0000-0000-000000000001",
                        });
                    } catch (error) {
                        errors.push(`${row.produto.nome || row.id}: ${error.message}`);
                    }
                }));
            }

            await base44.entities.AuditLog.create({
                user_email: user?.email,
                user_name: user?.full_name || user?.nome,
                user_cargo: user?.cargo,
                action: "BULK_PRICE_ADJUSTMENT",
                entity_type: "Produto",
                entity_id: `${snapshot.length}`,
                entity_description: `Reajuste em massa (${snapshot.length} sucesso, ${errors.length} erro)`,
                changes: {
                    targetField,
                    tipoAjuste,
                    operacao,
                    adjustmentValue,
                    criteria,
                    exceptionMode,
                    exceptionIds,
                    blockedCount: blockedRows.length,
                    selectedCount: selectedExecutableRows.length,
                    successCount: snapshot.length,
                    errorCount: errors.length,
                },
                timestamp: new Date().toISOString(),
            });

            if (snapshot.length) {
                salvarSnapshotDesfazer(snapshot);
            }

            queryClient.invalidateQueries({ queryKey: ["produtos"] });

            if (errors.length) {
                toast.warning(`Execução parcial: ${snapshot.length} sucesso, ${errors.length} erro`);
            } else {
                toast.success(`${snapshot.length} produto(s) atualizados com sucesso`);
            }

            setSimulation(null);
            if (!errors.length) {
                onClose();
            }
        } catch (error) {
            toast.error("Erro ao executar reajuste: " + error.message);
        } finally {
            setAplicando(false);
        }
    };

    const nomeCampoAlvo = targetField === "preco_venda" ? "Preço de Venda" : "Preço de Custo Tabela";

    const previewRowsSource = simulation?.rows || eligibleProducts;
    const totalPreviewRows = previewRowsSource.length;
    const totalPreviewPages = Math.max(1, Math.ceil(totalPreviewRows / PREVIEW_PAGE_SIZE));
    const currentPreviewPage = Math.min(previewPage, totalPreviewPages);
    const previewStartIndex = (currentPreviewPage - 1) * PREVIEW_PAGE_SIZE;

    const previewRowsSlice = useMemo(() => {
        return previewRowsSource.slice(previewStartIndex, previewStartIndex + PREVIEW_PAGE_SIZE);
    }, [previewRowsSource, previewStartIndex]);

    const previewRows = useMemo(() => {
        if (simulation) return previewRowsSlice;

        return previewRowsSlice.map((produto) => {
            const current = Number(produto[targetField] || 0);
            const adjusted = tipoAjuste === "porcentagem"
                ? (operacao === "aumentar"
                    ? current * (1 + (parseFloat(percentual || 0) / 100))
                    : current * (1 - (parseFloat(percentual || 0) / 100)))
                : tipoAjuste === "multiplicador"
                    ? current * parseFloat(valorFixo || 0)
                    : (operacao === "aumentar"
                        ? current + parseFloat(valorFixo || 0)
                        : Math.max(0, current - parseFloat(valorFixo || 0)));
            const deltaPercent = current > 0 ? ((adjusted - current) / current) * 100 : 0;

            return {
                id: produto.id,
                produto,
                current,
                adjusted: Math.round(adjusted * 100) / 100,
                deltaPercent,
                blocked: false,
                reasons: [],
            };
        });
    }, [simulation, previewRowsSlice, targetField, tipoAjuste, operacao, percentual, valorFixo]);

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-xl font-semibold" style={{ color: "#07593f" }}>
                        Reajuste Flexível em Massa
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-5 py-4">
                    {!can("manage_bulk_price_adjustment") && (
                        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                            Você não possui permissão para executar reajuste em massa.
                        </div>
                    )}

                    {lastBatch?.rows?.length > 0 && minutosRestantesDesfazer > 0 && (
                        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-between gap-3">
                            <div className="text-sm text-amber-800">
                                Último lote disponível para desfazer: {lastBatch.rows.length} item(ns), janela restante {minutosRestantesDesfazer} min.
                            </div>
                            <Button
                                variant="outline"
                                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                                onClick={desfazerUltimoLote}
                                disabled={aplicando}
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Desfazer Último Lote
                            </Button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-900">1. Regra do reajuste</h3>
                        <p className="text-xs text-gray-600">Escolha o campo de preço e o comportamento das exceções para a simulação.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                        <div>
                            <Label className="text-sm font-medium text-gray-700 mb-2 block">Campo de preço</Label>
                            <Select value={targetField} onValueChange={setTargetField}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="preco_venda">Preço de Venda</SelectItem>
                                    <SelectItem value="preco_custo_tabela">Preço de Custo Tabela</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-sm font-medium text-gray-700 mb-2 block">Modo das exceções</Label>
                            <Select value={exceptionMode} onValueChange={setExceptionMode}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={BULK_PRICE_CONSTANTS.EXCEPTION_MODES.INCLUDE_FILTER_EXCLUDE_ITEMS}>
                                        Excluir itens selecionados manualmente
                                    </SelectItem>
                                    <SelectItem value={BULK_PRICE_CONSTANTS.EXCEPTION_MODES.EXCLUDE_FILTER_INCLUDE_ITEMS}>
                                        Incluir apenas itens selecionados manualmente
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-900">2. Itens alvo</h3>
                        <p className="text-xs text-gray-600">Defina os candidatos usando filtros de fabricante, categoria, status e faixa de preço.</p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-3 p-4 border rounded-xl">
                        <div>
                            <Label className="text-xs text-gray-600">Fabricante</Label>
                            <Select
                                value={criteria.fabricantes || "todos"}
                                onValueChange={(value) => setCriteria((prev) => ({ ...prev, fabricantes: value === "todos" ? "" : value }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os fabricantes</SelectItem>
                                    {uniqueManufacturers.map((fabricante) => (
                                        <SelectItem key={fabricante} value={fabricante}>{fabricante}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Categoria</Label>
                            <Select
                                value={criteria.categorias || "todas"}
                                onValueChange={(value) => setCriteria((prev) => ({ ...prev, categorias: value === "todas" ? "" : value }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas as categorias</SelectItem>
                                    {uniqueCategories.map((categoria) => (
                                        <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Produto específico</Label>
                            <Input
                                value={criteria.searchTerm}
                                onChange={(e) => setCriteria((prev) => ({ ...prev, searchTerm: e.target.value }))}
                                placeholder="Nome, SKU, ID"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Status</Label>
                            <Select
                                value={criteria.status}
                                onValueChange={(value) => setCriteria((prev) => ({ ...prev, status: value }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={BULK_PRICE_CONSTANTS.STATUS_OPTIONS.TODOS}>Todos</SelectItem>
                                    <SelectItem value={BULK_PRICE_CONSTANTS.STATUS_OPTIONS.ATIVO}>Somente ativos</SelectItem>
                                    <SelectItem value={BULK_PRICE_CONSTANTS.STATUS_OPTIONS.INATIVO}>Inativo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs text-gray-600">Faixa de preço (mín.)</Label>
                            <Input type="number" value={criteria.precoMin} onChange={(e) => setCriteria((prev) => ({ ...prev, precoMin: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Faixa de preço (máx.)</Label>
                            <Input type="number" value={criteria.precoMax} onChange={(e) => setCriteria((prev) => ({ ...prev, precoMax: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Estoque (mín.)</Label>
                            <Input type="number" value={criteria.estoqueMin} onChange={(e) => setCriteria((prev) => ({ ...prev, estoqueMin: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Estoque (máx.)</Label>
                            <Input type="number" value={criteria.estoqueMax} onChange={(e) => setCriteria((prev) => ({ ...prev, estoqueMax: e.target.value }))} />
                        </div>

                        <div>
                            <Label className="text-xs text-gray-600">Cadastro (de)</Label>
                            <Input type="date" lang="pt-BR" value={criteria.createdFrom} onChange={(e) => setCriteria((prev) => ({ ...prev, createdFrom: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Cadastro (até)</Label>
                            <Input type="date" lang="pt-BR" value={criteria.createdTo} onChange={(e) => setCriteria((prev) => ({ ...prev, createdTo: e.target.value }))} />
                        </div>

                        <div>
                            <Label className="text-xs text-gray-600">Atualização (de)</Label>
                            <Input type="date" lang="pt-BR" value={criteria.updatedFrom} onChange={(e) => setCriteria((prev) => ({ ...prev, updatedFrom: e.target.value }))} />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-600">Atualização (até)</Label>
                            <Input type="date" lang="pt-BR" value={criteria.updatedTo} onChange={(e) => setCriteria((prev) => ({ ...prev, updatedTo: e.target.value }))} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-900">3. Forma de cálculo</h3>
                        <p className="text-xs text-gray-600">Defina tipo, direção e valor do reajuste.</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-900">4. Ajustes manuais (exceções)</h3>
                        <p className="text-xs text-gray-600">Inclua ou exclua itens pontuais sem alterar os filtros principais.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 p-4 border rounded-xl">
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={tipoAjuste === "porcentagem" ? "default" : "outline"}
                                    onClick={() => setTipoAjuste("porcentagem")}
                                    className={tipoAjuste === "porcentagem" ? "bg-green-600 hover:bg-green-700" : ""}
                                >
                                    <Percent className="w-4 h-4 mr-2" />
                                    Porcentagem
                                </Button>
                                <Button
                                    type="button"
                                    variant={tipoAjuste === "fixo" ? "default" : "outline"}
                                    onClick={() => setTipoAjuste("fixo")}
                                    className={tipoAjuste === "fixo" ? "bg-blue-600 hover:bg-blue-700" : ""}
                                >
                                    <DollarSign className="w-4 h-4 mr-2" />
                                    Valor Fixo
                                </Button>
                                <Button
                                    type="button"
                                    variant={tipoAjuste === "multiplicador" ? "default" : "outline"}
                                    onClick={() => setTipoAjuste("multiplicador")}
                                    className={tipoAjuste === "multiplicador" ? "bg-violet-600 hover:bg-violet-700" : ""}
                                >
                                    Multiplicador
                                </Button>
                            </div>

                            {tipoAjuste !== "multiplicador" && (
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={operacao === "aumentar" ? "default" : "outline"}
                                        onClick={() => setOperacao("aumentar")}
                                        className={operacao === "aumentar" ? "bg-green-600 hover:bg-green-700" : ""}
                                    >
                                        <TrendingUp className="w-4 h-4 mr-2" />
                                        Aumentar
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={operacao === "diminuir" ? "default" : "outline"}
                                        onClick={() => setOperacao("diminuir")}
                                        className={operacao === "diminuir" ? "bg-red-600 hover:bg-red-700" : ""}
                                    >
                                        <TrendingDown className="w-4 h-4 mr-2" />
                                        Diminuir
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label className="text-xs text-gray-600">Valor do reajuste</Label>
                            <Input
                                type="number"
                                min="0"
                                max={tipoAjuste === "porcentagem" ? "20" : "999999"}
                                step={tipoAjuste === "porcentagem" ? "0.5" : tipoAjuste === "multiplicador" ? "0.01" : "0.01"}
                                value={adjustmentValue}
                                onChange={(e) => tipoAjuste === "porcentagem" ? setPercentual(e.target.value) : setValorFixo(e.target.value)}
                                placeholder={tipoAjuste === "porcentagem" ? "Ex: 5" : tipoAjuste === "multiplicador" ? "Ex: 1.08" : "Ex: 50"}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {tipoAjuste === "multiplicador"
                                    ? "Use fator direto. Ex.: 1.05 aumenta 5%, 0.95 reduz 5%."
                                    : "Limite de segurança: 20% por item."}
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 p-4 border rounded-xl">
                        <div>
                            <Label className="text-xs text-gray-600">Buscar exceções</Label>
                            <Input
                                value={exceptionSearch}
                                onChange={(e) => setExceptionSearch(e.target.value)}
                                placeholder="Digite nome, SKU ou ID"
                            />
                            <div className="mt-2 space-y-1 max-h-28 overflow-auto">
                                {exceptionSuggestions.map((produto) => {
                                    const selected = exceptionIds.includes(produto.id);
                                    return (
                                        <button
                                            key={produto.id}
                                            type="button"
                                            className={`w-full text-left px-2 py-1 rounded text-xs border ${selected ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"}`}
                                            onClick={() => toggleException(produto.id)}
                                        >
                                            {produto.nome} ({produto.codigo_barras || produto.id})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-gray-600">Exceções ativas ({exceptionProducts.length})</Label>
                            <div className="max-h-32 overflow-auto border rounded p-2 text-xs space-y-1">
                                {exceptionProducts.length === 0 && (
                                    <div className="text-gray-500">Nenhuma exceção selecionada.</div>
                                )}
                                {exceptionProducts.map((produto) => (
                                    <div key={produto.id} className="flex items-center justify-between gap-2">
                                        <span className="truncate">{produto.nome}</span>
                                        <Button size="sm" variant="ghost" onClick={() => removeException(produto.id)}>Remover</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-gray-50 text-sm text-gray-700 grid md:grid-cols-3 gap-3">
                        <div>Base pelos filtros: <span className="font-semibold">{filteredProducts.length}</span></div>
                        <div>Elegíveis após exceções: <span className="font-semibold">{eligibleProducts.length}</span></div>
                        <div>Campo de preço: <span className="font-semibold">{nomeCampoAlvo}</span></div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-900">5. Simulação e validação</h3>
                        <p className="text-xs text-gray-600">Simule antes de executar e verifique os itens que requerem ajuste.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={gerarSimulacao} disabled={!can("manage_bulk_price_adjustment") || aplicando}>
                            Simular reajuste
                        </Button>
                        {simulation && (
                            <>
                                <Button variant="outline" onClick={selecionarTodosElegiveis} disabled={aplicando || !executionRows.length}>
                                    Selecionar todos elegíveis
                                </Button>
                                <Button variant="outline" onClick={limparSelecaoElegiveis} disabled={aplicando || !selectedExecutionIds.length}>
                                    Limpar seleção
                                </Button>
                            </>
                        )}
                        {simulation && (
                            <div className="text-sm text-gray-600">
                                Prontos para aplicar: <span className="font-semibold text-green-700">{simulation.summary.totalExecutaveis}</span> | Selecionados: <span className="font-semibold text-blue-700">{selectedExecutableRows.length}</span> | Requer ajuste: <span className="font-semibold text-red-700">{simulation.summary.totalBloqueados}</span>
                            </div>
                        )}
                    </div>

                    {simulation && (
                        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm">
                            <div className="font-medium text-blue-900 mb-2">Resumo da simulação</div>
                            <div className="grid md:grid-cols-4 gap-2 text-blue-900">
                                <div>Total elegíveis: {simulation.summary.totalElegiveis}</div>
                                <div>Prontos para aplicar: {simulation.summary.totalExecutaveis}</div>
                                <div>Soma atual: {formatMoney(simulation.summary.somaAtual)}</div>
                                <div>Soma nova: {formatMoney(simulation.summary.somaNova)}</div>
                            </div>
                            <div className="mt-2">Impacto total: <span className={simulation.summary.impactoTotal >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{formatMoney(simulation.summary.impactoTotal)}</span></div>
                        </div>
                    )}

                    <div className="border rounded-xl overflow-hidden">
                        <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between text-xs text-gray-600">
                            <span>
                                Mostrando {Math.min(totalPreviewRows, previewStartIndex + 1)}-{Math.min(totalPreviewRows, previewStartIndex + previewRows.length)} de {totalPreviewRows} item(ns)
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPreviewPage <= 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span>Página {currentPreviewPage} de {totalPreviewPages}</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewPage((prev) => Math.min(totalPreviewPages, prev + 1))}
                                    disabled={currentPreviewPage >= totalPreviewPages}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 sticky top-0">
                                    <TableRow>
                                        <TableHead className="w-16">Aplicar?</TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Atual</TableHead>
                                        <TableHead className="text-right">Novo</TableHead>
                                        <TableHead className="text-right">Var. %</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewRows.map((row) => {
                                        const selectedExecution = selectedExecutionIds.includes(row.id);
                                        return (
                                            <TableRow key={row.id} className={row.blocked ? "bg-red-50" : ""}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedExecution}
                                                        disabled={row.blocked}
                                                        onCheckedChange={() => toggleExecucaoSelecionada(row.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium text-sm truncate max-w-[280px]">{row.produto.nome}</p>
                                                    <p className="text-xs text-gray-500">{row.produto.categoria || "Sem categoria"}</p>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">{formatMoney(row.current)}</TableCell>
                                                <TableCell className="text-right font-mono text-sm">{formatMoney(row.adjusted)}</TableCell>
                                                <TableCell className={`text-right text-sm ${row.deltaPercent >= 0 ? "text-green-700" : "text-red-700"}`}>
                                                    {row.deltaPercent.toFixed(2)}%
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {row.blocked ? (
                                                        <div className="text-red-700 flex items-center gap-1">
                                                            <ShieldAlert className="w-3 h-3" />
                                                            <span>{row.reasons.join("; ")}</span>
                                                            {row.reasons.some((reason) => String(reason).toLowerCase().includes("menor ou igual a zero")) && (
                                                                <Button
                                                                    type="button"
                                                                    variant="link"
                                                                    size="sm"
                                                                    className="h-auto p-0 text-red-800 underline"
                                                                    onClick={() => abrirEditarCadastro(row.produto)}
                                                                >
                                                                    corrigir cadastro
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-green-700">Pronto para aplicar</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900">6. Execução</h3>
                    <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        {simulation
                            ? `${selectedExecutableRows.length} item(ns) selecionados para execução em ${nomeCampoAlvo}`
                            : "Simule o reajuste para liberar a execução"}
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={aplicarAjuste}
                            disabled={
                                aplicando ||
                                !simulation ||
                                !selectedExecutableRows.length ||
                                !can("manage_bulk_price_adjustment")
                            }
                            className="min-w-[180px] bg-green-700 hover:bg-green-800"
                        >
                            {aplicando ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Executar Reajuste
                        </Button>
                    </div>
                    </div>
                </div>
            </DialogContent>

        </Dialog>

        <Dialog open={editCadastroOpen} onOpenChange={setEditCadastroOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar Cadastro do Item</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="text-sm text-gray-700 font-medium">
                        {editCadastroItem?.nome || "Produto"}
                    </div>
                    <div>
                        <Label>Preço de Custo</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPrecoCusto}
                            onChange={(e) => setEditPrecoCusto(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Preço de Venda</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPrecoVenda}
                            onChange={(e) => setEditPrecoVenda(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setEditCadastroOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={salvarEdicaoCadastro} disabled={salvandoEdicaoCadastro}>
                        {salvandoEdicaoCadastro && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar Cadastro
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
