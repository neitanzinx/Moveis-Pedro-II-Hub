import { PRODUCT_KEYWORD_RULES } from '@/constants/productKeywordFallback';

const normalizeText = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const pickTopCandidate = (scores, firstSeen) => {
    let winner = null;
    let topScore = 0;

    Object.entries(scores).forEach(([key, score]) => {
        if (score > topScore) {
            winner = key;
            topScore = score;
            return;
        }

        if (score === topScore && score > 0) {
            if ((firstSeen[key] ?? Number.MAX_SAFE_INTEGER) < (firstSeen[winner] ?? Number.MAX_SAFE_INTEGER)) {
                winner = key;
            }
        }
    });

    return { key: winner, score: topScore };
};

export const detectProductKeywordSuggestion = (
    nomeProduto,
    {
        returnDefault = false,
        defaultCategoria = 'Outros',
        defaultAmbiente = 'Diversos',
    } = {}
) => {
    const normalizedName = normalizeText(nomeProduto);

    if (!normalizedName) {
        return {
            categoriaSuggestion: returnDefault ? defaultCategoria : null,
            ambienteSuggestion: returnDefault ? defaultAmbiente : null,
            categoryScore: 0,
            ambienteScore: 0,
            matchedKeywords: [],
            hasSuggestion: false,
        };
    }

    const categoryScores = {};
    const ambienteScores = {};
    const categoryFirstSeen = {};
    const ambienteFirstSeen = {};
    const matchedKeywordSet = new Set();

    PRODUCT_KEYWORD_RULES.forEach((rule, idx) => {
        const matchedKeywords = (rule.keywords || []).filter((kw) => normalizedName.includes(normalizeText(kw)));
        const score = matchedKeywords.length;

        if (!score) return;

        matchedKeywords.forEach((kw) => matchedKeywordSet.add(kw));

        categoryScores[rule.categoria] = (categoryScores[rule.categoria] || 0) + score;
        ambienteScores[rule.ambiente] = (ambienteScores[rule.ambiente] || 0) + score;

        if (categoryFirstSeen[rule.categoria] === undefined) {
            categoryFirstSeen[rule.categoria] = idx;
        }
        if (ambienteFirstSeen[rule.ambiente] === undefined) {
            ambienteFirstSeen[rule.ambiente] = idx;
        }
    });

    const categoryTop = pickTopCandidate(categoryScores, categoryFirstSeen);
    const ambienteTop = pickTopCandidate(ambienteScores, ambienteFirstSeen);

    const hasSuggestion = categoryTop.score > 0 || ambienteTop.score > 0;

    return {
        categoriaSuggestion: categoryTop.key || (returnDefault ? defaultCategoria : null),
        ambienteSuggestion: ambienteTop.key || (returnDefault ? defaultAmbiente : null),
        categoryScore: categoryTop.score,
        ambienteScore: ambienteTop.score,
        matchedKeywords: Array.from(matchedKeywordSet),
        hasSuggestion,
    };
};
