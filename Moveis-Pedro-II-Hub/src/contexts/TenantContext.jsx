import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Contexto para dados do tenant (organização)
const TenantContext = createContext(null);

// Configurações padrão (fallback)
const DEFAULT_ORGANIZATION = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Sistema ERP',
    slug: 'default',
    logo_url: null,
    primary_color: '#07593f',
    secondary_color: '#f38a4c',
};

const DEFAULT_SETTINGS = {
    prazo_entrega_padrao: 7,
    prazo_montagem_padrao: 3,
    taxa_juros_parcelamento: {
        "2x": 0, "3x": 0, "4x": 2.5, "5x": 3, "6x": 3.5,
        "7x": 4, "8x": 4.5, "9x": 5, "10x": 5.5, "11x": 6, "12x": 6.5
    },
    comissao_base_percentual: 3.00,
    comissao_sobre: 'bruto',
    modulos_ativos: {
        montagem: true,
        assistencia_tecnica: true,
        nfe: true,
        marketing: true,
        rh: true,
        bi_dashboard: true,
        catalogo_whatsapp: true
    }
};

export function TenantProvider({ children, organizationId }) {
    const [organization, setOrganization] = useState(null);
    const [settings, setSettings] = useState(null);
    const [lojas, setLojas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadTenantData();
    }, [organizationId]);

    const loadTenantData = async () => {
        try {
            setLoading(true);
            setError(null);

            // ID padrão para Móveis Pedro II se não especificado
            const orgId = organizationId || '00000000-0000-0000-0000-000000000001';

            // Carregar organização
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', orgId)
                .single();

            if (orgError) {
                console.warn('Erro ao carregar organização, usando padrão:', orgError);
                setOrganization(DEFAULT_ORGANIZATION);
            } else {
                setOrganization(orgData);
            }

            // Carregar configurações
            const { data: settingsData, error: settingsError } = await supabase
                .from('organization_settings')
                .select('*')
                .eq('organization_id', orgId)
                .single();

            if (settingsError) {
                console.warn('Erro ao carregar settings, usando padrão:', settingsError);
                setSettings(DEFAULT_SETTINGS);
            } else {
                setSettings(settingsData);
            }

            // Carregar lojas
            const { data: lojasData, error: lojasError } = await supabase
                .from('lojas')
                .select('*')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .order('nome');

            if (lojasError) {
                console.warn('Erro ao carregar lojas:', lojasError);
                setLojas([]);
            } else {
                setLojas(lojasData || []);
            }

        } catch (err) {
            console.error('Erro ao carregar dados do tenant:', err);
            setError(err);
            // Usar valores padrão em caso de erro
            setOrganization(DEFAULT_ORGANIZATION);
            setSettings(DEFAULT_SETTINGS);
        } finally {
            setLoading(false);
        }
    };

    // Verificar se um módulo está ativo
    const isModuleActive = (moduleName) => {
        if (!settings?.modulos_ativos) return true; // padrão: ativo
        return settings.modulos_ativos[moduleName] !== false;
    };

    // Obter taxa de juros para parcelas
    const getJurosParcela = (parcelas) => {
        if (!settings?.taxa_juros_parcelamento) return 0;
        return settings.taxa_juros_parcelamento[`${parcelas}x`] || 0;
    };

    const value = {
        organization,
        settings,
        lojas,
        loading,
        error,
        isModuleActive,
        getJurosParcela,
        refreshTenant: loadTenantData,
        // Helpers para branding
        brandName: organization?.name || DEFAULT_ORGANIZATION.name,
        brandLogo: organization?.logo_url || DEFAULT_ORGANIZATION.logo_url,
        primaryColor: organization?.primary_color || DEFAULT_ORGANIZATION.primary_color,
        secondaryColor: organization?.secondary_color || DEFAULT_ORGANIZATION.secondary_color,
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
}

// Hook para usar o contexto do tenant
export function useTenant() {
    const context = useContext(TenantContext);
    if (!context) {
        console.warn('useTenant deve ser usado dentro de um TenantProvider');
        // Retornar valores padrão para evitar quebrar o app
        return {
            organization: DEFAULT_ORGANIZATION,
            settings: DEFAULT_SETTINGS,
            lojas: [],
            loading: false,
            error: null,
            isModuleActive: () => true,
            getJurosParcela: () => 0,
            refreshTenant: () => { },
            brandName: DEFAULT_ORGANIZATION.name,
            brandLogo: DEFAULT_ORGANIZATION.logo_url,
            primaryColor: DEFAULT_ORGANIZATION.primary_color,
            secondaryColor: DEFAULT_ORGANIZATION.secondary_color,
        };
    }
    return context;
}

// Hook específico para organização
export function useOrganization() {
    const { organization, loading, error } = useTenant();
    return { organization, loading, error };
}

// Hook específico para configurações
export function useOrganizationSettings() {
    const { settings, loading, error, isModuleActive, getJurosParcela } = useTenant();
    return { settings, loading, error, isModuleActive, getJurosParcela };
}

// Hook específico para lojas
export function useLojas() {
    const { lojas, loading, error } = useTenant();
    return { lojas, loading, error };
}

export default TenantContext;
