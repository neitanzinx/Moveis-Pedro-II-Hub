import { describe, it, expect } from 'vitest';
import { buildTrackingUrl, buildClientPortalUrl, buildAssistenciaUrl, getTenantIdentifier } from './tenantLinkHelper';

describe('tenantLinkHelper', () => {
    it('extracts slug as priority tenant identifier', () => {
        expect(getTenantIdentifier({ slug: 'moveis-pedro-ii' })).toBe('moveis-pedro-ii');
    });

    it('uses CNPJ numbers if slug is default or missing', () => {
        expect(getTenantIdentifier({ slug: 'default', cnpj: '12.345.678/0001-90' })).toBe('12345678000190');
    });

    it('builds tracking URL with tenant slug', () => {
        const url = buildTrackingUrl('123', { slug: 'moveis-pedro-ii' });
        expect(url).toContain('/moveis-pedro-ii/rastreio/123');
    });

    it('builds client portal URL with tenant slug', () => {
        const url = buildClientPortalUrl({ slug: 'marca-moveis' });
        expect(url).toContain('/marca-moveis/area-cliente');
    });

    it('builds assistencia URL with tenant slug', () => {
        const url = buildAssistenciaUrl('auto', { slug: 'marca-moveis' });
        expect(url).toContain('/marca-moveis/assistencia/auto');
    });
});
