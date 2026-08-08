"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Bot, Clock3, Power } from "lucide-react";
import { toast } from "sonner";

type Feature = {
  feature_code: string;
  display_name: string;
  enabled: boolean;
  required_entitlement: string | null;
  model_tier: "fast" | "balanced" | "advanced";
  timeout_ms: number;
  max_output_tokens: number;
};

type Payload = {
  features: Feature[];
  permissions: { can_manage: boolean };
  summary: { requests_24h: number; failures_24h: number; estimated_cost_micros_24h: number; average_latency_ms_24h: number };
  recent_failures: Array<{ feature_code: string; error_code: string | null; created_at: string }>;
};

export function AdminAiControlCenter() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/ai", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "AI controls could not be loaded.");
    setPayload(data as Payload);
  }, []);

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "AI controls could not be loaded.")); }, [load]);

  async function update(feature: Feature, changes: Partial<Feature>) {
    setSaving(feature.feature_code);
    try {
      const response = await fetch("/api/admin/ai", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ feature_code: feature.feature_code, ...changes }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "AI control could not be saved.");
      setPayload((current) => current ? { ...current, features: current.features.map((item) => item.feature_code === feature.feature_code ? data.feature : item) } : current);
      toast.success(`${feature.display_name} updated.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "AI control could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  if (error) return <section className="panel mt-5 rounded-3xl p-5"><div className="text-sm text-rec">{error}</div></section>;
  if (!payload) return <section className="panel mt-5 rounded-3xl p-5 text-sm text-muted-foreground">Loading studio intelligence...</section>;

  const stats = [
    { label: "Requests / 24h", value: payload.summary.requests_24h, icon: Activity },
    { label: "Failures / 24h", value: payload.summary.failures_24h, icon: AlertTriangle },
    { label: "Avg latency", value: `${payload.summary.average_latency_ms_24h}ms`, icon: Clock3 },
    { label: "Est. cost", value: `$${(payload.summary.estimated_cost_micros_24h / 1_000_000).toFixed(2)}`, icon: Bot },
  ];

  return (
    <section className="panel mt-5 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div><div className="label-hw text-gold">Studio Intelligence</div><h2 className="mt-2 text-2xl font-semibold">AI control center</h2><p className="mt-2 text-sm text-muted-foreground">Operational controls and privacy-safe usage from the last 24 hours.</p></div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-1 text-xs text-emerald-300">Server only</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-black/24 p-3"><Icon className="h-4 w-4 text-gold"/><div className="mt-3 text-xl font-semibold">{value}</div><div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div></div>)}</div>
      <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
        {payload.features.map((feature) => (
          <div key={feature.feature_code} className="grid gap-3 bg-black/20 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div><div className="font-semibold">{feature.display_name}</div><div className="mt-1 text-xs text-muted-foreground">{feature.required_entitlement ?? "Internal"} · {feature.max_output_tokens} max tokens</div></div>
            <select aria-label={`${feature.display_name} model tier`} value={feature.model_tier} disabled={!payload.permissions.can_manage || saving === feature.feature_code} onChange={(event) => void update(feature, { model_tier: event.target.value as Feature["model_tier"] })} className="h-10 rounded-xl border border-white/10 bg-black px-3 text-xs text-white"><option value="fast">Fast</option><option value="balanced">Balanced</option><option value="advanced">Advanced</option></select>
            <button type="button" disabled={!payload.permissions.can_manage || saving === feature.feature_code} onClick={() => void update(feature, { enabled: !feature.enabled })} className={`flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold ${feature.enabled ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-300" : "border-rec/25 bg-rec/8 text-rec"}`}><Power className="h-3.5 w-3.5"/>{feature.enabled ? "Live" : "Paused"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
