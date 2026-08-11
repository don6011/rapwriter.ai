"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight, Inbox, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_REFRESH_EVENT } from "@/lib/client/activity-events";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

export function ActivityInbox({
  signedIn,
  onAuthRequired,
}: {
  signedIn: boolean;
  onAuthRequired: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!signedIn) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Activity could not be loaded.");
      setItems(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
      setError(data.foundation_ready === false ? "Activity inbox setup is pending." : null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Activity could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load(true);
    if (!signedIn) return;
    let active = true;
    let disposeRealtime = () => undefined;
    const refresh = () => void load(true);
    const refreshWhenVisible = () => document.visibilityState === "visible" && refresh();
    const timer = window.setInterval(refresh, 45_000);

    window.addEventListener(ACTIVITY_REFRESH_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    try {
      const supabase = createClient();
      void supabase.auth.getUser().then(({ data }) => {
        if (!active || !data.user) return;
        const channel = supabase
          .channel(`activity-inbox:${data.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "user_notifications",
              filter: `owner_id=eq.${data.user.id}`,
            },
            (payload) => {
              if (!active) return;
              const incoming = payload.new as Partial<NotificationRow>;
              refresh();
              if (!open && incoming.title) {
                toast(incoming.title, {
                  description: incoming.body || undefined,
                  action: incoming.action_url
                    ? { label: "Open", onClick: () => window.location.assign(incoming.action_url as string) }
                    : undefined,
                });
              }
            },
          )
          .subscribe();
        disposeRealtime = () => { void supabase.removeChannel(channel); };
      });
    } catch {
      // Polling remains active when Realtime is unavailable.
    }

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(ACTIVITY_REFRESH_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      disposeRealtime();
    };
  }, [load, open, signedIn]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  function openInbox() {
    if (!signedIn) {
      onAuthRequired();
      return;
    }
    setOpen(true);
    void load();
  }

  async function markRead(notificationId?: string) {
    const body = notificationId ? { notification_id: notificationId } : { mark_all: true };
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Activity could not be updated.");
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => !notificationId || item.id === notificationId ? { ...item, read_at: readAt } : item));
      setUnreadCount((current) => notificationId ? Math.max(0, current - 1) : 0);
      if (!notificationId) toast.success("Activity marked as read.");
      return true;
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "Activity could not be updated.");
      return false;
    }
  }

  async function follow(item: NotificationRow) {
    if (!item.read_at) await markRead(item.id);
    if (item.action_url) window.location.assign(item.action_url);
  }

  return (
    <>
      <button
        type="button"
        onClick={openInbox}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/30 text-white/72 transition-colors hover:border-gold/30 hover:text-gold"
        aria-label={unreadCount ? `Open activity, ${unreadCount} unread` : "Open activity"}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-bold leading-none text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/74 backdrop-blur-sm" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-inbox-title"
            className="flex max-h-[88svh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#111113] shadow-[0_-24px_80px_rgba(0,0,0,0.7)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start gap-3 border-b border-white/10 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/8 text-gold"><Inbox className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="label-hw text-gold">Activity</div>
                <h2 id="activity-inbox-title" className="mt-1 text-xl font-semibold">Your studio inbox</h2>
              </div>
              {unreadCount > 0 && (
                <button type="button" onClick={() => void markRead()} className="min-h-10 rounded-xl px-2 text-[10px] font-semibold text-gold">
                  <CheckCheck className="mr-1 inline h-4 w-4" />Read all
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10" aria-label="Close activity"><X className="h-4 w-4" /></button>
            </header>

            <div className="overflow-y-auto overscroll-contain">
              {loading && !items.length ? (
                <div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
              ) : error && !items.length ? (
                <div className="p-6 text-center"><p className="text-sm text-muted-foreground">{error}</p><button type="button" onClick={() => void load()} className="mt-4 min-h-10 rounded-xl border border-gold/25 px-4 text-xs font-semibold text-gold">Try again</button></div>
              ) : items.length ? (
                <div className="divide-y divide-white/8">
                  {items.map((item) => (
                    <button key={item.id} type="button" onClick={() => void follow(item)} className="flex min-h-[82px] w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", item.read_at ? "bg-white/14" : "bg-gold shadow-[0_0_12px_rgba(246,199,72,0.55)]")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", item.read_at ? "font-medium text-white/72" : "font-semibold text-white")}>{item.title}</span>
                        {item.body && <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{item.body}</span>}
                        <span className="mt-2 block text-[9px] uppercase text-gold/70">{relativeTime(item.created_at)}</span>
                      </span>
                      {item.action_url && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-white/28" />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-60 place-items-center p-8 text-center">
                  <div><Inbox className="mx-auto h-7 w-7 text-gold/65" /><h3 className="mt-4 text-base font-semibold">The room is quiet.</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Membership, collaboration, review, and account updates will arrive here.</p></div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}
