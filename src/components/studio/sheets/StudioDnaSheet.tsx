"use client";

import { StudioDnaChoice } from "@/components/studio/primitives/StudioDnaChoice";
import { artistGoals, producerModes, sessionMoods, writingStyles } from "@/lib/studio/dna";
import { studioDnaCue } from "@/lib/studio/intelligence";
import { getStudioPack } from "@/lib/studio/packs";
import type { StudioDna, StudioPack, StudioPackId } from "@/lib/studio/types";
import { ChevronRight, LockKeyhole, X } from "lucide-react";
import { useEffect, useState } from "react";

export function StudioDnaSheet({
  open,
  dna,
  studioPacks,
  canUseStudioPack,
  onChange,
  onClose,
  onStart,
}: {
  open: boolean;
  dna: StudioDna;
  studioPacks: StudioPack[];
  canUseStudioPack: (id: StudioPackId) => boolean;
  onChange: (patch: Partial<StudioDna>) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  const [previewEnvironment, setPreviewEnvironment] = useState<StudioPackId>(dna.environment);

  useEffect(() => {
    if (open) setPreviewEnvironment(dna.environment);
  }, [dna.environment, open]);

  if (!open) return null;
  const previewPack = getStudioPack(previewEnvironment);
  const previewLocked = !canUseStudioPack(previewPack.id);
  const selectedPack = getStudioPack(dna.environment);
  const previewDna = { ...dna, environment: previewPack.id };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/68 px-4 pb-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="studio-dna-title" className="max-h-[92svh] w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative h-36">
          <img src={previewPack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: previewPack.position }} decoding="async" draggable={false} />
          <div className="absolute inset-0" style={{ background: previewPack.overlay }} />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <div className="label-hw text-gold/85">Studio DNA</div>
              <h2 id="studio-dna-title" className="mt-2 text-2xl font-semibold">Set the room.</h2>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/30 text-muted-foreground" aria-label="Close Studio DNA">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92svh-9rem)] overflow-y-auto p-5">
          <StudioDnaChoice
            title="Environment"
            value={previewEnvironment}
            options={studioPacks.map((pack) => ({ value: pack.id, label: pack.label, locked: !canUseStudioPack(pack.id) }))}
            onSelect={(environment) => {
              const nextEnvironment = environment as StudioPackId;
              setPreviewEnvironment(nextEnvironment);
              if (canUseStudioPack(nextEnvironment)) onChange({ environment: nextEnvironment });
            }}
          />
          <StudioDnaChoice title="Artist Goal" value={dna.goal} options={artistGoals.map((label) => ({ value: label, label }))} onSelect={(goal) => onChange({ goal })} />
          <StudioDnaChoice title="Writing Style" value={dna.style} options={writingStyles.map((label) => ({ value: label, label }))} onSelect={(style) => onChange({ style })} />
          <StudioDnaChoice title="Mood" value={dna.mood} options={sessionMoods.map((label) => ({ value: label, label }))} onSelect={(mood) => onChange({ mood })} />
          <StudioDnaChoice title="Producer" value={dna.producer} options={producerModes.map((label) => ({ value: label, label }))} onSelect={(producer) => onChange({ producer })} />

          <div className="mt-5 rounded-2xl border border-gold/20 bg-gold/8 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="label-hw text-gold/85">Session intelligence</div>
              {previewLocked && <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase text-white/55"><LockKeyhole className="h-3 w-3" />Preview</span>}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/76">
              {studioDnaCue(previewDna, previewPack)}
            </p>
          </div>

          <button onClick={onStart} className="gold-seal sticky bottom-0 z-10 mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-[0_-12px_28px_rgba(17,17,19,0.92)]">
            {previewLocked ? `Start in ${selectedPack.label}` : "Start Session"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
