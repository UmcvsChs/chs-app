"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";

// A short private conversation about one service between the venue and CHS. The guest never sees it.
interface Msg { id: string; side: "host" | "admin" | "system"; body: string; created_at: string }

export default function ServiceThread({ lineId, me, onSent }: { lineId: string; me: "host" | "admin"; onSent?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_service_thread", { p_line: lineId });
    if (error) { setErr(error.message); return; }
    setMsgs((data as Msg[]) || []);
  }, [lineId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("send_service_message", { p_line: lineId, p_body: text.trim() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setText(""); load(); onSent?.();
  }

  return (
    <div className="mt-1.5 border border-gray-200 rounded-lg bg-white p-2 space-y-1">
      <p className="text-[10px] font-bold text-gray-500">Conversation with {me === "host" ? "CHS" : "the venue"} (the guest does not see this)</p>
      {msgs === null && <p className="text-[10px] text-gray-400">Loading…</p>}
      {msgs?.length === 0 && <p className="text-[10px] text-gray-400">No messages yet.</p>}
      {msgs?.map((m) => {
        const mine = m.side === me;
        return (
          <div key={m.id} className={`text-[11px] rounded-lg px-2 py-1 ${m.side === "system" ? "bg-gray-50 text-gray-500 italic" : mine ? "bg-blue-50 text-blue-900 ml-6" : "bg-amber-50 text-amber-900 mr-6"}`}>
            <span className="block text-[9px] opacity-60">{m.side === "system" ? "Note" : m.side === "host" ? "Venue" : "CHS"} · {formatDateTime(m.created_at)}</span>
            <span className="whitespace-pre-wrap">{m.body}</span>
          </div>
        );
      })}
      <div className="flex gap-1">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write a message" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
        <button disabled={busy || !text.trim()} onClick={send} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Send</button>
      </div>
      {err && <p className="text-[10px] text-red-600">{err}</p>}
    </div>
  );
}
