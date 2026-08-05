import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAcbrToken } from '../_shared/acbrAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Acao = 'solicitar' | 'aprovar' | 'reprovar' | 'executar'
type TipoEvento = 'cancelamento' | 'carta_correcao' | 'inutilizacao'

const ROLES_SOLICITAR = ['Administrador', 'Gerente', 'Gerente Geral', 'Vendedor', 'Financeiro']
const ROLES_APROVAR = ['Administrador', 'Gerente', 'Gerente Geral', 'Financeiro']

async function resolveOrganizationId(supabase: any, vendaId?: string, nfeRef?: string) {
  if (vendaId) {
    const { data: venda } = await supabase
      .from('vendas')
      .select('organization_id')
      .eq('id', vendaId)
      .maybeSingle()

    if (venda?.organization_id) return venda.organization_id
  }

  if (nfeRef) {
    const { data: nfe } = await supabase
      .from('notas_fiscais_emitidas')
      .select('venda_id')
      .eq('acbr_id', nfeRef)
      .maybeSingle()

    if (nfe?.venda_id) {
      const { data: venda } = await supabase
        .from('vendas')
        .select('organization_id')
        .eq('id', nfe.venda_id)
        .maybeSingle()

      if (venda?.organization_id) return venda.organization_id
    }
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      acao,
      tipo_evento,
      solicitacao_id,
      venda_id,
      nfe_ref,
      organization_id,
      user_id,
      ambiente = 'homologacao',
      justificativa,
      descricao_correcao,
      inutilizacao,
      motivo_reprovacao,
    } = await req.json()

    const acoes: Acao[] = ['solicitar', 'aprovar', 'reprovar', 'executar']
    const tipos: TipoEvento[] = ['cancelamento', 'carta_correcao', 'inutilizacao']

    if (!acao || !acoes.includes(acao)) throw new Error(`acao deve ser: ${acoes.join(', ')}`)
    if (!tipo_evento || !tipos.includes(tipo_evento)) throw new Error(`tipo_evento deve ser: ${tipos.join(', ')}`)
    if (!user_id) throw new Error('user_id é obrigatório')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: usuario, error: userError } = await supabase
      .from('public_users')
      .select('id, nome, cargo')
      .eq('id', user_id)
      .single()

    if (userError || !usuario) throw new Error('Usuário não encontrado')

    if (acao === 'solicitar' && !ROLES_SOLICITAR.includes(usuario.cargo)) {
      return new Response(JSON.stringify({ success: false, error: 'Perfil sem permissão para solicitar evento fiscal', code: 'ROLE_BLOCKED' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if ((acao === 'aprovar' || acao === 'reprovar' || acao === 'executar') && !ROLES_APROVAR.includes(usuario.cargo)) {
      return new Response(JSON.stringify({ success: false, error: 'Somente gerência pode aprovar/reprovar/executar evento fiscal', code: 'ROLE_BLOCKED' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (acao === 'solicitar') {
      const orgId = organization_id || await resolveOrganizationId(supabase, venda_id, nfe_ref)
      if (!orgId) throw new Error('organization_id não identificado para a solicitação')

      if (tipo_evento === 'cancelamento') {
        if (!nfe_ref) throw new Error('nfe_ref é obrigatório para cancelamento')
        if (!justificativa || justificativa.trim().length < 15) {
          throw new Error('Justificativa de cancelamento deve ter no mínimo 15 caracteres')
        }
      }

      if (tipo_evento === 'carta_correcao') {
        if (!nfe_ref) throw new Error('nfe_ref é obrigatório para carta de correção')
        if (!descricao_correcao || descricao_correcao.trim().length < 15) {
          throw new Error('Descrição da CC-e deve ter no mínimo 15 caracteres')
        }
      }

      if (tipo_evento === 'inutilizacao') {
        if (!inutilizacao?.cnpj || !inutilizacao?.ano || !inutilizacao?.serie || !inutilizacao?.numero_inicial || !inutilizacao?.numero_final) {
          throw new Error('Dados de inutilização incompletos (cnpj, ano, serie, numero_inicial, numero_final)')
        }
        if (!inutilizacao?.justificativa || inutilizacao.justificativa.trim().length < 15) {
          throw new Error('Justificativa de inutilização deve ter no mínimo 15 caracteres')
        }
      }

      const payload = {
        justificativa: justificativa?.trim() || null,
        descricao_correcao: descricao_correcao?.trim() || null,
        inutilizacao: inutilizacao || null,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('nfe_eventos_solicitacoes')
        .insert({
          organization_id: orgId,
          venda_id: venda_id || null,
          nfe_ref: nfe_ref || null,
          ambiente,
          tipo_evento,
          payload,
          status_solicitacao: 'pendente_aprovacao',
          solicitante_nome: usuario.nome,
          solicitante_id: user_id,
          mensagem_status: 'Solicitação registrada e aguardando aprovação',
        })
        .select('*')
        .single()

      if (insertError) throw new Error(insertError.message)

      await supabase.from('nfe_eventos').insert({
        organization_id: orgId,
        venda_id: venda_id || null,
        nfe_ref: nfe_ref || null,
        tipo_evento: `solicitacao_${tipo_evento}`,
        status_novo: 'pendente_aprovacao',
        dados_resposta: { solicitacao_id: inserted.id },
        realizado_por: usuario.nome,
        realizado_por_id: user_id,
      })

      return new Response(JSON.stringify({
        success: true,
        acao,
        solicitacao: inserted,
        message: 'Solicitação registrada. Aguarde aprovação gerencial.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!solicitacao_id) throw new Error('solicitacao_id é obrigatório para aprovar/reprovar/executar')

    const { data: solicitacao, error: solError } = await supabase
      .from('nfe_eventos_solicitacoes')
      .select('*')
      .eq('id', solicitacao_id)
      .single()

    if (solError || !solicitacao) throw new Error('Solicitação não encontrada')

    if (acao === 'aprovar') {
      if (solicitacao.status_solicitacao !== 'pendente_aprovacao') {
        throw new Error(`Só é possível aprovar solicitação pendente. Status atual: ${solicitacao.status_solicitacao}`)
      }

      const { data: updated, error: updateError } = await supabase
        .from('nfe_eventos_solicitacoes')
        .update({
          status_solicitacao: 'aprovado',
          aprovador_nome: usuario.nome,
          aprovador_id: user_id,
          approved_at: new Date().toISOString(),
          mensagem_status: 'Solicitação aprovada e pronta para execução',
        })
        .eq('id', solicitacao_id)
        .select('*')
        .single()

      if (updateError) throw new Error(updateError.message)

      await supabase.from('nfe_eventos').insert({
        organization_id: solicitacao.organization_id,
        venda_id: solicitacao.venda_id,
        nfe_ref: solicitacao.nfe_ref,
        tipo_evento: `aprovacao_${solicitacao.tipo_evento}`,
        status_anterior: 'pendente_aprovacao',
        status_novo: 'aprovado',
        dados_resposta: { solicitacao_id },
        realizado_por: usuario.nome,
        realizado_por_id: user_id,
      })

      return new Response(JSON.stringify({ success: true, acao, solicitacao: updated, message: 'Solicitação aprovada.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (acao === 'reprovar') {
      if (solicitacao.status_solicitacao !== 'pendente_aprovacao') {
        throw new Error(`Só é possível reprovar solicitação pendente. Status atual: ${solicitacao.status_solicitacao}`)
      }
      if (!motivo_reprovacao || motivo_reprovacao.trim().length < 5) {
        throw new Error('Motivo da reprovação deve ter no mínimo 5 caracteres')
      }

      const { data: updated, error: updateError } = await supabase
        .from('nfe_eventos_solicitacoes')
        .update({
          status_solicitacao: 'reprovado',
          aprovador_nome: usuario.nome,
          aprovador_id: user_id,
          approved_at: new Date().toISOString(),
          reprovado_motivo: motivo_reprovacao.trim(),
          mensagem_status: `Reprovado: ${motivo_reprovacao.trim()}`,
        })
        .eq('id', solicitacao_id)
        .select('*')
        .single()

      if (updateError) throw new Error(updateError.message)

      await supabase.from('nfe_eventos').insert({
        organization_id: solicitacao.organization_id,
        venda_id: solicitacao.venda_id,
        nfe_ref: solicitacao.nfe_ref,
        tipo_evento: `reprovacao_${solicitacao.tipo_evento}`,
        status_anterior: 'pendente_aprovacao',
        status_novo: 'reprovado',
        motivo_sefaz: motivo_reprovacao.trim(),
        dados_resposta: { solicitacao_id },
        realizado_por: usuario.nome,
        realizado_por_id: user_id,
      })

      return new Response(JSON.stringify({ success: true, acao, solicitacao: updated, message: 'Solicitação reprovada.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // executar
    if (solicitacao.status_solicitacao !== 'aprovado') {
      throw new Error(`Só é possível executar solicitação aprovada. Status atual: ${solicitacao.status_solicitacao}`)
    }

    await supabase
      .from('nfe_eventos_solicitacoes')
      .update({ status_solicitacao: 'executando', mensagem_status: 'Executando evento junto à ACBR API...' })
      .eq('id', solicitacao_id)

    const auth = await getAcbrToken(supabase, solicitacao.organization_id, solicitacao.ambiente)

    let apiResponse: any = null
    let protocolo: string | null = null

    if (solicitacao.tipo_evento === 'cancelamento') {
      if (!solicitacao.nfe_ref) throw new Error('nfe_ref ausente na solicitação de cancelamento')

      const payloadJustificativa = solicitacao.payload?.justificativa
      if (!payloadJustificativa || payloadJustificativa.length < 15) {
        throw new Error('Justificativa inválida para cancelamento')
      }

      const { data: nfeRecord } = await supabase
        .from('notas_fiscais_emitidas')
        .select('status, venda_id')
        .eq('acbr_id', solicitacao.nfe_ref)
        .single()

      if (!nfeRecord) throw new Error('NF-e não encontrada para cancelamento')
      if (nfeRecord.status !== 'autorizado') {
        throw new Error(`Cancelamento só é permitido para NF-e autorizada. Status atual: ${nfeRecord.status}`)
      }

      const cancelResponse = await fetch(`${auth.baseUrl}/nfe/${solicitacao.nfe_ref}/cancelamento`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ justificativa: payloadJustificativa }),
      })

      apiResponse = await cancelResponse.json()
      if (!cancelResponse.ok) {
        const msg = apiResponse?.error?.message || apiResponse?.mensagem || JSON.stringify(apiResponse)
        throw new Error(`Erro ao cancelar NF-e: ${msg}`)
      }

      protocolo = apiResponse?.protocolo || null

      await supabase
        .from('notas_fiscais_emitidas')
        .update({ status: 'cancelado', motivo_status: payloadJustificativa, updated_at: new Date().toISOString() })
        .eq('acbr_id', solicitacao.nfe_ref)

      await supabase
        .from('vendas')
        .update({ nfe_emitida: false, nfe_status: 'cancelado', nfe_mensagem: `Cancelada por ${usuario.nome}: ${payloadJustificativa}` })
        .eq('nfe_ref', solicitacao.nfe_ref)

      await supabase.from('nfe_eventos').insert({
        organization_id: solicitacao.organization_id,
        venda_id: solicitacao.venda_id,
        nfe_ref: solicitacao.nfe_ref,
        tipo_evento: 'cancelamento',
        status_novo: 'cancelado',
        motivo_sefaz: payloadJustificativa,
        protocolo,
        dados_resposta: apiResponse,
        realizado_por: usuario.nome,
        realizado_por_id: user_id,
      })
    }

    if (solicitacao.tipo_evento === 'carta_correcao') {
      if (!solicitacao.nfe_ref) throw new Error('nfe_ref ausente na solicitação de CC-e')

      const descricao = solicitacao.payload?.descricao_correcao
      if (!descricao || descricao.length < 15) throw new Error('Descrição de CC-e inválida')

      const { data: nfeRecord, error: nfeError } = await supabase
        .from('notas_fiscais_emitidas')
        .select('id, venda_id, status')
        .eq('acbr_id', solicitacao.nfe_ref)
        .single()

      if (nfeError || !nfeRecord) throw new Error('NF-e não encontrada para CC-e')
      if (nfeRecord.status !== 'autorizado') {
        throw new Error(`CC-e só pode ser criada para NF-e autorizada. Status atual: ${nfeRecord.status}`)
      }

      const { data: ultimaCce } = await supabase
        .from('nfe_carta_correcao')
        .select('sequencia')
        .eq('nota_fiscal_id', nfeRecord.id)
        .order('sequencia', { ascending: false })
        .limit(1)
        .maybeSingle()

      const proximaSequencia = (ultimaCce?.sequencia ?? 0) + 1
      if (proximaSequencia > 20) throw new Error('Limite máximo de 20 cartas de correção por NF-e atingido')

      const cceResponse = await fetch(`${auth.baseUrl}/nfe/${solicitacao.nfe_ref}/carta-correcao`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ descricao_correcao: descricao }),
      })

      apiResponse = await cceResponse.json()
      if (!cceResponse.ok) {
        const msg = apiResponse?.error?.message || apiResponse?.mensagem || JSON.stringify(apiResponse)
        throw new Error(`Erro ao criar CC-e: ${msg}`)
      }

      protocolo = apiResponse?.protocolo || null

      await supabase.from('nfe_carta_correcao').insert({
        organization_id: solicitacao.organization_id,
        nota_fiscal_id: nfeRecord.id,
        nfe_ref: solicitacao.nfe_ref,
        sequencia: proximaSequencia,
        descricao_correcao: descricao,
        status: apiResponse?.status || 'enviado',
        protocolo,
        data_evento: apiResponse?.data_evento || new Date().toISOString(),
        criado_por: usuario.nome,
        criado_por_id: user_id,
        dados_resposta: apiResponse,
      })

      await supabase.from('nfe_eventos').insert({
        organization_id: solicitacao.organization_id,
        venda_id: nfeRecord.venda_id,
        nfe_ref: solicitacao.nfe_ref,
        tipo_evento: 'carta_correcao',
        status_novo: apiResponse?.status || 'enviado',
        protocolo,
        dados_resposta: apiResponse,
        realizado_por: usuario.nome,
        realizado_por_id: user_id,
      })
    }

    if (solicitacao.tipo_evento === 'inutilizacao') {
      const inutilizacaoPayload = solicitacao.payload?.inutilizacao
      if (!inutilizacaoPayload?.cnpj) throw new Error('CNPJ é obrigatório para inutilização')

      const inutilResponse = await fetch(`${auth.baseUrl}/nfe/inutilizacoes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ambiente: solicitacao.ambiente,
          cnpj: inutilizacaoPayload.cnpj,
          ano: Number(inutilizacaoPayload.ano),
          serie: Number(inutilizacaoPayload.serie),
          numero_inicial: Number(inutilizacaoPayload.numero_inicial),
          numero_final: Number(inutilizacaoPayload.numero_final),
          justificativa: inutilizacaoPayload.justificativa,
        }),
      })

      apiResponse = await inutilResponse.json()
      if (!inutilResponse.ok) {
        const msg = apiResponse?.error?.message || apiResponse?.mensagem || JSON.stringify(apiResponse)
        throw new Error(`Erro ao inutilizar numeração: ${msg}`)
      }

      protocolo = apiResponse?.protocolo || null

      await supabase.from('nfe_eventos').insert({
        organization_id: solicitacao.organization_id,
        venda_id: solicitacao.venda_id || null,
        nfe_ref: solicitacao.nfe_ref || null,
        tipo_evento: 'inutilizacao',
        status_novo: apiResponse?.status || 'processando',
        protocolo,
        dados_resposta: apiResponse,
        realizado_por: usuario.nome,
        realizado_por_id: user_id,
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('nfe_eventos_solicitacoes')
      .update({
        status_solicitacao: 'executado',
        executado_por_nome: usuario.nome,
        executado_por_id: user_id,
        executed_at: new Date().toISOString(),
        protocolo,
        dados_resposta: apiResponse,
        mensagem_status: 'Evento executado com sucesso',
      })
      .eq('id', solicitacao_id)
      .select('*')
      .single()

    if (updateError) throw new Error(updateError.message)

    return new Response(JSON.stringify({
      success: true,
      acao,
      solicitacao: updated,
      message: 'Evento fiscal executado com sucesso.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[gerir-evento-nfe]', error)
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
