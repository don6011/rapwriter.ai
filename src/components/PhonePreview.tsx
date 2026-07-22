"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

type PhoneModel = "iphone" | "samsung";

const phoneModels: Array<{ id: PhoneModel; label: string; detail: string }> = [
  { id: "iphone", label: "iPhone", detail: "390 x 844" },
  { id: "samsung", label: "Samsung", detail: "390 x 844" },
];

export function PhonePreview() {
  const [model, setModel] = useState<PhoneModel>("iphone");
  const [isHydrated, setIsHydrated] = useState(false);
  const activeModel = phoneModels.find((item) => item.id === model) ?? phoneModels[0];

  useEffect(() => {
    const savedModel = window.sessionStorage.getItem("rapwriter:preview-device");
    if (savedModel === "iphone" || savedModel === "samsung") setModel(savedModel);
    setIsHydrated(true);
  }, []);

  function selectModel(nextModel: PhoneModel) {
    window.sessionStorage.setItem("rapwriter:preview-device", nextModel);
    setModel(nextModel);
  }

  return (
    <main data-preview-ready={isHydrated ? "true" : "false"} className="min-h-[100svh] overflow-x-hidden bg-[#050506] text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#09090a]/94 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <BrandLogo />
          <div className="flex rounded-xl border border-white/10 bg-black/35 p-1" role="tablist" aria-label="Phone preview model">
            {phoneModels.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={model === item.id}
                onClick={() => selectModel(item.id)}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors",
                  model === item.id ? "bg-gold text-black" : "text-white/55 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="relative mx-auto flex min-h-[calc(100svh-65px)] w-full max-w-5xl flex-col items-center px-4 py-7">
        <div className="mb-5 flex items-center gap-3 text-center">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
          <div>
            <div className="label-hw text-gold/80">Live device preview</div>
            <div className="mt-1 text-xs text-white/42">{activeModel.label} / {activeModel.detail}</div>
          </div>
        </div>

        <div className="relative">
          <DeviceShell model={model} />
        </div>
      </section>
    </main>
  );
}

function DeviceShell({ model }: { model: PhoneModel }) {
  const isIPhone = model === "iphone";

  return (
    <div
      data-testid="phone-shell"
      data-device={model}
      className={cn(
        "relative max-w-[calc(100vw-24px)] border-2 shadow-[0_36px_110px_rgba(0,0,0,0.72),inset_0_0_0_1px_rgba(255,255,255,0.15)] transition-[border-radius,padding,width,height] duration-300",
        isIPhone
          ? "h-[868px] w-[414px] rounded-[62px] border-[#4b4d52] bg-[linear-gradient(145deg,#2d2f33,#0b0c0e_42%,#24262a)] p-[10px]"
          : "h-[864px] w-[410px] rounded-[42px] border-[#55575b] bg-[linear-gradient(145deg,#3a3c40,#111214_46%,#2b2d31)] p-[8px]",
      )}
    >
      {isIPhone ? (
        <>
          <span className="absolute -left-[5px] top-32 h-10 w-[4px] rounded-l bg-[#34363a]" />
          <span className="absolute -left-[5px] top-48 h-16 w-[4px] rounded-l bg-[#34363a]" />
          <span className="absolute -left-[5px] top-[268px] h-16 w-[4px] rounded-l bg-[#34363a]" />
          <span className="absolute -right-[5px] top-48 h-24 w-[4px] rounded-r bg-[#34363a]" />
        </>
      ) : (
        <>
          <span className="absolute -left-[4px] top-40 h-20 w-[3px] rounded-l bg-[#3b3d41]" />
          <span className="absolute -right-[4px] top-36 h-16 w-[3px] rounded-r bg-[#3b3d41]" />
          <span className="absolute -right-[4px] top-56 h-28 w-[3px] rounded-r bg-[#3b3d41]" />
        </>
      )}
      <div className={cn("relative h-full w-full overflow-hidden bg-black transition-[border-radius] duration-300", isIPhone ? "rounded-[51px]" : "rounded-[33px]")}>
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 bg-black",
            isIPhone
              ? "h-[34px] w-[126px] rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.025)]"
              : "h-[12px] w-[12px] rounded-full border border-white/8 shadow-[0_0_8px_rgba(0,0,0,0.9)]",
          )}
        />
        <iframe
          src="/"
          title="RapWriter device preview"
          className="h-full w-full border-0 bg-black"
          allow="autoplay; microphone"
        />
        <div
          className={cn(
            "pointer-events-none absolute bottom-2 left-1/2 z-20 h-1 -translate-x-1/2 rounded-full",
            isIPhone ? "w-32 bg-white/78" : "w-28 bg-white/62",
          )}
        />
      </div>
    </div>
  );
}
