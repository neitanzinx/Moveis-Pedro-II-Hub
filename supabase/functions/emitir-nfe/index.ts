// Supabase Edge Function: emitir-nfe
// Deploy: supabase functions deploy emitir-nfe --no-verify-jwt
// API: ACBR API (multi-tenant — credenciais por organization_id)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAcbrToken } from '../_shared/acbrAuth.ts'

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
                JSON.stringify({ success: true, message: 'NF-e Emission Service Ready (ACBR API)' }),
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

        // ── Idempotência: bloqueia dupla emissão ──────────────────────────────
        if (vendaData.nfe_emitida && vendaData.nfe_status === 'autorizado') {
            throw new Error('Esta venda já possui uma NF-e autorizada.');
        }

        // ── Gate de Aprovação Fiscal ───────────────────────────────────────────
        // A NF-e só pode ser emitida se um gerente/admin aprovou formalmente.
        if (!vendaData.nfe_aprovada) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Esta NF-e ainda não foi aprovada para emissão. Solicite aprovação gerencial antes de emitir.',
                    code: 'NFE_NOT_APPROVED',
                }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
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
        // STEP 3: FETCH ACBR TOKEN (via shared helper)
        // ═══════════════════════════════════════════════════════════════════════

        let auth: { accessToken: string; baseUrl: string };
        try {
            auth = await getAcbrToken(supabase, organization_id, ambiente);
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
        if (!cliente.codigo_municipio) camposFaltantes.push({ campo: 'cliente.codigo_municipio', mensagem: 'Código IBGE do município do cliente é obrigatório — edite o cliente e clique em "Buscar CEP" para preencher automaticamente', secao: 'Destinatário' });

        // --- Itens (Produtos) ---
        const validatedItems: any[] = [];
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            let ncm = item.ncm;
            let cfop = item.cfop;
            let cest = item.cest;
            let unidade = item.unidade || item.unidade_comercial;
            let origemMerc = item.origem_mercadoria;

            // Fetch product details (always fetch to get fiscal overrides)
            let prodCsosn: string | null = null;
            let prodCstIcms: string | null = null;
            let prodCstPis: string | null = null;
            let prodCstCofins: string | null = null;
            let prodAliquotaIcms: number | null = null;
            let prodPercentualTributos: number | null = null;

            if (item.produto_id) {
                const { data: prod } = await supabase
                    .from('produtos')
                    .select('ncm, cfop, cest, unidade, origem_mercadoria, origem, nome, csosn, cst_icms, cst_pis, cst_cofins, aliquota_icms, percentual_tributos')
                    .eq('id', item.produto_id)
                    .single();

                if (prod) {
                    ncm = ncm || prod.ncm;
                    cfop = cfop || prod.cfop;
                    cest = cest || prod.cest;
                    unidade = unidade || prod.unidade;
                    origemMerc = origemMerc ?? prod.origem_mercadoria ?? prod.origem;
                    // Fiscal overrides (product-level, may be null)
                    prodCsosn = prod.csosn || null;
                    prodCstIcms = prod.cst_icms || null;
                    prodCstPis = prod.cst_pis || null;
                    prodCstCofins = prod.cst_cofins || null;
                    prodAliquotaIcms = prod.aliquota_icms != null ? parseFloat(prod.aliquota_icms) : null;
                    prodPercentualTributos = prod.percentual_tributos != null ? parseFloat(prod.percentual_tributos) : null;
                }
            }

            const itemName = item.produto_nome || item.nome || `Item ${i + 1}`;

            if (!ncm) camposFaltantes.push({ campo: `itens[${i}].ncm`, mensagem: `${itemName}: NCM é obrigatório — cadastre na aba Fiscal do produto`, secao: 'Itens' });
            else if (ncm.replace(/\D/g, '').length !== 8) camposFaltantes.push({ campo: `itens[${i}].ncm`, mensagem: `${itemName}: NCM deve ter 8 dígitos`, secao: 'Itens' });

            if (!cfop) camposFaltantes.push({ campo: `itens[${i}].cfop`, mensagem: `${itemName}: CFOP é obrigatório — cadastre na aba Fiscal do produto`, secao: 'Itens' });
            if (!unidade) unidade = 'UN';
            if (origemMerc === null || origemMerc === undefined) origemMerc = '0'; // Nacional (retrocompatível)

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
                qtd_final: qtd,
                // Fiscal overrides (product → org → system)
                _csosn: prodCsosn,
                _cst_icms: prodCstIcms,
                _cst_pis: prodCstPis,
                _cst_cofins: prodCstCofins,
                _aliquota_icms: prodAliquotaIcms,
                _percentual_tributos: prodPercentualTributos,
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
        // STEP 5: BUILD ACBR PAYLOAD
        // ═══════════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: BUILD ACBR PAYLOAD (TNfePedidoEmissao -> infNFe Sefaz)
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

        // ── Emitente: body tem precedência, banco é fallback robusto ──────────
        const emitCnpj = (emitente.cnpj || config?.emitente_cnpj || '').replace(/\D/g, '');
        const emitUf = (emitente.uf || config?.emitente_uf || 'ES').toUpperCase();
        const emitNome = emitente.nome || config?.emitente_nome || 'Emitente';
        const emitIe = (emitente.ie || config?.emitente_ie || '').replace(/\D/g, '');
        const emitCrt = parseInt(emitente.regimeTributario || String(config?.emitente_crt ?? 1));
        const emitLogradouro = emitente.logradouro || config?.emitente_logradouro || 'Rua';
        const emitNumero = emitente.numero || config?.emitente_numero || 'SN';
        const emitComplemento = emitente.complemento || null;
        const emitBairro = emitente.bairro || config?.emitente_bairro || 'Bairro';
        const emitMunCode = emitente.codigoMunicipio || config?.emitente_codigo_municipio || '3205309';
        const emitMunNome = emitente.municipio || config?.emitente_municipio || 'Vitoria';
        const emitCep = (emitente.cep || config?.emitente_cep || '29000000').replace(/\D/g, '');
        const emitMunCodeInt = parseInt(String(emitMunCode), 10) || 3205309;
        const clienteMunCodeInt = parseInt(String(cliente.codigo_municipio || '3205309'), 10) || 3205309;
        const isInterestadual = clienteUf !== emitUf;

        const localDestino = isInterestadual ? 2 : 1; // 1=Interna, 2=Interestadual

        // ── Fiscal Defaults: produto → org config → sistema ────────────────
        const orgCsosnPadrao = config?.csosn_padrao || '102';
        const orgCstIcmsPadrao = config?.cst_icms_padrao || '00';
        const orgCstPisPadrao = config?.cst_pis_padrao || '49';
        const orgCstCofinsPadrao = config?.cst_cofins_padrao || '49';
        const orgAliqIcms = parseFloat(config?.aliquota_icms_padrao ?? 17);
        const orgAliqIcmsInter = parseFloat(config?.aliquota_icms_interestadual_padrao ?? 12);
        const orgAliqPis = parseFloat(config?.aliquota_pis_padrao ?? 0.65);
        const orgAliqCofins = parseFloat(config?.aliquota_cofins_padrao ?? 3.0);
        const orgPercTrib = parseFloat(config?.percentual_tributos_padrao ?? 17);
        const orgModFrete = config?.mod_frete_padrao ?? 9;

        // ── Desconto e Frete da Venda ────────────────────────────────────────
        const valorDesconto = parseFloat(vendaData.valor_desconto ?? vendaData.desconto ?? 0) || 0;
        const valorFrete = parseFloat(vendaData.valor_frete ?? 0) || 0;
        // Frontend pode sobrescrever modFrete
        const modFreteOverride = body.modFrete;
        let modFreteResolido: number;
        if (modFreteOverride !== undefined && modFreteOverride !== null) {
            modFreteResolido = parseInt(String(modFreteOverride), 10);
        } else if (valorFrete > 0) {
            modFreteResolido = 0; // CIF - por conta do emitente
        } else {
            modFreteResolido = orgModFrete;
        }

        // ── Engine Tributária Multi-Regime ───────────────────────────────────
        // CRT 1/2: Simples Nacional → CSOSN configurável, PIS/COFINS NT CST 49 (Outras Saídas)
        // CRT 3: Regime Normal → ICMS00, PIS/COFINS com alíquotas configuráveis
        // Prioridade: produto override → org default → sistema default
        function calcularImpostos(item: any, crt: number, itemInterestadual: boolean) {
            const origRaw = parseInt(String(item.origem_mercadoria ?? '0'), 10);
            const orig = Number.isNaN(origRaw) ? 0 : origRaw;
            const valorItem = parseFloat((item.preco_final * item.qtd_final).toFixed(2));

            // ── vTotTrib (Lei da Transparência 12.741/2012) ──────────────
            const percTrib = item._percentual_tributos ?? orgPercTrib;
            const vTotTrib = parseFloat((valorItem * percTrib / 100).toFixed(2));

            if (crt === 3) {
                // CSTs: produto → org → sistema
                const cstIcms = parseInt(item._cst_icms || orgCstIcmsPadrao || '00', 10);
                const cstPis = item._cst_pis || orgCstPisPadrao || '01';
                const cstCofins = item._cst_cofins || orgCstCofinsPadrao || '01';

                const pICMS = item._aliquota_icms ?? (itemInterestadual ? orgAliqIcmsInter : orgAliqIcms);
                const vBC = valorItem;
                const vICMS = parseFloat((vBC * pICMS / 100).toFixed(2));
                const pPIS = orgAliqPis;
                const vPIS = parseFloat((vBC * pPIS / 100).toFixed(2));
                const pCOFINS = orgAliqCofins;
                const vCOFINS = parseFloat((vBC * pCOFINS / 100).toFixed(2));

                return {
                    vTotTrib,
                    ICMS: { ICMS00: { orig, CST: cstIcms, modBC: 3, vBC, pICMS, vICMS } },
                    PIS: { PISAliq: { CST: parseInt(cstPis, 10) || 1, vBC, pPIS, vPIS } },
                    COFINS: { COFINSAliq: { CST: parseInt(cstCofins, 10) || 1, vBC, pCOFINS, vCOFINS } },
                };
            }

            // CRT 1 ou 2: Simples Nacional
            const csosn = parseInt(item._csosn || orgCsosnPadrao || '102', 10);
            const cstPisSn = item._cst_pis || orgCstPisPadrao || '49';
            const cstCofinsSn = item._cst_cofins || orgCstCofinsPadrao || '49';

            return {
                vTotTrib,
                ICMS: { ICMSSN102: { orig, CSOSN: csosn } },
                PIS: { PISNT: { CST: cstPisSn } },
                COFINS: { COFINSNT: { CST: cstCofinsSn } },
            };
        }

        // ── Auto-adjust CFOP for interstate sales ─────────────────────────
        function ajustarCfopInterestadual(cfop: number, isInter: boolean): number {
            if (!isInter) return cfop;
            const str = String(cfop);
            // CFOP 5xxx (intra-state) → 6xxx (interstate)
            if (str.startsWith('5')) {
                return parseInt('6' + str.substring(1), 10);
            }
            return cfop;
        }

        // Build Itens (Det)
        let totICMS = 0, totBC = 0, totPIS = 0, totCOFINS = 0;
        const dets = validatedItems.map((item, index) => {
            const nItem = index + 1;
            const valorItem = item.preco_final * item.qtd_final;
            const imposto = calcularImpostos(item, emitCrt, isInterestadual);

            if (emitCrt === 3) {
                totBC += imposto.ICMS.ICMS00?.vBC ?? 0;
                totICMS += imposto.ICMS.ICMS00?.vICMS ?? 0;
                totPIS += imposto.PIS.PISAliq?.vPIS ?? 0;
                totCOFINS += imposto.COFINS.COFINSAliq?.vCOFINS ?? 0;
            }

            const cfopBase = parseInt(String(item.cfop).replace(/\D/g, ''), 10) || 5102;
            const cfopFinal = ajustarCfopInterestadual(cfopBase, isInterestadual);

            return {
                nItem,
                prod: {
                    cProd: String(item.produto_id || item.id || nItem),
                    cEAN: "SEM GTIN",
                    xProd: (item.produto_nome || item.nome || 'Produto').substring(0, 120),
                    NCM: item.ncm.replace(/\D/g, ''),
                    CEST: item.cest ? item.cest.replace(/\D/g, '') : undefined,
                    CFOP: cfopFinal,
                    uCom: item.unidade,
                    qCom: item.qtd_final,
                    vUnCom: item.preco_final,
                    vProd: parseFloat(valorItem.toFixed(2)),
                    cEANTrib: "SEM GTIN",
                    uTrib: item.unidade,
                    qTrib: item.qtd_final,
                    vUnTrib: item.preco_final,
                    indTot: 1
                },
                imposto
            };
        });

        // ── Totais (fórmula SEFAZ: vNF = vProd - vDesc + vFrete + vSeg + vOutro - vICMSDeson + vII + vIPI + vFCPST)
        const vProd = parseFloat(dets.reduce((acc, det) => acc + (det?.prod?.vProd || 0), 0).toFixed(2));
        const vDesc = parseFloat(valorDesconto.toFixed(2));
        const vFrete = parseFloat(valorFrete.toFixed(2));
        const vNF = parseFloat((vProd - vDesc + vFrete).toFixed(2));

        const total = {
            ICMSTot: {
                vBC: parseFloat(totBC.toFixed(2)),
                vICMS: parseFloat(totICMS.toFixed(2)),
                vICMSDeson: 0.00,
                vFCP: 0.00,
                vBCST: 0.00,
                vST: 0.00,
                vFCPST: 0.00,
                vFCPSTRet: 0.00,
                vProd,
                vFrete,
                vSeg: 0.00,
                vDesc,
                vII: 0.00,
                vIPI: 0.00,
                vIPIDevol: 0.00,
                vPIS: parseFloat(totPIS.toFixed(2)),
                vCOFINS: parseFloat(totCOFINS.toFixed(2)),
                vOutro: 0.00,
                vNF
            }
        };

        // Pagamento (vPag = valor efetivamente pago = vNF)
        const indPag = mapIndicadorPagamento(vendaData.forma_pagamento || 'Dinheiro');
        const pag = {
            detPag: [{
                indPag,
                tPag: mapFormaPagamento(vendaData.forma_pagamento || 'Dinheiro'),
                vPag: vNF
            }]
        };

        // ── Gerar número da NF-e (atomiço via UPDATE ... RETURNING) ────────────
        const { data: nfeNumRow, error: nfeNumErr } = await supabase.rpc('increment_nfe_number', { org_id: organization_id });
        let nNF: number;
        if (nfeNumErr || !nfeNumRow) {
            // Fallback: incrementa manualmente
            const { data: cfgRow } = await supabase
                .from('organization_nfe_configs')
                .select('ultimo_numero_nfe')
                .eq('organization_id', organization_id)
                .single();
            nNF = (cfgRow?.ultimo_numero_nfe || 0) + 1;
            await supabase.from('organization_nfe_configs').update({ ultimo_numero_nfe: nNF }).eq('organization_id', organization_id);
        } else {
            nNF = typeof nfeNumRow === 'number' ? nfeNumRow : (nfeNumRow as any);
        }

        // Construct Full Payload
        const nfePayload: any = {
            ambiente: ambiente,      // 'homologacao' | 'producao'
            referencia: `venda_${venda_id}`, // Idempotência: impede duplicatas em retry
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: parseInt(UF_IBGE[emitUf] || '32'),
                    natOp: natureza_operacao,
                    mod: 55,
                    serie: parseInt(emitente.serie || '1'),
                    nNF: nNF,
                    dhEmi: data_emissao,
                    tpNF: 1, // Saída
                    idDest: localDestino,
                    cMunFG: emitMunCodeInt,
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
                    xNome: emitNome.substring(0, 60),
                    enderEmit: {
                        xLgr: emitLogradouro,
                        nro: emitNumero,
                        xCpl: emitComplemento,
                        xBairro: emitBairro,
                        cMun: emitMunCodeInt,
                        xMun: emitMunNome,
                        UF: emitUf,
                        CEP: emitCep,
                        cPais: 1058,
                        xPais: 'BRASIL'
                    },
                    IE: emitIe,
                    CRT: emitCrt
                },
                dest: {
                    CNPJ: clienteCpfCnpj.length === 14 ? clienteCpfCnpj : undefined,
                    CPF: clienteCpfCnpj.length === 11 ? clienteCpfCnpj : undefined,
                    xNome: nomeCliente.substring(0, 60),
                    enderDest: {
                        xLgr: cliente.endereco || cliente.rua || cliente.logradouro || 'Rua',
                        nro: cliente.numero || 'SN',
                        xBairro: cliente.bairro,
                        cMun: clienteMunCodeInt,
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
                    modFrete: modFreteResolido
                },
                pag: pag,
                infAdic: vendaData.observacoes ? { infCpl: vendaData.observacoes.substring(0, 5000) } : undefined
            }
        };

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 6: SEND TO ACBR API
        // ═══════════════════════════════════════════════════════════════════════

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
            // Log full response for debugging
            const fullRespStr = JSON.stringify(respData);
            console.error('[emitir-nfe] ACBR API error (HTTP ' + nfeResponse.status + '):', fullRespStr);

            // Return the RAW response so the user/developer can see exactly what failed
            throw new Error(`Erro ACBR API (HTTP ${nfeResponse.status}): ${fullRespStr.substring(0, 1500)}`);
        }

        // Response handling...
        // Note: If async, status might be 'processando'.
        // If synchronous, we get 'autorizado' or 'rejeitado'.
        // Nuvem Fiscal might return 'id' immediately.

        const acbrId = respData.id;
        const statusNfe = respData.status || 'processando';
        const codigoStatus = respData.codigo_status || respData.autorizacao?.codigo_status || null;
        const motivoStatus =
            respData.motivo_status
            || respData.mensagem_sefaz
            || respData.motivo
            || respData.autorizacao?.motivo_status
            || respData.autorizacao?.mensagem
            || null;

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 7: SAVE RESULTS
        // ═══════════════════════════════════════════════════════════════════════

        // (Rest of the code remains similar)

        // Update Venda
        await supabase.from('vendas').update({
            nfe_emitida: true,
            nfe_status: statusNfe,
            nfe_ref: acbrId,
            nfe_mensagem: motivoStatus || 'Enviada para processamento'
        }).eq('id', venda_id);

        // Insert into notas_fiscais_emitidas
        await supabase.from('notas_fiscais_emitidas').insert({
            venda_id,
            acbr_id: acbrId,
            ambiente: ambiente,
            status: statusNfe,
            codigo_status: codigoStatus ? parseInt(String(codigoStatus), 10) : null,
            motivo_status: motivoStatus,
            natureza_operacao,
            data_emissao,
            chave_acesso: respData.chave || null,
            numero_nota: (respData.numero_nf || respData.numero) ? String(respData.numero_nf || respData.numero) : null,
            serie: respData.serie ? String(respData.serie) : null,
            protocolo_autorizacao: respData.numero_protocolo || respData.protocolo || null,
            emitente_cnpj: emitCnpj,
            emitente_razao_social: emitNome,
            destinatario_cpf_cnpj: clienteCpfCnpj,
            destinatario_nome: nomeCliente,
            destinatario_endereco: cliente.rua || cliente.endereco || cliente.logradouro,
            destinatario_numero: cliente.numero || 'SN',
            destinatario_bairro: cliente.bairro,
            destinatario_cidade: cliente.cidade,
            destinatario_uf: clienteUf,
            destinatario_cep: (cliente.cep || '').replace(/\D/g, ''),
            valor_total: vNF,
            valor_produtos: vProd,
            valor_desconto: vDesc,
            valor_frete: vFrete,
            emitido_por: usuario.nome,
            emitido_por_id: user_id,
            token_gerencial_id: tokenUsado ? tokenUsado.id : null,
        }).select().single();

        // ── Auditoria de evento fiscal ────────────────────────────────────────
        const { error: eventoErr } = await supabase.from('nfe_eventos').insert({
            venda_id,
            nfe_ref: acbrId,
            tipo_evento: 'emissao_enviada',
            status_novo: statusNfe,
            dados_resposta: respData,
            realizado_por: usuario.nome,
            realizado_por_id: user_id,
        });
        if (eventoErr) console.error('[emitir-nfe] Erro ao salvar evento:', eventoErr.message);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'NF-e enviada para processamento',
                ref: acbrId,
                status: statusNfe,
                codigo_status: codigoStatus,
                motivo_status: motivoStatus,
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
