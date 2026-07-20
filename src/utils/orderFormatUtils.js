import { format } from "date-fns";
import { buildProductDisplayName, formatProductItemName } from "@/utils/productReference";

/**
 * Monta a linha de exibição de um item da OC no texto operacional.
 * Usa nome_completo_produto (que já vem consolidado com Ref, Medidas e Material).
 * Inclui cor específica do item (cor_item) para precisão máxima.
 * Garante que o fornecedor saiba EXATAMENTE qual item é.
 * @param {Object} item
 * @param {number} index
 * @returns {string}
 */
export function formatarLinhaItemOc(item, index) {
  const nome = formatProductItemName(item);
  const cor = item.cor_item || item.cor || null;
  const qtd = Number(item.quantidade_pedida || 0);
  const qtdFormatada = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(qtd) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(qtd);

  const partes = [nome];
  if (cor) partes.push(cor);

  const precoCusto = Number(item.preco_custo_item || 0);

  return `${index + 1}. ${partes.join(' - ')},  Qtd: ${qtdFormatada}, Custo: R$ ${precoCusto.toFixed(2)}`;
}

/**
 * Monta o bloco de informações de assistência de um item, quando aplicável.
 * @param {Object} item
 * @returns {string|null} Bloco formatado ou null quando tipo for ordem comum.
 */
export function formatarBlocoAssistenciaItem(item) {
  if (!item.tipo_item_oc || item.tipo_item_oc === 'ORDEM_COMUM_ENCOMENDA') return null;

  const linhas = [];
  linhas.push(`Assistência do Ped. ${item.pedido_origem_numero || 'N/I'}`);
  linhas.push(`É reposição pela fábrica? ${item.reposicao_fabrica ? 'SIM' : 'NÃO'}`);
  if (item.motivo_assistencia) {
    linhas.push(`Motivo da assistência: ${item.motivo_assistencia}`);
  }
  linhas.push(`Imagens e Vídeos? ${item.possui_imagens_videos ? 'Sim' : 'Não'}`);
  if (item.anexos_item && item.anexos_item.length > 0) {
    const nomes = item.anexos_item.map(a => a.nome || a.url || 'anexo').join(', ');
    linhas.push(`Anexo: ${nomes}`);
  }
  return linhas.join('\n');
}

/**
 * Gera o texto operacional do pedido para cópia/envio ao fornecedor.
 * Formato profissional com saudação, dados completos da OC e assinatura.
 * @param {Object} oc  - Objeto OC com fornecedor_nome, numero_pedido, created_at/data_pedido, metadata
 * @param {Array}  itens - Array de itens da OC
 * @param {Object} user - Usuário logado { nome, nome_usuario, id, ... }
 * @param {string} lojaName - Nome da loja/empresa (vem das configurações, nunca deixar vazio)
 * @returns {string}
 */
export function gerarTextoPedidoOperacional(oc, itens = [], user = {}, lojaName = '') {
  const rawDate = oc.created_at || oc.data_pedido;
  const dataFormatada = rawDate
    ? new Date(rawDate.includes('T') ? rawDate : rawDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  const metadata = oc.metadata || {};
  const vendedorNome = metadata.vendedor_nome || user.nome || user.nome_usuario || 'Não informado';
  const ocNumero = oc.numero_pedido || 'Sem número';
  const refPedido = metadata.pedido_origem_numero || metadata.origem || '';
  const marca = metadata.marca || 'N/I';

  const linhas = [];

  // Cabeçalho com nome da loja (sempre validado pelas chamadas de componentes)
  const nomeEmpresa = lojaName || 'Empresa';
  linhas.push(`Segue encomenda da loja *${nomeEmpresa}*:\n`);

  // Linha do pedido OC com referências
  let linhaOc = `Pedido OC-${ocNumero}`;
  if (refPedido) {
    linhaOc += `, (ref. ao pedido ${refPedido})`;
  }
  linhaOc += `, vend. ${vendedorNome} - ${marca}`;
  linhas.push(linhaOc);
  linhas.push('');

  // Produtos
  linhas.push('Produto:');
  linhas.push('');

  if (itens.length > 0) {
    itens.forEach((item, index) => {
      linhas.push(`- ${formatarLinhaItemOc(item, index)}`);
    });
  } else {
    linhas.push('(Sem itens cadastrados)');
  }

  linhas.push('');
  linhas.push('POR GENTILEZA, ENVIAR CÓPIA DO PEDIDO');
  linhas.push('');
  linhas.push('ATENCIOSAMENTE,');
  linhas.push('');
  linhas.push(vendedorNome);
  linhas.push('Departamento de Compras');
  linhas.push(nomeEmpresa);

  return linhas.join('\n');
}

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
    const parseDateSafe = (d) => {
        if (!d) return null;
        if (typeof d === 'string') {
            return new Date(d.includes('T') ? d : d + 'T12:00:00');
        }
        return new Date(d);
    };
    const dataFormatada = pedidoData.data_pedido
        ? format(parseDateSafe(pedidoData.data_pedido), 'dd/MM/yyyy')
        : 'Não informada';
    const previsaoFormatada = pedidoData.data_previsao_entrega
        ? format(parseDateSafe(pedidoData.data_previsao_entrega), 'dd/MM/yyyy')
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
      texto += `${index + 1}. ${buildProductDisplayName(item.produto_nome, item.modelo_referencia)}\n`;
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

    texto += `\n---\n_Gestão de Compras_`;

    return texto;
}
