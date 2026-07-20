import { LockKeyhole } from "lucide-react";

export function AdminSignIn({ defaultEmail, error }: { defaultEmail?: string; error?: string }) {
  return (
    <form action="/api/admin/sign-in" method="post" className="mt-5 space-y-3">
      <label className="block">
        <span className="label-hw">Admin email</span>
        <input
          name="email"
          defaultValue={defaultEmail ?? ""}
          type="email"
          autoComplete="email"
          className="mt-2 h-12 w-full rounded-2xl border border-border bg-black/35 px-4 text-sm outline-none focus:border-gold/45"
          placeholder="owner@example.com"
          required
        />
      </label>
      <label className="block">
        <span className="label-hw">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-2 h-12 w-full rounded-2xl border border-border bg-black/35 px-4 text-sm outline-none focus:border-gold/45"
          placeholder="Enter password"
          required
          minLength={6}
        />
      </label>
      {error && (
        <div className="rounded-2xl border border-gold/20 bg-gold/8 p-3 text-xs leading-5 text-gold">
          {error}
        </div>
      )}
      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 text-sm font-semibold text-black disabled:opacity-60"
      >
        <LockKeyhole className="h-4 w-4" />
        Unlock Admin
      </button>
      <p className="px-2 text-center text-xs leading-5 text-muted-foreground">
        Use the same password account created in Supabase Auth.
      </p>
    </form>
  );
}
