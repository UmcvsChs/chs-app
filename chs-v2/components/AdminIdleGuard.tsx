"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const IDLE_MS = 120 * 60 * 1000; // 120 minutes without activity
const BEAT_MS = 60 * 1000;       // tell the database at most once a minute

// Staff admins (not the super admin) are logged out after 120 minutes with no
// activity. The database enforces the same limit independently: admin power
// stops at 120 minutes since the last heartbeat even if this screen is closed.
export default function AdminIdleGuard() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const last = useRef(0);
  const beat = useRef(0);
  const staffAdmin = !!session && profile?.role === "admin" && !profile?.is_super_admin;
  const onGate = path === "/admin-approval-pending" || path === "/login" || path === "/team-access";

  useEffect(() => {
    if (!staffAdmin || onGate) return;
    last.current = Date.now();
    async function expire() {
      await supabase.rpc("admin_end_session");
      await supabase.auth.signOut();
      router.push("/team-access");
    }
    function activity() {
      const t = Date.now();
      last.current = t;
      if (t - beat.current > BEAT_MS) {
        beat.current = t;
        supabase.rpc("admin_heartbeat").then(({ data }) => { if (data === false) expire(); });
      }
    }
    const events = ["click", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    const timer = setInterval(() => { if (Date.now() - last.current > IDLE_MS) expire(); }, 30 * 1000);
    return () => { events.forEach((e) => window.removeEventListener(e, activity)); clearInterval(timer); };
  }, [staffAdmin, onGate, router]);

  return null;
}
