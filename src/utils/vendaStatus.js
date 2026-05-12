const MONEY_EPSILON = 0.01;

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

export function isStatusCancelado(status) {
    return normalizeText(status).startsWith('cancelad');
}

export function isVendaCancelada(vendaOuStatus) {
    const status = typeof vendaOuStatus === 'string'
        ? vendaOuStatus
        : vendaOuStatus?.status;

    return isStatusCancelado(status);
}

function toNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
        const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function sumPagamentos(pagamentos = []) {
    if (!Array.isArray(pagamentos)) return 0;

    return pagamentos.reduce((sum, pagamento) => {
        return sum + toNumber(pagamento?.valor);
    }, 0);
}

function getVendaEntregas(venda, entregas = []) {
    if (!venda) return [];

    return entregas.filter((entrega) => {
        if (venda.id && entrega.venda_id === venda.id) return true;
        if (venda.numero_pedido && entrega.numero_pedido === venda.numero_pedido) return true;
        return false;
    });
}

function getVendaMontagens(venda, montagens = []) {
    if (!venda) return [];

    return montagens.filter((montagem) => {
        if (venda.id && montagem.venda_id === venda.id) return true;
        if (venda.numero_pedido && montagem.numero_pedido === venda.numero_pedido) return true;
        return false;
    });
}

function getVendaLancamentos(venda, lancamentos = []) {
    if (!venda?.id) return [];
    return lancamentos.filter((lancamento) => lancamento.venda_id === venda.id);
}

function isLancamentoPago(lancamento) {
    const status = normalizeText(lancamento?.status);
    return lancamento?.pago === true || status === 'pago';
}

function isLancamentoReceita(lancamento) {
    return normalizeText(lancamento?.tipo) === 'receita';
}

export function getVendaFinanceiro(venda, { entregas = [], lancamentos = [] } = {}) {
    const legacyStatus = String(venda?.status || '').trim();
    const normalizedLegacyStatus = normalizeText(legacyStatus);

    if (isVendaCancelada(venda)) {
        return {
            total: toNumber(venda?.valor_total),
            valorPago: 0,
            valorRestante: 0,
            displayStatus: 'Cancelado',
            isPaid: false,
            isPending: false,
            isCancelled: true,
            hasComprovantePagamento: false,
            hasPagamentoEntregaConfirmado: false,
            source: 'legacy_status'
        };
    }

    const entregasRelacionadas = getVendaEntregas(venda, entregas);
    const lancamentosRelacionados = getVendaLancamentos(venda, lancamentos).filter(isLancamentoReceita);

    const total = toNumber(venda?.valor_total);
    const valorPagoInformado = toNumber(venda?.valor_pago);
    const valorPagoNosPagamentos = sumPagamentos(venda?.pagamentos);
    const valorPagoNosLancamentos = lancamentosRelacionados
        .filter(isLancamentoPago)
        .reduce((sum, lancamento) => sum + Math.abs(toNumber(lancamento?.valor)), 0);

    const valorPago = Math.max(valorPagoInformado, valorPagoNosPagamentos, valorPagoNosLancamentos);
    const valorRestanteInformado = venda?.valor_restante == null ? null : Math.max(toNumber(venda.valor_restante), 0);
    const valorRestanteCalculado = Math.max(total - valorPago, 0);
    const valorRestante = valorRestanteInformado == null ? valorRestanteCalculado : Math.min(valorRestanteInformado, valorRestanteCalculado);

    const hasComprovantePagamento = entregasRelacionadas.some((entrega) => Boolean(entrega?.comprovante_pagamento_url));
    const hasPagamentoEntregaConfirmado = Boolean(venda?.pagamento_entrega_confirmado) || entregasRelacionadas.some((entrega) => entrega?.pagamento_confirmado === true);
    const hasLancamentoPendente = lancamentosRelacionados.some((lancamento) => !isLancamentoPago(lancamento));
    const hasLegacyPaid = ['pago', 'pago & retirado', 'quitado'].includes(normalizedLegacyStatus);

    let isPaid = false;
    let source = 'pending';

    if (hasPagamentoEntregaConfirmado) {
        isPaid = true;
        source = 'delivery_confirmation';
    } else if (hasComprovantePagamento && !hasLancamentoPendente) {
        isPaid = true;
        source = 'payment_receipt';
    } else if (total <= MONEY_EPSILON) {
        isPaid = true;
        source = 'zero_total';
    } else if (valorRestante <= MONEY_EPSILON || valorPago + MONEY_EPSILON >= total) {
        isPaid = true;
        source = 'sale_totals';
    } else if (valorPagoNosLancamentos > 0 && !hasLancamentoPendente) {
        isPaid = true;
        source = 'financial_entries';
    } else if (hasLegacyPaid) {
        isPaid = true;
        source = 'legacy_status';
    }

    return {
        total,
        valorPago,
        valorRestante,
        displayStatus: isPaid ? 'Pago' : 'Pagamento Pendente',
        isPaid,
        isPending: !isPaid,
        isCancelled: false,
        hasComprovantePagamento,
        hasPagamentoEntregaConfirmado,
        source
    };
}

export function getItemEntregaLabel(item) {
    const tipoEntrega = normalizeText(item?.tipo_entrega);

    if (tipoEntrega === 'retira' || tipoEntrega === 'retirada') {
        return 'Retirada na loja';
    }

    if (tipoEntrega === 'entrega') {
        return 'Entrega';
    }

    return '-';
}

export function getItemMontagemLabel(item) {
    const tipoMontagem = normalizeText(item?.tipo_montagem);

    if (tipoMontagem === 'montado' || tipoMontagem === 'interna') {
        return 'Montagem interna';
    }

    if (tipoMontagem === 'montagem_cliente' || tipoMontagem === 'terceirizada' || tipoMontagem === 'montagem externa') {
        return 'Montagem externa';
    }

    if (tipoMontagem === 'sem_montagem') {
        return 'Sem montagem';
    }

    return '-';
}

export function getEntregaFotos(entrega) {
    const fotosDiretas = Array.isArray(entrega?.fotosEntrega) ? entrega.fotosEntrega : [];
    const fotos = fotosDiretas.length > 0
        ? fotosDiretas
        : (Array.isArray(entrega?.fotos_entrega) ? entrega.fotos_entrega : []);
    const fotosNormalizadas = fotos
        .map((foto, index) => {
            if (typeof foto === 'string') {
                return {
                    url: foto,
                    tipo: index === 0 ? 'Foto da entrega' : `Foto ${index + 1}`
                };
            }

            const fotoUrl = foto?.url || foto?.dataUrl || foto?.publicUrl || foto?.public_url || foto?.imagem_url;

            if (fotoUrl) {
                return {
                    url: fotoUrl,
                    tipo: foto.tipo || `Foto ${index + 1}`,
                    timestamp: foto.timestamp
                };
            }

            return null;
        })
        .filter(Boolean);

    if (fotosNormalizadas.length > 0) {
        return fotosNormalizadas;
    }

    if (entrega?.foto_entrega_url) {
        return [{ url: entrega.foto_entrega_url, tipo: 'Foto da entrega' }];
    }

    return [];
}

export function getVendaResumoLogistico(venda, { entregas = [], montagens = [] } = {}) {
    const itens = Array.isArray(venda?.itens) ? venda.itens : [];
    const entregasRelacionadas = getVendaEntregas(venda, entregas);
    const montagensRelacionadas = getVendaMontagens(venda, montagens);

    const itensDetalhados = itens.map((item) => ({
        ...item,
        entregaLabel: getItemEntregaLabel(item),
        montagemLabel: getItemMontagemLabel(item),
        resumoItem: `${item?.quantidade || 0}x ${item?.produto_nome || item?.nome || 'Item sem nome'}`
    }));

    const retiradaItens = itensDetalhados.filter((item) => ['retira', 'retirada'].includes(normalizeText(item?.tipo_entrega)));
    const entregaItens = itensDetalhados.filter((item) => normalizeText(item?.tipo_entrega) === 'entrega');
    const montagemInternaItens = entregaItens.filter((item) => ['montado', 'interna'].includes(normalizeText(item?.tipo_montagem)));
    const montagemExternaItens = entregaItens.filter((item) => ['montagem_cliente', 'terceirizada', 'montagem externa'].includes(normalizeText(item?.tipo_montagem)));
    const entregaSemMontagemItens = entregaItens.filter((item) => {
        const tipoMontagem = normalizeText(item?.tipo_montagem);
        return !tipoMontagem || tipoMontagem === 'sem_montagem';
    });

    const composicao = [];

    if (retiradaItens.length > 0) {
        composicao.push({ key: 'retirada', label: 'Retirada na loja', count: retiradaItens.length, tone: 'purple' });
    }
    if (entregaItens.length > 0) {
        composicao.push({ key: 'entrega', label: 'Entrega', count: entregaItens.length, tone: 'blue' });
    }
    if (montagemInternaItens.length > 0) {
        composicao.push({ key: 'montagem_interna', label: 'Montagem interna', count: montagemInternaItens.length, tone: 'orange' });
    }
    if (montagemExternaItens.length > 0) {
        composicao.push({ key: 'montagem_externa', label: 'Montagem externa', count: montagemExternaItens.length, tone: 'cyan' });
    }
    if (entregaSemMontagemItens.length > 0) {
        composicao.push({ key: 'sem_montagem', label: 'Sem montagem', count: entregaSemMontagemItens.length, tone: 'green' });
    }

    const entregaPrincipal = [...entregasRelacionadas].sort((a, b) => {
        const dataA = new Date(a?.data_realizada || a?.data_agendada || a?.created_date || 0).getTime();
        const dataB = new Date(b?.data_realizada || b?.data_agendada || b?.created_date || 0).getTime();
        return dataB - dataA;
    })[0] || null;

    const montagensConcluidas = montagensRelacionadas.length > 0 && montagensRelacionadas.every((montagem) => normalizeText(montagem?.status) === 'concluida');
    const isMisto = retiradaItens.length > 0 && entregaItens.length > 0;
    const allRetirada = retiradaItens.length > 0 && entregaItens.length === 0;
    const headline = allRetirada
        ? 'Retirada na loja'
        : isMisto
            ? 'Entrega + retirada'
            : entregaItens.length > 0
                ? 'Entrega'
                : '-';

    const gruposDetalhados = [];

    if (entregaItens.length > 0) {
        gruposDetalhados.push({
            key: 'entrega_detalhada',
            label: entregaPrincipal && normalizeText(entregaPrincipal.status) === 'entregue' ? 'Itens entregues' : 'Itens para entrega',
            tone: 'blue',
            items: entregaItens
        });
    }

    if (montagemInternaItens.length > 0) {
        gruposDetalhados.push({
            key: 'montagem_interna_detalhada',
            label: 'Itens de montagem interna',
            tone: 'orange',
            items: montagemInternaItens
        });
    }

    if (montagemExternaItens.length > 0) {
        gruposDetalhados.push({
            key: 'montagem_externa_detalhada',
            label: 'Itens de montagem externa',
            tone: 'cyan',
            items: montagemExternaItens
        });
    }

    if (retiradaItens.length > 0) {
        gruposDetalhados.push({
            key: 'retirada_detalhada',
            label: 'Itens de retirada na loja',
            tone: 'purple',
            items: retiradaItens
        });
    }

    return {
        headline,
        isMisto,
        allRetirada,
        entregaPrincipal,
        composicao,
        gruposDetalhados,
        contagens: {
            retirada: retiradaItens.length,
            entrega: entregaItens.length,
            montagemInterna: montagemInternaItens.length,
            montagemExterna: montagemExternaItens.length,
            semMontagem: entregaSemMontagemItens.length
        },
        montagensConcluidas,
        itensDetalhados
    };
}