"use client";

import { ActivityInbox } from "@/components/ActivityInbox";
import { BrandLogo } from "@/components/BrandLogo";
import type { MembershipSnapshot } from "@/lib/membership";
import { membershipAccessLabel } from "@/lib/studio/format";
import { Crown } from "lucide-react";

export function MobileHeader({
  signedIn,
  membership,
  onOpenAccess,
  onAuthRequired,
}: {
  signedIn: boolean;
  membership: MembershipSnapshot | null;
  onOpenAccess: () => void;
  onAuthRequired: () => void;
}) {
  const accessLabel = membershipAccessLabel(membership);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-black/82 px-5 py-4 backdrop-blur-xl">
      <BrandLogo className="[&>span:first-child]:h-10 [&>span:first-child]:w-[9.25rem]" />
      <div className="flex items-center gap-2">
        {accessLabel && (
          <button
            type="button"
            onClick={onOpenAccess}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 text-[10px] font-semibold text-gold"
            aria-label={`Open ${accessLabel} studio access`}
          >
            <Crown className="h-3.5 w-3.5" />
            <span>{accessLabel}</span>
          </button>
        )}
        <ActivityInbox signedIn={signedIn} onAuthRequired={onAuthRequired} />
      </div>
    </header>
  );
}
