/**
 * Exportador para SPED EFD Contribuições
 * 
 * Gera arquivo TXT no layout SPED para envio à Receita Federal
 * 
 * IMPORTANTE: Este é um exportador simplificado.
 * Para uso em produção, validar com contador os requisitos específicos.
 */

// Formatar data para SPED: DDMMAAAA
const formatarDataSPED = (data) => {
    if (!data) return '';
    const d = new Date(data);
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}${mes}${ano}`;
};

// Formatar valor para SPED: sem pontos, vírgula como decimal
const formatarValorSPED = (valor) => {
    if (!valor) return '0,00';
    return Number(valor).toFixed(2).replace('.', ',');
};

// Limpar texto para SPED (sem caracteres especiais)
const limparTexto = (texto, tamanho = 60) => {
    if (!texto) return '';
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-zA-Z0-9 ]/g, '') // Remove caracteres especiais
        .substring(0, tamanho)
        .toUpperCase();
};

/**
 * Gera arquivo SPED EFD Contribuições simplificado
 * @param {Object} dados - Dados para exportação
 * @param {Object} empresa - Dados da empresa
 * @param {string} periodo - Período no formato MMAAAA
 */
export function gerarSPEDContribuicoes(dados, empresa, periodo) {
    const { vendas = [], lancamentos = [] } = dados;
    const linhas = [];
    let contadorLinhas = 0;

    // ===== BLOCO 0 - ABERTURA =====

    // Registro 0000 - Abertura do Arquivo Digital
    contadorLinhas++;
    linhas.push([
        '|0000',
        '015', // Código da versão do leiaute
        '0', // Tipo de escrituração: 0=Original
        periodo.substring(0, 2) + periodo.substring(2), // Período
        formatarDataSPED(new Date(periodo.substring(2), parseInt(periodo.substring(0, 2)) - 1, 1)),
        formatarDataSPED(new Date(periodo.substring(2), parseInt(periodo.substring(0, 2)), 0)),
        limparTexto(empresa.razao_social || 'EMPRESA'),
        (empresa.cnpj || '').replace(/\D/g, ''),
        empresa.uf || 'SP',
        (empresa.codigo_municipio || '').toString(),
        '', // SUFRAMA
        '1', // Indicador natureza PJ: 1=Lucro Presumido
        '2', // Indicador atividade: 2=Industrial ou equiparado
        ''
    ].join('|') + '|');

    // Registro 0001 - Abertura Bloco 0
    contadorLinhas++;
    linhas.push('|0001|0|');

    // Registro 0100 - Dados do Contabilista
    contadorLinhas++;
    linhas.push([
        '|0100',
        limparTexto(empresa.contador_nome || 'CONTADOR'),
        (empresa.contador_cpf || '').replace(/\D/g, ''),
        empresa.contador_crc || '',
        (empresa.contador_cnpj || '').replace(/\D/g, ''),
        (empresa.contador_cep || '').replace(/\D/g, ''),
        limparTexto(empresa.contador_endereco || ''),
        empresa.contador_numero || '',
        '',
        limparTexto(empresa.contador_bairro || ''),
        empresa.contador_telefone || '',
        empresa.contador_email || ''
    ].join('|') + '|');

    // Registro 0990 - Encerramento Bloco 0
    contadorLinhas++;
    linhas.push(`|0990|${contadorLinhas}|`);
    contadorLinhas = 0;

    // ===== BLOCO A - DOCUMENTOS FISCAIS (SERVIÇOS) =====

    contadorLinhas++;
    linhas.push('|A001|1|'); // 1 = sem dados

    contadorLinhas++;
    linhas.push(`|A990|${contadorLinhas}|`);
    contadorLinhas = 0;

    // ===== BLOCO C - DOCUMENTOS FISCAIS (MERCADORIAS) =====

    contadorLinhas++;
    linhas.push('|C001|0|'); // 0 = com dados

    // Registro C010 - Identificação do Estabelecimento
    contadorLinhas++;
    linhas.push([
        '|C010',
        (empresa.cnpj || '').replace(/\D/g, ''),
        '1' // Indicador escrituração: 1=Consolidada
    ].join('|') + '|');

    // Registro C100 - Documento NF
    vendas.filter(v => v.numero_nfe).forEach(venda => {
        contadorLinhas++;
        linhas.push([
            '|C100',
            '1', // IND_OPER: 1=Saída
            '1', // IND_EMIT: 1=Próprio
            (empresa.cnpj || '').replace(/\D/g, ''),
            '55', // Modelo: NF-e
            '00', // Situação: Regular
            venda.serie_nfe || '1',
            venda.numero_nfe || '',
            venda.chave_nfe || '',
            formatarDataSPED(venda.data_venda),
            formatarDataSPED(venda.data_venda),
            formatarValorSPED(venda.valor_total),
            '0', // IND_PGTO
            formatarValorSPED(venda.desconto || 0),
            formatarValorSPED(0), // Abatimento
            formatarValorSPED(venda.valor_total),
            formatarValorSPED(0), // Frete
            formatarValorSPED(0), // Seguro
            formatarValorSPED(0), // Outras despesas
            formatarValorSPED(venda.valor_total), // Base ICMS
            formatarValorSPED(0), // ICMS
            formatarValorSPED(venda.valor_total), // Base ICMS ST
            formatarValorSPED(0), // ICMS ST
            formatarValorSPED(0), // IPI
            formatarValorSPED(venda.valor_total * 0.0065), // PIS
            formatarValorSPED(venda.valor_total * 0.03), // COFINS
            formatarValorSPED(venda.valor_total * 0.0925) // PIS+COFINS
        ].join('|') + '|');
    });

    contadorLinhas++;
    linhas.push(`|C990|${contadorLinhas}|`);
    contadorLinhas = 0;

    // ===== BLOCO D - SERVIÇOS (TRANSPORTE) =====

    contadorLinhas++;
    linhas.push('|D001|1|');

    contadorLinhas++;
    linhas.push(`|D990|${contadorLinhas}|`);
    contadorLinhas = 0;

    // ===== BLOCO F - DEMAIS DOCUMENTOS =====

    contadorLinhas++;
    linhas.push('|F001|1|');

    contadorLinhas++;
    linhas.push(`|F990|${contadorLinhas}|`);
    contadorLinhas = 0;

    // ===== BLOCO M - APURAÇÃO PIS/COFINS =====

    contadorLinhas++;
    linhas.push('|M001|0|');

    // Totais do período
    const totalVendas = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const pisPeriodo = totalVendas * 0.0065;
    const cofinsPeriodo = totalVendas * 0.03;

    // M100 - Crédito de PIS
    contadorLinhas++;
    linhas.push([
        '|M100',
        '01', // Código natureza base de cálculo
        formatarValorSPED(0), // Valor aquisições
        formatarValorSPED(totalVendas),
        formatarValorSPED(totalVendas),
        '0,65', // Alíquota PIS
        formatarValorSPED(pisPeriodo),
        '01' // Código tipo crédito
    ].join('|') + '|');

    // M500 - Crédito de COFINS
    contadorLinhas++;
    linhas.push([
        '|M500',
        '01',
        formatarValorSPED(0),
        formatarValorSPED(totalVendas),
        formatarValorSPED(totalVendas),
        '3,00',
        formatarValorSPED(cofinsPeriodo),
        '01'
    ].join('|') + '|');

    contadorLinhas++;
    linhas.push(`|M990|${contadorLinhas}|`);
    contadorLinhas = 0;

    // ===== BLOCO 1 - COMPLEMENTOS =====

    contadorLinhas++;
    linhas.push('|1001|1|');

    contadorLinhas++;
    linhas.push(`|1990|${contadorLinhas}|`);
    contadorLinhas = 0;

    // ===== BLOCO 9 - CONTROLE E ENCERRAMENTO =====

    contadorLinhas++;
    linhas.push('|9001|0|');

    // Registro 9900 - Totalizadores
    const blocos = ['0000', '0001', '0100', '0990', 'A001', 'A990', 'C001', 'C010', 'C100', 'C990', 'D001', 'D990', 'F001', 'F990', 'M001', 'M100', 'M500', 'M990', '1001', '1990', '9001', '9900', '9990', '9999'];
    blocos.forEach(bloco => {
        contadorLinhas++;
        const qtd = linhas.filter(l => l.startsWith(`|${bloco}`)).length;
        if (qtd > 0 || bloco === '9900' || bloco === '9990' || bloco === '9999') {
            linhas.push(`|9900|${bloco}|${qtd || 1}|`);
        }
    });

    contadorLinhas++;
    linhas.push(`|9990|${contadorLinhas}|`);

    // Registro 9999 - Encerramento do arquivo
    linhas.push(`|9999|${linhas.length + 1}|`);

    return linhas.join('\r\n');
}

/**
 * Gera arquivo simplificado para contador
 */
export function gerarResumoContador(dados, periodo) {
    const { vendas = [], lancamentos = [] } = dados;

    const receitas = lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'Cancelado');
    const despesas = lancamentos.filter(l => l.tipo === 'despesa' && l.status !== 'Cancelado');

    const totalReceitas = receitas.reduce((sum, l) => sum + Math.abs(l.valor || 0), 0);
    const totalDespesas = despesas.reduce((sum, l) => sum + Math.abs(l.valor || 0), 0);
    const totalVendas = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);

    return `
================================================================================
                    RESUMO CONTÁBIL - PERÍODO ${periodo}
================================================================================
Gerado em: ${new Date().toLocaleString('pt-BR')}

RESUMO GERAL
--------------------------------------------------------------------------------
Total de Vendas:                     R$ ${totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Total de Receitas Financeiras:       R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Total de Despesas:                   R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Resultado do Período:                R$ ${(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

VENDAS POR DIA
--------------------------------------------------------------------------------
${vendas.reduce((acc, v) => {
        const data = v.data_venda?.split('T')[0] || 'Sem data';
        if (!acc[data]) acc[data] = { qtd: 0, total: 0 };
        acc[data].qtd++;
        acc[data].total += v.valor_total || 0;
        return acc;
    }, {})
            ? Object.entries(vendas.reduce((acc, v) => {
                const data = v.data_venda?.split('T')[0] || 'Sem data';
                if (!acc[data]) acc[data] = { qtd: 0, total: 0 };
                acc[data].qtd++;
                acc[data].total += v.valor_total || 0;
                return acc;
            }, {})).map(([data, val]) => `${data}: ${val.qtd} vendas - R$ ${val.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')
            : 'Nenhuma venda no período'}

DESPESAS POR CATEGORIA
--------------------------------------------------------------------------------
${Object.entries(despesas.reduce((acc, l) => {
                const cat = l.categoria || 'Outros';
                if (!acc[cat]) acc[cat] = 0;
                acc[cat] += Math.abs(l.valor || 0);
                return acc;
            }, {})).map(([cat, val]) => `${cat}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n') || 'Nenhuma despesa'}

================================================================================
Este relatório é informativo. Consulte seu contador para obrigações fiscais.
================================================================================
`;
}

export function downloadTXT(conteudo, nomeArquivo) {
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export default {
    gerarSPEDContribuicoes,
    gerarResumoContador,
    downloadTXT
};
