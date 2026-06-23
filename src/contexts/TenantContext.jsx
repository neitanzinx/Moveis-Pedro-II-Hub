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
    comissao_prioridade_estrategia: 'mais_especifica',
    comissao_recalculo_politica: 'nao_recalcular',
    comissao_modelo_calculo: 'regra_venda',
    comissao_faixa_referencia: 'vendedor',
    comissao_meta_minima_loja_percentual: 0,
    compras_aprovacao_automatica: ['a_vista'],
    conferencia_caixa_enabled: false,
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

    // Atualiza o favicon e o título dinamicamente
    useEffect(() => {
        if (organization) {
            document.title = organization.name || "Móveis Pedro II";

            // Remove favicons antigos se existirem para evitar duplicidade
            const existingLinks = document.querySelectorAll("link[rel~='icon']");
            existingLinks.forEach(link => link.remove());

            // Cria o novo favicon do tenant com bypass de cache longo
            const logoUrl = organization.logo_url
                ? `${organization.logo_url}?v=${new Date().getTime()}`
                : `https://stgatkuwnouzwczkpphs.supabase.co/storage/v1/object/public/publico/mp2logo.png?v=${new Date().getTime()}`;

            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.href = logoUrl;
            document.getElementsByTagName('head')[0].appendChild(link);
        }
    }, [organization]);

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
        // Flag de Conferência de Caixa
        conferenciaCaixaEnabled: settings?.conferencia_caixa_enabled === true,
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
            conferenciaCaixaEnabled: false,
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
