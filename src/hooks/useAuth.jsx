import { useState, useEffect, createContext, useContext } from "react";
import { base44, supabase } from "@/api/base44Client";
import { ROLE_RULES, SCOPES, userCan, getUserRoles, getHighestScope, hasRole, getUserEffectivePermissions } from "@/config/permissions";
import { canAccessLojaId, filterDataByLoja } from "@/lib/utils";

const AuthContext = createContext(null);

function normalizeUserRoles(user) {
  const roles = getUserRoles(user);
  return {
    ...user,
    cargos: roles,
    // Preserva cargo legado; não sobrescreve com default de roles para não
    // dar cargo a clientes sem cargo atribuído.
    cargo: user?.cargo || null
  };
}

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

  const getMergedRolePermissions = (roles = [], dbPermissions = []) => {
    const hardcodedPermissions = roles.flatMap((role) => ROLE_RULES[role]?.can || []);
    return Array.from(new Set([...(dbPermissions || []), ...hardcodedPermissions]));
  };

  useEffect(() => {
    let mounted = true;

    const startLoadingFailsafe = () => {
      return setTimeout(() => {
        if (mounted) {
          console.warn('[Auth] Failsafe acionado: finalizando loading para evitar tela travada.');
          setLoading(false);
        }
      }, 10000);
    };

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

        // Mescla dados da sessão com dados do perfil e normaliza cargos
        const fullUser = u ? { ...sessionUser, ...u } : sessionUser;
        return normalizeUserRoles(fullUser);
      } catch (err) {
        console.error('Erro ao carregar perfil Supabase:', err);
        return sessionUser;
      }
    };

    // Função para verificar autenticação de funcionário (agora via Supabase direto)
    const checkEmployeeAuth = async () => {
      // Verifica se há dados de usuário em localStorage (cache do login)
      const cachedUser = localStorage.getItem('employee_user');
      if (!cachedUser) return null;

      try {
        // Valida que o cache é JSON v\u00e1lido antes de prosseguir (cache corrompido = limpar e sair)
        JSON.parse(cachedUser);

        // Verificar se ainda tem sessão Supabase ativa
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Sessão expirada, limpar cache
          localStorage.removeItem('employee_user');
          return null;
        }

        // Buscar perfil atualizado do banco para garantir dados recentes
        const { data: userProfile, error } = await supabase
          .from('public_users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error || !userProfile) {
          console.warn('[Auth] Perfil não encontrado no banco');
          localStorage.removeItem('employee_user');
          return null;
        }

        if (!userProfile.ativo) {
          console.warn('[Auth] Usuário inativo');
          localStorage.removeItem('employee_user');
          await supabase.auth.signOut();
          return null;
        }

        // Atualizar cache com dados atualizados
        localStorage.setItem('employee_user', JSON.stringify(userProfile));

        return normalizeUserRoles({
          ...session.user,
          ...userProfile,
          full_name: userProfile.full_name || userProfile.matricula
        });
      } catch (e) {
        console.error("Erro ao verificar auth de funcionário:", e);
        localStorage.removeItem('employee_user');
        return null;
      }
    };

    // Carrega estado inicial
    const initAuth = async () => {
      console.log('[Auth] Iniciando verificação de autenticação...');

      try {
        // Limpar token legado do backend (não mais utilizado)
        if (localStorage.getItem('employee_token')) {
          console.log('[Auth] Removendo token legado do backend...');
          localStorage.removeItem('employee_token');
        }

        // 1. Primeiro verifica se há cache de funcionário
        const hasCachedUser = localStorage.getItem('employee_user');

        if (hasCachedUser) {
          console.log('[Auth] Cache de funcionário encontrado, verificando...');
          const employeeUser = await checkEmployeeAuth();

          if (employeeUser && mounted) {
            console.log('[Auth] ✅ Funcionário autenticado:', employeeUser.full_name, '- Cargos:', employeeUser.cargos?.join(', ') || employeeUser.cargo);
            setAuthType('employee');
            setUser(employeeUser);

            // Buscar permissões dos cargos
            try {
              const rolePermissions = await base44.entities.RolePermission.list();
              const roles = getUserRoles(employeeUser);
              const permissionsFromDb = Array.from(new Set(
                rolePermissions
                  .filter(c => roles.includes(c.cargo))
                  .flatMap(c => Array.isArray(c.permissions) ? c.permissions : [])
              ));
              const permissions = getMergedRolePermissions(roles, permissionsFromDb);

              if (permissions.length > 0) {
                const roleScopes = roles.map(role => ROLE_RULES[role]?.scope).filter(Boolean);
                setCargoPermissoes({
                  can: permissions,
                  scope: getHighestScope(roleScopes)
                });
              }
            } catch (e) {
              console.log("[Auth] Usando permissões hardcoded (fallback)", e);
            }

            setLoading(false);
            return;
          } else {
            console.log('[Auth] ⚠️ Cache inválido ou sessão expirada');
          }
        }

        // 2. Se não tem funcionário logado, verifica Supabase Auth (para clientes)
        console.log('[Auth] Verificando autenticação Supabase...');
        const supabaseUser = await base44.auth.me();

        if (supabaseUser && mounted) {
          const fullProfile = await loadSupabaseProfile(supabaseUser);

          if (fullProfile) {
            console.log('[Auth] Supabase user encontrado:', fullProfile.email, '- Cargos:', fullProfile.cargos?.join(', ') || fullProfile.cargo || 'Nenhum');
            setAuthType('supabase');
            setUser(fullProfile);

            // Buscar permissões dos cargos se existir
            if (fullProfile.cargos?.length || fullProfile.cargo) {
              try {
                const rolePermissions = await base44.entities.RolePermission.list();
                const roles = getUserRoles(fullProfile);
                const permissionsFromDb = Array.from(new Set(
                  rolePermissions
                    .filter(c => roles.includes(c.cargo))
                    .flatMap(c => Array.isArray(c.permissions) ? c.permissions : [])
                ));
                const permissions = getMergedRolePermissions(roles, permissionsFromDb);

                if (permissions.length > 0) {
                  const roleScopes = roles.map(role => ROLE_RULES[role]?.scope).filter(Boolean);
                  setCargoPermissoes({
                    can: permissions,
                    scope: getHighestScope(roleScopes)
                  });
                }
              } catch (e) {
                console.log("Usando permissões hardcoded (fallback)", e);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Erro durante initAuth:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const failsafeId = startLoadingFailsafe();
    initAuth().finally(() => clearTimeout(failsafeId));

    // Inscreve para mudanças no Supabase Auth
    const { data: { subscription } } = base44.auth.onAuthStateChange?.((event, session) => {
      if (event === 'SIGNED_OUT' && authType === 'supabase') {
        setUser(null);
        setCargoPermissoes(null);
        setAuthType(null);
        setLoading(false);
        localStorage.removeItem('admin_selected_store'); // Limpa seleção ao sair
      } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !localStorage.getItem('employee_user')) {
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
    // Limpar cache de funcionário
    localStorage.removeItem('employee_user');
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

    const roles = getUserRoles(user);
    if (!roles.length) return false;

    // Se cargo é Administrador no banco OU tem permissão especial '*'
    if (hasRole(user, 'Administrador')) return true;

    // Tenta usar permissões do banco primeiro
    if (cargoPermissoes?.can) {
      if (cargoPermissoes.can.includes('*')) return true;
      return cargoPermissoes.can.includes(permission);
    }

    // Fallback para regras hardcoded multi-cargo
    return userCan(user, permission);
  };

  // Pega o escopo (all, store, own)
  const getScope = () => {
    if (!user) return SCOPES.OWN;

    // Tenta banco primeiro
    if (cargoPermissoes?.scope) {
      return cargoPermissoes.scope;
    }

    // Fallback
    return getUserEffectivePermissions(user).scope;
  };

  // Verifica se usuario e Gerente
  const isGerente = () => {
    return hasRole(user, 'Gerente');
  };

  // Pega a loja do usuario (Prioridade: Loja fixa do user -> Loja selecionada pelo Admin)
  const getUserLoja = () => {
    return user?.loja || selectedStore || null;
  };

  const getUserLojas = () => {
    const lojas = [user?.loja, selectedStore].filter(Boolean);
    return Array.from(new Set(lojas));
  };

  const canAccessLoja = (lojaId) => {
    return canAccessLojaId(lojaId, getUserLojas());
  };

  // Verifica se deve filtrar por loja (Gerente)
  const shouldFilterByStore = () => {
    return getUserLojas().length > 0;
  };

  // Filtra dados automaticamente por escopo
  const filterData = (data, options = {}) => {
    if (!data || !user) return [];
    if (!Array.isArray(data)) return [];

    const normalizedOptions = typeof options === 'string'
      ? { scopeOverride: options }
      : (options || {});

    const userLojas = getUserLojas();
    const dataWithinUserStores = userLojas.length > 0
      ? filterDataByLoja(data, userLojas, { lojaField: normalizedOptions.lojaField })
      : data;

    const scope = normalizedOptions.scopeOverride || getScope();

    // Mesmo admins do tenant continuam limitados a suas lojas atribuídas.
    if (scope === SCOPES.ALL || scope === 'all') return dataWithinUserStores;

    // Gerente ve apenas da sua loja
    if (scope === SCOPES.STORE || scope === 'store') {
      if (!userLojas.length) {
        console.warn('[useAuth] Gerente sem loja definida, filtrando tudo');
        return [];
      }

      return dataWithinUserStores;
    }

    // Vendedor ve apenas o proprio
    if (scope === SCOPES.OWN || scope === 'own') {
      const userIdField = normalizedOptions.userField || 'responsavel_id';
      const userIdFields = [userIdField, 'vendedor_id', 'created_by', 'user_id'];

      return dataWithinUserStores.filter(item => {
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
    getUserLojas,
    canAccessLoja,
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
  if (context === undefined || context === null) {
    console.error('[useAuth] Context is missing! AuthContext:', AuthContext);
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}