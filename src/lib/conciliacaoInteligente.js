/**
 * Conciliação Inteligente de Lançamentos Financeiros
 *
 * Detecta possíveis duplicatas entre:
 *   1. Um novo lançamento manual do financeiro e lançamentos existentes originados de OCs
 *   2. Um lançamento sendo criado a partir de uma OC (manual) e lançamentos existentes
 *      (criados automaticamente pelo recebimento ou aprovação de pagamento)
 *
 * Critério principal: mesmo valor inteiro (ignorando decimais) + tipo Saída + categoria de compra
 * Critério secundário: fornecedor similar OU número de OC na descrição OU janela de 60 dias
 */

/** Palavras-chave que indicam lançamentos de compra de mercadoria */
const KEYWORDS_COMPRA = [
  'compra', 'fornecedor', 'estoque', 'mercadoria', 'pedido', 'oc', 'boleto',
  'fatura', 'nota fiscal', 'nfe', 'nf-e',
];

/**
 * Retorna true se a categoria/descrição é de compra de mercadoria/fornecedor
 */
export function isLancamentoCompra(lancamento) {
  const texto = [
    lancamento.categoria_nome || '',
    lancamento.descricao || '',
    lancamento.tipo || '',
    lancamento.origem || '',
  ]
    .join(' ')
    .toLowerCase();

  return KEYWORDS_COMPRA.some((kw) => texto.includes(kw));
}

/**
 * Normaliza string para comparação: lowercase, sem acentos, sem espaços duplos
 */
function normalizar(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica similaridade entre dois strings (>= 60% de caracteres comuns)
 */
function textoSimilar(a, b) {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Bigramas simples
  const bigrams = (s) => {
    const out = new Set();
    for (let i = 0; i < s.length - 1; i++) out.add(s[i] + s[i + 1]);
    return out;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let inter = 0;
  ba.forEach((bg) => { if (bb.has(bg)) inter++; });
  const total = ba.size + bb.size;
  return total > 0 && (2 * inter) / total >= 0.5;
}

/**
 * Extrai o número de OC de uma string (ex: "OC #1234" → "1234")
 */
function extrairNumeroOc(str) {
  const m = (str || '').match(/oc\s*#?\s*(\d+)/i);
  return m ? m[1] : null;
}

/**
 * Retorna a diferença em dias entre duas datas ISO (YYYY-MM-DD)
 */
function diffDias(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

/**
 * Verifica se dois valores são "iguais ignorando decimais"
 * Regra: Math.floor de ambos são iguais
 */
function valorSimilar(v1, v2) {
  const n1 = parseFloat(v1);
  const n2 = parseFloat(v2);
  if (isNaN(n1) || isNaN(n2)) return false;
  return Math.floor(n1) === Math.floor(n2);
}

/**
 * Analisa se um novo lançamento tem potencial de duplicidade com lançamentos existentes.
 *
 * @param {Object} novoLancamento  - O lançamento que está sendo criado
 * @param {Array}  todosLancamentos - Lista completa de lançamentos existentes
 * @returns {{ duplicatas: Array, aviso: string|null }}
 */
export function verificarConciliacao(novoLancamento, todosLancamentos) {
  // Só faz sentido checar para Saídas relacionadas a compras
  const tipoSaida =
    novoLancamento.tipo === 'Saída' ||
    novoLancamento.tipo === 'Saida' ||
    novoLancamento.tipo === 'DESPESA';

  if (!tipoSaida) return { duplicatas: [], aviso: null };
  if (!isLancamentoCompra(novoLancamento)) return { duplicatas: [], aviso: null };

  const valorNovo = parseFloat(novoLancamento.valor);
  if (isNaN(valorNovo) || valorNovo <= 0) return { duplicatas: [], aviso: null };

  const novoOcNum = extrairNumeroOc(novoLancamento.descricao) ||
    extrairNumeroOc(novoLancamento.numero_pedido) ||
    extrairNumeroOc(novoLancamento.origem);

  const duplicatas = todosLancamentos.filter((l) => {
    // Ignorar o próprio lançamento (edição)
    if (l.id && novoLancamento.id && l.id === novoLancamento.id) return false;
    // Ignorar cancelados
    if (l.status === 'Cancelado' || l.status === 'Cancelada') return false;
    // Deve ser Saída
    const tipoL = l.tipo === 'Saída' || l.tipo === 'Saida' || l.tipo === 'DESPESA';
    if (!tipoL) return false;
    // Deve ser de compra
    if (!isLancamentoCompra(l)) return false;
    // Valor inteiro igual
    if (!valorSimilar(l.valor, valorNovo)) return false;

    // Com pelo menos um critério secundário:
    const lOcNum = extrairNumeroOc(l.descricao) ||
      extrairNumeroOc(l.numero_pedido) ||
      extrairNumeroOc(l.origem);

    // 1. Mesmo número de OC
    if (novoOcNum && lOcNum && novoOcNum === lOcNum) return true;

    // 2. Fornecedor similar (se disponível)
    if (
      novoLancamento.fornecedor_nome &&
      l.fornecedor_nome &&
      textoSimilar(novoLancamento.fornecedor_nome, l.fornecedor_nome)
    )
      return true;

    // 3. Descrição similar
    if (textoSimilar(novoLancamento.descricao, l.descricao)) return true;

    // 4. Janela de 60 dias (data de vencimento ou data lançamento próximos)
    const dataRef = novoLancamento.data_vencimento || novoLancamento.data_lancamento;
    const dataL = l.data_vencimento || l.data_lancamento;
    if (diffDias(dataRef, dataL) <= 60) return true;

    return false;
  });

  if (duplicatas.length === 0) return { duplicatas: [], aviso: null };

  const aviso =
    duplicatas.length === 1
      ? `Foi encontrado 1 lançamento com valor semelhante (R$ ${Math.floor(valorNovo)}) que pode ser duplicata deste.`
      : `Foram encontrados ${duplicatas.length} lançamentos com valor semelhante (R$ ${Math.floor(valorNovo)}) que podem ser duplicatas deste.`;

  return { duplicatas, aviso };
}
