// _shared/acbrAuth.ts
// Helper compartilhado para autenticação OAuth2 na ACBR API
// Multi-tenant: cada organization_id tem suas próprias credenciais

interface AcbrConfig {
    acbr_client_id: string;
    acbr_client_secret: string;
    acbr_access_token: string | null;
    acbr_token_expires_at: string | null;
}

interface AuthResult {
    accessToken: string;
    baseUrl: string;
}

const AUTH_URL = 'https://auth.acbr.api.br/realms/ACBrAPI/protocol/openid-connect/token';

export function getAcbrBaseUrl(ambiente: string): string {
    return ambiente === 'producao'
        ? 'https://prod.acbr.api.br'
        : 'https://hom.acbr.api.br';
}

/**
 * Obtém um Bearer token OAuth2 usando credenciais master da integração ACBr.
 * Secrets esperados: ACBR_MASTER_CLIENT_ID e ACBR_MASTER_CLIENT_SECRET.
 */
export async function getAcbrMasterToken(ambiente: string): Promise<AuthResult> {
    const denoRuntime = (globalThis as unknown as {
        Deno?: { env: { get: (key: string) => string | undefined } };
    }).Deno;
    const clientId = denoRuntime?.env.get('ACBR_MASTER_CLIENT_ID')?.trim();
    const clientSecret = denoRuntime?.env.get('ACBR_MASTER_CLIENT_SECRET')?.trim();

    if (!clientId || !clientSecret) {
        throw new Error(
            'Credenciais master da ACBR API não configuradas. Defina ACBR_MASTER_CLIENT_ID e ACBR_MASTER_CLIENT_SECRET nos secrets da Edge Function.'
        );
    }

    const baseUrl = getAcbrBaseUrl(ambiente);

    const tokenResponse = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'nfe',
        }).toString(),
    });

    if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        console.error('[ACBR] Erro ao obter token master:', tokenResponse.status, errBody);

        if (tokenResponse.status === 401 || tokenResponse.status === 400) {
            throw new Error(
                'Credenciais master da ACBR API inválidas. Verifique ACBR_MASTER_CLIENT_ID e ACBR_MASTER_CLIENT_SECRET.'
            );
        }

        throw new Error(`Erro ao obter token master ACBR: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
        throw new Error('Resposta de autenticação da ACBR sem access_token.');
    }

    return { accessToken, baseUrl };
}

/**
 * Obtém um Bearer token válido para a ACBR API.
 * 1. Busca credenciais da organização na tabela organization_nfe_configs
 * 2. Se já existe token cacheado e não expirou, retorna direto
 * 3. Senão, faz OAuth2 client_credentials e cacheia o novo token
 */
export async function getAcbrToken(
    supabase: any,
    organizationId: string,
    ambiente: string
): Promise<AuthResult> {
    // 1. Buscar config da organização
    const { data: config, error: configError } = await supabase
        .from('organization_nfe_configs')
        .select('acbr_client_id, acbr_client_secret, acbr_access_token, acbr_token_expires_at')
        .eq('organization_id', organizationId)
        .maybeSingle();

    if (configError || !config) {
        throw new Error(
            'Configuração NF-e não encontrada para esta empresa. Vá em Configurações > NF-e e insira o Client ID e Client Secret da ACBR API.'
        );
    }

    if (!config.acbr_client_id || !config.acbr_client_secret) {
        throw new Error(
            'Client ID e Client Secret da ACBR API não configurados. Vá em Configurações > NF-e.'
        );
    }

    const baseUrl = getAcbrBaseUrl(ambiente);

    // 2. Verificar se token cacheado ainda é válido (com margem de 5 min)
    if (config.acbr_access_token && config.acbr_token_expires_at) {
        const expiresAt = new Date(config.acbr_token_expires_at);
        const now = new Date();
        const marginMs = 5 * 60 * 1000; // 5 minutos de margem

        if (expiresAt.getTime() - marginMs > now.getTime()) {
            return { accessToken: config.acbr_access_token, baseUrl };
        }
    }

    // 3. Token expirado ou ausente → obter novo via OAuth2
    console.log(`[ACBR] Solicitando novo token para org ${organizationId}`);

    const tokenResponse = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.acbr_client_id,
            client_secret: config.acbr_client_secret,
            scope: 'nfe',
        }).toString(),
    });

    if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        console.error('[ACBR] Erro ao obter token:', tokenResponse.status, errBody);

        if (tokenResponse.status === 401 || tokenResponse.status === 400) {
            throw new Error(
                'Credenciais da ACBR API inválidas. Verifique Client ID e Client Secret em Configurações > NF-e.'
            );
        }
        throw new Error(`Erro ao obter token ACBR: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 2592000; // padrão ~30 dias

    // Calcular data de expiração
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 4. Salvar token cacheado no banco
    await supabase
        .from('organization_nfe_configs')
        .update({
            acbr_access_token: accessToken,
            acbr_token_expires_at: expiresAt,
        })
        .eq('organization_id', organizationId);

    console.log(`[ACBR] Novo token obtido, expira em ${expiresAt}`);

    return { accessToken, baseUrl };
}
