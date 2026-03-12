/**
 * Utilitários de cálculo para o Dashboard BI
 */
import { formatarMoeda as formatMoedaOriginal } from './formatters';

export const formatarMoeda = formatMoedaOriginal;

/**
 * Formata um valor decimal em porcentagem (ex: 0.15 -> 15.0%)
 */
export function formatarPct(valor, decimais = 1) {
    if (valor === null || valor === undefined || isNaN(valor)) return '0,0%';
    const pct = valor * 100;
    return pct.toLocaleString('pt-BR', {
        minimumFractionDigits: decimais,
        maximumFractionDigits: decimais
    }) + '%';
}

/**
 * Filtra dados por um período pré-definido (hoje, semana, mes, ano)
 */
export function filtrarPorPeriodo(dataRef, periodo = 'mes') {
    if (!dataRef) return false;

    const data = new Date(dataRef);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataInicio = new Date(hoje);

    switch (periodo) {
        case 'hoje':
            dataInicio.setHours(0, 0, 0, 0);
            break;
        case 'semana':
            dataInicio.setDate(hoje.getDate() - 7);
            break;
        case 'mes':
            dataInicio.setMonth(hoje.getMonth() - 1);
            break;
        case 'ano':
            dataInicio.setFullYear(hoje.getFullYear() - 1);
            break;
        default:
            return true;
    }

    return data >= dataInicio;
}

/**
 * Calcula os principais KPIs de Vendas
 */
export function calcularKPIsVendas(vendas, lancamentos, filtroFn) {
    const faturamento = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);
    const qtdVendas = vendas.length;
    const ticketMedio = qtdVendas > 0 ? faturamento / qtdVendas : 0;

    const receitas = lancamentos
        .filter(l => l.tipo === 'receita' && filtroFn(l.data_lancamento))
        .reduce((acc, l) => acc + (l.valor || 0), 0);

    const despesas = lancamentos
        .filter(l => l.tipo === 'despesa' && filtroFn(l.data_lancamento))
        .reduce((acc, l) => acc + (l.valor || 0), 0);

    const lucro = receitas - despesas;

    return {
        faturamento,
        qtdVendas,
        ticketMedio,
        receitas,
        despesas,
        lucro
    };
}

/**
 * Calcula a taxa de conversão (Vendas / Orçamentos)
 */
export function calcularTaxaConversao(orcamentos, vendas) {
    if (!orcamentos || orcamentos.length === 0) return 0;
    return vendas.length / orcamentos.length;
}

/**
 * Agrupa faturamento por canal de venda
 */
export function agruparPorCanal(vendas) {
    const grupos = vendas.reduce((acc, v) => {
        const canal = v.canal_venda || 'Loja Física';
        acc[canal] = (acc[canal] || 0) + (v.valor_total || 0);
        return acc;
    }, {});

    return Object.entries(grupos)
        .map(([canal, total]) => ({ canal, total }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Calcula KPIs de Estoque
 */
export function calcularKPIsEstoque(produtos, vendas) {
    const valorEstoque = produtos.reduce((acc, p) => {
        const qtd = (p.quantidade_estoque || 0);
        const custo = (p.preco_custo || 0);
        return acc + (qtd * custo);
    }, 0);

    const cmv = vendas.reduce((acc, v) => {
        // Se a venda tem itens com preco_custo, somamos
        const custoItens = (v.itens || []).reduce((sum, item) => sum + (item.preco_custo || 0) * (item.quantidade || 0), 0);
        return acc + custoItens;
    }, 0);

    const faturamentoVendas = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);
    const margemBruta = faturamentoVendas - cmv;

    // Giro de Estoque (simplificado: CMV / Valor Estoque)
    const giroEstoque = valorEstoque > 0 ? cmv / valorEstoque : 0;

    // GMROI (Margem Bruta / Valor Estoque)
    const gmroi = valorEstoque > 0 ? margemBruta / valorEstoque : 0;

    const produtosAbaixoMinimo = produtos.filter(p =>
        (p.quantidade_estoque || 0) < (p.estoque_minimo || 0)
    );

    const porCategoria = produtos.reduce((acc, p) => {
        const cat = p.categoria || 'Sem Categoria';
        const valor = (p.quantidade_estoque || 0) * (p.preco_custo || 0);
        const grupo = acc.find(g => g.categoria === cat);
        if (grupo) {
            grupo.valor += valor;
        } else {
            acc.push({ categoria: cat, valor });
        }
        return acc;
    }, []);

    // Idade média real baseada em created_at dos produtos com estoque > 0
    const hoje = new Date();
    const produtosComEstoque = produtos.filter(p => (p.quantidade_estoque || 0) > 1 && p.created_at);
    const idadeMediaEstoque = produtosComEstoque.length > 0
        ? Math.round(produtosComEstoque.reduce((acc, p) => {
            const criacao = new Date(p.created_at);
            const diffDias = Math.max(0, Math.floor((hoje - criacao) / (1000 * 60 * 60 * 24)));
            return acc + diffDias;
        }, 0) / produtosComEstoque.length)
        : 0;

    return {
        valorEstoque,
        margemBruta,
        giroEstoque,
        gmroi,
        idadeMediaEstoque,
        produtosAbaixoMinimo,
        porCategoria: porCategoria.sort((a, b) => b.valor - a.valor).slice(0, 10)
    };
}

/**
 * Calcula KPIs de Logística
 */
export function calcularKPIsLogistica(entregas, vendas) {
    const totalEntregas = entregas.length;
    const entregasConcluidas = entregas.filter(e => e.status === 'Entregue').length;
    const entregasPendentes = entregas.filter(e => e.status !== 'Entregue' && e.status !== 'Cancelada').length;

    // Taxa de pontualidade
    const entregasComData = entregas.filter(e => e.data_agendada && e.data_realizada);
    const pontuais = entregasComData.filter(e => e.data_realizada <= e.data_agendada).length;
    const taxaPontualidade = entregasComData.length > 0 ? pontuais / entregasComData.length : 1;

    // Índice de Avarias
    const avarias = entregas.filter(e => e.tem_avaria || e.status_avaria === 'com_avaria').length;
    const indiceAvarias = totalEntregas > 0 ? avarias / totalEntregas : 0;

    // Frete sobre receita
    const totalFrete = vendas.reduce((acc, v) => acc + (v.valor_frete || 0), 0);
    const totalReceita = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);
    const freteSobreReceita = totalReceita > 0 ? totalFrete / totalReceita : 0;

    const porStatus = entregas.reduce((acc, e) => {
        const status = e.status || 'Pendente';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    // Lead Time Médio real: dias entre created_at da entrega e data_realizada
    const entregasRealizadas = entregas.filter(e => e.created_at && e.data_realizada);
    let leadTimeMedio = 'N/A';
    if (entregasRealizadas.length > 0) {
        const somaLeadTime = entregasRealizadas.reduce((acc, e) => {
            const criacao = new Date(e.created_at);
            const realizada = new Date(e.data_realizada);
            const diffDias = Math.max(0, Math.floor((realizada - criacao) / (1000 * 60 * 60 * 24)));
            return acc + diffDias;
        }, 0);
        leadTimeMedio = Math.round(somaLeadTime / entregasRealizadas.length);
    }

    return {
        totalEntregas,
        entregasConcluidas,
        entregasPendentes,
        leadTimeMedio,
        taxaPontualidade,
        indiceAvarias,
        freteSobreReceita,
        porStatus: Object.entries(porStatus).map(([name, value]) => ({ name, value }))
    };
}

/**
 * Calcula KPIs de Clientes
 */
export function calcularKPIsClientes(clientes, vendas, npsAvaliacoes, filtroFn) {
    const totalClientes = clientes.length;
    const novosClientes = clientes.filter(c => filtroFn(c.created_at)).length;

    // NPS
    const avaliacoesPeriodo = (npsAvaliacoes || []).filter(n => filtroFn(n.created_at));
    const totalNps = avaliacoesPeriodo.length;
    let promotores = 0;
    let passivos = 0;
    let detratores = 0;

    let somaAtendimento = 0, somaEntrega = 0, somaQualidade = 0;

    avaliacoesPeriodo.forEach(a => {
        const nota = a.nota_geral || 0;
        if (nota >= 9) promotores++;
        else if (nota >= 7) passivos++;
        else detratores++;

        somaAtendimento += a.nota_atendimento || nota;
        somaEntrega += a.nota_entrega || nota;
        somaQualidade += a.nota_qualidade || nota;
    });

    const npsScore = totalNps > 0 ? ((promotores - detratores) / totalNps) * 100 : 0;
    const mediaAtendimento = totalNps > 0 ? somaAtendimento / totalNps : 0;
    const mediaEntrega = totalNps > 0 ? somaEntrega / totalNps : 0;
    const mediaQualidade = totalNps > 0 ? somaQualidade / totalNps : 0;

    // LTV Médio (Receita total das vendas / total de clientes na base)
    const faturamentoTotal = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);
    const ltvMedio = totalClientes > 0 ? faturamentoTotal / totalClientes : 0;

    // Top Clientes
    const clientesMap = vendas.reduce((acc, v) => {
        const cId = v.cliente_id;
        const cNome = v.cliente_nome || 'Cliente não identificado';
        if (!cId) return acc;
        if (!acc[cId]) acc[cId] = { nome: cNome, total: 0, compras: 0 };
        acc[cId].total += (v.valor_total || 0);
        acc[cId].compras += 1;
        return acc;
    }, {});

    const topClientes = Object.values(clientesMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    // Taxa de Recompra: % de clientes que fizeram mais de 1 compra
    const clientesUnicos = Object.keys(clientesMap).length;
    const clientesRecompra = Object.values(clientesMap).filter(c => c.compras > 1).length;
    const taxaRecompra = clientesUnicos > 0 ? clientesRecompra / clientesUnicos : 0;

    return {
        totalClientes,
        novosClientes,
        totalNps,
        detratores,
        promotores,
        passivos,
        npsScore,
        mediaAtendimento,
        mediaEntrega,
        mediaQualidade,
        ltvMedio,
        taxaRecompra,
        topClientes
    };
}

/**
 * Calcula Rankings (Vendedores e Produtos)
 */
export function calcularRankings(vendas, users) {
    // Vendedores
    const rankingVendedores = vendas.reduce((acc, v) => {
        const vId = v.vendedor_id;
        const vNome = v.vendedor_nome || 'Sistema';
        if (!acc[vId]) acc[vId] = { nome: vNome, total: 0, qtd: 0 };
        acc[vId].total += (v.valor_total || 0);
        acc[vId].qtd += 1;
        return acc;
    }, {});

    const topVendedores = Object.values(rankingVendedores)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    // Produtos
    const rankingProdutos = vendas.reduce((acc, v) => {
        (v.itens || []).forEach(item => {
            const pId = item.produto_id;
            const pNome = item.produto_nome;
            if (!acc[pId]) acc[pId] = { nome: pNome, total: 0, qtd: 0 };
            acc[pId].total += (item.subtotal || 0);
            acc[pId].qtd += (item.quantidade || 0);
        });
        return acc;
    }, {});

    const topProdutos = Object.values(rankingProdutos)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    return {
        topVendedores,
        topProdutos
    };
}

/**
 * Agrupa vendas por dia para gráfico histórico
 */
export function agruparVendasPorDia(vendas) {
    const grupos = vendas.reduce((acc, v) => {
        const dia = v.data_venda?.split('T')[0];
        if (!dia) return acc;
        acc[dia] = (acc[dia] || 0) + (v.valor_total || 0);
        return acc;
    }, {});

    return Object.entries(grupos)
        .map(([dia, total]) => ({
            dia,
            diaFormatado: dia.split('-').reverse().slice(0, 2).join('/'),
            total
        }))
        .sort((a, b) => a.dia.localeCompare(b.dia));
}

/**
 * Agrupa faturamento por forma de pagamento
 */
export function agruparPorFormaPagamento(vendas, lancamentos) {
    const grupos = vendas.reduce((acc, v) => {
        const forma = v.forma_pagamento || 'Outros';
        acc[forma] = (acc[forma] || 0) + (v.valor_total || 0);
        return acc;
    }, {});

    return Object.entries(grupos)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
}
