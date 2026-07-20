"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isAppRole, type AppRole } from "@/lib/access-control";
import { createClient } from "@/lib/supabase/client";

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
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
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
        setUser(null);
        setRoles([]);
        setEmailVerified(false);
        setError("RapWriter could not reach the session service. Please try again.");
        return false;
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

    void supabase.auth.getUser().then(async ({ data, error: userError }) => {
      if (!active) return;
      if (userError) {
        const missingSession = userError.name === "AuthSessionMissingError"
          || userError.message.toLowerCase().includes("auth session missing");
        setError(missingSession ? null : userError.message);
        setUser(null);
      } else {
        await confirmServerSession(data.user);
      }
      if (active) setLoading(false);
    });

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

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [confirmServerSession, supabase]);

  const signIn = async (email: string, next = "/") => {
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
    const next = encodeURIComponent("/?auth_mode=recovery");
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
