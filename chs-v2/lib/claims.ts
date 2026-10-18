import { supabase } from "./supabase";
import { compressImage } from "./imageCompression";

export const CLAIM_TYPE_LABEL: Record<string, string> = {
  damaged: "Damaged or broken",
  faulty: "Faulty / does not work",
  not_as_described: "Not as described",
  wrong_item: "Wrong item sent",
  missing: "Missing items or parts",
  not_received: "Not received",
};
export const CLAIM_TYPE_HELP: Record<string, string> = {
  damaged: "Broken, torn, crushed or burst. Report within 48 hours of delivery.",
  faulty: "It looks fine but does not work or has a hidden defect. Report within 7 days of delivery.",
  not_as_described: "Different from the listing (size, colour, quality, quantity). Report within 48 hours.",
  wrong_item: "You received something other than what you ordered. Report within 48 hours.",
  missing: "Part of the order is not in the package. Report within 48 hours.",
  not_received: "The delivery date has passed or it was marked delivered but you do not have it.",
};
export const REMEDY_LABEL: Record<string, string> = {
  refund: "Refund me",
  replacement: "Send a replacement",
  return_refund: "I will return it for a refund",
  partial: "Partial refund",
  reject: "Claim not upheld",
};
export const FAULT_LABEL: Record<string, string> = {
  seller: "Seller (packing, the goods themselves, or the seller's own rider/courier)",
  chs_transit: "Delivery arranged by CHS (rider or courier)",
  buyer: "Buyer",
  unclear: "Could not be established",
};
export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  open: { text: "Waiting for the seller", cls: "bg-amber-50 text-amber-700" },
  offer_made: { text: "Seller made an offer", cls: "bg-blue-50 text-blue-700" },
  awaiting_chs: { text: "With CHS to decide", cls: "bg-purple-50 text-purple-700" },
  awaiting_second: { text: "Second CHS approval", cls: "bg-purple-50 text-purple-700" },
  replacement_pending: { text: "Replacement in progress", cls: "bg-blue-50 text-blue-700" },
  return_pending: { text: "Goods to be returned", cls: "bg-blue-50 text-blue-700" },
  return_received: { text: "Return received, refund being approved", cls: "bg-purple-50 text-purple-700" },
  decided: { text: "Decided", cls: "bg-green-50 text-green-700" },
  withdrawn: { text: "Withdrawn", cls: "bg-gray-100 text-gray-600" },
};
export const FLAG_LABEL: Record<string, string> = {
  seller_silent: "The seller did not reply in time",
  buyer_silent: "The buyer did not answer the offer in time",
  replacement_sent: "Seller says the replacement was sent",
  return_overdue: "The goods were not returned within 7 days",
};

// Upload photos to the private bucket under <uid>/<folder>/..., returning the stored paths.
export async function uploadClaimPhotos(files: File[], uid: string, folder: "claims" | "packing"): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    const small = await compressImage(f).catch(() => f);
    const ext = (small.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("private-documents").upload(path, small);
    if (error) throw new Error("A photo could not be uploaded: " + error.message);
    out.push(path);
  }
  return out;
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const res: Record<string, string> = {};
  if (!paths.length) return res;
  const { data } = await supabase.storage.from("private-documents").createSignedUrls(paths, 3600);
  (data || []).forEach((d) => { if (d.path && d.signedUrl) res[d.path] = d.signedUrl; });
  return res;
}

export function fmtDT(s?: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function timeLeft(s?: string | null) {
  if (!s) return "";
  const ms = new Date(s).getTime() - Date.now();
  if (ms <= 0) return "time is up";
  const h = Math.floor(ms / 3600000);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} h left` : `${Math.max(1, Math.floor(ms / 60000))} min left`;
}
