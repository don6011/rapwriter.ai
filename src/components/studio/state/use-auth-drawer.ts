"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { useRapWriterData } from "@/hooks/use-rapwriter-data";
import { AUTH_RECOVERY_EVENT } from "@/lib/auth-recovery-url";

type Workspace = ReturnType<typeof useRapWriterData>;

export type AuthDrawerActions = Pick<
  Workspace,
  | "signIn"
  | "signInWithPassword"
  | "signUpWithPassword"
  | "sendPasswordReset"
  | "updatePassword"
  | "resendVerification"
>;

export function useAuthDrawer({
  signIn,
  signInWithPassword,
  signUpWithPassword,
  sendPasswordReset,
  updatePassword,
  resendVerification,
}: AuthDrawerActions) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authRedirectUrl, setAuthRedirectUrl] = useState("/api/auth/callback");
  const [authRecoveryMode, setAuthRecoveryMode] = useState(false);

  useEffect(() => {
    setAuthRedirectUrl(`${window.location.origin}/api/auth/callback`);
  }, []);

  useEffect(() => {
    const activateRecovery = () => {
      setAuthRecoveryMode(true);
      setAuthOpen(true);
      setAuthNotice("Choose a new password for your RapWriter account.");
    };

    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    if (url.searchParams.get("auth_mode") === "recovery" || hash.get("type") === "recovery") {
      activateRecovery();
      url.searchParams.delete("auth_mode");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    window.addEventListener(AUTH_RECOVERY_EVENT, activateRecovery);
    return () => window.removeEventListener(AUTH_RECOVERY_EVENT, activateRecovery);
  }, []);

  const requestAuth = useCallback((message = "Sign in to sync your studio.") => {
    setAuthNotice(message);
    setAuthOpen(true);
  }, []);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    const result = await signInWithPassword(authEmail, authPassword);
    if (result.error) {
      setAuthNotice(result.error.message);
      setAuthBusy(false);
      return;
    }
    setAuthNotice("Signed in. Syncing your studio...");
    setAuthBusy(false);
    setAuthOpen(false);
  };

  const createAccountWithPassword = async () => {
    setAuthBusy(true);
    const result = await signUpWithPassword(authEmail, authPassword);
    if (result.error) {
      setAuthNotice(result.error.message);
      setAuthBusy(false);
      return;
    }
    setAuthBusy(false);
    if (result.data.session) {
      setAuthNotice("Account created. Syncing your studio...");
      setAuthOpen(false);
      return;
    }
    setAuthNotice("Account created. Check your email to confirm, then sign in.");
  };

  const sendMagicLink = async () => {
    setAuthBusy(true);
    const next = `${window.location.pathname}${window.location.search}`;
    const result = await signIn(authEmail, next);
    setAuthBusy(false);
    if (result.error) {
      setAuthNotice(result.error.message);
      return;
    }
    setAuthNotice("Magic link sent. Open it in this same preview browser.");
  };

  const requestPasswordReset = async () => {
    if (!authEmail.includes("@")) {
      setAuthNotice("Enter the email for your RapWriter account first.");
      return;
    }
    setAuthBusy(true);
    const result = await sendPasswordReset(authEmail);
    setAuthBusy(false);
    setAuthNotice(result.error ? result.error.message : "Password reset sent. Open the email in this browser.");
  };

  const updateRecoveredPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authPassword.length < 8) {
      setAuthNotice("Use at least 8 characters for the new password.");
      return;
    }
    setAuthBusy(true);
    const result = await updatePassword(authPassword);
    setAuthBusy(false);
    if (result.error) {
      setAuthNotice(result.error.message);
      return;
    }
    setAuthRecoveryMode(false);
    setAuthNotice("Password updated. Your studio is ready.");
    setAuthOpen(false);
  };

  const resendConfirmation = async () => {
    if (!authEmail.includes("@")) {
      setAuthNotice("Enter the account email first.");
      return;
    }
    setAuthBusy(true);
    const result = await resendVerification(authEmail);
    setAuthBusy(false);
    setAuthNotice(result.error ? result.error.message : "Confirmation email sent.");
  };

  return {
    /** Opens the drawer with a contextual reason. Stable across renders. */
    requestAuth,
    /** Spread straight onto <MobileAuthDrawer />; the prop contract is unchanged. */
    drawerProps: {
      open: authOpen,
      email: authEmail,
      password: authPassword,
      busy: authBusy,
      notice: authNotice,
      redirectUrl: authRedirectUrl,
      recoveryMode: authRecoveryMode,
      onEmail: setAuthEmail,
      onPassword: setAuthPassword,
      onSubmit: authRecoveryMode ? updateRecoveredPassword : submitAuth,
      onCreateAccount: createAccountWithPassword,
      onMagicLink: sendMagicLink,
      onForgotPassword: requestPasswordReset,
      onResendVerification: resendConfirmation,
      onClose: () => {
        setAuthOpen(false);
        setAuthRecoveryMode(false);
      },
    },
  };
}
