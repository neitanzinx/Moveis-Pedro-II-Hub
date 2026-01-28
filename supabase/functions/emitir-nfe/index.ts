// Supabase Edge Function: emitir-nfe
// Deploy: supabase functions deploy emitir-nfe --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();

        // Ping check
        if (body.ping) {
            return new Response(
                JSON.stringify({ success: true, message: 'Focus NFe V2 Service Ready' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { venda_id, ambiente = 'homologacao' } = body;

        if (!venda_id) {
            throw new Error('venda_id é obrigatório');
        }

        // Initialize Supabase Admin Client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Busca Contextual: Venda + Itens + Cliente
        const { data: venda, error: vendaError } = await supabase
            .from('vendas')
            .select(`
                *,
                itens:venda_itens (
                    *,
                    produto:produtos (*)
                ),
                cliente:clientes (*)
            `)
            .eq('id', venda_id)
            .single();

        // Fallback for flat structure if relation is different (based on previous file analysis)
        // Previous file used: select('*') and then fetched cliente separately using venda.cliente_id
        // and used venda.itens (JSONB) if available.
        // Let's stick to the robust method: Fetch Venda, then Cliente.

        let vendaData = venda;
        if (!vendaData && !vendaError) {
            // Try fetching simple if the join failed due to missing relation
            const { data: simpleVenda, error: simpleError } = await supabase
                .from('vendas')
                .select('*')
                .eq('id', venda_id)
                .single();
            if (simpleError) throw simpleError;
            vendaData = simpleVenda;
        }

        if (!vendaData) throw new Error('Venda não encontrada');

        // Fetch Cliente
        const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', vendaData.cliente_id)
            .single();

        if (clienteError || !cliente) throw new Error('Cliente detectado na venda não encontrado no banco');

        // Resolve Itens (Check if it's JSONB column 'itens' or relation)
        // Previous code used `const itens = venda.itens || []`.
        // We will stick to that but also look for relations if needed.
        let itens = vendaData.itens;
        if (!itens || !Array.isArray(itens)) {
            // Try fetching from `itens_venda` or similar if exists, but simplified schema suggests JSONB or separate query.
            // Previous code assumed `venda.itens` exists.
            itens = [];
        }

        // Need to ensure we have NCM. Previous code used `item.ncm` or defaults.
        // Now we need `organization_id`.

        const organization_id = vendaData.organization_id;
        if (!organization_id) {
            throw new Error('Venda não associada a uma organização (organization_id is null). Configure a empresa.');
        }

        // 2. Recuperação de Credencial
        const { data: config, error: configError } = await supabase
            .from('organization_nfe_configs')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('ambiente', ambiente)
            .single();

        if (configError || !config) {
            throw new Error(`NFe não configurada para esta empresa no ambiente: ${ambiente}`);
        }

        // 3. Validação Fiscal (NCM)
        // We need to fetch products to get stored NCM if they are not in the item JSON
        // If items in JSON don't have NCM, we might need to query `produtos` table.
        // The previous code did: `item.ncm || '94036000'`.
        // The prompt says: "Se algum estiver null, aborte e avise qual produto falta."

        const validatedItems = [];
        for (const item of itens) {
            let ncm = item.ncm;
            let cest = item.cest; // Should be in item normally or product

            // If missing in item JSON, fetch from product
            if (!ncm) {
                const { data: prod } = await supabase
                    .from('produtos')
                    .select('ncm, cest, nome')
                    .eq('id', item.produto_id)
                    .single();

                if (prod) {
                    ncm = prod.ncm;
                    cest = prod.cest;
                }
            }

            if (!ncm) {
                throw new Error(`Produto sem NCM: ${item.produto_nome || item.nome || 'Item desconhecido'}`);
            }

            validatedItems.push({ ...item, ncm, cest });
        }

        // 4. Mapeamento Focus NFe
        // Docs: https://focusnfe.com.br/doc/v2/nfe/

        const natureza_operacao = config.natureza_operacao_padrao || 'Venda de Mercadoria';
        const data_emissao = new Date().toISOString();

        // Focus NFe Payload
        const nfePayload = {
            natureza_operacao: natureza_operacao,
            data_emissao: data_emissao,
            tipo_documento: 1, // 1=Saída
            finalidade_emissao: 1, // 1=Normal
            local_destino: 1, // 1=Interna
            presenca_comprador: 1, // 1=Presencial
            consumidor_final: 1, // 1=Sim

            cliente: {
                cpf: cliente.cpf || cliente.cnpj,
                nome_completo: cliente.nome_completo || cliente.razao_social,
                endereco: cliente.endereco,
                numero: cliente.numero || 'SN',
                bairro: cliente.bairro,
                cidade: cliente.cidade,
                uf: cliente.estado,
                cep: cliente.cep ? cliente.cep.replace(/\D/g, '') : null,
                telefone: cliente.telefone ? cliente.telefone.replace(/\D/g, '') : null,
                email: cliente.email
            },

            items: validatedItems.map((item, index) => ({
                numero_item: index + 1,
                codigo_produto: item.produto_id,
                descricao: item.produto_nome || item.nome,
                cfop: "5102", // Simples: Venda
                unidade_comercial: "UN",
                quantidade_comercial: item.quantidade,
                valor_unitario_comercial: item.preco_unitario || item.preco_venda,
                unidade_tributavel: "UN",
                quantidade_tributavel: item.quantidade,
                valor_unitario_tributavel: item.preco_unitario || item.preco_venda,
                ncm: item.ncm,
                cest: item.cest,
                inclui_no_total: 1,
                icms_origem: 0,
                icms_situacao_tributaria: "102", // Simples Nacional
                pis_situacao_tributaria: "07", // Isento Simples
                cofins_situacao_tributaria: "07" // Isento Simples
            })),

            // Pagamento
            formas_pagamento: [{
                forma_pagamento: mapFormaPagamento(vendaData.forma_pagamento || "Dinheiro"), // Need helper
                valor_pagamento: vendaData.valor_total
            }]
        };

        // 5. Envio para Focus NFe
        // URL
        const baseUrl = ambiente === 'producao'
            ? 'https://api.focusnfe.com.br/v2'
            : 'https://homologacao.focusnfe.com.br/v2'; // Note the subdomain for sandbox

        // Use ref to track
        const ref = `venda_${venda_id}_${Date.now()}`;

        const response = await fetch(`${baseUrl}/nfe?ref=${ref}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(config.focus_token + ':') // Basic Auth with token as username
            },
            body: JSON.stringify(nfePayload)
        });

        const respData = await response.json();

        if (!response.ok) {
            throw new Error(`Erro Focus NFe: ${respData.mensagem || response.statusText} - ${JSON.stringify(respData.erros || '')}`);
        }

        // 6. Salvar retorno
        // Focus returns { status: "processando", ref: "..." } or similar
        // Update Venda with ref and status

        await supabase.from('vendas').update({
            nfe_emitida: true, // Mark as attempted/emitted
            nfe_status: respData.status, // 'processando' or 'autorizado'
            nfe_ref: ref, // To query later
            // Store raw response if needed in a separate log table, but for now just status
            nfe_mensagem: respData.mensagem
        }).eq('id', venda_id);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'NFe enviada para processamento',
                ref: ref,
                status: respData.status
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

// Helper functions
const mapFormaPagamento = (forma: string): string => {
    // Focus codes: 01=Dinheiro, 03=Cartão Crédito, 04=Cartão Débito, 17=PIX
    const normalized = forma.toLowerCase();
    if (normalized.includes('dinheiro')) return '01';
    if (normalized.includes('crédito')) return '03';
    if (normalized.includes('débito')) return '04';
    if (normalized.includes('pix')) return '17';
    if (normalized.includes('boleto')) return '15';
    return '99'; // Outros
};
