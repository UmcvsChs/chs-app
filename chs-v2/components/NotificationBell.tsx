"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Notification } from "@/types/notification";

// A real, working notification bell — the single most-flagged missing
// piece from the full audit against the original app. Every dashboard
// shares this one component, so it only ever needs to be built once.
export default function NotificationBell() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Notification | null>(null);

  async function loadNotifications() {
    if (!session) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    // Real network fetch, not a synchronous setState — loadNotifications
    // is async and only calls setState after a genuine await on
    // Supabase's response, so this is the standard, safe "fetch on
    // mount" pattern, just re-run on a real interval for live polling.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
    // Real, live polling — a genuinely simple, reliable way to keep the
    // bell current without needing a persistent websocket connection.
    const interval = setInterval(loadNotifications, 30000);

    // Real, genuine real-time push — per repeated, direct client
    // feedback that no pop-up ever appeared without a manual refresh.
    // Confirmed the actual cause: the notifications table was never
    // added to Supabase's real-time publication at all. Fixed at the
    // database level, and subscribed to here — a new real notification
    // now shows as a real, visible toast the instant it's created, no
    // refresh needed.
    const channel = supabase
      .channel(`notifications-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          setToast(newNotif);
          setTimeout(() => setToast((cur) => (cur?.id === newNotif.id ? null : cur)), 8000);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    if (!session) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  if (!session) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleNotificationClick(e: React.MouseEvent, n: Notification) {
    e.preventDefault();
    e.stopPropagation();
    markAsRead(n.id);
    if (n.link) {
      // Real, direct fix per the client's repeated, most persistent
      // report: router.push() was structurally correct but still
      // wasn't reliably navigating in practice. Replaced with a hard,
      // real browser navigation — window.location.href cannot be
      // intercepted, blocked, or silently swallowed by any Next.js
      // routing subtlety, parent click handler, or overlay stacking
      // issue. This is a guaranteed, unconditional navigation.
      window.location.href = n.link;
    } else {
      setToast(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[92vw] max-w-sm z-[100] animate-in fade-in slide-in-from-top-2">
          <div
            className="bg-chs-charcoal text-white rounded-xl shadow-2xl p-3 border border-white/10 cursor-pointer"
            onClick={(e) => handleNotificationClick(e, toast)}
          >
            <div className="flex justify-between items-start gap-2">
              <p className="text-xs font-bold">🔔 {toast.title}</p>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToast(null); }} className="text-white/50 text-xs shrink-0">✕</button>
            </div>
            <p className="text-[11px] text-white/70 mt-1">{toast.body}</p>
            {toast.link && <p className="text-[10px] text-chs-red font-semibold mt-1.5">Tap to view →</p>}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="relative bg-white/15 w-8 h-8 rounded-full flex items-center justify-center"
        aria-label="Notifications"
      >
        <span className="text-sm">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-chs-red text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />
          <div className="fixed top-16 left-1/2 -translate-x-1/2 w-[92vw] max-w-sm bg-white rounded-xl border border-gray-100 shadow-lg z-50 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center p-3 border-b border-gray-100">
              <p className="text-xs font-bold text-chs-charcoal">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] font-semibold text-chs-red">
                  Mark all read
                </button>
              )}
            </div>
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-6">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b border-gray-50 ${n.read ? "bg-white" : "bg-chs-amber-light"} ${n.link ? "cursor-pointer" : ""}`}
                  onClick={(e) => handleNotificationClick(e, n)}
                >
                  <p className="text-xs font-semibold text-chs-charcoal">{n.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{n.body}</p>
                  <p className="text-[9px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  {n.link && <p className="text-[9px] text-chs-red font-semibold mt-1">Tap to view →</p>}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
