import { useState, useEffect } from "react";
import { base44, supabase } from "@/api/base44Client";
import { ROLE_RULES, SCOPES } from "@/config/permissions";


export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cargoPermissoes, setCargoPermissoes] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Função auxiliar para carregar o perfil completo
    const loadProfile = async (sessionUser) => {
      try {
        if (!sessionUser) {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const { data: u, error: profileError } = await supabase
          .from('public_users')
          .select('*')
          .eq('id', sessionUser.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Erro ao buscar perfil:', profileError);
        }

        if (mounted) {
          // Mescla dados da sessão com dados do perfil
          const fullUser = u ? { ...sessionUser, ...u } : sessionUser;
          const cargo = fullUser.cargo || 'Administrador';

          setUser({
            ...fullUser,
            cargo: cargo,
            full_name: fullUser.full_name || fullUser.email,
          });

          // Buscar permissões do cargo no banco
          try {
            const cargos = await base44.entities.Cargo.list();
            const cargoEncontrado = cargos.find(c => c.nome === cargo);
            if (cargoEncontrado?.permissoes) {
              setCargoPermissoes(cargoEncontrado.permissoes);
            }
          } catch (e) {
            console.log("Usando permissões hardcoded (fallback)");
          }

          setLoading(false);
        }
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        if (mounted) setLoading(false);
      }
    };

    // 1. Carrega estado inicial
    base44.auth.me().then(loadProfile);

    // 2. Inscreve para mudanças (Login/Logout)
    const { data: { subscription } } = base44.auth.onAuthStateChange?.((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setCargoPermissoes(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadProfile(session?.user);
      }
    }) || { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

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
    can,
    getScope,
    filterData,
    isGerente,
    getUserLoja,
    shouldFilterByStore,
    SCOPES
  };
}