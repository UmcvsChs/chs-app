"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ShortletMessage {
  id: string;
  sender_role: "guest" | "host" | "admin";
  text: string;
  created_at: string;
}

// The real, missing feature confirmed by checking the code directly —
// no in-app communication existed for Shortlet/Hotel bookings at all.
// Built with genuine host anonymity toward the guest specifically —
// a guest only ever sees "Host", never a real name — while the host
// sees the guest's real name, and admin sees everything, matching
// exactly what was described: hosts can stay anonymous to guests,
// never to CHS itself.
export default function ShortletMessageThread({
  bookingId,
  viewerRole,
  guestName,
}: {
  bookingId: string;
  viewerRole: "guest" | "host" | "admin";
  guestName?: string;
}) {
  const [messages, setMessages] = useState<ShortletMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from("shortlet_messages")
      .select("id, sender_role, text, created_at")
      .eq("shortlet_booking_id", bookingId)
      .order("created_at", { ascending: true });
    setMessages((data as ShortletMessage[]) || []);
  }

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("send_shortlet_message", { p_booking_id: bookingId, p_text: text.trim() });
    setSending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setText("");
    loadMessages();
  }

  // The real anonymity rule — a guest never sees who the host really
  // is, no matter what; admin and the host himself always see the
  // real, correct label for every message.
  function labelFor(role: string) {
    if (role === "admin") return "CHS";
    if (viewerRole === "guest") return role === "guest" ? "You" : "Host";
    if (viewerRole === "host") return role === "host" ? "You" : (guestName || "Guest");
    return role === "guest" ? (guestName || "Guest") : "Host";
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 mt-2">
      <p className="text-xs font-bold text-chs-charcoal mb-2">💬 Messages</p>
      <div ref={containerRef} className="max-h-56 overflow-y-auto space-y-1.5 mb-2">
        {messages.length === 0 ? (
          <p className="text-[10px] text-gray-400">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`text-[11px] rounded-lg px-2 py-1.5 max-w-[85%] ${
              (viewerRole === m.sender_role) ? "bg-chs-amber-light ml-auto" : "bg-gray-100"
            }`}>
              <p className="text-[9px] font-bold text-gray-400 mb-0.5">{labelFor(m.sender_role)}</p>
              <p className="text-chs-charcoal">{m.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {error && <p className="text-[10px] text-chs-red mb-1">{error}</p>}
      <div className="flex gap-1.5">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
        <button onClick={handleSend} disabled={sending || !text.trim()}
          className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}
