"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { ChsSeal } from "@/components/ChsStamp";
import { chsLabel, isChsStamped } from "@/lib/chsStamp";

// A printable sheet for the signboard, flyer or WhatsApp status: the CHS seal, the tag, and a QR code that opens the
// public tag-check page. Shown only for a property CHS has actually stamped.
interface P { title: string; location_area: string | null; purpose: string; chs_service: string; chs_tag: string | null; reference_number: string | null }

export default function StampSheet() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<P | null | undefined>(undefined);
  const [qr, setQr] = useState("");

  useEffect(() => {
    supabase.from("properties").select("title, location_area, purpose, chs_service, chs_tag, reference_number").eq("id", id).maybeSingle()
      .then(({ data }) => setP((data as P | null) ?? null));
  }, [id]);
  useEffect(() => {
    if (p?.chs_tag) QRCode.toDataURL(`${window.location.origin}/verify-chs/${p.chs_tag}`, { width: 360, margin: 1 }).then(setQr);
  }, [p]);

  if (p === undefined) return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  if (!p || !isChsStamped(p.chs_service) || !p.chs_tag) return <p className="p-6 text-sm text-gray-600">This property does not carry a CHS stamp, so there is nothing to print.</p>;

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center text-center">
      <button onClick={() => window.print()} className="print:hidden mb-4 px-5 py-2 rounded-full bg-chs-red text-white text-sm font-bold">Print or save as PDF</button>
      <div className="border-4 border-chs-charcoal rounded-2xl p-8 w-full max-w-md">
        <ChsSeal level={p.chs_service} tag={p.chs_tag} size={220} />
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mt-3">{chsLabel(p.chs_service)}</h1>
        <p className="text-sm mt-1">{p.title}{p.location_area ? `, ${p.location_area}` : ""}</p>
        <p className="font-mono text-xl tracking-widest mt-3">{p.chs_tag}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt={`QR code to check ${p.chs_tag}`} className="mx-auto mt-3 w-44 h-44" />}
        <p className="text-xs mt-2">Scan to check this tag, or type it at <b>/verify-chs</b></p>
        <p className="text-[11px] text-gray-600 mt-3">Published fees only. Pay through your CHS account and keep the receipt. CHS never asks you to pay into a personal account.</p>
      </div>
    </div>
  );
}
