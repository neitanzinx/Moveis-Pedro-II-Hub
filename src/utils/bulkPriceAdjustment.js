const MAX_ADJUSTMENT_PERCENT = 20;

const STATUS_OPTIONS = {
    TODOS: "todos",
    ATIVO: "ativo",
    INATIVO: "inativo",
};

const EXCEPTION_MODES = {
    INCLUDE_FILTER_EXCLUDE_ITEMS: "include_filter_exclude_items",
    EXCLUDE_FILTER_INCLUDE_ITEMS: "exclude_filter_include_items",
};

const toNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const toDateValue = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalize = (value) => String(value || "").trim().toLowerCase();

export const parseList = (input) =>
    String(input || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

const containsAny = (candidate, terms = []) => {
    if (!terms.length) return true;
    const normalizedCandidate = normalize(candidate);
    return terms.some((term) => normalizedCandidate.includes(normalize(term)));
};

const resolveStoreValue = (produto) => {
    return (
        produto.loja ||
        produto.loja_nome ||
        produto.loja_venda ||
        produto.store ||
        produto.store_name ||
        ""
    );
};

const resolveSearchBlob = (produto) => {
    return normalize(
        [
            produto.id,
            produto.nome,
            produto.codigo_barras,
            produto.modelo_referencia,
            produto.fornecedor_nome,
            produto.marca,
        ].join(" ")
    );
};

const isInPriceRange = (value, minValue, maxValue) => {
    const current = toNumber(value);
    if (minValue !== "" && current < toNumber(minValue)) return false;
    if (maxValue !== "" && current > toNumber(maxValue)) return false;
    return true;
};

const isInDateRange = (value, from, to) => {
    if (!from && !to) return true;

    const dateValue = toDateValue(value);
    if (!dateValue) return false;

    const fromDate = from ? toDateValue(from) : null;
    const toDate = to ? toDateValue(to) : null;

    if (fromDate && dateValue < fromDate) return false;
    if (toDate) {
        const inclusiveEnd = new Date(toDate);
        inclusiveEnd.setHours(23, 59, 59, 999);
        if (dateValue > inclusiveEnd) return false;
    }

    return true;
};

export const filterProductsByCriteria = (produtos = [], criteria = {}, targetField = "preco_venda") => {
    const fabricantes = parseList(criteria.fabricantes);
    const categorias = parseList(criteria.categorias);
    const searchTerm = normalize(criteria.searchTerm);

    return produtos.filter((produto) => {
        const fabricanteValue = produto.fornecedor_nome || produto.marca || "";
        const categoriaValue = produto.categoria || "";
        const status = criteria.status || STATUS_OPTIONS.TODOS;

        if (!containsAny(fabricanteValue, fabricantes)) return false;
        if (!containsAny(categoriaValue, categorias)) return false;
        if (!isInPriceRange(produto[targetField], criteria.precoMin, criteria.precoMax)) return false;

        if (searchTerm && !resolveSearchBlob(produto).includes(searchTerm)) return false;

        const storeFilter = normalize(criteria.loja);
        if (storeFilter && storeFilter !== "todas") {
            const storeValue = normalize(resolveStoreValue(produto));
            if (!storeValue || storeValue !== storeFilter) return false;
        }

        const unidadeFilter = normalize(criteria.unidade);
        if (unidadeFilter && unidadeFilter !== "todas") {
            if (normalize(produto.unidade) !== unidadeFilter) return false;
        }

        if (status === STATUS_OPTIONS.ATIVO && !produto.ativo) return false;
        if (status === STATUS_OPTIONS.INATIVO && produto.ativo) return false;

        if (!isInPriceRange(produto.quantidade_estoque, criteria.estoqueMin, criteria.estoqueMax)) return false;

        if (!isInDateRange(produto.created_at, criteria.createdFrom, criteria.createdTo)) return false;
        if (!isInDateRange(produto.updated_at, criteria.updatedFrom, criteria.updatedTo)) return false;

        return true;
    });
};

export const applyExceptionMode = ({
    produtos = [],
    filteredProducts = [],
    exceptionMode = EXCEPTION_MODES.INCLUDE_FILTER_EXCLUDE_ITEMS,
    exceptionIds = [],
}) => {
    const filteredSet = new Set(filteredProducts.map((produto) => produto.id));
    const exceptionSet = new Set(exceptionIds);

    if (exceptionMode === EXCEPTION_MODES.EXCLUDE_FILTER_INCLUDE_ITEMS) {
        return produtos.filter((produto) => !filteredSet.has(produto.id) || exceptionSet.has(produto.id));
    }

    return filteredProducts.filter((produto) => !exceptionSet.has(produto.id));
};

export const calculateAdjustedValue = ({ currentValue, adjustmentType, operation, adjustmentValue }) => {
    const current = toNumber(currentValue);
    const value = toNumber(adjustmentValue);

    if (adjustmentType === "porcentagem") {
        return operation === "aumentar"
            ? current * (1 + value / 100)
            : current * (1 - value / 100);
    }

    return operation === "aumentar"
        ? current + value
        : Math.max(0, current - value);
};

export const buildSimulation = ({
    produtos = [],
    targetField,
    adjustmentType,
    operation,
    adjustmentValue,
}) => {
    const adjustedRows = produtos.map((produto) => {
        const current = toNumber(produto[targetField]);
        const adjusted = calculateAdjustedValue({
            currentValue: current,
            adjustmentType,
            operation,
            adjustmentValue,
        });
        const rounded = Math.round(adjusted * 100) / 100;
        const delta = rounded - current;
        const deltaPercent = current > 0 ? (delta / current) * 100 : rounded > 0 ? 100 : 0;

        const reasons = [];
        if (rounded <= 0) reasons.push("Preço final menor ou igual a zero");
        if (Math.abs(deltaPercent) > MAX_ADJUSTMENT_PERCENT) {
            reasons.push(`Variação acima do limite de ${MAX_ADJUSTMENT_PERCENT}%`);
        }

        return {
            id: produto.id,
            produto,
            current,
            adjusted: rounded,
            delta,
            deltaPercent,
            blocked: reasons.length > 0,
            reasons,
        };
    });

    const executableRows = adjustedRows.filter((row) => !row.blocked);
    const blockedRows = adjustedRows.filter((row) => row.blocked);

    return {
        rows: adjustedRows,
        executableRows,
        blockedRows,
        summary: {
            totalElegiveis: adjustedRows.length,
            totalExecutaveis: executableRows.length,
            totalBloqueados: blockedRows.length,
            somaAtual: executableRows.reduce((acc, row) => acc + row.current, 0),
            somaNova: executableRows.reduce((acc, row) => acc + row.adjusted, 0),
            impactoTotal: executableRows.reduce((acc, row) => acc + row.delta, 0),
        },
    };
};

export const BULK_PRICE_CONSTANTS = {
    MAX_ADJUSTMENT_PERCENT,
    STATUS_OPTIONS,
    EXCEPTION_MODES,
};
