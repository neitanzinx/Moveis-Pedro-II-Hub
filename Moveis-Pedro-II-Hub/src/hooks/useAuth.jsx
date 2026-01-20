import { useState, useEffect } from "react";
import { base44, supabase } from "@/api/base44Client";
import { ROLE_RULES, SCOPES } from "@/config/permissions";

// API URL para autenticação de funcionários
const API_URL = import.meta.env.VITE_ZAP_API_URL || '';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cargoPermissoes, setCargoPermissoes] = useState(null);
  const [authType, setAuthType] = useState(null); // 'employee' | 'supabase' | null

  useEffect(() => {
    let mounted = true;

    // Função auxiliar para carregar o perfil completo (Supabase)
    const loadSupabaseProfile = async (sessionUser) => {
      try {
        if (!sessionUser) {
          return null;
        }

        const { data: u, error: profileError } = await supabase
          .from('public_users')
          .select('*')
          .eq('id', sessionUser.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Erro ao buscar perfil:', profileError);
        }

        // Mescla dados da sessão com dados do perfil
        const fullUser = u ? { ...sessionUser, ...u } : sessionUser;
        const cargo = fullUser.cargo || null;

        return {
          ...fullUser,
          cargo: cargo,
          full_name: fullUser.full_name || fullUser.email,
        };
      } catch (error) {
        console.error("Erro ao carregar perfil Supabase:", error);
        return null;
      }
    };

    // Função para verificar autenticação de funcionário (JWT)
    const checkEmployeeAuth = async () => {
      const token = localStorage.getItem('employee_token');
      const storedUser = localStorage.getItem('employee_user');

      if (!token || !storedUser) {
        return null;
      }

      try {
        // Verificar se token ainda é válido
        const response = await fetch(`${API_URL}/api/auth/employee/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          // Token inválido - limpar
          localStorage.removeItem('employee_token');
          localStorage.removeItem('employee_user');
          return null;
        }

        const data = await response.json();
        if (data.success && data.user) {
          return {
            ...data.user,
            full_name: data.user.full_name || data.user.matricula
          };
        }
      } catch (e) {
        console.error("Erro ao verificar auth de funcionário:", e);
      }

      return null;
    };

    // Carrega estado inicial
    const initAuth = async () => {
      // 1. Primeiro verifica autenticação de funcionário (JWT)
      const employeeUser = await checkEmployeeAuth();

      if (employeeUser && mounted) {
        setAuthType('employee');
        setUser(employeeUser);

        // Buscar permissões do cargo
        try {
          const cargos = await base44.entities.Cargo.list();
          const cargoEncontrado = cargos.find(c => c.nome === employeeUser.cargo);
          if (cargoEncontrado?.permissoes) {
            setCargoPermissoes(cargoEncontrado.permissoes);
          }
        } catch (e) {
          console.log("Usando permissões hardcoded (fallback)");
        }

        setLoading(false);
        return;
      }

      // 2. Se não tem funcionário logado, verifica Supabase Auth
      const supabaseUser = await base44.auth.me();

      if (supabaseUser && mounted) {
        const fullProfile = await loadSupabaseProfile(supabaseUser);

        if (fullProfile) {
          setAuthType('supabase');
          setUser(fullProfile);

          // Buscar permissões do cargo se existir
          if (fullProfile.cargo) {
            try {
              const cargos = await base44.entities.Cargo.list();
              const cargoEncontrado = cargos.find(c => c.nome === fullProfile.cargo);
              if (cargoEncontrado?.permissoes) {
                setCargoPermissoes(cargoEncontrado.permissoes);
              }
            } catch (e) {
              console.log("Usando permissões hardcoded (fallback)");
            }
          }
        }
      }

      if (mounted) {
        setLoading(false);
      }
    };

    initAuth();

    // Inscreve para mudanças no Supabase Auth
    const { data: { subscription } } = base44.auth.onAuthStateChange?.((event, session) => {
      if (event === 'SIGNED_OUT' && authType === 'supabase') {
        setUser(null);
        setCargoPermissoes(null);
        setAuthType(null);
        setLoading(false);
      } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !localStorage.getItem('employee_token')) {
        // Só atualiza se não estiver logado como funcionário
        loadSupabaseProfile(session?.user).then(profile => {
          if (mounted && profile) {
            setAuthType('supabase');
            setUser(profile);
          }
        });
      }
    }) || { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Função de logout que funciona para ambos os tipos
  const logout = async () => {
    if (authType === 'employee') {
      localStorage.removeItem('employee_token');
      localStorage.removeItem('employee_user');
    }
    // Sempre tenta deslogar do Supabase também
    await base44.auth.logout();
    setUser(null);
    setAuthType(null);
    setCargoPermissoes(null);
    window.location.href = '/login';
  };

  // Verifica permissão - primeiro tenta banco, depois fallback hardcoded
  const can = (permission) => {
    if (!user) return false;
    if (!user.cargo) return false;

    // Se cargo é Administrador no banco OU tem permissão especial '*'
    if (user.cargo === 'Administrador') return true;

    // Tenta usar permissões do banco primeiro
    if (cargoPermissoes?.can) {
      if (cargoPermissoes.can.includes('*')) return true;
      return cargoPermissoes.can.includes(permission);
    }

    // Fallback para regras hardcoded
    const rules = ROLE_RULES[user.cargo];
    if (!rules) return false;
    if (rules.can.includes('*')) return true;
    return rules.can.includes(permission);
  };

  // Pega o escopo (all, store, own)
  const getScope = () => {
    if (!user) return SCOPES.OWN;

    // Tenta banco primeiro
    if (cargoPermissoes?.scope) {
      return cargoPermissoes.scope;
    }

    // Fallback
    const rules = ROLE_RULES[user.cargo];
    return rules ? rules.scope : SCOPES.OWN;
  };

  // Verifica se usuario e Gerente
  const isGerente = () => {
    return user?.cargo === 'Gerente';
  };

  // Pega a loja do usuario
  const getUserLoja = () => {
    return user?.loja || null;
  };

  // Verifica se deve filtrar por loja (Gerente)
  const shouldFilterByStore = () => {
    const scope = getScope();
    return scope === SCOPES.STORE || scope === 'store';
  };

  // Filtra dados automaticamente por escopo
  // options.lojaField permite especificar qual campo usar para loja
  // options.userField permite especificar qual campo usar para usuario
  const filterData = (data, options = {}) => {
    if (!data || !user) return [];
    if (!Array.isArray(data)) return [];

    const scope = getScope();

    // Admin ve tudo
    if (scope === SCOPES.ALL || scope === 'all') return data;

    // Gerente ve apenas da sua loja
    if (scope === SCOPES.STORE || scope === 'store') {
      const userLoja = user.loja;
      if (!userLoja) {
        console.warn('[useAuth] Gerente sem loja definida, filtrando tudo');
        return [];
      }

      // Tenta varios campos possiveis para loja
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

    // Vendedor ve apenas o proprio
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
  };

  return {
    user,
    loading,
    logout,
    authType,
    can,
    getScope,
    filterData,
    isGerente,
    getUserLoja,
    shouldFilterByStore,
    SCOPES
  };
}