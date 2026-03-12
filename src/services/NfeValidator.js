/**
 * NfeValidator.js
 * Valida os dados necessários para emissão de NF-e antes de enviar à Nuvem Fiscal.
 */

const REQUIRED_CLIENTE_FIELDS = [
    { keys: ['cpf_cnpj', 'cpf', 'cnpj'], label: 'CPF/CNPJ do cliente', errorKey: 'cpf_cnpj' },
    { keys: ['nome', 'nome_completo', 'razao_social'], label: 'Nome do cliente', errorKey: 'nome' },
    { keys: ['logradouro', 'endereco', 'endereco_logradouro'], label: 'Logradouro do cliente', errorKey: 'logradouro' },
    { keys: ['numero', 'endereco_numero'], label: 'Número do endereço', errorKey: 'numero' },
    { keys: ['bairro', 'endereco_bairro'], label: 'Bairro do cliente', errorKey: 'bairro' },
    { keys: ['cidade', 'endereco_cidade'], label: 'Cidade do cliente', errorKey: 'cidade' },
    { keys: ['estado', 'uf', 'endereco_uf'], label: 'Estado (UF) do cliente', errorKey: 'estado' },
    { keys: ['cep', 'endereco_cep'], label: 'CEP do cliente', errorKey: 'cep' },
];

const REQUIRED_EMITENTE_FIELDS = [
    { keys: ['cnpj'], label: 'CNPJ do emitente', errorKey: 'cnpj' },
    { keys: ['razao_social', 'nome'], label: 'Razão social do emitente', errorKey: 'razao_social' },
    { keys: ['ie', 'inscricao_estadual'], label: 'Inscrição Estadual do emitente', errorKey: 'ie' },
    { keys: ['logradouro'], label: 'Logradouro do emitente', errorKey: 'logradouro' },
    { keys: ['numero'], label: 'Número do emitente', errorKey: 'numero' },
    { keys: ['bairro'], label: 'Bairro do emitente', errorKey: 'bairro' },
    { keys: ['cidade', 'municipio', 'municipio_nome'], label: 'Cidade do emitente', errorKey: 'cidade' },
    { keys: ['uf', 'estado', 'uf_emitente'], label: 'UF do emitente', errorKey: 'uf' },
    { keys: ['cep'], label: 'CEP do emitente', errorKey: 'cep' },
];

const REQUIRED_ITEM_FIELDS = [
    { key: 'ncm', label: 'NCM' },
    { key: 'cfop', label: 'CFOP' },
    { key: 'unidade', label: 'Unidade' },
];

/**
 * Valida os dados necessários para emissão de NF-e.
 */
export function validarNFe({ emitente, cliente, itens }) {
    const errors = [];
    const errorsBySection = {
        Emitente: [],
        Cliente: [],
        Itens: []
    };

    const getFirstValue = (obj, keys) => {
        if (!obj) return null;
        for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
                return obj[key];
            }
        }
        return null;
    };

    // Validar Emitente
    for (const field of REQUIRED_EMITENTE_FIELDS) {
        const value = getFirstValue(emitente, field.keys);
        if (!value) {
            const errorObj = {
                campo: field.errorKey,
                mensagem: `${field.label} é obrigatório`
            };
            errors.push(errorObj);
            errorsBySection.Emitente.push(errorObj);
        }
    }

    // Validar Cliente
    for (const field of REQUIRED_CLIENTE_FIELDS) {
        const value = getFirstValue(cliente, field.keys);
        if (!value) {
            const errorObj = {
                campo: field.errorKey,
                mensagem: `${field.label} é obrigatório`
            };
            errors.push(errorObj);
            errorsBySection.Cliente.push(errorObj);
        }
    }

    // Validar CPF/CNPJ length
    const cpfCnpjRaw = getFirstValue(cliente, ['cpf_cnpj', 'cpf', 'cnpj']);
    if (cpfCnpjRaw) {
        const cpfCnpj = String(cpfCnpjRaw).replace(/\D/g, '');
        if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
            const errorObj = {
                campo: 'cpf_cnpj',
                mensagem: 'CPF/CNPJ do cliente deve ter 11 (CPF) ou 14 (CNPJ) dígitos'
            };
            errors.push(errorObj);
            errorsBySection.Cliente.push(errorObj);
        }
    }

    // Validar Itens
    if (!itens || itens.length === 0) {
        const errorObj = {
            campo: 'itens',
            mensagem: 'A venda deve ter pelo menos 1 item'
        };
        errors.push(errorObj);
        errorsBySection.Itens.push(errorObj);
    } else {
        itens.forEach((item, index) => {
            const nItem = index + 1;
            for (const field of REQUIRED_ITEM_FIELDS) {
                const value = item[field.key];
                if (!value || String(value).trim() === '') {
                    const errorObj = {
                        campo: `itens[${index}].${field.key}`,
                        mensagem: `Item ${nItem} (${item.produto_nome || item.nome || 'sem nome'}): ${field.label} é obrigatório`
                    };
                    errors.push(errorObj);
                    errorsBySection.Itens.push(errorObj);
                }
            }

            // Validate NCM has 8 digits
            if (item.ncm) {
                const ncm = String(item.ncm).replace(/\D/g, '');
                if (ncm.length !== 8) {
                    const errorObj = {
                        campo: `itens[${index}].ncm`,
                        mensagem: `Item ${nItem}: NCM deve ter 8 dígitos (atual: "${item.ncm}")`
                    };
                    errors.push(errorObj);
                    errorsBySection.Itens.push(errorObj);
                }
            }

            // Validate CFOP has 4 digits
            if (item.cfop) {
                const cfop = String(item.cfop).replace(/\D/g, '');
                if (cfop.length !== 4) {
                    const errorObj = {
                        campo: `itens[${index}].cfop`,
                        mensagem: `Item ${nItem}: CFOP deve ter 4 dígitos (atual: "${item.cfop}")`
                    };
                    errors.push(errorObj);
                    errorsBySection.Itens.push(errorObj);
                }
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        errorsBySection,
        totalErrors: errors.length,
        camposFaltantes: errors,
        porSecao: errorsBySection
    };
}
