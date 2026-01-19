/**
 * Exportador para formato Conta Azul
 * 
 * Gera arquivo CSV compatível com importação do Conta Azul
 */

// Formato de data do Conta Azul: DD/MM/YYYY
const formatarData = (data) => {
    if (!data) return '';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
};

// Formato de valor: vírgula como decimal
const formatarValor = (valor) => {
    if (!valor) return '0,00';
    return Number(valor).toFixed(2).replace('.', ',');
};

/**
 * Exporta lançamentos financeiros para formato Conta Azul
 * @param {Array} lancamentos - Lista de lançamentos financeiros
 * @param {Object} options - Opções de exportação
 * @returns {string} Conteúdo CSV
 */
export function exportarLancamentosContaAzul(lancamentos, options = {}) {
    const { incluirCancelados = false } = options;

    // Filtrar lançamentos
    const lancamentosFiltrados = lancamentos.filter(l =>
        incluirCancelados || l.status !== 'Cancelado'
    );

    // Cabeçalho CSV
    const header = [
        'Data',
        'Descrição',
        'Categoria',
        'Valor',
        'Tipo',
        'Status',
        'Centro de Custo',
        'Observação'
    ].join(';');

    // Linhas de dados
    const linhas = lancamentosFiltrados.map(l => {
        return [
            formatarData(l.data_lancamento),
            `"${(l.descricao || '').replace(/"/g, '""')}"`,
            l.categoria || 'Outros',
            formatarValor(l.tipo === 'despesa' ? -Math.abs(l.valor) : Math.abs(l.valor)),
            l.tipo === 'receita' ? 'Receita' : 'Despesa',
            l.status || 'Pendente',
            l.loja || 'Principal',
            `"${(l.observacao || '').replace(/"/g, '""')}"`
        ].join(';');
    });

    return [header, ...linhas].join('\n');
}

/**
 * Exporta vendas para formato Conta Azul
 */
export function exportarVendasContaAzul(vendas, options = {}) {
    const header = [
        'Data',
        'Nº Pedido',
        'Cliente',
        'CPF/CNPJ',
        'Valor Total',
        'Forma Pagamento',
        'Status',
        'Vendedor'
    ].join(';');

    const linhas = vendas.map(v => {
        return [
            formatarData(v.data_venda),
            v.numero_pedido || '',
            `"${(v.cliente_nome || '').replace(/"/g, '""')}"`,
            v.cliente_cpf || v.cliente_cnpj || '',
            formatarValor(v.valor_total),
            v.forma_pagamento || 'Não informado',
            v.status || 'Concluída',
            v.vendedor_nome || ''
        ].join(';');
    });

    return [header, ...linhas].join('\n');
}

/**
 * Exporta clientes para formato Conta Azul
 */
export function exportarClientesContaAzul(clientes) {
    const header = [
        'Nome/Razão Social',
        'CPF/CNPJ',
        'Email',
        'Telefone',
        'Endereço',
        'Cidade',
        'Estado',
        'CEP'
    ].join(';');

    const linhas = clientes.map(c => {
        return [
            `"${(c.nome_completo || c.razao_social || '').replace(/"/g, '""')}"`,
            c.cpf || c.cnpj || '',
            c.email || '',
            c.telefone || '',
            `"${(c.endereco || '').replace(/"/g, '""')}"`,
            c.cidade || '',
            c.estado || '',
            c.cep || ''
        ].join(';');
    });

    return [header, ...linhas].join('\n');
}

/**
 * Gera arquivo para download
 */
export function downloadCSV(conteudo, nomeArquivo) {
    // Adicionar BOM para Excel reconhecer UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + conteudo], { type: 'text/csv;charset=utf-8' });
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
    exportarLancamentosContaAzul,
    exportarVendasContaAzul,
    exportarClientesContaAzul,
    downloadCSV
};
