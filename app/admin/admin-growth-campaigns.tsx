"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pause, Play, XCircle } from "lucide-react";
import { toast } from "sonner";

type Campaign = {
  slug: string; name: string; description: string; is_active: boolean; max_claims: number; claim_count: number;
  remaining_slots: number; claims_today: number; active_memberships: number; expired_memberships: number;
  starts_at: string; ends_at: string;
};

export function AdminGrowthCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/campaigns", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Campaigns unavailable.");
    setCampaigns(payload.campaigns ?? []);
  }, []);
  useEffect(() => { load().catch((error) => toast.error(error.message)).finally(() => setLoading(false)); }, [load]);
  async function update(campaign: Campaign, action: "activate" | "pause" | "close" | "capacity") {
    let maxClaims: number | undefined;
    if (action === "capacity") {
      const value = window.prompt("New campaign capacity", String(campaign.max_claims));
      if (!value) return;
      maxClaims = Number(value);
      if (!Number.isInteger(maxClaims) || maxClaims < campaign.claim_count) return toast.error(`Enter ${campaign.claim_count} or more.`);
    }
    setBusy(campaign.slug);
    try {
      const response = await fetch("/api/admin/campaigns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: campaign.slug, action, max_claims: maxClaims }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Campaign update failed.");
      await load();
      toast.success(`${campaign.name} updated.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Campaign update failed."); }
    finally { setBusy(null); }
  }
  return <section className="panel mt-5 rounded-3xl p-5">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/25 bg-gold/8"><Megaphone className="h-4 w-4 text-gold" /></span><div><div className="label-hw text-gold">Growth</div><h2 className="mt-1 text-xl font-semibold">Launch campaigns</h2></div></div>
    {loading ? <p className="mt-5 text-sm text-muted-foreground">Loading campaign inventory...</p> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{campaigns.map((campaign) => {
      const percent = Math.min(100, Math.round((campaign.claim_count / campaign.max_claims) * 100));
      return <article key={campaign.slug} className="rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{campaign.name}</h3><p className="mt-1 text-xs text-muted-foreground">{campaign.description}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase ${campaign.is_active ? "border-emerald-400/25 text-emerald-300" : "border-white/10 text-muted-foreground"}`}>{campaign.is_active ? "Active" : "Paused"}</span></div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gold" style={{ width: `${percent}%` }} /></div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{campaign.claim_count.toLocaleString()} / {campaign.max_claims.toLocaleString()} claimed</span><span>{campaign.remaining_slots.toLocaleString()} remaining</span></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label="Today" value={campaign.claims_today} /><Metric label="Active" value={campaign.active_memberships} /><Metric label="Expired" value={campaign.expired_memberships} /></div>
        <div className="mt-4 grid grid-cols-3 gap-2"><button disabled={busy === campaign.slug} onClick={() => update(campaign, campaign.is_active ? "pause" : "activate")} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-gold/25 text-[10px] font-semibold text-gold disabled:opacity-40">{campaign.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{campaign.is_active ? "Pause" : "Activate"}</button><button disabled={busy === campaign.slug} onClick={() => update(campaign, "capacity")} className="min-h-10 rounded-xl border border-white/10 text-[10px] font-semibold disabled:opacity-40">Capacity</button><button disabled={busy === campaign.slug} onClick={() => window.confirm(`Close ${campaign.name}? Existing access stays valid.`) && update(campaign, "close")} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-rec/20 text-[10px] font-semibold text-rec disabled:opacity-40"><XCircle className="h-3 w-3" />Close</button></div>
      </article>;
    })}</div>}
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/10 bg-white/[0.025] px-2 py-2"><div className="font-semibold text-gold">{value}</div><div className="mt-1 text-[8px] uppercase text-muted-foreground">{label}</div></div>; }
