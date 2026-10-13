"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";

// The guest's side of the host's Services and Changes tabs. Whatever the host answers (we supply it, you arrange
// it, we cannot provide it) appears here at once, and the guest can ask for another service or for a change in
// the number of guests, which the host then approves or declines.

interface Line { id: string; service: string; label: string; quantity: number | null; status: string; provider_name: string | null; price: number | null; note: string | null; fee?: number | null; paid_at?: string | null; payment_ref?: string | null }
interface Chg {
  id: string; old_guests: number | null; new_guests: number | null; new_check_in: string | null; new_check_out: string | null; services: { service: string; quantity?: number }[];
  note: string | null; status: string; host_note: string | null; created_at: string; decided_at: string | null; extra_base: number; to_pay: number; topup_expires_at: string | null;
}

const STATUS: Record<string, { text: string; cls: string }> = {
  requested: { text: "Waiting for the venue", cls: "bg-amber-100 text-amber-800" },
  arranging: { text: "The venue is arranging this", cls: "bg-purple-100 text-purple-800" },
  supplied: { text: "✓ The venue will supply this", cls: "bg-green-100 text-green-800" },
  guest_arranges: { text: "You arrange this yourself", cls: "bg-blue-100 text-blue-800" },
  declined: { text: "Not available", cls: "bg-red-100 text-red-700" },
  cancelled: { text: "Withdrawn", cls: "bg-gray-100 text-gray-500" },
};
const CHG: Record<string, string> = { pending: "Waiting for the venue", approved: "Approved", declined: "Not approved", withdrawn: "Withdrawn", awaiting_topup: "Approved: pay the extra", lapsed: "Lapsed (not paid in time)" };
const OPTIONS: [string, string][] = [["ushers", "Ushers"], ["caterer", "Caterer"], ["band", "Live band / entertainment"], ["security", "Security"], ["decoration", "Decoration"], ["mc", "MC"], ["photographer", "Photographer"], ["dj", "DJ / sound"], ["parking", "Parking attendants"], ["other", "Something else"]];

export default function GuestBookingExtras({ bookingId, status, checkIn, startOpen = false }: { bookingId: string; status: string; checkIn: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [lines, setLines] = useState<Line[]>([]);
  const [changes, setChanges] = useState<Chg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [svc, setSvc] = useState("caterer"); const [qty, setQty] = useState(""); const [svcNote, setSvcNote] = useState("");
  const [newGuests, setNewGuests] = useState(""); const [chgNote, setChgNote] = useState(""); const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [today] = useState(() => new Date(Date.now() + 3600000).toISOString().slice(0, 10));

  const live = ["pending_host_review", "awaiting_payment", "confirmed"].includes(status);
  const canChange = ["awaiting_payment", "confirmed"].includes(status) && checkIn >= today;

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.rpc("get_my_booking_services", { p_booking: bookingId }),
      supabase.rpc("get_my_booking_changes", { p_booking: bookingId }),
    ]);
    setLines(((a.data as Line[]) || []).filter((l) => l.status !== "cancelled"));
    setChanges((b.data as Chg[]) || []);
    setLoaded(true);
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!live && lines.length === 0) return null;
  const waiting = lines.filter((l) => l.status === "requested").length;
  const answered = lines.length - waiting;

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string, after?: () => void) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await p;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok); after?.(); load();
  }

  return (
    <div id={`extras-${bookingId}`} className="mt-3 border border-gray-200 rounded-xl">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex justify-between items-center px-3 py-2 text-xs font-bold text-chs-charcoal">
        <span>🎉 Services &amp; changes{loaded && lines.length > 0 ? ` · ${answered} answered${waiting ? `, ${waiting} waiting` : ""}` : ""}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {msg && <p className="text-[11px] text-green-700">{msg}</p>}
          {err && !/insufficient_balance/.test(err) && <p className="text-[11px] text-red-600">{err}</p>}

          <div>
            <p className="text-[11px] font-bold text-chs-charcoal mb-1">What you asked for</p>
            {lines.length === 0 && <p className="text-[11px] text-gray-400">Nothing yet. You can ask for ushers, a caterer, a live band, security and more below.</p>}
            {lines.map((l) => {
              const st = STATUS[l.status] || STATUS.requested;
              return (
                <div key={l.id} className="border border-gray-200 rounded-lg p-2 mb-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-semibold text-chs-charcoal">{l.label}{l.quantity ? ` × ${l.quantity}` : ""}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
                  </div>
                  {l.status !== "requested" && (l.provider_name || l.price != null || l.note) && (
                    <p className="text-[10px] text-gray-600 mt-0.5">{l.provider_name ? `By ${l.provider_name}. ` : ""}{l.price != null ? `Price ${formatNaira(l.price)}${l.fee ? ` + ${formatNaira(l.fee)} CHS fee` : ""}${l.paid_at ? ` ✓ paid, held by CHS until your event (receipt ${l.payment_ref}). ` : ". "}` : ""}{l.note ? `“${l.note}”` : ""}</p>
                  )}
                  {live && l.status === "supplied" && l.price != null && l.price > 0 && !l.paid_at && ["awaiting_payment", "confirmed"].includes(status) && (
                    <button disabled={busy} onClick={() => run(supabase.rpc("pay_service_line", { p_line: l.id }), "Paid. CHS holds it safely until your event.")} className="mt-1 px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Pay {formatNaira(l.price + (l.fee || 0))} from my wallet</button>
                  )}
                  {err && /insufficient_balance/.test(err) && l.status === "supplied" && !l.paid_at && <p className="text-[10px] text-red-600 mt-1">Your wallet balance is too low. <a href="/wallet" className="underline font-semibold">Fund your wallet</a>, then pay.</p>}
                  {l.status === "requested" && l.note && <p className="text-[10px] italic text-gray-500 mt-0.5">“{l.note}”</p>}
                  {live && l.status === "requested" && (
                    <button disabled={busy} onClick={() => run(supabase.rpc("guest_cancel_service", { p_booking: bookingId, p_service: l.service }), "Withdrawn.")} className="text-[10px] underline text-gray-500 mt-1">Withdraw this request</button>
                  )}
                </div>
              );
            })}
          </div>

          {live && (
            <div className="bg-gray-50 rounded-lg p-2 space-y-1.5">
              <p className="text-[11px] font-bold text-chs-charcoal">Ask for another service</p>
              <div className="flex gap-1">
                <select value={svc} onChange={(e) => setSvc(e.target.value)} className="flex-1 border border-gray-300 rounded px-1 py-1 text-[11px] bg-white">
                  {OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="How many" className="w-20 border border-gray-300 rounded px-2 py-1 text-[11px]" />
              </div>
              <input value={svcNote} onChange={(e) => setSvcNote(e.target.value)} maxLength={300} placeholder="Details (no phone numbers or emails)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
              <button disabled={busy} onClick={() => run(supabase.rpc("guest_add_service", { p_booking: bookingId, p_service: svc, p_quantity: qty ? Number(qty) : null, p_note: svcNote.trim() || null }), "Sent to the venue. You will be told their answer.", () => { setQty(""); setSvcNote(""); })}
                className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Send to the venue</button>
            </div>
          )}

          {canChange && (
            <div className="bg-gray-50 rounded-lg p-2 space-y-1.5">
              <p className="text-[11px] font-bold text-chs-charcoal">Ask to change your booking</p>
              <p className="text-[10px] text-gray-500">Move to another date (same length of stay) or change the number of guests. The venue approves or declines. A bigger crowd may need a bigger hall: if it costs more, you pay the difference through your CHS wallet and the change takes effect once you have paid.</p>
              <label className="block text-[10px] text-gray-500">New date (leave empty to keep yours)</label>
              <input type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
              <input value={newGuests} onChange={(e) => setNewGuests(e.target.value.replace(/\D/g, ""))} placeholder="New number of guests" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
              <input value={chgNote} onChange={(e) => setChgNote(e.target.value)} maxLength={300} placeholder="Anything else you want changed" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
              <button disabled={busy || (!newGuests && !newDate && !chgNote.trim())} onClick={() => run(supabase.rpc("request_booking_change", { p_booking: bookingId, p_new_guests: newGuests ? Number(newGuests) : null, p_services: [], p_note: chgNote.trim() || null, p_new_check_in: newDate || null }), "Sent to the venue.", () => { setNewGuests(""); setChgNote(""); setNewDate(""); })}
                className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">Send change request</button>
            </div>
          )}

          {changes.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-chs-charcoal mb-1">Your change requests</p>
              {changes.map((c) => (
                <div key={c.id} className="border border-gray-200 rounded-lg p-2 mb-1.5">
                  <div className="flex justify-between gap-2">
                    <p className="text-xs text-chs-charcoal">{[c.new_check_in ? `Move to ${c.new_check_in}` : null, c.new_guests != null ? `Guests ${c.old_guests ?? "?"} → ${c.new_guests}` : null].filter(Boolean).join(" · ") || "Change"}{c.note ? ` · “${c.note}”` : ""}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${c.status === "approved" ? "bg-green-100 text-green-800" : c.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{CHG[c.status] || c.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">{formatDateTime(c.created_at)}</p>
                  {c.host_note && <p className="text-[10px] text-gray-600 mt-0.5">Venue: “{c.host_note}”</p>}
                  {c.status === "awaiting_topup" && (
                    <div className="mt-1.5 bg-blue-50 rounded-lg p-2">
                      <p className="text-[11px] text-blue-900">The venue approved this. It costs <b>{formatNaira(c.to_pay)}</b> more (including CHS&apos;s fee){c.topup_expires_at ? `. Pay by ${formatDateTime(c.topup_expires_at)}` : ""}, or your booking stays as it was.</p>
                      <div className="flex gap-2 mt-1.5">
                        <button disabled={busy} onClick={() => run(supabase.rpc("pay_booking_topup", { p_request: c.id }), "Paid. Your change is confirmed.")} className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">Pay {formatNaira(c.to_pay)} from my wallet</button>
                        <button disabled={busy} onClick={() => run(supabase.rpc("withdraw_booking_change", { p_request: c.id }), "Change cancelled. Your booking is as it was.")} className="text-[10px] underline text-gray-500">No thanks</button>
                      </div>
                      {err && /insufficient_balance/.test(err) && <p className="text-[10px] text-red-600 mt-1">Your wallet balance is too low. <a href="/wallet" className="underline font-semibold">Fund your wallet</a>, then try again.</p>}
                    </div>
                  )}
                  {c.status === "pending" && <button disabled={busy} onClick={() => run(supabase.rpc("withdraw_booking_change", { p_request: c.id }), "Withdrawn.")} className="text-[10px] underline text-gray-500 mt-1">Withdraw</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
