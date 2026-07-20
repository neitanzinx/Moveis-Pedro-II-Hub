import { useCallback, useEffect, useState } from "react";
import { supabase, getActiveAuthMode, setActiveAuthMode, clearActiveAuthMode, AUTH_MODES } from "@/lib/supabase";

const OPERATOR_AUTH_TIMEOUT_MS = 15000;
const OPERATOR_AUTH_CACHE_KEY = "operator_auth_cache";

function readCachedOperatorAuth() {
  try {
    const raw = localStorage.getItem(OPERATOR_AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user || !parsed.profile) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedOperatorAuth(payload) {
  try {
    localStorage.setItem(OPERATOR_AUTH_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignora falhas de storage para não bloquear o login.
  }
}

function clearCachedOperatorAuth() {
  try {
    localStorage.removeItem(OPERATOR_AUTH_CACHE_KEY);
  } catch {
    // Ignora falhas de storage.
  }
}

export function useOperatorAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [operatorProfile, setOperatorProfile] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authAttempt, setAuthAttempt] = useState(0);

  const isTimeoutError = useCallback((error) => {
    return error?.message?.includes('Timeout em');
  }, []);

  const withTimeout = useCallback(async (promise, ms, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Timeout em ${label}`)), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const loadOperatorProfile = useCallback(async (authUserId) => {
    if (!authUserId) return null;

    const { data, error } = await withTimeout(
      supabase
        .from("saas_operator_users")
        .select("id, auth_user_id, email, is_active, last_login_at")
        .eq("auth_user_id", authUserId)
        .eq("is_active", true)
        .maybeSingle(),
      OPERATOR_AUTH_TIMEOUT_MS,
      'saas_operator_users.profile'
    );

    if (error) {
      throw error;
    }

    return data || null;
  }, [withTimeout]);

  useEffect(() => {
    let mounted = true;

    const applyCache = (cachedAuth) => {
      if (!cachedAuth || !mounted) return false;
      setUser(cachedAuth.user);
      setOperatorProfile(cachedAuth.profile);
      return true;
    };

    const clearState = () => {
      if (!mounted) return;
      setUser(null);
      setOperatorProfile(null);
    };

    const syncWithSession = async (sessionUserOverride = null) => {
      const cachedAuth = readCachedOperatorAuth();
      const failsafeId = setTimeout(() => {
        if (mounted) {
          setLoading(false);
        }
      }, OPERATOR_AUTH_TIMEOUT_MS);

      try {
        if (mounted) {
          setLoading(true);
          setAuthError(null);
        }

        // Se o modo ativo é 'tenant', não carregar perfil de operador
        const currentMode = getActiveAuthMode();
        if (currentMode === AUTH_MODES.TENANT) {
          clearCachedOperatorAuth();
          clearState();
          return;
        }

        if (cachedAuth) {
          applyCache(cachedAuth);
          if (mounted) setLoading(false);
        }

        let sessionUser = sessionUserOverride;

        if (!sessionUserOverride) {
          const {
            data: { session },
          } = await withTimeout(
            supabase.auth.getSession(),
            OPERATOR_AUTH_TIMEOUT_MS,
            'supabase.auth.getSession'
          );
          sessionUser = session?.user || null;
        }

        if (!sessionUser) {
          clearCachedOperatorAuth();
          clearState();
          return;
        }

        const profile = await loadOperatorProfile(sessionUser.id);

        if (!profile) {
          clearCachedOperatorAuth();
          clearState();
          return;
        }

        const mergedUser = { ...sessionUser, ...profile };

        if (mounted) {
          setUser(mergedUser);
          setOperatorProfile(profile);
        }

        writeCachedOperatorAuth({ user: mergedUser, profile });
      } catch (error) {
        console.error("Erro ao validar sessão do operador:", error);

        if (isTimeoutError(error) && cachedAuth) {
          applyCache(cachedAuth);
          if (mounted) {
            setAuthError(null);
          }
          return;
        }

        if (mounted) {
          clearState();
          if (isTimeoutError(error)) {
            setAuthError({
              code: 'operator-auth-timeout',
              source: error?.message?.replace('Timeout em ', '') || 'operator-auth',
              message: 'Nao foi possivel validar a sessao do operador dentro do tempo esperado.'
            });
          }
        }
      } finally {
        clearTimeout(failsafeId);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    syncWithSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user || null;

      if (!sessionUser) {
        clearCachedOperatorAuth();
        clearState();
        if (mounted) {
          setAuthError(null);
          setLoading(false);
        }
        return;
      }

      await syncWithSession(sessionUser);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [authAttempt, isTimeoutError, loadOperatorProfile, withTimeout]);

  const retryAuth = useCallback(() => {
    setLoading(true);
    setAuthError(null);
    setAuthAttempt((prev) => prev + 1);
  }, []);

  const signInWithPassword = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    const sessionUser = data?.user;
    const profile = await loadOperatorProfile(sessionUser?.id);

    if (!profile) {
      await supabase.auth.signOut();
      clearCachedOperatorAuth();
      throw new Error("Sua conta nao tem acesso ao painel operador.");
    }

    const mergedUser = { ...sessionUser, ...profile };

    // ISOLAMENTO: Marcar sessão como operador e limpar cache de tenant
    setActiveAuthMode(AUTH_MODES.OPERATOR);
    try { localStorage.removeItem('employee_user'); } catch { /* ignore */ }

    await supabase
      .from("saas_operator_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", profile.id);

    setUser(mergedUser);
    setOperatorProfile(profile);
    setAuthError(null);
    setLoading(false);
    writeCachedOperatorAuth({ user: mergedUser, profile });

    return { user: mergedUser, operatorProfile: profile };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearCachedOperatorAuth();
    clearActiveAuthMode();
    setUser(null);
    setOperatorProfile(null);
    setAuthError(null);
    setLoading(false);
  };

  return {
    loading,
    user,
    operatorProfile,
    authError,
    hasSession: !!user,
    isAuthenticated: !!user,
    isOperator: !!operatorProfile,
    retryAuth,
    signInWithPassword,
    signOut,
  };
}
