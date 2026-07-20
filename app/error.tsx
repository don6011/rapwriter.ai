"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#070708] px-6 text-white">
      <section className="w-full max-w-md text-center">
        <BrandLogo className="justify-center" />
        <div className="label-hw mt-8 text-gold/80">Studio interrupted</div>
        <h1 className="mt-3 text-3xl font-semibold">Your work is still protected.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          RapWriter hit a temporary problem while opening this view. Retry now or return to the Studio.
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" onClick={reset} className="gold-seal flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <Link href="/" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 text-sm font-semibold">
            <Home className="h-4 w-4" />
            Studio
          </Link>
        </div>
      </section>
    </main>
  );
}
