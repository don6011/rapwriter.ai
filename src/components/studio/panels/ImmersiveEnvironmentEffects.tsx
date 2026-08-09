"use client";

import type { StudioPack } from "@/lib/studio/types";

export function ImmersiveEnvironmentEffects({ studioPack }: { studioPack: StudioPack }) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="studio-depth-shift absolute -inset-8 bg-cover opacity-[0.22] blur-[3px] transition-[background-image,background-position] duration-700"
        style={{ backgroundImage: `url('${studioPack.image}')`, backgroundPosition: studioPack.position }}
      />
      <div className="studio-haze absolute inset-0 opacity-45" />
      <div className="studio-particles absolute inset-0 opacity-35" />
      <div
        className="studio-light-pulse absolute left-1/2 top-[-18%] h-[42svh] w-[88vw] max-w-[520px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${studioPack.tone}, transparent 68%)` }}
      />
    </div>
  );
}
