"use client";

import { MembershipCard } from "@/components/MembershipCard";
import { AccountControls } from "@/components/studio/onboarding/AccountControls";
import { MobileProfileRow } from "@/components/studio/primitives/MobileProfileRow";
import { ProfileSignal } from "@/components/studio/primitives/ProfileSignal";
import type { ProfileRow } from "@/hooks/use-rapwriter-data";
import { accountTypeLabel, hasArtistWorkspace, hasProducerWorkspace } from "@/lib/account-role";
import type { MembershipSnapshot } from "@/lib/membership";
import type { BoothReadyResult, StudioPack } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { Camera, Crown, Headphones, LifeBuoy, LockKeyhole, Pencil, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ProfileScreen({
  completionPct,
  boothReady,
  activeStudioPack,
  membership,
  profile,
  lockerCounts,
  loading,
  signedIn,
  emailVerified,
  isAdmin,
  error,
  onAuthRequired,
  onExpandWorkspace,
  onProfileAvatar,
  onProfileIdentity,
  onSignOut,
  onOpenStudio,
  onOpenMarket,
}: {
  completionPct: number;
  boothReady: BoothReadyResult;
  activeStudioPack: StudioPack;
  membership: MembershipSnapshot | null;
  profile: ProfileRow | null;
  lockerCounts: { beats: number; songs: number; hooks: number; collection: number };
  loading: boolean;
  signedIn: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  error: string | null;
  onAuthRequired: () => void;
  onExpandWorkspace: () => Promise<void>;
  onProfileAvatar: (file: File | null) => Promise<ProfileRow | null>;
  onProfileIdentity: (artistName: string) => Promise<ProfileRow | null>;
  onSignOut: () => Promise<void>;
  onOpenStudio: () => void;
  onOpenMarket: () => void;
}) {
  const [workspaceUpgradeStatus, setWorkspaceUpgradeStatus] = useState<"idle" | "saving" | "error">("idle");
  const [workspaceUpgradeError, setWorkspaceUpgradeError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "saving" | "error">("idle");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const artistName = profile?.artist_name || profile?.display_name || profile?.email?.split("@")[0] || "RapWriter Artist";
  const [identityEditorOpen, setIdentityEditorOpen] = useState(false);
  const [artistNameDraft, setArtistNameDraft] = useState(artistName);
  const [identityStatus, setIdentityStatus] = useState<"idle" | "saving" | "error">("idle");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const joinedLabel = profile?.created_at
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(profile.created_at))
    : "Private beta";
  const boothLabel = boothReady.locked ? "Keep writing" : `${boothReady.score}/100`;
  const profileLabel = accountTypeLabel(profile?.account_type);
  const canAccessProducer = Boolean(membership?.producer) || hasProducerWorkspace(profile?.account_type);
  const canAccessArtist = Boolean(membership?.artist) || hasArtistWorkspace(profile?.account_type);
  const canExpandWorkspace = !canAccessProducer || !canAccessArtist;
  const membershipLabel = [membership?.artist?.plan.name, canAccessProducer ? "Producer HQ Free" : null].filter(Boolean).join(" + ");

  useEffect(() => {
    if (!identityEditorOpen) setArtistNameDraft(artistName);
  }, [artistName, identityEditorOpen]);

  const expandWorkspace = async () => {
    setWorkspaceUpgradeStatus("saving");
    setWorkspaceUpgradeError(null);
    try {
      await onExpandWorkspace();
      setWorkspaceUpgradeStatus("idle");
    } catch (upgradeError) {
      setWorkspaceUpgradeStatus("error");
      setWorkspaceUpgradeError(upgradeError instanceof Error ? upgradeError.message : "Workspace could not be added.");
    }
  };

  const changeAvatar = async (file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      setAvatarStatus("error");
      setAvatarError("Choose a photo smaller than 5 MB.");
      return;
    }
    setAvatarStatus("saving");
    setAvatarError(null);
    try {
      await onProfileAvatar(file);
      setAvatarStatus("idle");
    } catch (avatarUploadError) {
      setAvatarStatus("error");
      setAvatarError(avatarUploadError instanceof Error ? avatarUploadError.message : "Profile photo could not be updated.");
    }
  };

  const saveArtistIdentity = async () => {
    const nextName = artistNameDraft.trim();
    if (nextName.length < 2) {
      setIdentityStatus("error");
      setIdentityError("Enter an artist name with at least 2 characters.");
      return;
    }
    setIdentityStatus("saving");
    setIdentityError(null);
    try {
      await onProfileIdentity(nextName);
      setIdentityStatus("idle");
      setIdentityEditorOpen(false);
    } catch (identitySaveError) {
      setIdentityStatus("error");
      setIdentityError(identitySaveError instanceof Error ? identitySaveError.message : "Artist identity could not be updated.");
    }
  };

  if (!signedIn && !loading) {
    return (
      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-5">
        <div className="label-hw text-gold/85">Artist profile</div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-gold/20 bg-[#111113]">
          <div className="relative h-36">
            <img src={activeStudioPack.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: activeStudioPack.position }} draggable={false} />
            <div className="absolute inset-0" style={{ background: activeStudioPack.overlay }} />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="label-hw text-gold/85">Private studio</div>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">Claim your RapWriter room.</h1>
            </div>
          </div>
          <div className="p-5">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-gold/35 bg-black p-2 shadow-[0_0_26px_rgba(246,199,72,0.18)]">
            <img src="/brand/rapwriter-mark.webp" alt="" className="h-full w-full object-contain" draggable={false} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Save your rooms, songs, hooks, beats, rough takes, and Booth Ready progress across every device.
          </p>
          {error && <p className="mt-3 text-xs text-rec">{error}</p>}
          <button onClick={onAuthRequired} className="gold-seal mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold">
            Sign in with email
          </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-32 pt-5">
      <div className="label-hw text-gold/85">{profileLabel}</div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#111113] shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
        <div className="relative px-4 pb-4 pt-5">
          <img src={activeStudioPack.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" style={{ objectPosition: activeStudioPack.position }} draggable={false} />
          <div className="absolute inset-0" style={{ background: activeStudioPack.overlay }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(246,199,72,0.18),transparent_34%)]" />
          <div className="relative flex items-center gap-3">
            <div className="shrink-0 text-center">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  if (file) void changeAvatar(file);
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarStatus === "saving"}
                className="relative grid h-18 w-18 place-items-center overflow-hidden rounded-2xl border border-gold/35 bg-black p-2 shadow-[0_0_26px_rgba(246,199,72,0.18)] disabled:opacity-60"
                aria-label="Change profile photo"
                title="Change profile photo"
              >
                <img
                  src={profile?.avatar_url || "/brand/rapwriter-mark.webp"}
                  alt=""
                  className={cn("h-full w-full", profile?.avatar_url ? "rounded-xl object-cover" : "object-contain")}
                  draggable={false}
                />
                <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-lg border border-gold/35 bg-black/85 text-gold shadow-lg">
                  {avatarStatus === "saving" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </span>
              </button>
              {profile?.avatar_url && (
                <button type="button" onClick={() => void changeAvatar(null)} disabled={avatarStatus === "saving"} className="mt-1 text-[9px] font-semibold text-white/45 hover:text-gold disabled:opacity-50">
                  Use crown
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-xl font-semibold">{loading ? "Loading artist..." : artistName}</div>
                <ShieldCheck className="h-4 w-4 shrink-0 text-gold" />
                <button
                  type="button"
                  onClick={() => {
                    setArtistNameDraft(artistName);
                    setIdentityError(null);
                    setIdentityEditorOpen(true);
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-white/55 transition-colors hover:border-gold/30 hover:text-gold"
                  aria-label="Edit artist name"
                  title="Edit artist name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Member since {joinedLabel}</div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-gold">
                <Crown className="h-3 w-3" />
                {emailVerified ? "Verified account" : "Email confirmation pending"}
              </div>
              {membershipLabel && (
                <div className="mt-2 truncate text-[10px] font-semibold text-white/55">{membershipLabel}</div>
              )}
            </div>
          </div>
          {avatarError && <p className="relative mt-2 text-xs text-rec">{avatarError}</p>}

          <div className="relative mt-5 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-black/35 p-3">
            <div>
              <div className="label-hw text-gold/80">Tonight&apos;s session</div>
              <div className="mt-1 text-sm font-semibold">{activeStudioPack.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{activeStudioPack.bestFor.join(" / ")}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gold">{completionPct}%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Complete</div>
            </div>
            <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-gold shadow-[0_0_18px_rgba(246,199,72,0.6)]" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 border-t border-white/10 p-4 text-center">
          {[
            [String(lockerCounts.songs), "Songs"],
            [String(lockerCounts.hooks), "Hooks"],
            [String(lockerCounts.beats), "Beats"],
            [String(lockerCounts.collection), "Vault"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-black/24 p-3">
              <div className="text-lg font-semibold text-gold">{value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <ProfileSignal title="Booth Ready" value={boothLabel} detail={boothReady.locked ? boothReady.lockedReason : boothReady.nextAction} />
      </div>

      <div id="profile-membership" className="scroll-mt-4 pt-4">
        <MembershipCard
          initialMembership={membership}
          onOpenStudio={onOpenStudio}
          onOpenMarket={onOpenMarket}
        />
      </div>

      <div className="mt-4 space-y-2">
        {canExpandWorkspace && (
          <MobileProfileRow
            icon={canAccessArtist ? Headphones : Pencil}
            title={canAccessArtist ? "Add Producer workspace" : "Add Artist workspace"}
            value={canAccessArtist ? "Upload beats and build a storefront" : "Write songs and enter Writer Flow"}
            onClick={() => void expandWorkspace()}
            disabled={workspaceUpgradeStatus === "saving"}
          />
        )}
        {canAccessProducer && <MobileProfileRow icon={Headphones} title="Producer HQ" value="Catalog, storefront, and business" href="/producer" />}
        <MobileProfileRow icon={LifeBuoy} title="Support" value="Get help and track support tickets" href="/support" />
        {isAdmin && <MobileProfileRow icon={LockKeyhole} title="Control room" value="Staff tools and catalog review" href="/admin" muted />}
      </div>
      {workspaceUpgradeStatus === "saving" && <p className="mt-3 text-xs text-gold">Preparing your combined workspace...</p>}
      {workspaceUpgradeError && <p className="mt-3 text-xs text-rec">{workspaceUpgradeError}</p>}
      <AccountControls email={profile?.email ?? null} onSignOut={onSignOut} />
      <button onClick={() => void onSignOut()} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-muted-foreground">
        Sign out
      </button>

      {identityEditorOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:py-6">
          <section role="dialog" aria-modal="true" aria-labelledby="artist-identity-title" className="w-full max-w-[400px] rounded-3xl border border-gold/25 bg-[#111113] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label-hw text-gold">Artist identity</div>
                <h2 id="artist-identity-title" className="mt-2 text-xl font-semibold">How should artists know you?</h2>
              </div>
              <button type="button" onClick={() => setIdentityEditorOpen(false)} disabled={identityStatus === "saving"} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground disabled:opacity-40" aria-label="Close artist identity editor"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">This name appears in your artist workspace. Your Producer HQ brand stays separate.</p>
            <label className="mt-5 block">
              <span className="label-hw text-white/50">Artist name</span>
              <input value={artistNameDraft} onChange={(event) => setArtistNameDraft(event.target.value)} maxLength={80} disabled={identityStatus === "saving"} autoFocus className="mt-2 min-h-12 w-full rounded-xl border border-white/12 bg-black/40 px-4 text-sm font-semibold outline-none focus:border-gold/50 disabled:opacity-50" />
            </label>
            {identityError && <p className="mt-3 text-xs leading-5 text-rec">{identityError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIdentityEditorOpen(false)} disabled={identityStatus === "saving"} className="min-h-12 rounded-xl border border-white/10 text-sm font-semibold text-white/70 disabled:opacity-40">Cancel</button>
              <button type="button" onClick={() => void saveArtistIdentity()} disabled={identityStatus === "saving" || artistNameDraft.trim().length < 2} className="gold-seal min-h-12 rounded-xl px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35">{identityStatus === "saving" ? "Saving..." : "Save artist name"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
