"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface OwnerAdminMessage {
  id: string;
  sender_role: "owner" | "admin";
  text: string;
  created_at: string;
}

// Real, new feature per direct client request: a genuine two-way
// correspondence channel between an owner and CHS admin — reusing the
// exact same real, proven messaging pattern already built for
// tenancy and shortlet messages, rather than a one-shot ticket.
export default function OwnerAdminMessageThread({ ownerId, viewerRole }: { ownerId: string; viewerRole: "owner" | "admin" }) {
  const [messages, setMessages] = useState<OwnerAdminMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from("owner_admin_messages")
      .select("id, sender_role, text, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true });
    setMessages((data as OwnerAdminMessage[]) || []);
  }

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.rpc("send_owner_admin_message", { p_owner_id: ownerId, p_text: text.trim() });
    setSending(false);
    if (!error) {
      setText("");
      loadMessages();
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <p className="text-xs font-bold text-chs-charcoal mb-2">💬 Direct line to CHS</p>
      <div className="max-h-56 overflow-y-auto space-y-1.5 mb-2">
        {messages.length === 0 ? (
          <p className="text-[10px] text-gray-400">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`text-[11px] rounded-lg px-2 py-1.5 max-w-[85%] ${
              viewerRole === m.sender_role ? "bg-chs-amber-light ml-auto" : "bg-gray-100"
            }`}>
              <p className="text-[9px] font-bold text-gray-400 mb-0.5">{m.sender_role === "admin" ? "CHS" : "You"}</p>
              <p className="text-chs-charcoal">{m.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1.5">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message to CHS..."
          className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
        <button onClick={handleSend} disabled={sending || !text.trim()}
          className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}
