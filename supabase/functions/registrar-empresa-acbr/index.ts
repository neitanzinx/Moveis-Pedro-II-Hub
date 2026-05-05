import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAcbrMasterToken } from "../_shared/acbrAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sanitizeDigits(value: string) {
  return (value || "").replace(/\D/g, "");
}

function normalizeCep(cep: string) {
  return sanitizeDigits(cep || "").slice(0, 8);
}

function assertRequired(value: unknown, field: string) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`Campo obrigatório: ${field}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      organization_id,
      cnpj,
      nome_razao_social,
      email,
      endereco,
      certificado_base64,
      certificado_senha,
      ambiente,
    } = await req.json();

    assertRequired(organization_id, "organization_id");
    assertRequired(cnpj, "cnpj");
    assertRequired(nome_razao_social, "nome_razao_social");
    assertRequired(email, "email");
    assertRequired(endereco, "endereco");
    assertRequired(certificado_base64, "certificado_base64");
    assertRequired(certificado_senha, "certificado_senha");

    const cnpjLimpo = sanitizeDigits(cnpj);
    if (cnpjLimpo.length !== 14) {
      throw new Error("CNPJ inválido. Informe 14 dígitos.");
    }

    const enderecoPayload = {
      logradouro: String(endereco.logradouro || "").trim(),
      numero: String(endereco.numero || "").trim() || "SN",
      complemento: String(endereco.complemento || "").trim(),
      bairro: String(endereco.bairro || "").trim(),
      codigo_municipio: sanitizeDigits(String(endereco.codigo_municipio || "")),
      cidade: String(endereco.cidade || "").trim(),
      uf: String(endereco.uf || "").trim().toUpperCase(),
      codigo_pais: "1058",
      pais: "Brasil",
      cep: normalizeCep(String(endereco.cep || "")),
    };

    assertRequired(enderecoPayload.logradouro, "endereco.logradouro");
    assertRequired(enderecoPayload.bairro, "endereco.bairro");
    assertRequired(enderecoPayload.codigo_municipio, "endereco.codigo_municipio");
    assertRequired(enderecoPayload.cidade, "endereco.cidade");
    assertRequired(enderecoPayload.uf, "endereco.uf");
    assertRequired(enderecoPayload.cep, "endereco.cep");

    const ambienteAcbr = ambiente === "homologacao" ? "homologacao" : "producao";
    const authAcbr = await getAcbrMasterToken(ambienteAcbr);

    const acbrHeaders = {
      Authorization: `Bearer ${authAcbr.accessToken}`,
      "Content-Type": "application/json",
    };

    const consultarResp = await fetch(`${authAcbr.baseUrl}/empresas/${cnpjLimpo}`, {
      method: "GET",
      headers: acbrHeaders,
    });

    if (!consultarResp.ok && consultarResp.status !== 404) {
      const body = await consultarResp.text();
      throw new Error(`Erro ao consultar empresa na ACBR (${consultarResp.status}): ${body}`);
    }

    if (consultarResp.status === 404) {
      const criarResp = await fetch(`${authAcbr.baseUrl}/empresas`, {
        method: "POST",
        headers: acbrHeaders,
        body: JSON.stringify({
          cpf_cnpj: cnpjLimpo,
          nome_razao_social: String(nome_razao_social).trim(),
          email: String(email).trim(),
          endereco: enderecoPayload,
        }),
      });

      if (!criarResp.ok) {
        const body = await criarResp.text();
        throw new Error(`Erro ao cadastrar empresa na ACBR (${criarResp.status}): ${body}`);
      }
    }

    const certResp = await fetch(`${authAcbr.baseUrl}/empresas/${cnpjLimpo}/certificado`, {
      method: "PUT",
      headers: acbrHeaders,
      body: JSON.stringify({
        certificado: certificado_base64,
        password: certificado_senha,
      }),
    });

    if (!certResp.ok) {
      const body = await certResp.text();
      throw new Error(`Erro ao cadastrar certificado na ACBR (${certResp.status}): ${body}`);
    }

    const certData = await certResp.json();

    const updatePayload = {
      emitente_cnpj: cnpjLimpo,
      emitente_nome: String(nome_razao_social).trim(),
      emitente_email: String(email).trim(),
      emitente_logradouro: enderecoPayload.logradouro,
      emitente_numero: enderecoPayload.numero,
      emitente_complemento: enderecoPayload.complemento || null,
      emitente_bairro: enderecoPayload.bairro,
      emitente_municipio: enderecoPayload.cidade,
      emitente_codigo_municipio: enderecoPayload.codigo_municipio,
      emitente_uf: enderecoPayload.uf,
      emitente_cep: enderecoPayload.cep,
      acbr_empresa_registrada: true,
      acbr_certificado_validade: certData.not_valid_after || null,
      acbr_certificado_thumbprint: certData.thumbprint || null,
    };

    let updateQuery = supabase
      .from("organization_nfe_configs")
      .update(updatePayload)
      .eq("organization_id", organization_id);

    if (ambiente) {
      updateQuery = updateQuery.eq("ambiente", ambiente);
    }

    const { error: updateErr } = await updateQuery;
    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Empresa e certificado registrados na ACBR com sucesso.",
        data: {
          cnpj: cnpjLimpo,
          certificado_validade: certData.not_valid_after || null,
          thumbprint: certData.thumbprint || null,
          serial_number: certData.serial_number || null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[registrar-empresa-acbr] erro:", error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
