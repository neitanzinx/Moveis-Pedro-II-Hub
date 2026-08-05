// Supabase Edge Function: aprovar-nfe
// Deploy: supabase functions deploy aprovar-nfe --no-verify-jwt
// Gerencia o fluxo de aprovação fiscal: solicitar | aprovar | reprovar

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Quem pode solicitar NF-e (qualquer cargo que lida com vendas)
const ROLES_SOLICITAR = ['Administrador', 'Gerente', 'Gerente Geral', 'Vendedor', 'Financeiro'];

// Quem pode aprovar ou reprovar (gerência e acima)
const ROLES_APROVAR = ['Administrador', 'Gerente', 'Gerente Geral', 'Financeiro'];

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { venda_id, user_id, acao, motivo_reprovacao } = await req.json()

        if (!venda_id) throw new Error('venda_id é obrigatório')
        if (!user_id) throw new Error('user_id é obrigatório')

        const acoes = ['solicitar', 'aprovar', 'reprovar', 'auto_aprovar']
        if (!acao || !acoes.includes(acao)) {
            throw new Error(`acao deve ser: ${acoes.join(', ')}`)
        }

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

        // 'auto_aprovar' solicita + aprova atomicamente (para gerentes em uma ação)
        if (acao === 'auto_aprovar' || acao === 'aprovar' || acao === 'reprovar') {
            if (!ROLES_APROVAR.includes(usuario.cargo)) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Somente gerentes, administradores e financeiro podem aprovar ou reprovar NF-e.',
                        code: 'ROLE_BLOCKED'
                    }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        if (acao === 'solicitar') {
            if (!ROLES_SOLICITAR.includes(usuario.cargo)) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Seu perfil não tem permissão para solicitar emissão de NF-e.',
                        code: 'ROLE_BLOCKED'
                    }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // ─── Buscar venda ─────────────────────────────────────────────────────
        const { data: venda, error: vendaError } = await supabase
            .from('vendas')
            .select('id, status, nfe_emitida, nfe_status, nfe_solicitada, nfe_aprovada, nfe_reprovada, organization_id')
            .eq('id', venda_id)
            .single()

        if (vendaError || !venda) throw new Error('Venda não encontrada')
        if (venda.status === 'Cancelado') {
            throw new Error('Não é possível solicitar NF-e para venda cancelada')
        }

        let updateData: Record<string, unknown> = {}
        let eventoTipo = ''

        // ─── Lógica por ação ─────────────────────────────────────────────────
        if (acao === 'solicitar') {
            if (venda.nfe_emitida && venda.nfe_status === 'autorizado') {
                throw new Error('Venda já possui NF-e autorizada')
            }
            updateData = {
                nfe_solicitada: true,
                nfe_aprovada: false,
                nfe_reprovada: false,
                nfe_reprovada_motivo: null,
            }
            eventoTipo = 'solicitacao_emissao'
        }

        if (acao === 'aprovar') {
            if (!venda.nfe_solicitada) {
                throw new Error('NF-e não foi solicitada para esta venda')
            }
            if (venda.nfe_aprovada) {
                throw new Error('NF-e já está aprovada para emissão')
            }
            updateData = {
                nfe_aprovada: true,
                nfe_aprovada_por: usuario.nome,
                nfe_aprovada_em: new Date().toISOString(),
                nfe_reprovada: false,
                nfe_reprovada_motivo: null,
            }
            eventoTipo = 'aprovacao_emissao'
        }

        if (acao === 'reprovar') {
            if (!venda.nfe_solicitada) {
                throw new Error('NF-e não foi solicitada para esta venda')
            }
            if (!motivo_reprovacao || motivo_reprovacao.trim().length < 5) {
                throw new Error('Informe o motivo da reprovação (mínimo 5 caracteres)')
            }
            updateData = {
                nfe_aprovada: false,
                nfe_reprovada: true,
                nfe_reprovada_motivo: motivo_reprovacao.trim(),
            }
            eventoTipo = 'reprovacao_emissao'
        }

        if (acao === 'auto_aprovar') {
            // Gerente solicita + aprova em um único passo
            updateData = {
                nfe_solicitada: true,
                nfe_aprovada: true,
                nfe_aprovada_por: usuario.nome,
                nfe_aprovada_em: new Date().toISOString(),
                nfe_reprovada: false,
                nfe_reprovada_motivo: null,
            }
            eventoTipo = 'auto_aprovacao_emissao'
        }

        // ─── Atualizar venda ─────────────────────────────────────────────────
        const { error: updateError } = await supabase
            .from('vendas')
            .update(updateData)
            .eq('id', venda_id)

        if (updateError) throw new Error('Erro ao atualizar venda: ' + updateError.message)

        // ─── Auditoria de evento ──────────────────────────────────────────────
        await supabase.from('nfe_eventos').insert({
            organization_id: venda.organization_id || null,
            venda_id,
            tipo_evento: eventoTipo,
            dados_resposta: { acao, motivo_reprovacao: motivo_reprovacao?.trim() ?? null },
            realizado_por: usuario.nome,
            realizado_por_id: user_id,
        }).then(({ error: auditErr }) => {
            if (auditErr) console.error('[aprovar-nfe] Audit insert failed:', auditErr)
        })

        const mensagens: Record<string, string> = {
            solicitar:    'Solicitação registrada. Aguarde aprovação gerencial.',
            aprovar:      'NF-e aprovada para emissão.',
            reprovar:     'NF-e reprovada.',
            auto_aprovar: 'NF-e autorizada para emissão.',
        }

        return new Response(
            JSON.stringify({
                success: true,
                acao,
                message: mensagens[acao],
                realizado_por: usuario.nome,
                update: updateData,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[aprovar-nfe]', error)
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
