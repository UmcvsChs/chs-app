"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

// The real fix for the exact broken scenario described: admin could
// already send a "we need more specification" note, but there was
// genuinely nowhere for the client to reply short of starting an
// entirely new request. This is a real, dedicated two-way thread —
// separate from the general notification bell — with a real unread
// badge and real voice-to-text input, using the browser's own
// built-in speech recognition, the same proven pattern already used
// in the Concierge feature.

interface EngageMessage {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

type SpeechRecognitionResultLike = { transcript: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

export default function EngageChatThread({
  requestId,
  session,
  isAdmin,
  reference,
}: {
  requestId: string;
  session: Session;
  isAdmin: boolean;
  reference: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<EngageMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const voiceSupported = typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    checkUnread();
    const interval = setInterval(checkUnread, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    if (open) {
      loadMessages();
      markRead();
      const interval = setInterval(loadMessages, 8000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  async function checkUnread() {
    const { data: req } = await supabase
      .from("engage_chs_requests")
      .select("client_last_read_at, admin_last_read_at")
      .eq("id", requestId)
      .maybeSingle();
    if (!req) return;
    const lastRead = isAdmin ? req.admin_last_read_at : req.client_last_read_at;
    const { count } = await supabase
      .from("engage_chs_messages")
      .select("id", { count: "exact", head: true })
      .eq("request_id", requestId)
      .neq("sender_id", session.user.id)
      .gt("created_at", lastRead);
    setUnreadCount(count || 0);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("engage_chs_messages")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  async function markRead() {
    await supabase.rpc("mark_engage_chs_thread_read", { p_request_id: requestId, p_as_admin: isAdmin });
    setUnreadCount(0);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.rpc("send_engage_chs_message", { p_request_id: requestId, p_text: text.trim() });
    setSending(false);
    if (!error) {
      setText("");
      await loadMessages();
    }
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-NG";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: { results: SpeechRecognitionResultLike[][] }) => {
      const transcript = event.results[0][0].transcript;
      setText((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="relative w-full mt-2 py-2 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold flex items-center justify-center gap-1.5"
      >
        💬 Conversation for {reference}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-chs-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="mt-2 bg-white rounded-xl border border-gray-100 flex flex-col h-80">
      <div className="flex justify-between items-center p-2.5 border-b border-gray-100">
        <p className="text-[11px] font-bold text-chs-charcoal">💬 {reference}</p>
        <button onClick={() => setOpen(false)} className="text-gray-400 text-base">✕</button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-2.5">
        {messages.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-6">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === session.user.id;
            return (
              <div key={m.id} className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-2.5 py-1.5 rounded-2xl text-[11px] ${isMine ? "bg-chs-red text-white" : "bg-gray-100 text-chs-charcoal"}`}>
                  {m.text}
                  <p className="text-[9px] opacity-70 mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-1.5 p-2.5 border-t border-gray-100">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isRecording ? "Listening..." : "Type or use the mic..."}
          className="flex-1 px-2.5 py-1.5 rounded-full border border-gray-200 text-[11px]"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={isRecording ? stopVoice : startVoice}
            className={`px-2.5 py-1.5 rounded-full text-[11px] ${isRecording ? "bg-chs-red text-white animate-pulse" : "bg-gray-100 text-gray-600"}`}
          >
            🎤
          </button>
        )}
        <button type="submit" disabled={sending || !text.trim()}
          className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
