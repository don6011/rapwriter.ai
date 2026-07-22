import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const links = [
  { to: "/studio", label: "Studio" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/manifesto", label: "Manifesto" },
  { to: "/changelog", label: "Changelog" },
] as const;

export function SiteNav({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-40 transition-colors",
        scrolled || !transparent
          ? "backdrop-blur-xl bg-onyx/70 border-b border-border/40"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-md gold-seal grid place-items-center">
            <Sparkles className="h-4 w-4 text-onyx" />
          </div>
          <span className="font-display text-lg tracking-tight">
            RapWriter<span className="text-gold-gradient">.ai</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                {user.email}
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
              <Link
                to="/studio"
                className="rounded-md gold-seal px-3.5 py-1.5 text-sm font-semibold text-onyx hover:scale-[1.02] transition-transform"
              >
                Enter Studio
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/studio"
                className="rounded-md gold-seal px-3.5 py-1.5 text-sm font-semibold text-onyx hover:scale-[1.02] transition-transform"
              >
                Enter Studio
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="md:hidden h-9 w-9 grid place-items-center rounded-md border border-border/60"
          aria-label="Menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/40 bg-onyx/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {user ? (
                <button
                  onClick={async () => {
                    await signOut();
                    setOpen(false);
                    navigate({ to: "/" });
                  }}
                  className="w-full rounded-md border border-border/60 px-3 py-2 text-sm text-left"
                >
                  Sign out ({user.email})
                </button>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  Sign in
                </Link>
              )}
              <Link
                to="/studio"
                onClick={() => setOpen(false)}
                className="w-full rounded-md gold-seal px-3 py-2 text-sm font-semibold text-onyx text-center"
              >
                Enter Studio
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
