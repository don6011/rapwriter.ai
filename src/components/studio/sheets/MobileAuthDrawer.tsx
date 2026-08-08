"use client";

import { Mail, ShieldCheck, X } from "lucide-react";
import type { FormEvent } from "react";

export function MobileAuthDrawer({
  open,
  email,
  password,
  busy,
  notice,
  redirectUrl,
  recoveryMode,
  onEmail,
  onPassword,
  onSubmit,
  onCreateAccount,
  onMagicLink,
  onForgotPassword,
  onResendVerification,
  onClose,
}: {
  open: boolean;
  email: string;
  password: string;
  busy: boolean;
  notice: string | null;
  redirectUrl: string;
  recoveryMode: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCreateAccount: () => void;
  onMagicLink: () => void;
  onForgotPassword: () => void;
  onResendVerification: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-[430px] rounded-3xl border border-white/10 bg-[#111113] p-5 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label-hw text-gold/85">Studio Sync</div>
            <h2 className="mt-2 text-2xl font-semibold">{recoveryMode ? "Choose a new password." : "Sign in with email."}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close sign in">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {recoveryMode ? "Your recovery link is verified. Set the password you will use across devices." : "Sign in with a password to keep your studio synced across devices."}
        </p>
        {!recoveryMode && <div className="mt-3 rounded-xl border border-white/10 bg-black/24 p-3">
          <div className="label-hw text-gold/80">Allowed redirect URL</div>
          <div className="mt-1 break-all text-xs leading-relaxed text-muted-foreground">{redirectUrl}</div>
        </div>}
        {!recoveryMode && <label className="mt-5 block">
          <span className="label-hw">Email</span>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3">
            <Mail className="h-4 w-4 text-gold" />
            <input
              value={email}
              onChange={(event) => onEmail(event.target.value)}
              type="email"
              required
              placeholder="artist@example.com"
              className="min-h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
            />
          </div>
        </label>}
        <label className="mt-3 block">
          <span className="label-hw">Password</span>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <input
              value={password}
              onChange={(event) => onPassword(event.target.value)}
              type="password"
              required
              minLength={6}
              placeholder={recoveryMode ? "Minimum 8 characters" : "Password"}
              className="min-h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
            />
          </div>
        </label>
        {notice && <div className="mt-3 rounded-xl border border-gold/20 bg-gold/8 p-3 text-sm text-gold">{notice}</div>}
        <button
          type="submit"
          disabled={busy || (recoveryMode ? password.length < 8 : !email.includes("@") || password.length < 6)}
          className="gold-seal mt-5 min-h-12 w-full rounded-2xl px-4 text-sm font-semibold disabled:opacity-55"
        >
          {busy ? "Working..." : recoveryMode ? "Update Password" : "Sign In"}
        </button>
        {!recoveryMode && <button
          type="button"
          onClick={onCreateAccount}
          disabled={busy || !email.includes("@") || password.length < 6}
          className="mt-3 min-h-12 w-full rounded-2xl border border-gold/25 bg-gold/8 px-4 text-sm font-semibold text-gold disabled:opacity-55"
        >
          Create Account
        </button>}
        {!recoveryMode && <button
          type="button"
          onClick={onMagicLink}
          disabled={busy || !email.includes("@")}
          className="mt-3 min-h-10 w-full rounded-xl px-4 text-xs font-semibold text-muted-foreground disabled:opacity-55"
        >
          Send magic link instead
        </button>}
        {!recoveryMode && <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={onForgotPassword} disabled={busy || !email.includes("@")} className="min-h-10 rounded-xl px-2 text-xs font-semibold text-muted-foreground disabled:opacity-55">
            Forgot password?
          </button>
          <button type="button" onClick={onResendVerification} disabled={busy || !email.includes("@")} className="min-h-10 rounded-xl px-2 text-xs font-semibold text-muted-foreground disabled:opacity-55">
            Resend confirmation
          </button>
        </div>}
      </form>
    </div>
  );
}
