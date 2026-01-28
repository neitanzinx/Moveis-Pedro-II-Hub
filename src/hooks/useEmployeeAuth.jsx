import { useState, useEffect, useCallback } from "react";
import { ROLE_RULES, SCOPES } from "@/config/permissions";

// API URL baseada no ambiente
const API_URL = import.meta.env.VITE_ZAP_API_URL || '';

/**
 * Hook de autenticação para funcionários (Matrícula + Senha)
 * Separado do Supabase Auth usado para clientes
 */
export function useEmployeeAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cargoPermissoes, setCargoPermissoes] = useState(null);

    // Carregar usuário do localStorage
    useEffect(() => {
        const loadUser = async () => {
            try {
                const token = localStorage.getItem('employee_token');
                const storedUser = localStorage.getItem('employee_user');

                if (!token || !storedUser) {
                    setUser(null);
                    setLoading(false);
                    return;
                }

                // Verificar se token ainda é válido
                const response = await fetch(`${API_URL}/api/auth/employee/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    // Token inválido ou expirado
                    localStorage.removeItem('employee_token');
                    localStorage.removeItem('employee_user');
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const data = await response.json();

                if (data.success && data.user) {
                    setUser({
                        ...data.user,
                        full_name: data.user.full_name || data.user.matricula
                    });
                } else {
                    setUser(null);
                }

            } catch (error) {
                console.error("Erro ao carregar usuário:", error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    // Logout
    const logout = useCallback(() => {
        localStorage.removeItem('employee_token');
        localStorage.removeItem('employee_user');
        setUser(null);
        window.location.href = '/login';
    }, []);

    // Obter token
    const getToken = useCallback(() => {
        return localStorage.getItem('employee_token');
    }, []);

    // Verificar permissão
    const can = useCallback((permission) => {
        if (!user) return false;
        if (!user.cargo) return false;

        // Administrador pode tudo
        if (user.cargo === 'Administrador') return true;

        // Usar permissões do cargo se disponíveis
        if (cargoPermissoes?.can) {
            if (cargoPermissoes.can.includes('*')) return true;
            return cargoPermissoes.can.includes(permission);
        }

        // Fallback para regras hardcoded
        const rules = ROLE_RULES[user.cargo];
        if (!rules) return false;
        if (rules.can.includes('*')) return true;
        return rules.can.includes(permission);
    }, [user, cargoPermissoes]);

    // Pegar o escopo (all, store, own)
    const getScope = useCallback(() => {
        if (!user) return SCOPES.OWN;

        if (cargoPermissoes?.scope) {
            return cargoPermissoes.scope;
        }

        const rules = ROLE_RULES[user.cargo];
        return rules ? rules.scope : SCOPES.OWN;
    }, [user, cargoPermissoes]);

    // Verificar se é Gerente
    const isGerente = useCallback(() => {
        return user?.cargo === 'Gerente';
    }, [user]);

    // Pegar a loja do usuário
    const getUserLoja = useCallback(() => {
        return user?.loja || null;
    }, [user]);

    // Verificar se deve filtrar por loja
    const shouldFilterByStore = useCallback(() => {
        const scope = getScope();
        return scope === SCOPES.STORE || scope === 'store';
    }, [getScope]);

    // Filtrar dados por escopo
    const filterData = useCallback((data, options = {}) => {
        if (!data || !user) return [];
        if (!Array.isArray(data)) return [];

        const scope = getScope();

        // Admin vê tudo
        if (scope === SCOPES.ALL || scope === 'all') return data;

        // Gerente vê apenas da sua loja
        if (scope === SCOPES.STORE || scope === 'store') {
            const userLoja = user.loja;
            if (!userLoja) return [];

            const lojaFields = options.lojaField
                ? [options.lojaField]
                : ['loja', 'loja_id', 'loja_nome', 'loja_venda', 'store'];

            return data.filter(item => {
                for (const field of lojaFields) {
                    if (item[field] && item[field] === userLoja) {
                        return true;
                    }
                }
                return false;
            });
        }

        // Vendedor vê apenas o próprio
        if (scope === SCOPES.OWN || scope === 'own') {
            const userIdField = options.userField || 'responsavel_id';
            const userIdFields = [userIdField, 'vendedor_id', 'created_by', 'user_id'];

            return data.filter(item => {
                for (const field of userIdFields) {
                    if (item[field] === user.id || item[field] === user.email) {
                        return true;
                    }
                }
                return false;
            });
        }

        return [];
    }, [user, getScope]);

    // Fazer requisição autenticada
    const fetchWithAuth = useCallback(async (url, options = {}) => {
        const token = getToken();

        if (!token) {
            throw new Error('Não autenticado');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        return fetch(url, { ...options, headers });
    }, [getToken]);

    return {
        user,
        loading,
        logout,
        getToken,
        fetchWithAuth,
        can,
        getScope,
        filterData,
        isGerente,
        getUserLoja,
        shouldFilterByStore,
        SCOPES
    };
}
