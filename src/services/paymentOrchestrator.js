const EPSILON = 0.01;

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const METHOD_ALIASES = {
  // Dinheiro / Pix
  dinheiro: "Dinheiro",
  pix: "Pix",
  // Débito
  debito: "Débito",
  "cartao de debito": "Débito",
  // Crédito — 1x vs parcelado separados para match exato com configuracao_taxa
  "credito 1x": "Crédito 1x",
  "credito parcelado": "Crédito Parcelado",
  // "credito" sozinho = legado (vendas antigas); normaliza para "Crédito 1x" por padrão
  credito: "Crédito 1x",
  // Cartão de Crédito usado na entrega (sempre 1x na porta)
  "cartao de credito": "Crédito 1x",
  "cartao de credito 1x": "Crédito 1x",
  "cartao de credito parcelado": "Crédito Parcelado",
  // Outros
  afesp: "AFESP",
  multicredito: "Multicrédito",
  boleto: "Boleto",
  crediario: "Crediário",
  financiamento: "Financiamento",
  transferencia: "Transferência",
  // Link de Pagamento
  "link - credito": "Link - Crédito",
  "link - debito": "Link - Débito",
  "link - pix": "Link - Pix",
  "link de pagamento": "Link de Pagamento",
};

const INSTALLMENT_METHODS = new Set(["Crédito 1x", "Crédito Parcelado", "Multicrédito", "AFESP", "Link - Crédito", "Link - Débito"]);

export const PAYMENT_METHOD_OPTIONS = [
  "Dinheiro",
  "Crédito",
  "Débito",
  "Pix",
  "AFESP",
  "Multicrédito",
  "Link de Pagamento",
];

export const LINK_PAYMENT_SUBTYPES = ["Link - Crédito", "Link - Débito", "Link - Pix"];

export const isLinkPaymentMethod = (method) => normalizeText(method || "") === "link de pagamento";

export const PAYMENT_METHOD_OPTIONS_DELIVERY = [
  "Pix",
  "Dinheiro",
  "Cartão de Crédito",
  "Cartão de Débito",
];

export const isInstallmentPaymentMethod = (method) => {
  const canonical = normalizePaymentMethod(method);
  return INSTALLMENT_METHODS.has(canonical);
};

export const normalizePaymentMethod = (method) => {
  const normalized = normalizeText(method);
  return METHOD_ALIASES[normalized] || String(method || "").trim();
};

const createAttemptId = () => `ATT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

export const normalizePaymentItem = (payment, splitSequence = 1) => {
  const valor = Number(payment?.valor || 0);
  const parcelas = Math.max(1, Number(payment?.parcelas || 1));
  const formaPagamento = normalizePaymentMethod(payment?.forma_pagamento || payment?.forma || "");

  return {
    ...payment,
    forma_pagamento: formaPagamento,
    valor,
    parcelas,
    split_sequence: Number(payment?.split_sequence || splitSequence),
    attempt_id: payment?.attempt_id || createAttemptId(),
    gateway_provider: payment?.gateway_provider || "manual",
    status_pagamento_item: payment?.status_pagamento_item || "iniciado",
  };
};

export const normalizePaymentSplit = (payments = []) =>
  payments.map((payment, index) => normalizePaymentItem(payment, index + 1));

export const validatePaymentSplit = ({ total, payments = [] }) => {
  const normalized = normalizePaymentSplit(payments);
  const errors = [];

  for (const payment of normalized) {
    if (!payment.forma_pagamento) {
      errors.push("Existe pagamento sem forma de pagamento definida.");
    }
    if (!Number.isFinite(payment.valor) || payment.valor <= 0) {
      errors.push(`Pagamento ${payment.split_sequence} possui valor invalido.`);
    }
    if (isInstallmentPaymentMethod(payment.forma_pagamento) && payment.parcelas < 1) {
      errors.push(`Pagamento ${payment.split_sequence} possui parcelamento invalido.`);
    }
  }

  const totalPago = normalized.reduce((sum, current) => sum + Number(current.valor || 0), 0);
  const restante = Math.max(0, Number(total || 0) - totalPago);

  if (totalPago - Number(total || 0) > EPSILON) {
    errors.push("Soma dos pagamentos excede o total da venda.");
  }

  return {
    ok: errors.length === 0,
    errors,
    pagamentos: normalized,
    totalPago,
    restante,
  };
};
