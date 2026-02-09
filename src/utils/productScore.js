/**
 * Calculates the completeness score of a product registration.
 * Returns a score (0-100), a level ('low', 'medium', 'high'), and missing fields.
 * 
 * Criteria:
 * - Green (High - 100%): Nome, EAN, Cor (if variation), Dims (H/W/D), NCM, Stock.
 * - Yellow (Medium - 50-80%): Basic info present, but missing Dims, Weight, or NCM.
 * - Red (Low - <50%): Only Name/Barcode present.
 */
export const calculateProductScore = (produto) => {
    if (!produto) return { score: 0, level: 'low', missing: [] };

    let score = 0;
    const missing = [];
    const totalWeights = {
        identity: 30, // Name, EAN, SKU
        specs: 30,    // Dimensions, Color, Material
        fiscal: 20,   // NCM, Origin
        logistic: 20  // Weight, Volumes, Stock
    };

    // 1. Identity Check
    if (produto.nome?.length > 3) score += 10;
    else missing.push('Nome');

    if (produto.codigo_barras?.length > 0) score += 10;
    else missing.push('EAN (Código de Barras)');

    // SKU is often auto-generated, checking if it exists
    if (produto.codigo_barras || produto.sku) score += 10;

    // 2. Specs Check
    const hasDims = produto.altura > 0 && produto.largura > 0 && produto.profundidade > 0;
    if (hasDims) score += 15;
    else missing.push('Dimensões (A/L/P)');

    // Color check: If it's a variation (parent_id) or has variations, color is crucial.
    // For standalone, it's good to have but maybe not mandatory if it's "Única".
    // We'll enforce it for score quality.
    if (produto.cor && produto.cor !== 'PADRAO') score += 10;
    else missing.push('Cor');

    if (produto.material) score += 5;

    // 3. Fiscal Check
    if (produto.ncm?.length >= 8) score += 15;
    else missing.push('NCM');

    if (produto.origem_mercadoria) score += 5;

    // 4. Logistic Check
    if (parseFloat(produto.peso_bruto) > 0) score += 10;
    else missing.push('Peso Bruto');

    if (parseInt(produto.volumes) > 0) score += 5;
    else missing.push('Volumes');

    // Stock check (not strict for registration quality, but good for "Active" status)
    if (produto.quantidade_estoque >= 0) score += 5;

    // Determine Level
    let level = 'low';
    if (score >= 90) level = 'high';
    else if (score >= 50) level = 'medium';

    return { score, level, missing };
};

export const getColorForScore = (level) => {
    switch (level) {
        case 'high': return 'bg-green-100 text-green-800 border-green-200';
        case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'low': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800';
    }
};
