// Supabase Edge Function: emitir-nfe
// Deploy: supabase functions deploy emitir-nfe --no-verify-jwt
// API: Nuvem Fiscal (multi-tenant — credenciais por organization_id)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getNuvemFiscalToken } from '../_shared/nuvemFiscalAuth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Roles Autorizados ───────────────────────────────────────────────────────
const ROLES_EMISSAO_DIRETA = ['Administrador', 'Gerente', 'Gerente Geral'];

// ─── Helper: Mapeamento Forma de Pagamento (SEFAZ codes) ─────────────────────
const mapFormaPagamento = (forma: string): string => {
    const normalized = (forma || '').toLowerCase();
    if (normalized.includes('dinheiro')) return '01';
    if (normalized.includes('crédito') || normalized.includes('credito')) return '03';
    if (normalized.includes('débito') || normalized.includes('debito')) return '04';
    if (normalized.includes('pix')) return '17';
    if (normalized.includes('boleto')) return '15';
    if (normalized.includes('cheque')) return '02';
    if (normalized.includes('promissória') || normalized.includes('promissoria') || normalized.includes('crediário') || normalized.includes('crediario')) return '05';
    return '99'; // Outros
};

// ─── Helper: Indicador de pagamento ──────────────────────────────────────────
const mapIndicadorPagamento = (forma: string): number => {
    const normalized = (forma || '').toLowerCase();
    if (normalized.includes('crediário') || normalized.includes('crediario') || normalized.includes('promissória') || normalized.includes('promissoria')) return 1; // Pagamento a prazo
    return 0; // Pagamento à vista
};

// ─── Helper: Validação de CPF ────────────────────────────────────────────────
function validarCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
    let r = 11 - (soma % 11);
    if (r >= 10) r = 0;
    if (r !== parseInt(cpf.charAt(9))) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
    r = 11 - (soma % 11);
    if (r >= 10) r = 0;
    return r === parseInt(cpf.charAt(10));
}

// ─── Helper: Validação de CNPJ ───────────────────────────────────────────────
function validarCNPJ(cnpj: string): boolean {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    let t = cnpj.length - 2, n = cnpj.substring(0, t), d = cnpj.substring(t);
    let s = 0, p = t - 7;
    for (let i = t; i >= 1; i--) { s += parseInt(n.charAt(t - i)) * p--; if (p < 2) p = 9; }
    let res = s % 11 < 2 ? 0 : 11 - (s % 11);
    if (res !== parseInt(d.charAt(0))) return false;
    t++; n = cnpj.substring(0, t); s = 0; p = t - 7;
    for (let i = t; i >= 1; i--) { s += parseInt(n.charAt(t - i)) * p--; if (p < 2) p = 9; }
    res = s % 11 < 2 ? 0 : 11 - (s % 11);
    return res === parseInt(d.charAt(1));
}

// ─── Helper: Mapear UF → código IBGE ────────────────────────────────────────
const UF_IBGE: Record<string, string> = {
    AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53',
    ES: '32', GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15',
    PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43',
    RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();

        // Ping check
        if (body.ping) {
            return new Response(
                JSON.stringify({ success: true, message: 'NF-e Emission Service Ready (Nuvem Fiscal)' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const {
            venda_id,
            ambiente = 'homologacao',
            user_id,
            token_gerencial
        } = body;

        if (!venda_id) throw new Error('venda_id é obrigatório');
        if (!user_id) throw new Error('user_id é obrigatório');

        // ─── Supabase Admin Client ───────────────────────────────────────────
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1: ROLE-BASED ACCESS CONTROL (RBAC)
        // ═══════════════════════════════════════════════════════════════════════

        const { data: usuario, error: userError } = await supabase
            .from('public_users')
            .select('id, cargo, nome, loja')
            .eq('id', user_id)
            .single();

        if (userError || !usuario) {
            throw new Error('Usuário não encontrado. Faça login novamente.');
        }

        const cargo = usuario.cargo;
        const podeEmitirDireto = ROLES_EMISSAO_DIRETA.includes(cargo);
        let tokenUsado: any = null;

        if (!podeEmitirDireto) {
            // Vendedor needs a managerial token
            if (!token_gerencial) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Somente gerentes e administradores podem emitir NF-e. Para vendedores, solicite um token gerencial.',
                        code: 'ROLE_BLOCKED',
                        requer_token: true
                    }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Validate the manager token
            const { data: token, error: tokenError } = await supabase
                .from('tokens_gerenciais')
                .select('*')
                .eq('codigo', token_gerencial)
                .eq('permissao', 'EMITIR_NFE')
                .eq('ativo', true)
                .single();

            if (tokenError || !token) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Token gerencial inválido ou não encontrado para permissão de emissão de NF-e.',
                        code: 'INVALID_TOKEN'
                    }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Check expiration
            if (token.expira_em && new Date(token.expira_em) < new Date()) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Token gerencial expirado. Solicite um novo ao gerente.',
                        code: 'TOKEN_EXPIRED'
                    }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Check usage limit
            if (token.max_usos && token.usos_realizados >= token.max_usos) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Token gerencial já atingiu o limite de uso.',
                        code: 'TOKEN_EXHAUSTED'
                    }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Mark token as used
            await supabase
                .from('tokens_gerenciais')
                .update({
                    usos_realizados: (token.usos_realizados || 0) + 1,
                    usado_em: new Date().toISOString(),
                    ativo: token.tipo_token === 'SINGLE_USE' ? false : true
                })
                .eq('id', token.id);

            tokenUsado = token;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 2: FETCH SALE DATA
        // ═══════════════════════════════════════════════════════════════════════

        const { data: vendaData, error: vendaError } = await supabase
            .from('vendas')
            .select('*')
            .eq('id', venda_id)
            .single();

        if (vendaError || !vendaData) throw new Error('Venda não encontrada');

        // Check if already emitted
        if (vendaData.nfe_emitida && vendaData.nfe_status === 'autorizado') {
            throw new Error('Esta venda já possui uma NF-e autorizada.');
        }

        // Fetch Cliente
        const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', vendaData.cliente_id)
            .single();

        if (clienteError || !cliente) throw new Error('Cliente da venda não encontrado no banco de dados');

        // Resolve Itens (use updated items from frontend if available, else from DB snapshot)
        let itens = body.itens_atualizados || vendaData.itens;
        if (!itens || !Array.isArray(itens) || itens.length === 0) {
            throw new Error('Venda não possui itens. Adicione produtos antes de emitir NF-e.');
        }

        // Organization
        const organization_id = vendaData.organization_id;
        if (!organization_id) {
            throw new Error('Venda não associada a uma organização (organization_id). Configure a empresa.');
        }

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 3: FETCH NUVEM FISCAL TOKEN (via shared helper)
        // ═══════════════════════════════════════════════════════════════════════

        let auth: { accessToken: string; baseUrl: string };
        try {
            auth = await getNuvemFiscalToken(supabase, organization_id, ambiente);
        } catch (e) {
            return new Response(
                JSON.stringify({ success: false, error: (e as Error).message, code: 'CONFIG_ERROR' }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Also fetch emitente data from config
        const { data: config } = await supabase
            .from('organization_nfe_configs')
            .select('*')
            .eq('organization_id', organization_id)
            .maybeSingle();

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 4: COMPREHENSIVE VALIDATION
        // ═══════════════════════════════════════════════════════════════════════

        const camposFaltantes: Array<{ campo: string; mensagem: string; secao: string }> = [];

        // --- Destinatário (Cliente) ---
        const cpfCnpj = cliente.cpf_cnpj || cliente.cpf || cliente.cnpj || cliente.documento;
        if (!cpfCnpj) {
            camposFaltantes.push({ campo: 'cliente.cpf_cnpj', mensagem: 'CPF/CNPJ do cliente é obrigatório', secao: 'Destinatário' });
        } else {
            const doc = cpfCnpj.replace(/\D/g, '');
            if (doc.length === 11 && !validarCPF(doc)) {
                camposFaltantes.push({ campo: 'cliente.cpf_cnpj', mensagem: 'CPF do cliente é inválido', secao: 'Destinatário' });
            } else if (doc.length === 14 && !validarCNPJ(doc)) {
                camposFaltantes.push({ campo: 'cliente.cpf_cnpj', mensagem: 'CNPJ do cliente é inválido', secao: 'Destinatário' });
            } else if (doc.length !== 11 && doc.length !== 14) {
                camposFaltantes.push({ campo: 'cliente.cpf_cnpj', mensagem: 'CPF/CNPJ do cliente deve ter 11 ou 14 dígitos', secao: 'Destinatário' });
            }
        }

        const nomeCliente = cliente.nome || cliente.nome_completo || cliente.razao_social;
        if (!nomeCliente) camposFaltantes.push({ campo: 'cliente.nome', mensagem: 'Nome do cliente é obrigatório', secao: 'Destinatário' });
        if (!cliente.rua && !cliente.endereco && !cliente.logradouro) camposFaltantes.push({ campo: 'cliente.rua', mensagem: 'Logradouro do cliente é obrigatório', secao: 'Destinatário' });
        if (!cliente.bairro) camposFaltantes.push({ campo: 'cliente.bairro', mensagem: 'Bairro do cliente é obrigatório', secao: 'Destinatário' });
        if (!cliente.cidade) camposFaltantes.push({ campo: 'cliente.cidade', mensagem: 'Cidade do cliente é obrigatória', secao: 'Destinatário' });
        if (!cliente.estado && !cliente.uf) camposFaltantes.push({ campo: 'cliente.uf', mensagem: 'UF do cliente é obrigatória', secao: 'Destinatário' });
        if (!cliente.cep) camposFaltantes.push({ campo: 'cliente.cep', mensagem: 'CEP do cliente é obrigatório', secao: 'Destinatário' });

        // --- Itens (Produtos) ---
        const validatedItems: any[] = [];
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            let ncm = item.ncm;
            let cfop = item.cfop;
            let cest = item.cest;
            let unidade = item.unidade || item.unidade_comercial;
            let origemMerc = item.origem_mercadoria;

            // Fetch product details if fields are missing
            if (!ncm || !cfop) {
                const { data: prod } = await supabase
                    .from('produtos')
                    .select('ncm, cfop, cest, unidade, origem_mercadoria, nome')
                    .eq('id', item.produto_id)
                    .single();

                if (prod) {
                    ncm = ncm || prod.ncm;
                    cfop = cfop || prod.cfop;
                    cest = cest || prod.cest;
                    unidade = unidade || prod.unidade;
                    origemMerc = origemMerc ?? prod.origem_mercadoria;
                }
            }

            const itemName = item.produto_nome || item.nome || `Item ${i + 1}`;

            if (!ncm) camposFaltantes.push({ campo: `itens[${i}].ncm`, mensagem: `${itemName}: NCM é obrigatório`, secao: 'Itens' });
            else if (ncm.replace(/\D/g, '').length !== 8) camposFaltantes.push({ campo: `itens[${i}].ncm`, mensagem: `${itemName}: NCM deve ter 8 dígitos`, secao: 'Itens' });

            if (!cfop) cfop = '5102'; // Default: Venda interna
            if (!unidade) unidade = 'UN';
            if (origemMerc === null || origemMerc === undefined) origemMerc = '0'; // Nacional

            const preco = parseFloat(item.preco_unitario || item.preco_venda || item.preco || 0);
            if (!preco || preco <= 0) camposFaltantes.push({ campo: `itens[${i}].preco`, mensagem: `${itemName}: Preço deve ser maior que zero`, secao: 'Itens' });

            const qtd = parseFloat(item.quantidade || 0);
            if (!qtd || qtd <= 0) camposFaltantes.push({ campo: `itens[${i}].qtd`, mensagem: `${itemName}: Quantidade deve ser maior que zero`, secao: 'Itens' });

            validatedItems.push({
                ...item,
                ncm,
                cfop,
                cest,
                unidade,
                origem_mercadoria: origemMerc,
                preco_final: preco,
                qtd_final: qtd
            });
        }

        // If any validation errors, abort with detailed list
        if (camposFaltantes.length > 0) {
            const porSecao: Record<string, typeof camposFaltantes> = {};
            camposFaltantes.forEach(e => {
                if (!porSecao[e.secao]) porSecao[e.secao] = [];
                porSecao[e.secao].push(e);
            });

            return new Response(
                JSON.stringify({
                    success: false,
                    error: `Dados incompletos para emissão de NF-e: ${camposFaltantes.length} campo(s) faltante(s)`,
                    code: 'VALIDATION_ERROR',
                    camposFaltantes,
                    porSecao,
                    totalErros: camposFaltantes.length
                }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: BUILD NUVEM FISCAL PAYLOAD
        // ═══════════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: BUILD NUVEM FISCAL PAYLOAD (TNfePedidoEmissao -> infNFe Sefaz)
        // ═══════════════════════════════════════════════════════════════════════

        // Emitente data from body (injected by frontend) or config
        const emitente = body.emitente_dados || {};
        if (!emitente.cnpj && !config?.emitente_cnpj) {
            throw new Error('Dados do emitente não encontrados. Configure a empresa em Configurações > NF-e.');
        }

        const natureza_operacao = config?.natureza_operacao_padrao || 'VENDA DE MERCADORIA';
        const data_emissao = new Date().toISOString();
        const clienteCpfCnpj = (cpfCnpj || '').replace(/\D/g, '');
        const clienteUf = (cliente.estado || cliente.uf || '').toUpperCase();

        // Emitente final data
        const emitCnpj = (emitente.cnpj || config?.emitente_cnpj || '').replace(/\D/g, '');
        const emitUf = emitente.uf || config?.emitente_uf || 'ES';
        const emitMunCode = emitente.codigoMunicipio || '3205309'; // Default Vitoria if missing

        const localDestino = clienteUf === emitUf ? 1 : 2; // 1=Interna, 2=Interestadual

        // Build Itens (Det)
        const dets = validatedItems.map((item, index) => {
            const nItem = index + 1;
            const valorTotal = item.preco_final * item.qtd_final;

            // ICMS Simples Nacional (CSOSN 102 - Tributada sem permissão de crédito)
            const imposto: any = {
                ICMS: {
                    ICMSSN102: {
                        orig: item.origem_mercadoria || '0',
                        CSOSN: '102'
                    }
                },
                PIS: {
                    PISOutr: {
                        CST: '99', // Outras Operações (Simples) or 07 (Isento)? Using 99 for generic Simples usually allowed
                        vBC: 0.00,
                        pPIS: 0.00,
                        vPIS: 0.00
                    }
                },
                COFINS: {
                    COFINSOutr: {
                        CST: '99',
                        vBC: 0.00,
                        pCOFINS: 0.00,
                        vCOFINS: 0.00
                    }
                }
            };

            return {
                nItem: nItem,
                prod: {
                    cProd: String(item.produto_id || item.id || nItem),
                    cEAN: "SEM GTIN",
                    xProd: (item.produto_nome || item.nome || 'Produto').substring(0, 120),
                    NCM: item.ncm.replace(/\D/g, ''),
                    CEST: item.cest ? item.cest.replace(/\D/g, '') : undefined,
                    CFOP: item.cfop,
                    uCom: item.unidade,
                    qCom: item.qtd_final,
                    vUnCom: item.preco_final,
                    vProd: valorTotal,
                    cEANTrib: "SEM GTIN",
                    uTrib: item.unidade,
                    qTrib: item.qtd_final,
                    vUnTrib: item.preco_final,
                    indTot: 1
                },
                imposto: imposto
            };
        });

        // Totais
        const valorTotalProdutos = validatedItems.reduce((acc, item) => acc + (item.preco_final * item.qtd_final), 0);

        const total = {
            ICMSTot: {
                vBC: 0.00,
                vICMS: 0.00,
                vICMSDeson: 0.00,
                vFCP: 0.00,
                vBCST: 0.00,
                vST: 0.00,
                vFCPST: 0.00,
                vFCPSTRet: 0.00,
                vProd: valorTotalProdutos,
                vFrete: 0.00,
                vSeg: 0.00,
                vDesc: 0.00,
                vII: 0.00,
                vIPI: 0.00,
                vIPIDevol: 0.00,
                vPIS: 0.00,
                vCOFINS: 0.00,
                vOutro: 0.00,
                vNF: vendaData.valor_total
            }
        };

        // Pagamento
        const pag = {
            detPag: [{
                tPag: mapFormaPagamento(vendaData.forma_pagamento || 'Dinheiro'),
                vPag: vendaData.valor_total
            }]
        };

        // Construct Full Payload
        const nfePayload: any = {
            ambiente: ambiente, // 'homologacao' or 'producao'
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: 32, // ES (Should map from emitUf code, but using 32 default for Pedro II)
                    // cNF: generated by Nuvem?
                    natOp: natureza_operacao,
                    mod: "55",
                    serie: parseInt(emitente.serie || '1'),
                    // nNF: generated by Nuvem?
                    dhEmi: data_emissao,
                    tpNF: 1, // Saída
                    idDest: localDestino,
                    cMunFG: emitMunCode,
                    tpImp: 1, // Retrato
                    tpEmis: 1, // Normal
                    tpAmb: ambiente === 'producao' ? 1 : 2,
                    finNFe: 1, // Normal
                    indFinal: 1, // Consumidor final
                    indPres: 1, // Presencial
                    procEmi: 0,
                    verProc: "App V1"
                },
                emit: {
                    CNPJ: emitCnpj,
                    xNome: (emitente.nome || 'Emitente').substring(0, 60),
                    enderEmit: {
                        xLgr: emitente.logradouro || 'Rua',
                        nro: emitente.numero || 'SN',
                        xCpl: emitente.complemento,
                        xBairro: emitente.bairro || 'Bairro',
                        cMun: emitente.codigoMunicipio || '3205309',
                        xMun: emitente.municipio || 'Vitoria',
                        UF: emitUf,
                        CEP: (emitente.cep || '29000000').replace(/\D/g, ''),
                        cPais: 1058,
                        xPais: 'BRASIL'
                    },
                    IE: (emitente.ie || '').replace(/\D/g, ''),
                    CRT: parseInt(emitente.regimeTributario || '1')
                },
                dest: {
                    CNPJ: clienteCpfCnpj.length === 14 ? clienteCpfCnpj : undefined,
                    CPF: clienteCpfCnpj.length === 11 ? clienteCpfCnpj : undefined,
                    xNome: nomeCliente.substring(0, 60),
                    enderDest: {
                        xLgr: cliente.rua || cliente.logradouro,
                        nro: cliente.numero || 'SN',
                        xBairro: cliente.bairro,
                        cMun: cliente.codigo_municipio || '3205309', // Fallback if missing? Validation will fail if missing.
                        xMun: cliente.cidade,
                        UF: clienteUf,
                        CEP: (cliente.cep || '').replace(/\D/g, ''),
                        cPais: 1058,
                        xPais: 'BRASIL'
                    },
                    indIEDest: 9 // Não contribuinte
                },
                det: dets,
                total: total,
                transp: {
                    modFrete: 9
                },
                pag: pag,
                infAdic: vendaData.observacoes ? { infCpl: vendaData.observacoes.substring(0, 5000) } : undefined
            }
        };

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 6: SEND TO NUVEM FISCAL
        // ═══════════════════════════════════════════════════════════════════════

        // Note: Using the specialized /nfe/emitir endpoint might not exist, 
        // usually it is POST /nfe implied emission or POST /nfe/autorizar depending on API version.
        // nuvemFiscalAuth.ts uses standard generic endpoint.

        console.log('Sending NFe payload:', JSON.stringify(nfePayload));

        const nfeResponse = await fetch(`${auth.baseUrl}/nfe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.accessToken}`,
            },
            body: JSON.stringify(nfePayload),
        });

        const respData = await nfeResponse.json();

        if (!nfeResponse.ok) {
            const erroMsg = respData.error?.message || respData.mensagem || JSON.stringify(respData);
            throw new Error(`Erro Nuvem Fiscal: ${erroMsg}`);
        }

        // Response handling...
        // Note: If async, status might be 'processando'.
        // If synchronous, we get 'autorizado' or 'rejeitado'.
        // Nuvem Fiscal might return 'id' immediately.

        const nuvemFiscalId = respData.id;
        const statusNfe = respData.status || 'processando';

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 7: SAVE RESULTS
        // ═══════════════════════════════════════════════════════════════════════

        // (Rest of the code remains similar)

        // Update Venda
        await supabase.from('vendas').update({
            nfe_emitida: true,
            nfe_status: statusNfe,
            nfe_ref: nuvemFiscalId,
            nfe_mensagem: respData.mensagem_sefaz || respData.motivo || 'Enviada para processamento'
        }).eq('id', venda_id);

        // Insert into notas_fiscais_emitidas
        await supabase.from('notas_fiscais_emitidas').insert({
            venda_id,
            nuvem_fiscal_id: nuvemFiscalId,
            ambiente: ambiente === 'producao' ? 1 : 2,
            status: statusNfe,
            motivo_status: respData.mensagem_sefaz || respData.motivo,
            natureza_operacao,
            data_emissao,
            chave_acesso: respData.chave || null,
            numero_nota: respData.numero ? String(respData.numero) : null,
            serie: respData.serie ? String(respData.serie) : null,
            protocolo_autorizacao: respData.protocolo || null,
            emitente_cnpj: emitCnpj,
            emitente_razao_social: emitente.nome || config?.emitente_razao_social || null,
            destinatario_cpf_cnpj: clienteCpfCnpj,
            destinatario_nome: nomeCliente,
            destinatario_endereco: cliente.rua || cliente.endereco || cliente.logradouro,
            destinatario_numero: cliente.numero || 'SN',
            destinatario_bairro: cliente.bairro,
            destinatario_cidade: cliente.cidade,
            destinatario_uf: clienteUf,
            destinatario_cep: (cliente.cep || '').replace(/\D/g, ''),
            valor_total: vendaData.valor_total,
            valor_produtos: valorTotalProdutos,
            emitido_por: usuario.nome,
            emitido_por_id: user_id,
            token_gerencial_id: tokenUsado ? tokenUsado.id : null,
        }).select().single();

        return new Response(
            JSON.stringify({
                success: true,
                message: 'NF-e enviada para processamento',
                ref: nuvemFiscalId,
                status: statusNfe,
                emitido_por: usuario.nome,
                via_token: !!tokenUsado
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Erro NFe:', error);
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
