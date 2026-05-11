import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const OPERATOR_AUTH_TIMEOUT_MS = 4000;

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

    const startLoadingFailsafe = () => {
      return setTimeout(() => {
        if (mounted) {
          setLoading(false);
        }
      }, OPERATOR_AUTH_TIMEOUT_MS);
    };

    const syncAuthState = async () => {
      const failsafeId = startLoadingFailsafe();

      try {
        setLoading(true);
        setAuthError(null);

        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          OPERATOR_AUTH_TIMEOUT_MS,
          'supabase.auth.getSession'
        );

        const sessionUser = session?.user || null;

        if (!sessionUser) {
          if (mounted) {
            setUser(null);
            setOperatorProfile(null);
          }
          return;
        }

        const profile = await loadOperatorProfile(sessionUser.id);

        if (mounted) {
          setUser(sessionUser);
          setOperatorProfile(profile);
        }
      } catch (error) {
        console.error("Erro ao validar sessão do operador:", error);
        if (mounted) {
          setUser(null);
          setOperatorProfile(null);
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

    syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const failsafeId = startLoadingFailsafe();

      try {
        if (mounted) {
          setAuthError(null);
        }

        const sessionUser = session?.user || null;

        if (!sessionUser) {
          if (mounted) {
            setUser(null);
            setOperatorProfile(null);
          }
          return;
        }

        const profile = await loadOperatorProfile(sessionUser.id);

        if (mounted) {
          setUser(sessionUser);
          setOperatorProfile(profile);
        }
      } catch (error) {
        console.error("Erro ao sincronizar autenticação do operador:", error);
        if (mounted) {
          setUser(null);
          setOperatorProfile(null);
          if (isTimeoutError(error)) {
            setAuthError({
              code: 'operator-auth-timeout',
              source: error?.message?.replace('Timeout em ', '') || 'operator-auth',
              message: 'Nao foi possivel sincronizar a sessao do operador dentro do tempo esperado.'
            });
          }
        }
      } finally {
        clearTimeout(failsafeId);
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [isTimeoutError, loadOperatorProfile, withTimeout, authAttempt]);

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
      throw new Error("Sua conta nao tem acesso ao painel operador.");
    }

    await supabase
      .from("saas_operator_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", profile.id);

    setUser(sessionUser);
    setOperatorProfile(profile);

    return { user: sessionUser, operatorProfile: profile };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOperatorProfile(null);
    setAuthError(null);
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
