import { BrandLogo } from "@/components/BrandLogo";

export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#070708] px-6 text-white">
      <div className="w-full max-w-sm text-center" role="status" aria-live="polite">
        <BrandLogo className="justify-center" />
        <div className="mx-auto mt-8 h-1 w-28 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gold" />
        </div>
        <p className="label-hw mt-4 text-gold/80">Preparing your studio</p>
      </div>
    </main>
  );
}
