"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { MODE_LABEL, STATUS_LABEL } from "@/lib/delivery";
import NotificationBell from "@/components/NotificationBell";
import { StatusBar, Timeline, type Shipment } from "@/components/ShipmentCard";
import ClaimPhotoPicker from "@/components/ClaimPhotoPicker";
import { uploadClaimPhotos, STATUS_LABEL as CLAIM_STATUS } from "@/lib/claims";
import { stageOf, parcelMoney, METHOD_LABEL, STAGE_LABEL, STAGE_STYLE } from "@/lib/sellerOrders";

type Method = "own_rider" | "courier" | "chs_centre";
const fmtDate = (x: string | null | undefined) => (x ? new Date(x).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtTime = (x: string | null | undefined) => (x ? new Date(x).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const inp = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white";

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return <div className="bg-white rounded-xl border border-gray-100 p-3">{title && <p className="text-xs font-bold text-chs-charcoal mb-2">{title}</p>}{children}</div>;
}

export default function SellerOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [s, setS] = useState<Shipment | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [method, setMethod] = useState<Method | null>(null);
  const [carrier, setCarrier] = useState("");
  const [waybill, setWaybill] = useState("");
  const [rider, setRider] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [expected, setExpected] = useState("");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [packFiles, setPackFiles] = useState<File[]>([]);
  const [claims, setClaims] = useState<{ id: string; reference: string; status: string; product: string; needs_me: boolean }[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_vendor_shipments");
    if (error) { setErr(error.message); setS(null); return; }
    const hit = ((data as Shipment[]) || []).find((x) => x.id === id) || null;
    setS(hit);
    const cl = await supabase.rpc("get_vendor_marketplace_claims");
    setClaims(((cl.data as { id: string; reference: string; status: string; product: string; needs_me: boolean; shipment_id: string }[]) || []).filter((c) => c.shipment_id === id));
    if (hit && method === null) setMethod(hit.mode === "vendor_free" ? "own_rider" : hit.mode === "courier" ? "courier" : "chs_centre");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, session, router, load]);

  async function packWithPhotos() {
    if (!s) return;
    setBusy(true); setErr(null); setOk(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const paths = packFiles.length ? await uploadClaimPhotos(packFiles, u.user!.id, "packing") : [];
      const { error } = await supabase.rpc("vendor_mark_packed", { p_shipment: s.id, p_photos: paths });
      if (error) throw new Error(error.message);
      setOk("Marked as packed. The buyer has been told."); setPackFiles([]); await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  async function run(fn: string, args: Record<string, unknown>, done: string) {
    setBusy(true); setErr(null); setOk(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk(done); await load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const Header = (
    <div className="bg-[var(--zone-accent)] text-white px-4 py-4 no-print">
      <div className="flex gap-4 text-xs text-white/80"><Link href="/vendor/orders">← All my orders</Link><Link href="/vendor">My shop dashboard</Link></div>
      <div className="flex items-center gap-2 mt-1"><h1 className="font-serif text-lg font-bold">{s ? `Order ${s.reference}` : "Order"}</h1><NotificationBell /></div>
    </div>
  );

  if (authLoading || s === undefined) return <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)]">{Header}<p className="p-6 text-sm text-gray-400">Loading order…</p></div>;
  if (!s) return (
    <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)]">{Header}
      <div className="p-6 text-sm"><p className="font-semibold text-chs-charcoal">We could not find this order on your shop.</p>{err && <p className="text-xs text-chs-red mt-1">{err}</p>}
        <Link href="/vendor/orders" className="inline-block mt-3 px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">Go to my orders</Link></div>
    </div>
  );

  const st = stageOf(s); const m = parcelMoney(s);
  const awaiting = s.status === "awaiting_dispatch";
  const needsCode = s.mode === "vendor_free" && !["awaiting_dispatch", "delivered", "cancelled", "problem"].includes(s.status);
  const detailsLine = [s.dispatch_method === "own_rider" ? null : s.carrier, s.rider_name && `${s.rider_name}${s.rider_phone ? ` · ${s.rider_phone}` : ""}`, s.vehicle_plate && `vehicle ${s.vehicle_plate}`, s.tracking_no && `waybill ${s.tracking_no}`].filter(Boolean);

  function dispatch() {
    run("vendor_dispatch_shipment", {
      p_shipment: s!.id, p_method: method, p_carrier: carrier || null, p_tracking: waybill || null,
      p_rider_name: rider || null, p_rider_phone: phone || null, p_vehicle: plate || null, p_expected: expected || null, p_note: note || null,
    }, "Dispatch recorded. The buyer and CHS have been told who is carrying the goods.");
  }

  return (
    <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)] pb-10">
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
      {Header}
      <div className="px-4 pt-4 space-y-3">
        {ok && <p className="text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 no-print">✓ {ok}</p>}
        {err && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 no-print">{err}</p>}

        {claims.length > 0 && (
          <div className="rounded-xl border-2 border-chs-red bg-red-50 p-3 space-y-1">
            <p className="text-xs font-bold text-chs-red">⚠️ A buyer reported a problem with this order</p>
            {claims.map((c) => (
              <Link key={c.id} href={`/claims/${c.id}`} className="flex justify-between items-center text-xs bg-white rounded-lg px-3 py-2">
                <span><b>{c.reference}</b> · {c.product}</span>
                <span className="font-semibold text-chs-red">{c.needs_me ? "Reply now →" : (CLAIM_STATUS[c.status] || CLAIM_STATUS.open).text + " →"}</span>
              </Link>
            ))}
            <p className="text-[10px] text-gray-600">The money for this order stays with CHS until the problem is settled.</p>
          </div>
        )}

        <Card>
          <div className="flex justify-between gap-2 items-start">
            <div><p className="text-[10px] text-gray-500">Placed {fmtTime(s.created_at)}</p><p className="text-xs font-bold text-chs-charcoal mt-0.5">{STATUS_LABEL[s.status] || s.status}</p></div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STAGE_STYLE[st]}`}>{STAGE_LABEL[st]}</span>
          </div>
          <StatusBar status={s.status} />
        </Card>

        <Card title="1 · What to pack">
          <ul className="text-sm divide-y divide-gray-100">
            {s.items.map((it) => (
              <li key={it.order_id} className="py-1.5 flex justify-between gap-3">
                <span><b>{it.quantity} ×</b> {it.name}{it.options && Object.keys(it.options).length ? ` (${Object.values(it.options).join(", ")})` : ""}<span className="block text-[10px] text-gray-400">{it.reference}{it.unit_price ? ` · ${formatNaira(Number(it.unit_price))} each` : ""}</span></span>
                <span className="font-semibold whitespace-nowrap">{formatNaira(Number(it.amount))}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-500 mt-1">About {s.weight_kg} kg in total.</p>
        </Card>

        <Card title="Your money on this order">
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-600">Goods value</span><b>{formatNaira(m.gross)}</b></div>
            <div className="flex justify-between"><span className="text-gray-600">CHS commission (deducted)</span><b className="text-chs-red">− {formatNaira(m.commission)}</b></div>
            <div className="flex justify-between border-t border-gray-100 pt-1"><span className="font-semibold">You receive</span><b className="text-green-700">{formatNaira(m.net)}</b></div>
          </div>
          <p className="text-[11px] mt-2 text-gray-600">
            {m.releasedNet > 0 ? `✓ ${formatNaira(m.releasedNet)} has been paid into your wallet.` : m.refunded > 0 ? "↩ This order was refunded to the buyer." : "💰 The buyer has paid in full. CHS holds the money safely until the goods are delivered, then CHS pays you your share."}
          </p>
        </Card>

        <Card title="Deliver to">
          <p className="text-sm font-semibold text-chs-charcoal">{s.buyer || "Buyer"}</p>
          <p className="text-sm text-gray-700">{s.dest_address}</p>
          <p className="text-[11px] text-gray-500 mt-1">{s.dest_area ? `${s.dest_area}, ` : ""}{s.dest} · about {s.km} km from you</p>
          <p className="text-[11px] text-gray-500">The buyer chose: <b>{MODE_LABEL[s.mode] || s.mode}</b>{s.eta_max ? ` · must arrive by ${fmtDate(s.eta_max)}` : ""}</p>
          {s.mode === "hub_pickup" && s.hub && <p className="text-[11px] mt-1 bg-gray-50 rounded px-2 py-1">The buyer collects from <b>{s.hub.name}</b>{s.hub.address ? `, ${s.hub.address}` : ""}.</p>}
        </Card>

        {awaiting && (
          <Card title="2 · Pack the goods">
            {s.packed_at ? <p className="text-sm text-green-700 font-semibold">✓ Packed {fmtTime(s.packed_at)}</p> : (
              <>
                <p className="text-[11px] text-gray-600 mb-2">Check every item against the list above, then tell the buyer it is packed.</p>
                <p className="text-[11px] font-semibold text-gray-700 mb-1">Photos of the packed goods (at least 2 for fragile items, recommended for all)</p>
                <p className="text-[10px] text-gray-500 mb-2">These protect you. If a buyer reports damage, CHS can see the goods left you in good order.</p>
                <div className="mb-3"><ClaimPhotoPicker files={packFiles} onChange={setPackFiles} /></div>
                <button disabled={busy} onClick={packWithPhotos} className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-sm font-semibold disabled:opacity-50">✓ I have packed all items</button>
              </>
            )}
          </Card>
        )}

        {awaiting && (
          <Card title="3 · Send it: who is carrying the goods?">
            <div className="grid gap-2">
              {([["own_rider", "🏍️ My own rider or vehicle", "You or your driver takes it to the buyer."], ["courier", "🚚 A courier or transport company", "GIG, park transport, DHL, a bus company, etc."], ["chs_centre", "🏢 CHS collection centre", "You take it to the CHS centre and CHS delivers."]] as [Method, string, string][]).map(([k, t, d]) => (
                <button key={k} type="button" onClick={() => setMethod(k)} className={`text-left rounded-xl border px-3 py-2 ${method === k ? "border-chs-red bg-red-50" : "border-gray-200 bg-white"}`}>
                  <p className="text-sm font-semibold text-chs-charcoal">{t}</p><p className="text-[11px] text-gray-500">{d}</p>
                </button>
              ))}
            </div>

            {method === "own_rider" && (
              <div className="mt-3 space-y-2">
                <input className={inp} value={rider} onChange={(e) => setRider(e.target.value)} placeholder="Rider / driver full name *" />
                <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Rider / driver phone number *" />
                <input className={inp} value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Vehicle or bike plate number (recommended)" />
              </div>
            )}
            {method === "courier" && (
              <div className="mt-3 space-y-2">
                <input className={inp} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Courier / transport company name *" />
                <input className={inp} value={waybill} onChange={(e) => setWaybill(e.target.value)} placeholder="Waybill / tracking number" />
                <input className={inp} value={rider} onChange={(e) => setRider(e.target.value)} placeholder="Driver or contact name at the courier (optional)" />
                <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Courier or driver phone (optional)" />
              </div>
            )}
            {method === "chs_centre" && <p className="mt-3 text-[11px] bg-gray-50 rounded-lg px-3 py-2 text-gray-700">Take the packed goods to the CHS collection centre in your city and tell them the order number <b>{s.reference}</b>. Tap the button below once they have taken it.</p>}

            {method && (
              <div className="mt-2 space-y-2">
                <label className="block text-[11px] text-gray-600">Expected delivery date
                  <input type="date" className={`${inp} mt-0.5`} value={expected} onChange={(e) => setExpected(e.target.value)} min={new Date().toISOString().slice(0, 10)} /></label>
                <textarea className={inp} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note for the buyer or CHS (optional): e.g. call before arriving, gate colour, fragile items" />
                <button disabled={busy} onClick={dispatch} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-bold disabled:opacity-50">{busy ? "Recording…" : s.mode === "vendor_free" ? "Record dispatch — goods are leaving now" : "Record dispatch — goods handed over"}</button>
                <p className="text-[10px] text-gray-500">This is saved as a permanent record. The buyer and CHS are told who is carrying the goods and how to reach them.</p>
              </div>
            )}
          </Card>
        )}

        {!awaiting && s.dispatch_method && (
          <Card title="Dispatch record">
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Sent via</dt><dd className="font-semibold text-right">{METHOD_LABEL[s.dispatch_method] || s.dispatch_method}</dd></div>
              {detailsLine.length > 0 && <div className="flex justify-between gap-3"><dt className="text-gray-500">Carrier</dt><dd className="font-semibold text-right">{detailsLine.join(" · ")}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Dispatched</dt><dd className="font-semibold">{fmtTime(s.dispatched_at)}</dd></div>
              {s.dispatch_expected && <div className="flex justify-between gap-3"><dt className="text-gray-500">Expected</dt><dd className="font-semibold">{fmtDate(s.dispatch_expected)}</dd></div>}
              {s.dispatch_note && <div className="flex justify-between gap-3"><dt className="text-gray-500">Note</dt><dd className="text-right">{s.dispatch_note}</dd></div>}
            </dl>
          </Card>
        )}

        {needsCode && (
          <Card title="4 · Buyer received it? Confirm with their code">
            <p className="text-[11px] text-gray-600 mb-2">When you hand the goods to the buyer, ask for the 6-digit delivery code on their order page and enter it here. This proves delivery and starts your payment.</p>
            <div className="flex gap-2">
              <input className={inp} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Buyer's 6-digit code" />
              <button disabled={busy || code.length !== 6} onClick={() => run("vendor_confirm_with_code", { p_shipment: s.id, p_code: code }, "Delivery confirmed. CHS will now release your payment.")} className="px-4 rounded-full bg-green-600 text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap">Confirm</button>
            </div>
          </Card>
        )}
        {!awaiting && !needsCode && st === "onway" && <Card><p className="text-[11px] text-gray-600">The goods are on the way. When the buyer confirms receipt (or CHS confirms delivery), your share is released by CHS and appears in your wallet and in <Link href="/vendor?tab=earnings" className="text-chs-red underline">My total earnings</Link>.</p></Card>}
        {st === "delivered" && <Card><p className="text-sm text-green-700 font-semibold">✓ Delivered {fmtTime(s.delivered_at)}. CHS releases your payment next.</p></Card>}
        {st === "problem" && <Card><p className="text-sm text-chs-red font-semibold">The buyer reported a problem. CHS is looking into it and will contact you.</p></Card>}

        <Card title="History of this order"><Timeline events={s.events} /></Card>

        <div className="flex gap-2 no-print">
          <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-full bg-white border border-gray-300 text-chs-charcoal text-xs font-semibold">🖨️ Print packing slip</button>
          <Link href="/vendor/orders" className="flex-1 py-2.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold text-center">← All my orders</Link>
        </div>
      </div>
    </div>
  );
}
