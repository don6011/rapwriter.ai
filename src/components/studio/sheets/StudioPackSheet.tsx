"use client";

import type { StudioRoomAccess } from "@/lib/studio-room-access";
import { getStudioPack } from "@/lib/studio/packs";
import type { StudioPack, StudioPackId } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Check, LockKeyhole, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

export function StudioPackSheet({
  open,
  active,
  packs,
  getStudioPackAccess,
  onClose,
  onPreview,
  onOpenMembership,
  onStudioDna,
  onSelect,
}: {
  open: boolean;
  active: StudioPackId;
  packs: StudioPack[];
  getStudioPackAccess: (id: StudioPackId) => StudioRoomAccess;
  onClose: () => void;
  onPreview: (id: StudioPackId) => void;
  onOpenMembership: () => void;
  onStudioDna: () => void;
  onSelect: (id: StudioPackId) => void;
}) {
  const [previewId, setPreviewId] = useState<StudioPackId>(active);
  const previewPack = getStudioPack(previewId);
  const previewAccess = getStudioPackAccess(previewPack.id);

  useEffect(() => {
    if (open) setPreviewId(active);
  }, [active, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <div className="max-h-[82svh] w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="label-hw text-gold/85">Studio Packs</div>
            <h2 className="mt-2 text-2xl font-semibold">Choose the room.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Change the environment without crowding the writing screen.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onStudioDna} className="grid h-10 w-10 place-items-center rounded-full border border-gold/25 bg-gold/8 text-gold" aria-label="Set Studio DNA" title="Studio DNA">
              <Sparkles className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-muted-foreground" aria-label="Close studio packs">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="max-h-[calc(82svh-8rem)] space-y-3 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-2xl border border-gold/25 bg-gold/8">
            <div className="relative h-40">
              <img src={previewPack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: previewPack.position }} loading="lazy" decoding="async" draggable={false} />
              <div className="absolute inset-0" style={{ background: previewPack.overlay }} />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="label-hw text-gold/85">{previewAccess.available ? previewAccess.badge : "Locked Preview"}</div>
                <div className="mt-1 text-2xl font-semibold">{previewPack.label}</div>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{previewPack.line}</p>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{previewPack.writingCue}</p>
              {previewAccess.available ? (
                <button type="button" onClick={() => onSelect(previewPack.id)} className="gold-seal mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-black">
                  Use {previewPack.label}
                </button>
              ) : (
                <>
                  {process.env.NODE_ENV !== "production" && (
                    <button
                      type="button"
                      onClick={() => {
                        onPreview(previewPack.id);
                        onClose();
                      }}
                      className="mt-3 min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white"
                    >
                      Preview locally
                    </button>
                  )}
                  <button type="button" onClick={onOpenMembership} className="gold-seal mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-black">
                    Unlock with RapWriter Pro
                  </button>
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                    All locked rooms are included while your Pro membership is active.
                  </p>
                  {process.env.NODE_ENV !== "production" && (
                    <p className="mt-1 text-center text-[10px] leading-relaxed text-white/40">
                      Local preview does not grant ownership or membership access.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {packs.map((pack) => {
              const access = getStudioPackAccess(pack.id);
              const locked = !access.available;
              const previewing = previewId === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPreviewId(pack.id)}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-black/24 text-left transition-colors",
                    previewing ? "border-gold/45 bg-gold/10" : "border-white/10",
                  )}
                >
                  <div className="relative h-20">
                    <img src={pack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: pack.position }} loading="lazy" decoding="async" draggable={false} />
                    <div className="absolute inset-0" style={{ background: pack.overlay }} />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-gold/20 bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-gold">
                        {access.badge}
                      </span>
                      {active === pack.id ? (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold text-black">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : locked ? (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 bg-black/45 text-white/70">
                          <LockKeyhole className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-xs font-semibold">{pack.label}</div>
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">{pack.bestFor.slice(0, 2).join(" / ")}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
            <div className="label-hw text-gold/80">Pack Access</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              RapWriter Pro unlocks every room while your membership is active. Included rooms stay available on every plan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
