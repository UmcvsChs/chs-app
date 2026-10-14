"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

// A group, corporate or large-party enquiry for a hotel, lodge or venue. It goes to the host and to CHS, who help
// agree a rate. No contact details are shared in the message.
export default function GroupEnquiryForm({ propertyId }: { propertyId: string }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [org, setOrg] = useState("");
  const [guests, setGuests] = useState(""); const [rooms, setRooms] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [purpose, setPurpose] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("submit_group_enquiry", {
      p_property: propertyId, p_name: name, p_org: org || null, p_guests: Number(guests), p_rooms: rooms ? Number(rooms) : null,
      p_in: from || null, p_out: to || null, p_purpose: purpose || null, p_message: message || null,
    });
    setBusy(false);
    if (error) setErr(error.message); else setDone(true);
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex justify-between items-center px-3 py-2.5 text-xs font-bold text-chs-charcoal">
        <span>👥 Group, corporate or large-party enquiry</span><span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {!session ? <p className="text-[11px] text-gray-500"><Link href="/login" className="underline text-chs-red font-semibold">Sign in</Link> to send an enquiry.</p> : done ? <p className="text-[11px] text-green-700">Sent. The host and CHS will come back to you here in the app.</p> : (
            <>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name or event name" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
              <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Company or organisation (optional)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
              <div className="grid grid-cols-2 gap-1.5">
                <input value={guests} onChange={(e) => setGuests(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Number of guests" className="border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <input value={rooms} onChange={(e) => setRooms(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Rooms (optional)" className="border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <label className="text-[10px] text-gray-500">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-xs" /></label>
                <label className="text-[10px] text-gray-500">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-xs" /></label>
              </div>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={80} placeholder="Purpose (retreat, conference, team stay…)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600} rows={3} placeholder="What do you need? (no phone numbers or emails; CHS passes your enquiry on)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
              {err && <p className="text-[11px] text-red-600">{err}</p>}
              <button disabled={busy || !name.trim() || !guests} onClick={send} className="px-4 py-1.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{busy ? "Sending…" : "Send enquiry"}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
