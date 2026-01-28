/**
 * Utilitários de formatação centralizados
 * Elimina duplicação de funções de formatação em múltiplos componentes
 */

// ==================== DOCUMENTOS ====================

/**
 * Formata CPF: 000.000.000-00
 * @param {string} valor - Valor a ser formatado
 * @returns {string} CPF formatado
 */
export function formatarCPF(valor) {
    if (!valor) return '';
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 11) {
        return numeros
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return valor;
}

/**
 * Formata CNPJ: 00.000.000/0000-00
 * @param {string} valor - Valor a ser formatado
 * @returns {string} CNPJ formatado
 */
export function formatarCNPJ(valor) {
    if (!valor) return '';
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 14) {
        return numeros
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    return valor;
}

/**
 * Formata CPF ou CNPJ dependendo do tamanho
 * @param {string} valor - Valor a ser formatado
 * @returns {string} CPF ou CNPJ formatado
 */
export function formatarCPFCNPJ(valor) {
    if (!valor) return '';
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 11) {
        return formatarCPF(valor);
    }
    return formatarCNPJ(valor);
}

// ==================== TELEFONE ====================

/**
 * Formata telefone brasileiro: (00) 0000-0000 ou (00) 00000-0000
 * @param {string} valor - Valor a ser formatado
 * @returns {string} Telefone formatado
 */
export function formatarTelefone(valor) {
    if (!valor) return '';
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 11) {
        if (numeros.length <= 10) {
            return numeros
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{4})(\d)/, '$1-$2');
        }
        return numeros
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
}

/**
 * Limpa telefone para apenas números
 * @param {string} valor - Telefone formatado
 * @returns {string} Apenas números
 */
export function limparTelefone(valor) {
    if (!valor) return '';
    return valor.replace(/\D/g, '');
}

// ==================== MOEDA ====================

/**
 * Formata valor para moeda brasileira: R$ 1.234,56
 * @param {number|string} valor - Valor a ser formatado
 * @returns {string} Valor formatado em BRL
 */
export function formatarMoeda(valor) {
    const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
    if (isNaN(numero)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
}

/**
 * Formata valor para moeda sem símbolo: 1.234,56
 * @param {number|string} valor - Valor a ser formatado
 * @returns {string} Valor formatado
 */
export function formatarValorNumerico(valor) {
    const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
    if (isNaN(numero)) return '0,00';
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numero);
}

/**
 * Converte string de moeda para número
 * @param {string} valor - Valor formatado: "1.234,56" ou "R$ 1.234,56"
 * @returns {number} Valor numérico
 */
export function parseMoeda(valor) {
    if (!valor) return 0;
    if (typeof valor === 'number') return valor;
    return parseFloat(
        valor
            .replace(/[R$\s]/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
    ) || 0;
}

// ==================== DATA ====================

/**
 * Formata data para DD/MM/YYYY
 * @param {string|Date} data - Data a ser formatada
 * @returns {string} Data formatada
 */
export function formatarData(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR');
}

/**
 * Formata data e hora para DD/MM/YYYY HH:mm
 * @param {string|Date} data - Data a ser formatada
 * @returns {string} Data e hora formatadas
 */
export function formatarDataHora(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formata data para exibição relativa (há X dias)
 * @param {string|Date} data - Data a ser comparada
 * @returns {string} Texto relativo
 */
export function formatarDataRelativa(data) {
    if (!data) return '';
    const d = new Date(data);
    if (isNaN(d.getTime())) return '';

    const agora = new Date();
    const diffMs = agora - d;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoje';
    if (diffDias === 1) return 'Ontem';
    if (diffDias < 7) return `Há ${diffDias} dias`;
    if (diffDias < 30) return `Há ${Math.floor(diffDias / 7)} semanas`;
    if (diffDias < 365) return `Há ${Math.floor(diffDias / 30)} meses`;
    return `Há ${Math.floor(diffDias / 365)} anos`;
}

/**
 * Calcula dias passados desde uma data
 * @param {string|Date} data - Data de referência
 * @returns {number} Número de dias
 */
export function getDiasPassados(data) {
    if (!data) return 0;
    const d = new Date(data);
    if (isNaN(d.getTime())) return 0;
    return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
}

// ==================== CEP ====================

/**
 * Formata CEP: 00000-000
 * @param {string} valor - Valor a ser formatado
 * @returns {string} CEP formatado
 */
export function formatarCEP(valor) {
    if (!valor) return '';
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 8) {
        return numeros.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
}

/**
 * Limpa CEP para apenas números
 * @param {string} valor - CEP formatado
 * @returns {string} Apenas números
 */
export function limparCEP(valor) {
    if (!valor) return '';
    return valor.replace(/\D/g, '');
}

// ==================== PORCENTAGEM ====================

/**
 * Formata valor como porcentagem
 * @param {number|string} valor - Valor a ser formatado
 * @param {number} decimais - Casas decimais (default: 1)
 * @returns {string} Valor formatado com %
 */
export function formatarPorcentagem(valor, decimais = 1) {
    const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
    if (isNaN(numero)) return '0%';
    return `${numero.toFixed(decimais)}%`;
}

// ==================== NÚMEROS ====================

/**
 * Formata número com separadores de milhar
 * @param {number|string} valor - Valor a ser formatado
 * @returns {string} Número formatado
 */
export function formatarNumero(valor) {
    const numero = typeof valor === 'string' ? parseInt(valor, 10) : valor;
    if (isNaN(numero)) return '0';
    return new Intl.NumberFormat('pt-BR').format(numero);
}

// ==================== TEXTO ====================

/**
 * Capitaliza primeira letra de cada palavra
 * @param {string} texto - Texto a ser capitalizado
 * @returns {string} Texto capitalizado
 */
export function capitalizar(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Trunca texto com reticências
 * @param {string} texto - Texto a ser truncado
 * @param {number} tamanho - Tamanho máximo
 * @returns {string} Texto truncado
 */
export function truncar(texto, tamanho = 50) {
    if (!texto) return '';
    if (texto.length <= tamanho) return texto;
    return texto.slice(0, tamanho) + '...';
}

// ==================== VALIDAÇÃO ====================

/**
 * Valida CPF
 * @param {string} cpf - CPF a ser validado
 * @returns {boolean} Se é válido
 */
export function validarCPF(cpf) {
    if (!cpf) return false;
    const numeros = cpf.replace(/\D/g, '');
    if (numeros.length !== 11) return false;
    if (/^(\d)\1+$/.test(numeros)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(numeros.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(numeros.charAt(9))) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(numeros.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(numeros.charAt(10));
}

/**
 * Valida CNPJ
 * @param {string} cnpj - CNPJ a ser validado
 * @returns {boolean} Se é válido
 */
export function validarCNPJ(cnpj) {
    if (!cnpj) return false;
    const numeros = cnpj.replace(/\D/g, '');
    if (numeros.length !== 14) return false;
    if (/^(\d)\1+$/.test(numeros)) return false;

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let soma = 0;
    for (let i = 0; i < 12; i++) {
        soma += parseInt(numeros.charAt(i)) * pesos1[i];
    }
    let resto = soma % 11;
    const digito1 = resto < 2 ? 0 : 11 - resto;
    if (digito1 !== parseInt(numeros.charAt(12))) return false;

    soma = 0;
    for (let i = 0; i < 13; i++) {
        soma += parseInt(numeros.charAt(i)) * pesos2[i];
    }
    resto = soma % 11;
    const digito2 = resto < 2 ? 0 : 11 - resto;
    return digito2 === parseInt(numeros.charAt(13));
}

/**
 * Valida email
 * @param {string} email - Email a ser validado
 * @returns {boolean} Se é válido
 */
export function validarEmail(email) {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Valida telefone brasileiro (10 ou 11 dígitos)
 * @param {string} telefone - Telefone a ser validado
 * @returns {boolean} Se é válido
 */
export function validarTelefone(telefone) {
    if (!telefone) return false;
    const numeros = telefone.replace(/\D/g, '');
    return numeros.length >= 10 && numeros.length <= 11;
}
