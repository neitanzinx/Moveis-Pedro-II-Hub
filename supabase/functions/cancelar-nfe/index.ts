// Supabase Edge Function: cancelar-nfe
// Deploy: supabase functions deploy cancelar-nfe --no-verify-jwt
// API: ACBR API (multi-tenant)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAcbrToken } from '../_shared/acbrAuth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Only managers/admins can cancel NF-e
const ROLES_CANCELAMENTO = ['Administrador', 'Gerente', 'Gerente Geral'];

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { nfe_ref, justificativa, ambiente = 'homologacao', user_id, organization_id } = await req.json()

        if (!nfe_ref) {
            return new Response(
                JSON.stringify({ error: 'nfe_ref é obrigatório (ID da NF-e na ACBR API)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!justificativa || justificativa.length < 15) {
            return new Response(
                JSON.stringify({ error: 'Justificativa deve ter no mínimo 15 caracteres' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!user_id) {
            return new Response(
                JSON.stringify({ error: 'user_id é obrigatório' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ─── RBAC: Only managers/admins can cancel ───────────────────────────
        const { data: usuario, error: userError } = await supabase
            .from('public_users')
            .select('id, cargo, nome')
            .eq('id', user_id)
            .single();

        if (userError || !usuario) {
            throw new Error('Usuário não encontrado.');
        }

        if (!ROLES_CANCELAMENTO.includes(usuario.cargo)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Somente gerentes e administradores podem cancelar NF-e.',
                    code: 'ROLE_BLOCKED'
                }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ─── Resolve organization_id ─────────────────────────────────────────
        let orgId = organization_id;

        if (!orgId) {
            const { data: nfeRecord } = await supabase
                .from('notas_fiscais_emitidas')
                .select('venda_id')
                .eq('acbr_id', nfe_ref)
                .single();

            if (nfeRecord?.venda_id) {
                const { data: venda } = await supabase
                    .from('vendas')
                    .select('organization_id')
                    .eq('id', nfeRecord.venda_id)
                    .single();

                orgId = venda?.organization_id;
            }
        }

        if (!orgId) {
            return new Response(
                JSON.stringify({ error: 'Não foi possível identificar a organização.', configurado: false }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ─── Get ACBR Token ──────────────────────────────────────────────────
        let auth;
        try {
            auth = await getAcbrToken(supabase, orgId, ambiente);
        } catch (e) {
            return new Response(
                JSON.stringify({ error: (e as Error).message, configurado: false }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ─── ACBR API: Cancel ────────────────────────────────────────────────
        const cancelResponse = await fetch(`${auth.baseUrl}/nfe/${nfe_ref}/cancelamento`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ justificativa }),
        });

        const cancelData = await cancelResponse.json();

        if (!cancelResponse.ok) {
            const errMsg = cancelData.error?.message || cancelData.mensagem || JSON.stringify(cancelData);
            throw new Error(`Erro ao cancelar NF-e: ${errMsg}`);
        }

        // ─── Update Database Records ─────────────────────────────────────────
        await supabase
            .from('notas_fiscais_emitidas')
            .update({
                status: 'cancelado',
                motivo_status: justificativa,
                updated_at: new Date().toISOString(),
            })
            .eq('acbr_id', nfe_ref);

        // Also update vendas table
        await supabase
            .from('vendas')
            .update({
                nfe_emitida: false,
                nfe_status: 'cancelado',
                nfe_mensagem: `Cancelada por ${usuario.nome}: ${justificativa}`,
            })
            .eq('nfe_ref', nfe_ref);

        return new Response(
            JSON.stringify({
                success: true,
                status: 'cancelado',
                protocolo: cancelData.protocolo,
                mensagem: 'NF-e cancelada com sucesso',
                cancelado_por: usuario.nome,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Erro:', error);
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
