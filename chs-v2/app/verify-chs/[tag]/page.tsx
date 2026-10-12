import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { chsLabel } from "@/lib/chsStamp";
import { ChsSeal } from "@/components/ChsStamp";

export const dynamic = "force-dynamic";

interface Result {
  found: boolean; reason?: string; tag?: string; level?: string; active?: boolean;
  since?: string | null; ended_at?: string | null; listing_public?: boolean;
  property_id?: string | null; title?: string | null; area?: string | null; purpose?: string | null;
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }) : "");

export default async function VerifyTagResult({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw);
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_chs_tag", { p_tag: tag });
  const r = (data as Result | null) ?? { found: false, reason: "error" };

  let tone = "red"; let heading = ""; let body = "";
  if (r.found && r.active) {
    tone = "green"; heading = "Genuine: " + chsLabel(r.level);
    body = `CHS issued this tag${r.since ? ` on ${fmt(r.since)}` : ""}.`;
  } else if (r.found) {
    tone = "amber"; heading = "This tag is no longer active";
    body = `CHS stopped managing or advertising this property${r.ended_at ? ` on ${fmt(r.ended_at)}` : ""}. Do not pay anyone because of this tag.`;
  } else if (r.reason === "bad_check_digit") {
    heading = "This tag has a typing error"; body = "The last digit does not match. Check the tag again, character by character.";
  } else if (r.reason === "bad_format") {
    heading = "This is not a CHS tag"; body = "A CHS tag looks like CHS-100002-3.";
  } else {
    heading = "CHS never issued this tag"; body = "Treat this advert as NOT managed by CHS. Do not pay any fee, deposit or inspection fee to anyone who gave you this tag.";
  }
  const colors: Record<string, string> = { green: "bg-green-50 border-green-300 text-green-800", amber: "bg-amber-50 border-amber-300 text-amber-800", red: "bg-red-50 border-red-300 text-red-800" };

  return (
    <div className="min-h-screen bg-[var(--zone-bg)]">
      <div className="bg-chs-charcoal text-white px-4 py-3"><Link href="/verify-chs" className="text-sm">← Check another tag</Link></div>
      <div className="px-4 py-6 max-w-md mx-auto">
        <div className={`rounded-xl border-2 p-4 ${colors[tone]}`}>
          <p className="text-[11px] font-mono mb-1">{tag.toUpperCase()}</p>
          <h1 className="font-serif text-lg font-bold">{tone === "green" ? "✓ " : tone === "amber" ? "⚠ " : "✕ "}{heading}</h1>
          <p className="text-xs mt-1">{body}</p>
        </div>
        {r.found && r.active && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <ChsSeal level={r.level} tag={r.tag} size={150} />
            {r.listing_public && r.property_id ? (
              <Link href={`/property/${r.property_id}`} className="w-full text-center bg-chs-red text-white rounded-full py-3 text-sm font-bold">
                View {r.title}{r.area ? `, ${r.area}` : ""}
              </Link>
            ) : (
              <p className="text-xs text-gray-500 text-center">This property is not open for viewing on CHS right now.</p>
            )}
          </div>
        )}
        <p className="text-[11px] text-gray-500 mt-6">Always confirm on the CHS website or app. Pay only through your CHS account so you get a receipt. CHS will never ask you to pay into a personal account.</p>
      </div>
    </div>
  );
}
