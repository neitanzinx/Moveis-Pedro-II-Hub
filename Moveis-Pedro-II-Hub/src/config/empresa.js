// Configurações de empresa dinâmicas (Multi-Tenant)
// Usa dados do TenantContext quando disponível, fallback para valores padrão

// Logo padrão do sistema (usado quando não há logo configurada)
const DEFAULT_LOGO = "https://stgatkuwnouzwczkpphs.supabase.co/storage/v1/object/public/publico/mp2logo.png";

// Cores padrão do sistema
const DEFAULT_COLORS = {
    primaria: "#07593f",
    secundaria: "#f38a4c"
};

/**
 * Obtém dados da empresa a partir do objeto organization
 * @param {Object} organization - Objeto da organização do TenantContext
 * @returns {Object} Dados formatados da empresa
 */
export const getEmpresa = (organization) => ({
    nome: organization?.name || "Sistema de Gestão",
    razao_social: organization?.razao_social || organization?.name || "Sistema de Gestão",
    cnpj: organization?.cnpj || "",
    logo_url: organization?.logo_url || DEFAULT_LOGO,
    whatsapp: organization?.whatsapp_suporte || "",
    email: organization?.email_suporte || "",
    cores: {
        primaria: organization?.primary_color || DEFAULT_COLORS.primaria,
        secundaria: organization?.secondary_color || DEFAULT_COLORS.secundaria
    }
});

/**
 * Função helper para pegar a logo (pode ser do admin ou da organização)
 * @param {Object} organization - Objeto da organização
 * @param {Object} adminUser - Usuário admin (opcional, para override)
 * @returns {string} URL da logo
 */
export const getLogoUrl = (organization, adminUser) => {
    return adminUser?.logo_url || organization?.logo_url || DEFAULT_LOGO;
};

/**
 * Obtém as cores do tema baseado na organização
 * @param {Object} organization - Objeto da organização
 * @returns {Object} Objeto com cores primária e secundária
 */
export const getCores = (organization) => ({
    primaria: organization?.primary_color || DEFAULT_COLORS.primaria,
    secundaria: organization?.secondary_color || DEFAULT_COLORS.secundaria
});

// DEPRECATED: Manter para compatibilidade temporária
// Use getEmpresa(organization) ou hooks do TenantContext
export const EMPRESA = {
    nome: "Móveis Pedro II",
    logo_url: DEFAULT_LOGO,
    cores: DEFAULT_COLORS
};
