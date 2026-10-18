"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { CLAIM_TYPE_LABEL, CLAIM_TYPE_HELP, uploadClaimPhotos } from "@/lib/claims";
import ClaimPhotoPicker from "./ClaimPhotoPicker";
import type { Shipment } from "./ShipmentCard";

// Buyer: report a problem with one item of a parcel. Works before delivery (at the door) and after delivery, inside the time limit.
export default function ClaimForm({ s, onClose }: { s: Shipment; onClose: () => void }) {
  const router = useRouter();
  const items = s.items.filter((i) => i.payment_status !== "refunded");
  const [orderId, setOrderId] = useState(items[0]?.order_id || "");
  const item = items.find((i) => i.order_id === orderId);
  const delivered = !!s.delivered_at;
  const types = delivered ? ["damaged", "faulty", "not_as_described", "wrong_item", "missing", "not_received"] : s.status === "out_for_delivery" || s.status === "delivered_by_carrier" ? ["damaged", "not_as_described", "wrong_item", "missing", "not_received"] : ["not_received"];
  const [type, setType] = useState(types[0]);
  const [units, setUnits] = useState(1);
  const [desc, setDesc] = useState("");
  const [remedy, setRemedy] = useState("refund");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const needPhotos = type !== "not_received";
  const [allow, setAllow] = useState<{ pct: number; keyword: string } | null>(null);
  useEffect(() => {
    if (!orderId) return;
    supabase.rpc("get_breakage_allowance", { p_order: orderId }).then(({ data }) => setAllow(data as { pct: number; keyword: string } | null));
  }, [orderId]);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Please log in again.");
      if (needPhotos && files.length < 2) throw new Error("Please add at least 2 clear photos of the problem.");
      const paths = files.length ? await uploadClaimPhotos(files, uid, "claims") : [];
      const { data, error } = await supabase.rpc("buyer_open_claim", { p_order: orderId, p_type: type, p_units: type === "not_received" ? item?.quantity || 1 : units, p_description: desc, p_remedy: remedy, p_photos: paths, p_at_door: false });
      if (error) throw new Error(error.message);
      router.push(`/claims/${data}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (!items.length) return <p className="text-xs text-gray-500">Everything in this parcel has already been refunded.</p>;
  return (
    <div className="mt-2 rounded-xl border border-red-100 bg-red-50/40 p-3 space-y-2.5">
      <p className="text-xs font-bold text-chs-charcoal">Report a problem</p>
      <p className="text-[10px] text-gray-600">No money moves when you send this. CHS holds the payment, the seller is asked to reply, and CHS decides if they cannot agree.</p>
      {items.length > 1 && (
        <label className="block text-[11px] font-semibold text-gray-700">Which item?
          <select value={orderId} onChange={(e) => { setOrderId(e.target.value); setUnits(1); }} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal">
            {items.map((i) => <option key={i.order_id} value={i.order_id}>{i.name} × {i.quantity} — {formatNaira(i.amount)}</option>)}
          </select>
        </label>
      )}
      <label className="block text-[11px] font-semibold text-gray-700">What is wrong?
        <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal">
          {types.map((t) => <option key={t} value={t}>{CLAIM_TYPE_LABEL[t]}</option>)}
        </select>
        <span className="block text-[10px] text-gray-500 font-normal mt-0.5">{CLAIM_TYPE_HELP[type]}</span>
      </label>
      {type === "damaged" && allow && allow.pct > 0 && item && (
        <p className="text-[10px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5">For this kind of goods a small amount of breakage in transport is normal. The first {Math.floor((item.quantity * allow.pct) / 100)} unit(s) ({allow.pct}% of {item.quantity}) are not refunded when damage is found. Anything above that is.</p>
      )}
      {type !== "not_received" && item && item.quantity > 1 && (
        <label className="block text-[11px] font-semibold text-gray-700">How many units are affected? (of {item.quantity})
          <input type="number" min={1} max={item.quantity} value={units} onChange={(e) => setUnits(Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)))} className="mt-1 w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal block" />
        </label>
      )}
      <label className="block text-[11px] font-semibold text-gray-700">Tell us what happened
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Describe the problem. When did you notice it? What condition was the package in?" className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal" />
      </label>
      <div>
        <p className="text-[11px] font-semibold text-gray-700 mb-1">Photos {needPhotos ? "(at least 2: the item and the package/label)" : "(optional)"}</p>
        <ClaimPhotoPicker files={files} onChange={setFiles} />
      </div>
      <label className="block text-[11px] font-semibold text-gray-700">What would you like?
        <select value={remedy} onChange={(e) => setRemedy(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal">
          <option value="refund">Refund me</option>
          <option value="replacement">Send a replacement</option>
          <option value="return_refund">I will return it for a refund</option>
        </select>
      </label>
      {err && <p className="text-xs text-chs-red font-semibold">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy || desc.trim().length < 10} className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{busy ? "Sending…" : "Send report"}</button>
        <button onClick={onClose} disabled={busy} className="px-3 py-2 text-xs text-gray-500">Cancel</button>
      </div>
    </div>
  );
}
