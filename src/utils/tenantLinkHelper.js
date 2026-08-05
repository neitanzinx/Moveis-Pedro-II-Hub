/**
 * Helper para construção de links públicos multitenant (Rastreio, Portal do Cliente, Assistência Técnica)
 */

export function getTenantIdentifier(organization = {}) {
    if (!organization) return '';
    if (organization?.slug && organization.slug !== 'default') {
        return organization.slug;
    }
    if (organization?.cnpj) {
        return organization.cnpj.replace(/\D/g, '');
    }
    if (organization?.id && organization.id !== '00000000-0000-0000-0000-000000000001') {
        return organization.id;
    }
    return '';
}

export function getBaseOrigin() {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return '';
}

/**
 * Gera URL pública de Rastreamento de Entrega
 * @param {string|number} entregaId
 * @param {Object} organization
 */
export function buildTrackingUrl(entregaId = '', organization = {}) {
    const origin = getBaseOrigin();
    const tenantId = getTenantIdentifier(organization);

    const pathId = entregaId ? `/${entregaId}` : '';
    if (tenantId) {
        return `${origin}/${tenantId}/rastreio${pathId}`;
    }
    return `${origin}/rastreio${pathId}`;
}

/**
 * Gera URL pública da Área / Portal do Cliente
 * @param {Object} organization
 */
export function buildClientPortalUrl(organization = {}) {
    const origin = getBaseOrigin();
    const tenantId = getTenantIdentifier(organization);

    if (tenantId) {
        return `${origin}/${tenantId}/area-cliente`;
    }
    return `${origin}/area-cliente`;
}

/**
 * Gera URL pública de Assistência Técnica (Auto-atendimento)
 * @param {string} subpath
 * @param {Object} organization
 */
export function buildAssistenciaUrl(subpath = 'auto', organization = {}) {
    const origin = getBaseOrigin();
    const tenantId = getTenantIdentifier(organization);

    if (tenantId) {
        return `${origin}/${tenantId}/assistencia/${subpath}`;
    }
    return `${origin}/assistencia/${subpath}`;
}
