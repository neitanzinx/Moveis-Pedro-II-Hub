import { useState, useEffect, createContext, useContext } from "react";
import { base44, supabase } from "@/api/base44Client";
import { ROLE_RULES, SCOPES } from "@/config/permissions";

// API URL para autenticação de funcionários
const API_URL = import.meta.env.VITE_ZAP_API_URL || '';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cargoPermissoes, setCargoPermissoes] = useState(null);
  const [authType, setAuthType] = useState(null); // 'employee' | 'supabase' | null

  // Admin Store Selection State
  const [selectedStore, setSelectedStoreState] = useState(() => {
    return localStorage.getItem('admin_selected_store') || null;
  });

  const setSelectedStore = (store) => {
    setSelectedStoreState(store);
    if (store) {
      localStorage.setItem('admin_selected_store', store);
    } else {
      localStorage.removeItem('admin_selected_store');
    }
  };

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

        return { ...fullUser, cargo };
      } catch (err) {
        console.error('Erro ao carregar perfil Supabase:', err);
        return sessionUser;
      }
    };

    // Função para verificar autenticação de funcionário
    const checkEmployeeAuth = async () => {
      const token = localStorage.getItem('employee_token');
      if (!token) return null;

      try {
        const response = await fetch(`${API_URL}/api/auth/employee/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('employee_token');
            localStorage.removeItem('employee_user');
            return null;
          }
          throw new Error('Falha na validação do token');
        }

        const data = await response.json();
        // Verificar se o usuário ainda está ativo no banco de dados
        // (Isso é importante caso o funcionário tenha sido desativado/removido)

        if (data.success && data.user) {
          // Opcional: Validar contra a tabela role_permissions ou tabela de usuarios do banco se necessário
          // Por enquanto confiamos no token JWT validado pelo backend

          return {
            ...data.user,
            full_name: data.user.full_name || data.user.matricula
          };
        }
      } catch (e) {
        console.error("Erro ao verificar auth de funcionário:", e);
        // Se der erro de conexão, talvez não devamos deslogar imediatamente?
        // Mas por segurança, se não validar, null.
      }

      return null;
    };

    // Carrega estado inicial
    const initAuth = async () => {
      console.log('[Auth] Iniciando verificação de autenticação...');

      // 1. Primeiro verifica autenticação de funcionário (JWT)
      const hasEmployeeToken = localStorage.getItem('employee_token');

      if (hasEmployeeToken) {
        console.log('[Auth] Token de funcionário encontrado, verificando...');
        const employeeUser = await checkEmployeeAuth();

        if (employeeUser && mounted) {
          console.log('[Auth] ✅ Funcionário autenticado:', employeeUser.full_name, '- Cargo:', employeeUser.cargo);
          setAuthType('employee');
          setUser(employeeUser);

          // Buscar permissões do cargo
          try {
            const rolePermissions = await base44.entities.RolePermission.list();
            const cargoEncontrado = rolePermissions.find(c => c.cargo === employeeUser.cargo);
            if (cargoEncontrado?.permissions) {
              setCargoPermissoes({
                can: cargoEncontrado.permissions,
                scope: ROLE_RULES[employeeUser.cargo]?.scope || 'own'
              });
            }
          } catch (e) {
            console.log("[Auth] Usando permissões hardcoded (fallback)", e);
          }

          setLoading(false);
          return;
        } else {
          // Token inválido - já foi limpo pelo checkEmployeeAuth se response.status 401/403
          // Se foi erro de rede, talvez não tenha limpado. Limpeza garantida abaixo?
          // checkEmployeeAuth limpa se 401/403.
          console.log('[Auth] ⚠️ Token de funcionário inválido ou expirado');
          if (!hasEmployeeToken) { // Se checkEmployeeAuth removeu
            // ok
          }
        }
      }

      // 2. Se não tem funcionário logado, verifica Supabase Auth (para clientes)
      console.log('[Auth] Verificando autenticação Supabase...');
      const supabaseUser = await base44.auth.me();

      if (supabaseUser && mounted) {
        const fullProfile = await loadSupabaseProfile(supabaseUser);

        if (fullProfile) {
          console.log('[Auth] Supabase user encontrado:', fullProfile.email, '- Cargo:', fullProfile.cargo || 'Nenhum');
          setAuthType('supabase');
          setUser(fullProfile);

          // Buscar permissões do cargo se existir
          if (fullProfile.cargo) {
            try {
              const rolePermissions = await base44.entities.RolePermission.list();
              const cargoEncontrado = rolePermissions.find(c => c.cargo === fullProfile.cargo);
              if (cargoEncontrado?.permissions) {
                setCargoPermissoes({
                  can: cargoEncontrado.permissions,
                  scope: ROLE_RULES[fullProfile.cargo]?.scope || 'own'
                });
              }
            } catch (e) {
              console.log("Usando permissões hardcoded (fallback)", e);
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
        localStorage.removeItem('admin_selected_store'); // Limpa seleção ao sair
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
  }, []); // Esvaziado para rodar apenas no mount do Provider

  // Sync effect: If user has fixed store, force selectedStore to match
  useEffect(() => {
    if (user?.loja) {
      if (selectedStore !== user.loja) {
        setSelectedStoreState(user.loja);
        localStorage.setItem('admin_selected_store', user.loja);
      }
    }
  }, [user?.loja]);

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
    setSelectedStore(null); // Limpa seleção
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

  // Pega a loja do usuario (Prioridade: Loja fixa do user -> Loja selecionada pelo Admin)
  const getUserLoja = () => {
    return user?.loja || selectedStore || null;
  };

  // Verifica se deve filtrar por loja (Gerente)
  const shouldFilterByStore = () => {
    const scope = getScope();
    return scope === SCOPES.STORE || scope === 'store';
  };

  // Filtra dados automaticamente por escopo
  const filterData = (data, options = {}) => {
    if (!data || !user) return [];
    if (!Array.isArray(data)) return [];

    const scope = getScope();

    // Admin ve tudo
    if (scope === SCOPES.ALL || scope === 'all') return data;

    // Gerente ve apenas da sua loja
    if (scope === SCOPES.STORE || scope === 'store') {
      const userLoja = getUserLoja();
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

  const value = {
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
    SCOPES,
    selectedStore,
    setSelectedStore
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}