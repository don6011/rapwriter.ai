"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isAppRole, type AppRole } from "@/lib/access-control";
import { AUTH_RECOVERY_EVENT, recoveryModeUrl, recoverySessionFromHash } from "@/lib/auth-recovery-url";
import { createClient } from "@/lib/supabase/client";

const SESSION_REQUEST_TIMEOUT_MS = 8_000;

function rejectAfter(timeoutMs: number, message: string) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
}

export function useAuth() {
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const verificationSequence = useRef(0);

  const confirmServerSession = useCallback(
    async (candidate: User | null) => {
      const verificationId = ++verificationSequence.current;
      if (!candidate) {
        setUser(null);
        setRoles([]);
        setEmailVerified(false);
        return false;
      }

      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), SESSION_REQUEST_TIMEOUT_MS);
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }).finally(() => window.clearTimeout(timeout));
        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: boolean;
          user_id?: string | null;
          roles?: unknown[];
          email_verified?: boolean;
          error?: string | null;
        };
        const confirmed = response.ok && payload.authenticated === true && payload.user_id === candidate.id;
        if (verificationId !== verificationSequence.current) return false;

        if (!confirmed) {
          if (response.status >= 500) {
            setUser((current) => (current?.id === candidate.id ? current : candidate));
            setError("Studio sync is reconnecting. Your work remains available on this device.");
            return true;
          }
          setUser(null);
          setRoles([]);
          setEmailVerified(false);
          setError(payload.error || "Your studio session could not be confirmed. Please sign in again.");
          return false;
        }

        setUser((current) => (current?.id === candidate.id ? current : candidate));
        setRoles((payload.roles ?? []).filter(isAppRole));
        setEmailVerified(payload.email_verified === true);
        setError(null);
        return true;
      } catch {
        if (verificationId !== verificationSequence.current) return false;
        setUser((current) => (current?.id === candidate.id ? current : candidate));
        setError("Studio sync is reconnecting. Your work remains available on this device.");
        return true;
      }
    },
    [],
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError("Supabase environment variables are missing.");
      return;
    }

    let active = true;

    void (async () => {
      try {
        const recoverySession = recoverySessionFromHash(window.location.hash);
        if (recoverySession) {
          const { error: recoveryError } = await supabase.auth.setSession({
            access_token: recoverySession.accessToken,
            refresh_token: recoverySession.refreshToken,
          });

          window.history.replaceState({}, "", recoveryModeUrl(window.location.href));
          window.dispatchEvent(new Event(AUTH_RECOVERY_EVENT));

          if (recoveryError) {
            setError("This recovery link is invalid or expired. Request a new password reset.");
            setUser(null);
            return;
          }
        }

        const { data, error: userError } = await Promise.race([
          supabase.auth.getSession(),
          rejectAfter(SESSION_REQUEST_TIMEOUT_MS, "Session restore timed out."),
        ]);
        if (!active) return;
        if (userError) {
          const missingSession = userError.name === "AuthSessionMissingError"
            || userError.message.toLowerCase().includes("auth session missing");
          setError(missingSession ? null : userError.message);
          setUser(null);
        } else {
          const restoredUser = data.session?.user ?? null;
          if (restoredUser) {
            setUser(restoredUser);
            setLoading(false);
          }
          await confirmServerSession(restoredUser);
        }
      } catch {
        if (!active) return;
        verificationSequence.current += 1;
        setUser(null);
        setRoles([]);
        setEmailVerified(false);
        setError(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      if (!nextUser) {
        verificationSequence.current += 1;
        setUser(null);
        setRoles([]);
        setEmailVerified(false);
        setError(null);
        return;
      }

      queueMicrotask(() => {
        if (active) void confirmServerSession(nextUser);
      });
    });

    const retryServerSession = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (active && data.session?.user) void confirmServerSession(data.session.user);
      });
    };
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") retryServerSession();
    };
    window.addEventListener("focus", retryServerSession);
    document.addEventListener("visibilitychange", retryWhenVisible);

    return () => {
      active = false;
      window.removeEventListener("focus", retryServerSession);
      document.removeEventListener("visibilitychange", retryWhenVisible);
      subscription.unsubscribe();
    };
  }, [confirmServerSession, supabase]);

  const signIn = async (email: string, next = "/studio") => {
    if (!supabase) return { error: new Error("Supabase is not configured.") };
    const params = new URLSearchParams({ next });
    const redirectTo = `${window.location.origin}/api/auth/callback?${params}`;
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
  };

  const signInWithPassword = async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase is not configured."), data: { user: null, session: null } };
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return result;
    }

    const serverReady = await confirmServerSession(result.data.user);
    setLoading(false);
    if (!serverReady) {
      return {
        data: result.data,
        error: new Error("Signed in, but RapWriter could not confirm the server session. Please try again."),
      };
    }

    return result;
  };

  const signUpWithPassword = async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase is not configured."), data: { user: null, session: null } };
    setLoading(true);
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return result;
    }

    if (result.data.session) await confirmServerSession(result.data.user);
    else setUser(null);
    setLoading(false);
    return result;
  };

  const sendPasswordReset = async (email: string) => {
    if (!supabase) return { error: new Error("Supabase is not configured.") };
    const next = encodeURIComponent("/studio?auth_mode=recovery");
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=${next}`,
    });
  };

  const updatePassword = async (password: string) => {
    if (!supabase) return { error: new Error("Supabase is not configured.") };
    const result = await supabase.auth.updateUser({ password });
    if (!result.error && result.data.user) await confirmServerSession(result.data.user);
    return result;
  };

  const resendVerification = async (email: string) => {
    if (!supabase) return { error: new Error("Supabase is not configured.") };
    return supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
  };

  const signOut = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      verificationSequence.current += 1;
      setUser(null);
      setRoles([]);
      setEmailVerified(false);
      setError(null);
      setLoading(false);
    }
  };

  return {
    user,
    roles,
    emailVerified,
    loading,
    sessionReady: Boolean(user),
    error,
    signIn,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    updatePassword,
    resendVerification,
    signOut,
    confirmServerSession,
  };
}
