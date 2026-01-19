// src/utils/markupCalculator.js

/**
 * Default margin targets per category (percentage as decimal).
 */
export function getMarginTarget(category) {
    const defaults = {
        Sofa: 0.30,
        Cama: 0.25,
        Mesa: 0.28,
        Cadeira: 0.27,
        Armario: 0.32,
        Estante: 0.30,
        Rack: 0.30,
        Poltrona: 0.30,
        Escrivaninha: 0.28,
        "Criado-mudo": 0.25,
        Buffet: 0.27,
        Aparador: 0.26,
        Banco: 0.24,
        Colchao: 0.30,
        "Guarda-roupa": 0.33,
        Comoda: 0.28,
        Painel: 0.30,
        Outros: 0.25,
    };
    return defaults[category] ?? 0.25;
}

/**
 * Supplier reliability factor. Placeholder logic: even IDs are trusted.
 */
export function getSupplierFactor(supplierId) {
    if (!supplierId) return 1.0;
    return supplierId % 2 === 0 ? 0.95 : 1.05;
}

/**
 * Adjusts margin based on stock levels (Scarcity vs Excess).
 */
export function getStockAdjustment(product) {
    const { quantidade_estoque = 0, estoque_minimo = 0 } = product;

    // If no minimum stock defined, assume neutral
    if (!estoque_minimo) return 1.0;

    const estoque = parseInt(quantidade_estoque);
    const min = parseInt(estoque_minimo);

    // Scarcity: Stock below minimum -> Increase price to slow sales/maximize profit
    if (estoque < min) {
        // Linear increase up to 10% when stock is near 0
        const shortageRatio = (min - estoque) / min; // 0 to 1
        return 1.0 + Math.min(shortageRatio * 0.10, 0.10);
    }

    // Excess: Stock way above minimum (> 3x) -> Decrease price to clear inventory
    if (estoque > min * 3) {
        // Small discount of 5% to encourage sales
        return 0.95;
    }

    // Normal stock levels
    return 1.0;
}

/**
 * Simplified tax rate (e.g., ICMS 18%).
 */
export function getTaxRate(_product) {
    return 0.18;
}

/**
 * Main function to calculate suggested selling price.
 */
export function calculateSuggestedMarkup(product) {
    const custo = parseFloat(product.preco_custo || 0);
    if (custo <= 0) return 0;

    const categoria = product.categoria;

    // 1. Base margin target
    const margemAlvo = getMarginTarget(categoria);
    let markup = custo * (1 + margemAlvo);

    // 2. Stock/Market Adjustment
    // Replaced "DemandFactor" with more specific StockAdjustment
    markup *= getStockAdjustment(product);

    // 3. Tax
    markup *= 1 + getTaxRate(product);

    // 4. Round to two decimals
    return Math.round(markup * 100) / 100;
}

/**
 * Returns detailed breakdown of markup calculation for transparency.
 */
export function calculateMarkupDetails(product) {
    const custo = parseFloat(product.preco_custo || 0);
    if (custo <= 0) {
        return null;
    }

    const categoria = product.categoria || 'Outros';

    // Step 1: Base margin
    const margemAlvo = getMarginTarget(categoria);
    const margemPercent = Math.round(margemAlvo * 100);
    const precoComMargem = custo * (1 + margemAlvo);

    // Step 2: Stock Adjustment
    const stockFactor = getStockAdjustment(product);
    let stockLabel = 'Estoque Normal';
    let stockFactorLabel = '0%';

    if (stockFactor > 1) {
        stockLabel = 'Escassez (Baixo Estoque)';
        stockFactorLabel = `+${Math.round((stockFactor - 1) * 100)}%`;
    } else if (stockFactor < 1) {
        stockLabel = 'Excesso de Estoque';
        stockFactorLabel = `${Math.round((stockFactor - 1) * 100)}%`;
    }

    const precoComEstoque = precoComMargem * stockFactor;

    // Step 3: Tax
    const taxRate = getTaxRate(product);
    const taxPercent = Math.round(taxRate * 100);
    const precoFinal = precoComEstoque * (1 + taxRate);

    return {
        custo,
        categoria,
        steps: [
            {
                label: `Margem ${categoria}`,
                factor: `+${margemPercent}%`,
                value: Math.round(precoComMargem * 100) / 100,
                description: `R$ ${custo.toFixed(2)} × ${(1 + margemAlvo).toFixed(2)}`
            },
            {
                label: stockLabel,
                factor: stockFactorLabel,
                value: Math.round(precoComEstoque * 100) / 100,
                description: stockFactor === 1 ? 'Sem ajuste' : (stockFactor > 1 ? 'Aumento por escassez' : 'Desconto por excesso')
            },
            {
                label: `Impostos (Estimado)`,
                factor: `+${taxPercent}%`,
                value: Math.round(precoFinal * 100) / 100,
                description: `ICMS ~${taxPercent}%`
            }
        ],
        precoFinal: Math.round(precoFinal * 100) / 100
    };
}

