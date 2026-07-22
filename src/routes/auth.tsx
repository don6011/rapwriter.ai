import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Mail, Lock, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · RapWriter.ai" },
      {
        name: "description",
        content: "Sign in or create your RapWriter.ai account. Your drafts, licenses, and Booth Ready certificates in one place.",
      },
      { property: "og:title", content: "Sign in · RapWriter.ai" },
      { property: "og:description", content: "Access Ghost Studio and your vault." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/studio" });
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/studio" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setNotice("Check your inbox to confirm your email, then sign in.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed.");
      if (result.redirected) return;
      navigate({ to: "/studio" });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background text-foreground">
      {/* Left — brand panel */}
      <div className="hidden md:flex relative overflow-hidden p-12 flex-col justify-between border-r border-border/40">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 h-[600px] w-[600px] rounded-full blur-3xl opacity-25 bg-[radial-gradient(circle_at_center,_var(--gold)_0%,_transparent_70%)]" />
        </div>
        <Link to="/" className="relative flex items-center gap-2">
          <div className="h-8 w-8 rounded-md gold-seal grid place-items-center">
            <Sparkles className="h-4 w-4 text-onyx" />
          </div>
          <span className="font-display text-lg">
            RapWriter<span className="text-gold-gradient">.ai</span>
          </span>
        </Link>
        <div className="relative">
          <h1 className="font-display text-4xl leading-tight">
            The room is <span className="text-gold-gradient">quiet</span>.<br />
            The pen is <span className="text-gold-gradient">warm</span>.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-sm">
            Sign in to access Ghost Studio, your licensed beats, and your Booth Ready certificates.
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Cloud vault · encrypted
          </span>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80 mb-3">
            {mode === "signin" ? "Welcome back" : "New here"}
          </div>
          <h2 className="font-display text-3xl">
            {mode === "signin" ? "Sign in to the Studio" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Your drafts, licenses, and certificates are waiting."
              : "60 seconds. No credit card. Start writing tonight."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-md border border-border/70 bg-onyx-elev/40 px-4 py-3 text-sm font-medium hover:bg-onyx-elev transition-colors disabled:opacity-60"
          >
            <GoogleG /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            <div className="flex-1 hairline" /> or email <div className="flex-1 hairline" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1.5">Email</div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md bg-onyx-elev/60 border border-border/60 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  placeholder="you@studio.com"
                />
              </div>
            </label>
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1.5">Password</div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md bg-onyx-elev/60 border border-border/60 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  placeholder="••••••••"
                />
              </div>
            </label>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-md gold-seal px-4 py-3 text-sm font-semibold text-onyx transition-transform",
                !busy && "hover:scale-[1.01]",
                busy && "opacity-70",
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to RapWriter?{" "}
                <button className="text-gold hover:underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have one?{" "}
                <button className="text-gold hover:underline" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="mt-8 text-center text-[11px] text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.5 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.3 13.3 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.6 7.2l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z"/>
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C1 16.8 0 20.3 0 24s1 7.2 2.6 10.7l7.9-6.1z"/>
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8 2.2-6.3 0-11.7-3.8-13.5-9.4l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}
