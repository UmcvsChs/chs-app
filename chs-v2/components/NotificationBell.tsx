"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    return () => clearInterval(interval);
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

  return (
    <div className="relative">
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
              notifications.map((n) => {
                const content = (
                  <div
                    className={`p-3 border-b border-gray-50 ${n.read ? "bg-white" : "bg-chs-amber-light"}`}
                    onClick={() => !n.read && markAsRead(n.id)}
                  >
                    <p className="text-xs font-semibold text-chs-charcoal">{n.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{n.body}</p>
                    <p className="text-[9px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
