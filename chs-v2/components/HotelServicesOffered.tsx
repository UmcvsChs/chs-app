"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { SERVICE_CATEGORIES, catInfo } from "@/components/ServiceCategories";

// Host / manager screen: the list of in-house services this hotel or lodge offers, and the reservations
// guests have made for them. No money moves here: guests pay the hotel directly.

interface Svc { id: string; category: string; name: string; description: string | null; price_from: number | null; price_note: string | null; capacity: string | null; hours: string | null; bookable: boolean; active: boolean }
interface Req { id: string; status: string; quantity: number; preferred_date: string | null; preferred_time: string | null; note: string | null; host_note: string | null; created_at: string; service: string; check_in: string; check_out: string; guest: string | null; room: string | null }

export default function HotelServicesOffered({ propertyId, role = "owner" }: { propertyId: string; role?: string }) {
  const canEdit = role === "owner" || role === "manager";
  const [svcs, setSvcs] = useState<Svc[] | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [cat, setCat] = useState("laundry"); const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(""); const [pnote, setPnote] = useState(""); const [cap, setCap] = useState(""); const [hours, setHours] = useState("");
  const [bookable, setBookable] = useState(true); const [active, setActive] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_offered_services_admin", { p_property_id: propertyId });
    if (error) { setErr(error.message); return; }
    const d = data as { services: Svc[]; requests: Req[] };
    setSvcs(d.services); setReqs(d.requests);
  }, [propertyId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function reset() { setEditId(null); setCat("laundry"); setName(""); setDesc(""); setPrice(""); setPnote(""); setCap(""); setHours(""); setBookable(true); setActive(true); }
  function edit(s: Svc) { setEditId(s.id); setCat(s.category); setName(s.name); setDesc(s.description ?? ""); setPrice(s.price_from ? String(s.price_from) : ""); setPnote(s.price_note ?? ""); setCap(s.capacity ?? ""); setHours(s.hours ?? ""); setBookable(s.bookable); setActive(s.active); window.scrollTo?.({ top: 0 }); }

  async function save(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("upsert_offered_service", { p_property_id: propertyId, p_id: editId, p_category: cat, p_name: name, p_description: desc, p_price: price ? Number(price) : null, p_price_note: pnote, p_capacity: cap, p_hours: hours, p_bookable: bookable, p_active: active });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Saved. Guests can see it on your hotel page."); reset(); load();
  }
  async function decide(id: string, status: string) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("decide_service_request", { p_id: id, p_status: status, p_note: notes[id] || null });
    setBusy(false);
    if (error) setErr(error.message); else load();
  }

  const open = reqs.filter((r) => r.status === "requested");
  return (
    <div className="space-y-3 text-xs">
      <p className="text-gray-600">List the services your hotel offers so guests know what is available before they book. The price is optional: leave it empty and guests only see that the service exists. Guests can reserve a service, but <b>payment is between the guest and your hotel</b>. CHS does not handle it.</p>
      {msg && <p className="text-green-700">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}

      {open.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-2 space-y-2">
          <p className="font-bold text-amber-900">🛎️ {open.length} service reservation{open.length > 1 ? "s" : ""} waiting</p>
          {open.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-2">
              <p className="font-semibold">{r.service} × {r.quantity}</p>
              <p className="text-gray-600">{r.guest ?? "Guest"}{r.room ? `, room ${r.room}` : ""}; stay {r.check_in} to {r.check_out}</p>
              <p className="text-gray-600">{r.preferred_date ? `For ${r.preferred_date}` : "Any day"}{r.preferred_time ? `, ${r.preferred_time}` : ""}{r.note ? `. "${r.note}"` : ""}</p>
              {canEdit && <>
                <input value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Reply to the guest (optional)" className="w-full border border-gray-300 rounded px-2 py-1 mt-1" />
                <div className="flex gap-2 mt-1">
                  <button disabled={busy} onClick={() => decide(r.id, "accepted")} className="px-3 py-1 rounded-full bg-green-600 text-white font-semibold">Accept</button>
                  <button disabled={busy} onClick={() => decide(r.id, "declined")} className="px-3 py-1 rounded-full border border-red-400 text-red-600 font-semibold">Cannot provide</button>
                </div></>}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form onSubmit={save} className="border border-gray-200 rounded-lg p-2 space-y-2">
          <p className="font-bold">{editId ? "Edit service" : "Add a service"}</p>
          <select value={cat} onChange={(e) => { setCat(e.target.value); if (!name) setName(catInfo(e.target.value).label); }} className="w-full border border-gray-300 rounded px-2 py-1.5">
            {SERVICE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Same-day laundry" maxLength={80} required className="w-full border border-gray-300 rounded px-2 py-1.5" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is included, rules, how it works (optional)" maxLength={500} rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5" />
          <div className="grid grid-cols-2 gap-2">
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Approx. price (₦, optional)" className="border border-gray-300 rounded px-2 py-1.5" />
            <input value={pnote} onChange={(e) => setPnote(e.target.value)} placeholder="per piece, per plate, per hour…" maxLength={60} className="border border-gray-300 rounded px-2 py-1.5" />
            <input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Capacity, e.g. 30 people" maxLength={100} className="border border-gray-300 rounded px-2 py-1.5" />
            <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours, e.g. 8am to 8pm" maxLength={100} className="border border-gray-300 rounded px-2 py-1.5" />
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} /> Guests can reserve this ahead (otherwise they only see it is available)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Show on my hotel page</label>
          <div className="flex gap-2">
            <button disabled={busy} className="px-4 py-1.5 rounded-full bg-chs-charcoal text-white font-semibold">{editId ? "Save changes" : "Add service"}</button>
            {editId && <button type="button" onClick={reset} className="px-4 py-1.5 rounded-full border border-gray-300">Cancel</button>}
          </div>
        </form>
      )}

      <div className="space-y-1">
        <p className="font-bold">Your services ({svcs?.length ?? 0})</p>
        {svcs === null && <p className="text-gray-500">Loading…</p>}
        {svcs?.length === 0 && <p className="text-gray-500">None yet. Add laundry, restaurant, pool and anything else you offer.</p>}
        {svcs?.map((s) => (
          <div key={s.id} className={`border rounded-lg p-2 flex justify-between gap-2 ${s.active ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
            <div>
              <p className="font-semibold">{catInfo(s.category).icon} {s.name}{!s.active && " (hidden)"}</p>
              <p className="text-gray-600">{s.price_from ? `From ${formatNaira(s.price_from)}${s.price_note ? " " + s.price_note : ""}` : "Price not shown"}{s.capacity ? ` · ${s.capacity}` : ""}{s.hours ? ` · ${s.hours}` : ""}{!s.bookable ? " · not reservable" : ""}</p>
            </div>
            {canEdit && <button onClick={() => edit(s)} className="text-chs-red font-semibold shrink-0">Edit</button>}
          </div>
        ))}
      </div>

      {reqs.filter((r) => r.status !== "requested").length > 0 && (
        <details>
          <summary className="font-bold cursor-pointer">Earlier reservations</summary>
          {reqs.filter((r) => r.status !== "requested").map((r) => (
            <p key={r.id} className="border-b border-gray-100 py-1">{r.service} × {r.quantity}, {r.guest ?? "Guest"}: <b>{r.status}</b>
              {r.status === "accepted" && canEdit && <button onClick={() => decide(r.id, "done")} className="ml-2 text-chs-red font-semibold">Mark done</button>}</p>
          ))}
        </details>
      )}
    </div>
  );
}
