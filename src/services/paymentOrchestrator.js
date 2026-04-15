const EPSILON = 0.01;

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const METHOD_ALIASES = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  "cartao de credito": "Cartão de Crédito",
  debito: "Débito",
  "cartao de debito": "Cartão de Débito",
  pix: "Pix",
  afesp: "AFESP",
  multicredito: "Multicrédito",
};

const INSTALLMENT_METHODS = new Set(["Crédito", "Cartão de Crédito", "Multicrédito", "AFESP"]);

export const PAYMENT_METHOD_OPTIONS = [
  "Dinheiro",
  "Crédito",
  "Débito",
  "Pix",
  "AFESP",
  "Multicrédito",
];

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
