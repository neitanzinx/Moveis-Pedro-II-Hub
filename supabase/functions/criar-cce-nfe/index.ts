// Supabase Edge Function: criar-cce-nfe
// Deploy: supabase functions deploy criar-cce-nfe --no-verify-jwt
// Cria Carta de Correção Eletrônica (CC-e) via POST /nfe/{id}/carta-correcao

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAcbrToken } from '../_shared/acbrAuth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES_PODE_CORRIGIR = ['Administrador', 'Gerente', 'Gerente Geral'];

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            nfe_ref,
            descricao_correcao,
            user_id,
            ambiente = 'producao',
            organization_id,
        } = await req.json()

        if (!nfe_ref) throw new Error('nfe_ref (ID da NF-e na ACBR API) é obrigatório')
        if (!descricao_correcao || descricao_correcao.trim().length < 15) {
            throw new Error('A descrição da correção deve ter no mínimo 15 caracteres')
        }
        if (!user_id) throw new Error('user_id é obrigatório')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ─── RBAC ────────────────────────────────────────────────────────────
        const { data: usuario, error: userError } = await supabase
            .from('public_users')
            .select('id, cargo, nome')
            .eq('id', user_id)
            .single()

        if (userError || !usuario) throw new Error('Usuário não encontrado')
        if (!ROLES_PODE_CORRIGIR.includes(usuario.cargo)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Somente gerentes e administradores podem emitir Carta de Correção.',
                    code: 'ROLE_BLOCKED',
                }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ─── Buscar nota no banco ────────────────────────────────────────────
        const { data: nfeRecord, error: nfeError } = await supabase
            .from('notas_fiscais_emitidas')
            .select('id, venda_id, status, chave_acesso')
            .eq('acbr_id', nfe_ref)
            .single()

        if (nfeError || !nfeRecord) throw new Error('NF-e não encontrada no banco de dados')
        if (nfeRecord.status !== 'autorizado') {
            throw new Error(`CC-e só pode ser criada para NF-e autorizada. Status atual: ${nfeRecord.status}`)
        }

        // ─── Resolver organization_id ─────────────────────────────────────────
        let orgId = organization_id
        if (!orgId && nfeRecord.venda_id) {
            const { data: venda } = await supabase
                .from('vendas')
                .select('organization_id')
                .eq('id', nfeRecord.venda_id)
                .single()
            orgId = venda?.organization_id
        }
        if (!orgId) throw new Error('Organização não identificada')

        // ─── Calcular próxima sequência (máx 20) ─────────────────────────────
        const { data: ultimaCce } = await supabase
            .from('nfe_carta_correcao')
            .select('sequencia')
            .eq('nota_fiscal_id', nfeRecord.id)
            .order('sequencia', { ascending: false })
            .limit(1)
            .maybeSingle()

        const proximaSequencia = (ultimaCce?.sequencia ?? 0) + 1
        if (proximaSequencia > 20) {
            throw new Error('Limite máximo de 20 cartas de correção por NF-e atingido')
        }

        // ─── Obter token ACBR ─────────────────────────────────────────────────
        const auth = await getAcbrToken(supabase, orgId, ambiente)

        // ─── POST /nfe/{id}/carta-correcao ────────────────────────────────────
        const cceResponse = await fetch(`${auth.baseUrl}/nfe/${nfe_ref}/carta-correcao`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ descricao_correcao: descricao_correcao.trim() }),
        })

        const cceData = await cceResponse.json()

        if (!cceResponse.ok) {
            const errMsg = cceData?.error?.message || cceData?.mensagem || JSON.stringify(cceData)
            throw new Error(`Erro ao criar CC-e: ${errMsg}`)
        }

        // ─── Persistir CC-e no banco ─────────────────────────────────────────
        const { error: insertError } = await supabase.from('nfe_carta_correcao').insert({
            organization_id: orgId,
            nota_fiscal_id: nfeRecord.id,
            nfe_ref,
            sequencia: proximaSequencia,
            descricao_correcao: descricao_correcao.trim(),
            status: cceData.status ?? 'enviado',
            protocolo: cceData.protocolo ?? null,
            data_evento: cceData.data_evento ?? new Date().toISOString(),
            criado_por: usuario.nome,
            criado_por_id: user_id,
            dados_resposta: cceData,
        })

        if (insertError) {
            console.error('[criar-cce-nfe] Erro ao salvar CC-e:', insertError)
        }

        // ─── Auditoria ────────────────────────────────────────────────────────
        await supabase.from('nfe_eventos').insert({
            organization_id: orgId,
            venda_id: nfeRecord.venda_id,
            nfe_ref,
            tipo_evento: 'carta_correcao',
            status_novo: cceData.status ?? 'enviado',
            protocolo: cceData.protocolo ?? null,
            dados_resposta: cceData,
            realizado_por: usuario.nome,
            realizado_por_id: user_id,
        })

        return new Response(
            JSON.stringify({
                success: true,
                sequencia: proximaSequencia,
                status: cceData.status,
                protocolo: cceData.protocolo,
                message: `Carta de Correção nº ${proximaSequencia} enviada com sucesso`,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[criar-cce-nfe]', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
