"use client";

import { AccessLaunchRow } from "@/components/studio/primitives/AccessLaunchRow";
import type { MembershipSnapshot } from "@/lib/membership";
import { hasAllAccessMembership, membershipAccessLabel } from "@/lib/studio/format";
import { Briefcase, ChevronRight, Crown, Headphones, Home, ShieldCheck, WandSparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export function StudioAccessHub({
  open,
  membership,
  onClose,
  onStartWriting,
  onOpenReadiness,
  onChooseRoom,
  onBrowseProducers,
  onManage,
}: {
  open: boolean;
  membership: MembershipSnapshot | null;
  onClose: () => void;
  onStartWriting: () => void;
  onOpenReadiness: () => void;
  onChooseRoom: () => void;
  onBrowseProducers: () => void;
  onManage: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const artist = membership?.artist ?? null;
  const producer = membership?.producer ?? null;
  if (!open || !artist) return null;

  const planLabel = [artist.plan.name, producer?.plan.name].filter(Boolean).join(" + ");
  const allAccess = hasAllAccessMembership(membership);
  const roomLimit = allAccess ? -1 : typeof artist.limits.studio_rooms === "number" ? artist.limits.studio_rooms : 1;
  const hasWriterIntelligence = artist.entitlements.ghostwriter === true || artist.entitlements.full_pen_view === true;
  const hasAdvancedReadiness = artist.entitlements.advanced_booth_ready === true;

  return (
    <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/76 px-2 pt-14 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Studio access">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close studio access" />
      <section className="relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101012] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-28px_90px_rgba(0,0,0,0.72)]">
        <div className="relative overflow-hidden border-b border-gold/18 px-5 pb-5 pt-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(246,199,72,0.16),transparent_42%)]" />
          <div className="relative flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/35 bg-gold/10 text-gold"><Crown className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="label-hw text-gold/80">Your studio is upgraded</div>
              <h2 className="mt-1 text-xl font-semibold text-white">{membershipAccessLabel(membership) ?? artist.plan.name} is active.</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/52">{planLabel}. The tools below are ready where you create.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/55" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <AccessLaunchRow
            icon={WandSparkles}
            eyebrow="Create"
            title="Writer Flow"
            detail={hasWriterIntelligence ? "Ghostwriter, Pen View, rewrites, and version history are available inside the pad." : "Your focused writing room is ready."}
            action="Start writing"
            onClick={onStartWriting}
          />
          <AccessLaunchRow
            icon={ShieldCheck}
            eyebrow="Finish"
            title="Record Readiness"
            detail={hasAdvancedReadiness ? "Advanced Booth Ready, performance coaching, and premium exports are active." : "Track song completion and prepare the record for the booth."}
            action="Open session"
            onClick={onOpenReadiness}
          />
          <AccessLaunchRow
            icon={Home}
            eyebrow="Environment"
            title={roomLimit === -1 ? "All studio rooms" : `${Math.max(1, roomLimit)} studio rooms`}
            detail="Choose the room that matches the energy of tonight's record."
            action="Choose room"
            onClick={onChooseRoom}
          />
          <AccessLaunchRow
            icon={Headphones}
            eyebrow="Sound"
            title="Producer beats"
            detail="Browse producer storefronts and find a beat that fits the session."
            action="Browse beats"
            onClick={onBrowseProducers}
          />

          {producer && (
            <Link href="/producer" className="flex min-h-14 items-center gap-3 rounded-2xl border border-gold/25 bg-gold/[0.07] px-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/25 bg-black/24 text-gold"><Briefcase className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white">Open Producer HQ</span><span className="mt-0.5 block truncate text-[10px] text-white/45">Catalog, services, promotion, and intelligence</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gold" />
            </Link>
          )}

          <button type="button" onClick={onManage} className="min-h-10 w-full text-xs font-semibold text-white/45 hover:text-gold">Manage membership in Profile</button>
        </div>
      </section>
    </div>
  );
}
