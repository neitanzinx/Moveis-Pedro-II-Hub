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
        catalogo_whatsapp: true,
        rastreio: true,
        // Módulos pagos (ausência no banco = DESATIVADO, usar isPaidModuleActive)
        whatsapp: true,
        fotos_entrega: true
    }
};

export function TenantProvider({ children, organizationId }) {
    const [organization, setOrganization] = useState(null);
    const [settings, setSettings] = useState(null);
    const [lojas, setLojas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resolvedOrgId, setResolvedOrgId] = useState(organizationId || null);

    // Detectar o organization_id do usuário logado (multi-tenant)
    useEffect(() => {
        const detectOrganization = async () => {
            // Se um organizationId foi passado explicitamente, usar ele
            if (organizationId) {
                setResolvedOrgId(organizationId);
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('public_users')
                        .select('organization_id')
                        .eq('id', session.user.id)
                        .single();

                    if (profile?.organization_id) {
                        setResolvedOrgId(profile.organization_id);
                        return;
                    }
                }
            } catch (err) {
                console.warn('[Tenant] Erro ao detectar organização do usuário:', err);
            }

            // Fallback: ID padrão da Móveis Pedro II (retrocompatibilidade)
            setResolvedOrgId('00000000-0000-0000-0000-000000000001');
        };

        detectOrganization();

        // Reagir a mudanças de autenticação (login/logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                // Logout — voltar ao padrão
                setResolvedOrgId('00000000-0000-0000-0000-000000000001');
            } else {
                // Novo login — detectar novamente
                detectOrganization();
            }
        });

        return () => subscription?.unsubscribe();
    }, [organizationId]);

    useEffect(() => {
        if (resolvedOrgId) {
            loadTenantData();
        }
    }, [resolvedOrgId]);

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

            const orgId = resolvedOrgId || '00000000-0000-0000-0000-000000000001';

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

    // Verificar se um módulo está ativo (padrão: ativo se ausente)
    const isModuleActive = (moduleName) => {
        if (!settings?.modulos_ativos) return true; // padrão: ativo
        return settings.modulos_ativos[moduleName] !== false;
    };

    // Verificar se um módulo PAGO está ativo (padrão: DESATIVADO se ausente)
    // Usar esta função para módulos que geram custo real: 'whatsapp', 'fotos_entrega'
    // Diferença do isModuleActive: chave ausente = bloqueado (fail-safe)
    const isPaidModuleActive = (moduleName) => {
        if (!settings?.modulos_ativos) return false; // sem settings = desativado
        return settings.modulos_ativos[moduleName] === true;
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
        isPaidModuleActive,
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
            isPaidModuleActive: () => false, // Fail-safe: sem contexto = desativado
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
    const { settings, loading, error, isModuleActive, isPaidModuleActive, getJurosParcela } = useTenant();
    return { settings, loading, error, isModuleActive, isPaidModuleActive, getJurosParcela };
}

// Hook específico para lojas
export function useLojas() {
    const { lojas, loading, error } = useTenant();
    return { lojas, loading, error };
}

export default TenantContext;
