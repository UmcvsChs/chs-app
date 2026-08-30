"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PrecommitMessage {
  id: string;
  sender_id: string;
  sender_role: "buyer" | "seller";
  text: string;
  status: "pending_review" | "approved" | "blocked";
  block_reason: string | null;
  created_at: string;
}

// Real trust-and-safety requirement per direct client instruction:
// every real negotiation message between a seller and an intending
// buyer must be reviewed by CHS before delivery — a genuine deterrent
// against taking a deal off-platform. A message containing a real
// phone number or email is blocked outright and never reaches the
// other party. Built on the real, existing precommit_messages system
// already proven and wired into the admin dashboard — not a separate
// mechanism (a genuine duplicate was built and removed before this).
export default function OfferMessageThread({ offerId, viewerRole, viewerId }: { offerId: string; viewerRole: "buyer" | "seller"; viewerId: string }) {
  const [messages, setMessages] = useState<PrecommitMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  async function loadMessages() {
    // RLS itself already hides another party's pending/blocked
    // messages from view — this fetch is safe by construction.
    const { data } = await supabase
      .from("precommit_messages")
      .select("id, sender_id, sender_role, text, status, block_reason, created_at")
      .eq("offer_id", offerId)
      .order("created_at", { ascending: true });
    setMessages((data as PrecommitMessage[]) || []);
  }

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setSendError(null);
    const { data: newId, error } = await supabase.rpc("send_precommit_message", { p_offer_id: offerId, p_text: text.trim() });
    setSending(false);
    if (error) {
      setSendError(error.message);
      return;
    }
    // Real check of the actual outcome — the function never raises
    // for a blocked message, it records it and returns normally, so
    // the real status has to be read back to know what happened.
    if (newId) {
      const { data: sentMessage } = await supabase.from("precommit_messages").select("status, block_reason").eq("id", newId).single();
      if (sentMessage?.status === "blocked") {
        setSendError(sentMessage.block_reason);
      }
    }
    setText("");
    loadMessages();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 mt-2">
      <p className="text-xs font-bold text-chs-charcoal mb-1">💬 Negotiation messages</p>
      <p className="text-[9px] text-gray-400 mb-2">Reviewed by CHS before delivery until payment is complete — never share a phone number or email here.</p>
      <div ref={containerRef} className="max-h-56 overflow-y-auto space-y-1.5 mb-2">
        {messages.length === 0 ? (
          <p className="text-[10px] text-gray-400">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === viewerId;
            return (
              <div key={m.id} className={`text-[11px] rounded-lg px-2 py-1.5 max-w-[85%] ${
                m.sender_role === viewerRole ? "bg-chs-amber-light ml-auto" : "bg-gray-100"
              }`}>
                <p className="text-[9px] font-bold text-gray-400 mb-0.5">{m.sender_role === viewerRole ? "You" : viewerRole === "buyer" ? "Seller" : "Buyer"}</p>
                <p className="text-chs-charcoal">{m.text}</p>
                {isMine && m.status === "pending_review" && (
                  <p className="text-[9px] text-chs-amber-dark mt-1">⏳ Awaiting CHS review</p>
                )}
                {isMine && m.status === "blocked" && (
                  <p className="text-[9px] text-chs-red mt-1">✕ Not delivered — {m.block_reason}</p>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {sendError && <p className="text-[10px] text-chs-red mb-1.5">{sendError}</p>}
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
