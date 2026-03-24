import { format } from "date-fns";

/**
 * Generates a formatted, WhatsApp-ready text block for a purchase order.
 * @param {Object} pedidoData  - The order object, must include: numero_pedido, data_pedido,
 *                               fornecedor_id, fornecedor_nome, itens[], valor_total,
 *                               data_previsao_entrega, condicoes_pagamento, observacoes,
 *                               tipo_preco, promocao_observacao, economia_total, valor_frete, valor_desconto
 * @param {Array}  fornecedores - The full list of supplier objects for phone/email lookup.
 * @returns {string}
 */
export function gerarTextoPedido(pedidoData, fornecedores = []) {
    const fornecedor = fornecedores.find(f => f.id === pedidoData.fornecedor_id);
    const dataFormatada = pedidoData.data_pedido
        ? format(new Date(pedidoData.data_pedido), 'dd/MM/yyyy')
        : 'Não informada';
    const previsaoFormatada = pedidoData.data_previsao_entrega
        ? format(new Date(pedidoData.data_previsao_entrega), 'dd/MM/yyyy')
        : 'A combinar';

    let texto = `*PEDIDO DE COMPRA*\n`;
    texto += `Nº: ${pedidoData.numero_pedido || 'Novo'}\n`;
    texto += `Data: ${dataFormatada}\n\n`;

    texto += `*FORNECEDOR:*\n`;
    texto += `${pedidoData.fornecedor_nome || fornecedor?.nome_empresa || 'Desconhecido'}\n`;
    if (fornecedor?.telefone) texto += `Tel: ${fornecedor.telefone}\n`;
    if (fornecedor?.email) texto += `Email: ${fornecedor.email}\n`;
    texto += `\n`;

    texto += `*ITENS DO PEDIDO:*\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    (pedidoData.itens || []).forEach((item, index) => {
        const total = (item.quantidade_pedida || 0) * (item.preco_unitario || 0);
        texto += `${index + 1}. ${item.produto_nome}\n`;
        texto += `   Qtd: ${item.quantidade_pedida} | R$ ${(item.preco_unitario || 0).toFixed(2)} = R$ ${total.toFixed(2)}\n`;
    });

    texto += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (pedidoData.valor_frete > 0) {
        texto += `Frete: R$ ${pedidoData.valor_frete.toFixed(2)}\n`;
    }
    if (pedidoData.valor_desconto > 0) {
        texto += `Desconto: R$ ${pedidoData.valor_desconto.toFixed(2)}\n`;
    }

    texto += `*TOTAL: R$ ${(pedidoData.valor_total || 0).toFixed(2)}*\n\n`;

    if (pedidoData.tipo_preco === 'promocional') {
        texto += `🏷️ *Preço Promocional*\n`;
        if (pedidoData.promocao_observacao) texto += `   ${pedidoData.promocao_observacao}\n`;
        texto += `   Economia: R$ ${(pedidoData.economia_total || 0).toFixed(2)}\n\n`;
    }

    texto += `*Previsão de Entrega:* ${previsaoFormatada}\n`;
    if (pedidoData.condicoes_pagamento) {
        texto += `*Pagamento:* ${pedidoData.condicoes_pagamento}\n`;
    }

    if (pedidoData.observacoes) {
        texto += `\n*Observações:*\n${pedidoData.observacoes}\n`;
    }

    texto += `\n---\n_Móveis Pedro II - Gestão de Compras_`;

    return texto;
}
