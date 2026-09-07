"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";

// Real, new page per direct client request: every real, CHS-mediated
// conversation an owner has ever had with a buyer or tenant, in one
// place — pulling from both real message systems (offer negotiations
// and tenancy messages) rather than only being visible one
// conversation at a time, buried inside each individual offer or
// tenancy screen.
interface Message {
  id: string;
  text: string;
  status: string;
  created_at: string;
  sender_id: string;
  conversation_type: "offer" | "tenancy";
  property_title: string;
  reference_id: string;
  sender_name: string;
}

export default function OwnerMessageHistoryPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"all" | "offer" | "tenancy">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    supabase.rpc("get_owner_message_history").then(({ data }) => {
      setMessages((data as unknown as Message[]) || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  const filtered = filter === "all" ? messages : messages.filter((m) => m.conversation_type === filter);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-owner pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/owner" className="text-xs text-white/70">← Back to Owner Dashboard</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">Message History</h1>
          <NotificationBell />
        </div>
        <p className="text-xs text-white/60 mt-1">Every real, CHS-mediated conversation with a buyer or tenant.</p>
        <div className="flex gap-1.5 mt-2">
          {(["all", "offer", "tenancy"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[10px] font-semibold px-3 py-1.5 rounded-full ${filter === f ? "bg-white text-chs-charcoal" : "bg-white/15 text-white"}`}>
              {f === "all" ? "All" : f === "offer" ? "Buyers" : "Tenants"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No real messages yet.</p>
        ) : (
          filtered.map((m) => (
            <Link
              key={m.id}
              href={m.conversation_type === "offer" ? `/property/${m.reference_id}` : "/owner"}
              className="block bg-white rounded-xl border border-gray-200 p-3"
            >
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-chs-charcoal">{m.property_title}</p>
                <span className="text-[9px] text-gray-400 whitespace-nowrap ml-2">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {m.conversation_type === "offer" ? "🏡 Buyer" : "🏠 Tenant"}: {m.sender_name}
              </p>
              <p className="text-xs text-gray-600 mt-1">{m.text}</p>
              {m.status === "pending_review" && <p className="text-[9px] text-chs-amber-dark font-semibold mt-1">⏳ Awaiting CHS review</p>}
              {m.status === "blocked" && <p className="text-[9px] text-chs-red font-semibold mt-1">🚫 Blocked by CHS</p>}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
