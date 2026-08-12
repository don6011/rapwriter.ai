export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#070708] px-6 text-white">
      <section className="w-full max-w-sm rounded-lg border border-gold/25 bg-[#111113] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">RapWriter</p>
        <h1 className="text-2xl font-semibold">Your studio is offline.</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          Connect once to load the studio. After that, saved drafts remain available on this device when your signal drops.
        </p>
      </section>
    </main>
  );
}
