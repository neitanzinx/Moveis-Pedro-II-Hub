// _shared/nuvemFiscalAuth.ts
// Helper compartilhado para autenticação OAuth2 na Nuvem Fiscal
// Multi-tenant: cada organization_id tem suas próprias credenciais

interface NuvemFiscalConfig {
    nuvem_client_id: string;
    nuvem_client_secret: string;
    nuvem_access_token: string | null;
    nuvem_token_expires_at: string | null;
}

interface AuthResult {
    accessToken: string;
    baseUrl: string;
}

const AUTH_URL = 'https://auth.nuvemfiscal.com.br/oauth/token';

export function getNuvemFiscalBaseUrl(ambiente: string): string {
    return ambiente === 'producao'
        ? 'https://api.nuvemfiscal.com.br'
        : 'https://api.sandbox.nuvemfiscal.com.br';
}

/**
 * Obtém um Bearer token válido para a Nuvem Fiscal.
 * 1. Busca credenciais da organização na tabela organization_nfe_configs
 * 2. Se já existe token cacheado e não expirou, retorna direto
 * 3. Senão, faz OAuth2 client_credentials e cacheia o novo token
 */
export async function getNuvemFiscalToken(
    supabase: any,
    organizationId: string,
    ambiente: string
): Promise<AuthResult> {
    // 1. Buscar config da organização
    const { data: config, error: configError } = await supabase
        .from('organization_nfe_configs')
        .select('nuvem_client_id, nuvem_client_secret, nuvem_access_token, nuvem_token_expires_at')
        .eq('organization_id', organizationId)
        .maybeSingle();

    if (configError || !config) {
        throw new Error(
            'Configuração NF-e não encontrada para esta empresa. Vá em Configurações > NF-e e insira o Client ID e Client Secret da Nuvem Fiscal.'
        );
    }

    if (!config.nuvem_client_id || !config.nuvem_client_secret) {
        throw new Error(
            'Client ID e Client Secret da Nuvem Fiscal não configurados. Vá em Configurações > NF-e.'
        );
    }

    const baseUrl = getNuvemFiscalBaseUrl(ambiente);

    // 2. Verificar se token cacheado ainda é válido (com margem de 5 min)
    if (config.nuvem_access_token && config.nuvem_token_expires_at) {
        const expiresAt = new Date(config.nuvem_token_expires_at);
        const now = new Date();
        const marginMs = 5 * 60 * 1000; // 5 minutos de margem

        if (expiresAt.getTime() - marginMs > now.getTime()) {
            return { accessToken: config.nuvem_access_token, baseUrl };
        }
    }

    // 3. Token expirado ou ausente → obter novo via OAuth2
    console.log(`[NuvemFiscal] Solicitando novo token para org ${organizationId}`);

    const tokenResponse = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.nuvem_client_id,
            client_secret: config.nuvem_client_secret,
            scope: 'empresa nfe',
        }).toString(),
    });

    if (!tokenResponse.ok) {
        const errBody = await tokenResponse.text();
        console.error('[NuvemFiscal] Erro ao obter token:', tokenResponse.status, errBody);

        if (tokenResponse.status === 401 || tokenResponse.status === 400) {
            throw new Error(
                'Credenciais da Nuvem Fiscal inválidas. Verifique Client ID e Client Secret em Configurações > NF-e.'
            );
        }
        throw new Error(`Erro ao obter token Nuvem Fiscal: ${tokenResponse.status}`);
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
            nuvem_access_token: accessToken,
            nuvem_token_expires_at: expiresAt,
        })
        .eq('organization_id', organizationId);

    console.log(`[NuvemFiscal] Novo token obtido, expira em ${expiresAt}`);

    return { accessToken, baseUrl };
}
