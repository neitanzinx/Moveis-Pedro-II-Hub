import { supabase, base44 } from "@/api/base44Client";
import { validatePaymentSplit } from "@/services/paymentOrchestrator";

export const MONEY_EPSILON = 0.01;

export function toMoneyNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
        const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value) {
    return toMoneyNumber(value).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function needsDeliveryPaymentConfirmation(entrega) {
    return Boolean(entrega?.pagamento_na_entrega || toMoneyNumber(entrega?.valor_a_receber) > MONEY_EPSILON);
}

function buildPartialPaymentNote(valorRecebido, saldoRestante) {
    return `Pagamento parcial recebido na entrega: R$ ${formatMoney(valorRecebido)}. Saldo restante: R$ ${formatMoney(saldoRestante)}.`;
}

async function updateVendaSafely(vendaId, vendaUpdates) {
    const { error } = await supabase
        .from("vendas")
        .update(vendaUpdates)
        .eq("id", vendaId);

    if (!error) return;

    const columnError = String(error?.message || "").toLowerCase();
    const fallbackRequired = columnError.includes("status_pagamento") || columnError.includes("data_pagamento");

    if (!fallbackRequired) {
        throw error;
    }

    const { status_pagamento, data_pagamento, ...legacyVendaUpdates } = vendaUpdates;
    const { error: fallbackError } = await supabase
        .from("vendas")
        .update(legacyVendaUpdates)
        .eq("id", vendaId);

    if (fallbackError) {
        throw fallbackError;
    }
}

async function syncReceitaLancamentos(vendaId, paymentDateIso, pagamentoQuitado, formaPagamento) {
    if (!vendaId || !pagamentoQuitado) return;

    const { data: lancamentosVenda, error } = await supabase
        .from("lancamentos_financeiros")
        .select("*")
        .eq("venda_id", vendaId)
        .eq("tipo", "receita")
        .eq("status", "Pendente");

    if (error) throw error;

    for (const lancamento of lancamentosVenda || []) {
        await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
            status: "Pago",
            pago: true,
            data_lancamento_real: paymentDateIso.split("T")[0],
            forma_pagamento: formaPagamento,
        });
    }
}

async function maybeCreateCardFee(entrega, valorRecebido, paymentDateIso, formaPagamento) {
    if (!entrega?.venda_id || valorRecebido <= MONEY_EPSILON) return;

    const formaPag = String(formaPagamento || entrega.forma_pagamento_entrega || entrega.forma_pagamento || "").trim();
    const formaNormalizada = formaPag.toLowerCase();
    const isCartao = formaNormalizada.includes("cartão") || formaNormalizada.includes("crédito") || formaNormalizada.includes("débito");

    if (!isCartao) return;

    const configTaxas = await base44.entities.ConfiguracaoTaxa.list();
    const isCreditoParcelado = formaNormalizada.includes("crédito") && !formaNormalizada.includes("1x") && /\d+x/i.test(formaPag);

    const taxa = configTaxas.find((item) => {
        if (isCreditoParcelado) return item.forma_pagamento === "Crédito Parcelado";

        let nomeBusca = formaNormalizada.replace("cartão de ", "");
        nomeBusca = nomeBusca.split("(")[0].trim();
        return (item.forma_pagamento || "").toLowerCase().includes(nomeBusca);
    });

    if (!taxa || toMoneyNumber(taxa.valor) <= 0) return;

    const valorTaxa = taxa.tipo_taxa === "porcentagem"
        ? (valorRecebido * toMoneyNumber(taxa.valor)) / 100
        : toMoneyNumber(taxa.valor);

    if (valorTaxa <= 0) return;

    await base44.entities.LancamentoFinanceiro.create({
        descricao: `Taxa ${formaPag} - Recebido na Entrega #${entrega.numero_pedido}`,
        valor: -valorTaxa,
        tipo: "despesa",
        data_vencimento: paymentDateIso.split("T")[0],
        data_lancamento: paymentDateIso.split("T")[0],
        pago: true,
        categoria_nome: "Taxas de Cartão",
        forma_pagamento: formaPag,
        status: "Pago",
        observacao: `${taxa.valor}${taxa.tipo_taxa === "porcentagem" ? "%" : " R$"} sobre R$ ${valorRecebido.toFixed(2)}`,
        venda_id: entrega.venda_id,
        numero_pedido: entrega.numero_pedido,
    });
}

export async function applyDeliveryPayment({
    entrega,
    pagamentoStatus,
    valorRecebido,
    formaPagamento,
    pagamentos,
    motivoPendente,
    comprovanteUrl = null,
    paymentDateIso = new Date().toISOString(),
}) {
    if (!entrega?.id) {
        throw new Error("Entrega inválida para registrar pagamento.");
    }

    const pagamentoInformado = pagamentoStatus === "pago";
    const pagamentosInformados = Array.isArray(pagamentos) ? pagamentos : [];
    const rawPayments = pagamentosInformados.length > 0
        ? pagamentosInformados
        : pagamentoInformado
            ? [{ forma_pagamento: formaPagamento, valor: valorRecebido, parcelas: 1 }]
            : [];

    if (pagamentoInformado) {
        const totalAlvo = Math.max(
            toMoneyNumber(entrega?.valor_a_receber),
            rawPayments.reduce((sum, payment) => sum + toMoneyNumber(payment?.valor), 0)
        );
        const initialValidation = validatePaymentSplit({
            total: totalAlvo,
            payments: rawPayments.map((payment) => ({
                ...payment,
                valor: toMoneyNumber(payment?.valor),
                parcelas: Number(payment?.parcelas || 1),
            })),
        });

        if (!initialValidation.ok) {
            throw new Error(initialValidation.errors[0] || "Não foi possível validar os pagamentos informados.");
        }
    }

    const entregaUpdates = {
        pagamento_confirmado: false,
        pagamento_pendente_motivo: pagamentoInformado ? null : (motivoPendente || "Pagamento não realizado na entrega"),
        data_pagamento_confirmado: paymentDateIso,
    };

    if (comprovanteUrl) {
        entregaUpdates.comprovante_pagamento_url = comprovanteUrl;
    }

    let vendaUpdates = null;
    let pagamentoQuitado = false;
    let valorRecebidoNum = Math.max(toMoneyNumber(valorRecebido), 0);
    let formaPagamentoFinal = String(
        formaPagamento || entrega?.forma_pagamento_entrega || entrega?.forma_pagamento || ""
    ).trim();
    let pagamentosNormalizados = [];

    if (entrega.venda_id) {
        const { data: vendaAtual, error: vendaError } = await supabase
            .from("vendas")
            .select("valor_total, valor_pago, valor_restante, pagamentos")
            .eq("id", entrega.venda_id)
            .single();

        if (vendaError) throw vendaError;

        const valorTotal = toMoneyNumber(vendaAtual?.valor_total);
        const valorPagoAtual = toMoneyNumber(vendaAtual?.valor_pago);
        const valorRestanteBase = vendaAtual?.valor_restante == null
            ? Math.max(valorTotal - valorPagoAtual, 0)
            : Math.max(toMoneyNumber(vendaAtual?.valor_restante), 0);

        if (pagamentoInformado && valorRecebidoNum > valorRestanteBase + MONEY_EPSILON) {
            throw new Error(`O valor recebido não pode ser maior que o saldo pendente de R$ ${formatMoney(valorRestanteBase)}.`);
        }

        if (pagamentoInformado) {
            const paymentsForSale = pagamentosInformados.length > 0
                ? pagamentosInformados
                : [{ forma_pagamento: formaPagamentoFinal, valor: valorRecebido, parcelas: 1 }];

            const paymentValidation = validatePaymentSplit({
                total: valorRestanteBase,
                payments: paymentsForSale.map((payment) => ({
                    ...payment,
                    valor: toMoneyNumber(payment?.valor),
                    parcelas: Number(payment?.parcelas || 1),
                })),
            });

            if (!paymentValidation.ok) {
                throw new Error(paymentValidation.errors[0] || "Não foi possível validar os pagamentos informados.");
            }

            pagamentosNormalizados = paymentValidation.pagamentos;
            valorRecebidoNum = paymentValidation.totalPago;
            formaPagamentoFinal = pagamentosNormalizados.length === 1
                ? pagamentosNormalizados[0].forma_pagamento
                : "Múltiplos";

            if (valorRecebidoNum <= MONEY_EPSILON) {
                throw new Error("Informe um valor recebido maior que zero.");
            }

            const novoValorRestante = Math.max(valorRestanteBase - valorRecebidoNum, 0);
            const novoValorPago = Math.min(valorTotal, valorPagoAtual + valorRecebidoNum);
            pagamentoQuitado = novoValorRestante <= MONEY_EPSILON;
            const pagamentosExistentes = Array.isArray(vendaAtual?.pagamentos) ? vendaAtual.pagamentos : [];

            const observacaoPagamento = pagamentoQuitado
                ? null
                : buildPartialPaymentNote(valorRecebidoNum, novoValorRestante);

            entregaUpdates.pagamento_confirmado = pagamentoQuitado;
            entregaUpdates.pagamento_pendente_motivo = observacaoPagamento;
            entregaUpdates.forma_pagamento_entrega = formaPagamentoFinal;

            vendaUpdates = {
                pagamento_entrega_confirmado: pagamentoQuitado,
                pagamento_entrega_observacao: observacaoPagamento,
                valor_pago: novoValorPago,
                valor_restante: novoValorRestante,
                forma_pagamento: formaPagamentoFinal,
                pagamentos: [...pagamentosExistentes, ...pagamentosNormalizados],
                status: pagamentoQuitado ? "Pago" : "Pagamento Pendente",
                status_pagamento: pagamentoQuitado ? "PAGO" : "PENDENTE",
                data_pagamento: paymentDateIso,
            };
        } else {
            vendaUpdates = {
                pagamento_entrega_confirmado: false,
                pagamento_entrega_observacao: motivoPendente || "Pagamento pendente na entrega",
                status: "Pagamento Pendente",
                status_pagamento: "PENDENTE",
            };
        }
    }

    const { error: entregaError } = await supabase
        .from("entregas")
        .update(entregaUpdates)
        .eq("id", entrega.id);

    if (entregaError) throw entregaError;

    if (entrega.venda_id && vendaUpdates) {
        await updateVendaSafely(entrega.venda_id, vendaUpdates);
    }

    if (pagamentoInformado) {
        await syncReceitaLancamentos(entrega.venda_id, paymentDateIso, pagamentoQuitado, formaPagamentoFinal);
        for (const pagamento of pagamentosNormalizados) {
            await maybeCreateCardFee(entrega, toMoneyNumber(pagamento.valor), paymentDateIso, pagamento.forma_pagamento);
        }
    }

    return {
        pagamentoQuitado,
        valorRecebido: valorRecebidoNum,
        pagamentos: pagamentosNormalizados,
        entregaUpdates,
        vendaUpdates,
    };
}