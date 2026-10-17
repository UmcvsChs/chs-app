"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { startWalletFunding } from "@/lib/paystack";
import ConfirmPay from "@/components/ConfirmPay";
import RefundPolicyNotice from "@/components/RefundPolicyNotice";
import type { CartLine } from "@/lib/cart";
import DeliveryCityPicker from "@/components/DeliveryCityPicker";
import { etaText, MODE_LABEL, type DeliveryPreview, type NgCity } from "@/lib/delivery";

interface PLine { product_id: string; name: string; photo: string | null; unit_price: number; quantity: number; options: Record<string, string>; stock: number | null; ok: boolean; problem: string | null; line_subtotal: number; }
interface Preview { lines: PLine[]; subtotal: number; buyer_commission_pct: number; buyer_commission: number; total: number; wallet_balance: number; all_ok: boolean; }

export default function MarketplaceCart({ cities, cityId, setCityId, items, loggedIn, onClose, setQty, remove, clear, requireVerified }: {
  cities: NgCity[]; cityId: number | null; setCityId: (id: number) => void;
  items: CartLine[]; loggedIn: boolean; onClose: () => void;
  setQty: (i: number, q: number) => void; remove: (i: number) => void; clear: () => void;
  requireVerified: () => boolean;
}) {
  const [pv, setPv] = useState<Preview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [address, setAddress] = useState(() => { try { return localStorage.getItem("chs_cart_address") || ""; } catch { return ""; } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ refs: string[]; total: number } | null>(null);
  const [topping, setTopping] = useState(false);
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [dp, setDp] = useState<DeliveryPreview | null>(null);
  const [dpErr, setDpErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn || items.length === 0 || !cityId) { // eslint-disable-next-line react-hooks/set-state-in-effect
      setDp(null); return; }
    supabase.rpc("get_delivery_preview", { p_items: items, p_city_id: cityId, p_methods: methods }).then(({ data, error }) => {
      if (error) { setDpErr(error.message); setDp(null); return; }
      setDpErr(null); setDp(data as DeliveryPreview);
    });
  }, [items, loggedIn, cityId, methods]);
  const deliveryTotal = dp?.delivery_total ?? 0;
  const grand = (pv?.total ?? 0) + deliveryTotal;

  const load = useCallback(async () => {
    if (!loggedIn || items.length === 0) { setPv(null); return; }
    const { data, error } = await supabase.rpc("get_cart_preview", { p_items: items });
    if (error) { setLoadErr(error.message); return; }
    setLoadErr(null); setPv(data as Preview);
  }, [items, loggedIn]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const shortfall = pv ? Math.max(0, Math.ceil(grand - pv.wallet_balance)) : 0;

  async function topUp() {
    if (shortfall < 100) return;
    setTopping(true); setErr(null);
    try {
      await startWalletFunding(shortfall * 100, () => { setTopping(false); setTimeout(load, 2500); setTimeout(load, 7000); }, () => setTopping(false));
    } catch (e) { setTopping(false); setErr(e instanceof Error ? e.message : "Could not start the payment."); }
  }

  async function pay() {
    if (!pv) return;
    if (address.trim().length < 10) { setErr("Please give your full delivery address (house number, street, area, town)."); return; }
    if (!cityId || !dp) { setErr("Please choose the city you want your goods delivered to, so we can work out delivery."); return; }
    if (!requireVerified()) { onClose(); return; }
    setBusy(true); setErr(null);
    try { localStorage.setItem("chs_cart_address", address.trim()); } catch { /* ignore */ }
    const { data, error } = await supabase.rpc("checkout_cart", { p_items: items, p_address: address.trim(), p_city_id: cityId, p_methods: methods });
    setBusy(false);
    if (error) { setErr(error.message.includes("insufficient_balance") ? "Your wallet balance is not enough. Use “Top up wallet” below, then pay." : error.message); load(); return; }
    const r = data as { references: string[]; total_paid: number };
    void r;
    setDone({ refs: r.references, total: r.total_paid });
    clear();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[94vh] overflow-y-auto rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <h2 className="font-serif text-base font-bold text-chs-charcoal">🛒 Your cart</h2>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none" aria-label="Close">✕</button>
        </div>

        {done ? (
          <div className="mt-4 text-center space-y-2">
            <p className="text-3xl">✅</p>
            <p className="text-sm font-bold text-green-700">Paid {formatNaira(done.total)}. The money is held safely by CHS until your delivery is confirmed.</p>
            <p className="text-[11px] text-gray-600">Order reference{done.refs.length > 1 ? "s" : ""}: <b>{done.refs.join(", ")}</b></p>
            <p className="text-[11px] text-gray-500">The vendor has been told to prepare your order. You can follow every order, any time, under My Requests.</p>
            <p className="text-[11px] text-gray-500">Each seller's parcel has its own tracking page and a 6-digit delivery code. Give the code only when you receive your goods.</p>
            <Link href="/marketplace/orders" className="inline-block mt-1 px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">Track my deliveries</Link>
            <button onClick={onClose} className="block mx-auto text-[11px] text-gray-500 underline">Keep shopping</button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">Your cart is empty.</p>
            <button onClick={onClose} className="mt-3 px-4 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">Continue shopping</button>
          </div>
        ) : !loggedIn ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-gray-600">Please log in to check out. Your cart is saved and waiting.</p>
            <Link href="/login" className="inline-block px-4 py-2 rounded-full bg-chs-red text-white text-xs font-semibold">Log in</Link>
          </div>
        ) : (
          <>
            {loadErr && <p className="text-xs text-chs-red mt-2">{loadErr}</p>}
            <div className="mt-3 divide-y divide-gray-100">
              {(pv?.lines || []).map((l, i) => (
                <div key={`${l.product_id}-${i}`} className="py-2.5 flex gap-2.5">
                  {l.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.photo} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-chs-charcoal leading-tight">{l.name}</p>
                    {Object.keys(l.options || {}).length > 0 && <p className="text-[10px] text-gray-500">{Object.entries(l.options).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>}
                    <p className="text-[11px] text-gray-600">{formatNaira(l.unit_price)} each</p>
                    {!l.ok && <p className="text-[10px] font-semibold text-chs-red">⚠️ {l.problem}. Change the quantity or remove it.</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <button type="button" onClick={() => setQty(i, l.quantity - 1)} className="w-6 h-6 rounded-full border border-gray-200 text-sm leading-none">−</button>
                      <span className="text-xs font-bold w-5 text-center">{l.quantity}</span>
                      <button type="button" onClick={() => setQty(i, l.stock != null ? Math.min(l.stock, l.quantity + 1) : l.quantity + 1)} className="w-6 h-6 rounded-full border border-gray-200 text-sm leading-none">+</button>
                      <button type="button" onClick={() => remove(i)} className="ml-auto text-[10px] text-chs-red underline">Remove</button>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-chs-charcoal whitespace-nowrap">{l.ok ? formatNaira(l.line_subtotal) : "—"}</p>
                </div>
              ))}
              {!pv && !loadErr && <p className="py-6 text-center text-xs text-gray-400">Loading your cart…</p>}
            </div>

            {pv && (
              <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-600">Delivery address</label>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House number, street, area, town and state. No phone numbers: CHS handles all contact."
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-xs" />
                </div>
                <DeliveryCityPicker cities={cities} cityId={cityId} onChange={setCityId} />
                {dpErr && <p className="text-xs text-chs-red">{dpErr}</p>}
                {dp && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-chs-charcoal">
                      🚚 Delivery · {dp.groups.filter((g) => g.km <= 30).length} of {dp.groups.length} seller{dp.groups.length > 1 ? "s are" : " is"} near you
                    </p>
                    {dp.groups.map((g) => (
                      <div key={g.vendor_id} className="border border-gray-100 rounded-xl p-2.5 bg-gray-50/60">
                        <p className="text-[11px] font-semibold text-chs-charcoal">{g.vendor_name} <span className="font-normal text-gray-500">· {g.vendor_city || "city on file"} · about {g.km} km away</span></p>
                        <div className="mt-1.5 space-y-1">
                          {g.options.map((o) => (
                            <label key={o.mode} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 cursor-pointer ${g.mode === o.mode ? "border-chs-red bg-white" : "border-gray-200 bg-white/60"}`}>
                              <input type="radio" name={`m-${g.vendor_id}`} checked={g.mode === o.mode} onChange={() => setMethods({ ...methods, [g.vendor_id]: o.mode })} className="mt-0.5" />
                              <span className="flex-1 text-[11px] leading-snug">
                                <b>{MODE_LABEL[o.mode] || o.label}</b><br />
                                <span className="text-gray-500">{o.label}</span><br />
                                <span className="text-gray-600">Arrives {etaText(o.eta_min, o.eta_max)}</span>
                              </span>
                              <span className="text-[11px] font-bold whitespace-nowrap">{g.mode === o.mode ? (o.fee + o.insurance === 0 ? "Free" : formatNaira(g.fee + g.insurance)) : (o.fee + o.insurance === 0 ? "Free" : formatNaira(o.fee + o.insurance))}</span>
                            </label>
                          ))}
                        </div>
                        {g.consolidated && <p className="text-[10px] text-green-700 mt-1">✓ Shares one CHS delivery run with your other nearby sellers, so the starting charge is not repeated.</p>}
                        {g.insurance > 0 && <p className="text-[10px] text-gray-500 mt-1">Includes transit insurance of {formatNaira(g.insurance)}.</p>}
                      </div>
                    ))}
                  </div>
                )}
                {!cityId && <p className="text-[11px] text-chs-red">Choose your city above to see delivery cost and arrival date.</p>}
                <div className="text-xs text-chs-charcoal space-y-0.5">
                  <p className="flex justify-between"><span>Items</span><span>{formatNaira(pv.subtotal)}</span></p>
                  <p className="flex justify-between"><span>CHS fee ({pv.buyer_commission_pct}%)</span><span>{formatNaira(pv.buyer_commission)}</span></p>
                  <p className="flex justify-between"><span>Delivery{dp && dp.groups.some((g) => g.insurance > 0) ? " and insurance" : ""}</span><span>{dp ? (deliveryTotal === 0 ? "Free" : formatNaira(deliveryTotal)) : "—"}</span></p>
                  <p className="flex justify-between text-sm font-bold border-t border-gray-100 pt-1 mt-1"><span>Total to pay</span><span>{formatNaira(grand)}</span></p>
                  <p className="flex justify-between text-[11px] text-gray-500"><span>Your wallet balance</span><span>{formatNaira(pv.wallet_balance)}</span></p>
                </div>
                <RefundPolicyNotice />
                {err && <p className="text-xs text-chs-red">{err}</p>}
                {shortfall > 0 && pv.all_ok && (
                  <div className="bg-chs-amber-light rounded-lg p-2.5">
                    <p className="text-[11px] text-chs-charcoal">Your wallet is short by <b>{formatNaira(shortfall)}</b>. Top it up right here and come straight back to pay.</p>
                    <button onClick={topUp} disabled={topping || shortfall < 100} className="mt-1.5 w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">{topping ? "Opening payment…" : `💳 Top up wallet with ${formatNaira(shortfall)}`}</button>
                  </div>
                )}
                <ConfirmPay onConfirm={pay} busy={busy} disabled={!pv.all_ok || shortfall > 0 || !dp} amountText={formatNaira(grand)} whatFor="for everything in your cart (held by CHS until delivery)"
                  className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
                  label={busy ? "Processing…" : `Pay ${formatNaira(grand)} from my wallet`} />
                <p className="text-[10px] text-gray-400 text-center">Your money is held by CHS and only released to the vendor after delivery is confirmed.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
