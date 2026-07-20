import { Home } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#070708] px-6 text-white">
      <section className="w-full max-w-md text-center">
        <BrandLogo className="justify-center" />
        <div className="label-hw mt-8 text-gold/80">Room not found</div>
        <h1 className="mt-3 text-3xl font-semibold">This studio door does not exist.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Return to your Studio and keep the session moving.
        </p>
        <Link href="/" className="gold-seal mx-auto mt-7 flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
          <Home className="h-4 w-4" />
          Back to Studio
        </Link>
      </section>
    </main>
  );
}
