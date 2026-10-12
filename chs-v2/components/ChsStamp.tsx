import Link from "next/link";
import { chsLabel, chsShortLabel, isChsStamped, CHS_VERIFY_PATH } from "@/lib/chsStamp";

// One design, three sizes. It is drawn from the database status only, so it cannot be put on a listing by its owner.
// chip   - small corner label on a listing card
// banner - the strip on the listing page, with the tag ID and a link to check it
// seal   - the round stamp used on printed signboards and flyers

export function ChsChip({ level }: { level?: string | null }) {
  if (!isChsStamped(level)) return null;
  const managed = level === "chs_managed";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-1 rounded-full shadow ${managed ? "bg-chs-charcoal text-amber-300 border border-amber-300" : "bg-white text-chs-charcoal border border-chs-charcoal"}`}>
      <span aria-hidden>🛡️</span>{chsShortLabel(level)}
    </span>
  );
}

export function ChsBanner({ level, tag }: { level?: string | null; tag?: string | null }) {
  if (!isChsStamped(level)) return null;
  const managed = level === "chs_managed";
  return (
    <div className={`mx-4 mt-3 rounded-xl border-2 px-3 py-2.5 flex items-center gap-3 ${managed ? "bg-chs-charcoal border-amber-300 text-white" : "bg-white border-chs-charcoal text-chs-charcoal"}`}>
      <span className="text-2xl" aria-hidden>🛡️</span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-extrabold ${managed ? "text-amber-300" : ""}`}>{chsLabel(level)}</p>
        {tag && <p className="text-[11px] font-mono tracking-wide">{tag}</p>}
        <p className={`text-[10px] ${managed ? "text-white/70" : "text-gray-500"}`}>
          {managed ? "CHS runs this property. Published fees only: no agent fee, legal fee or inspection fee." : "CHS has checked and advertises this property."}
        </p>
      </div>
      {tag && <Link href={`${CHS_VERIFY_PATH}/${tag}`} className={`shrink-0 text-[10px] font-bold underline ${managed ? "text-amber-300" : "text-chs-red"}`}>Check this tag</Link>}
    </div>
  );
}

export function ChsSeal({ level, tag, size = 160 }: { level?: string | null; tag?: string | null; size?: number }) {
  if (!isChsStamped(level)) return null;
  const managed = level === "chs_managed";
  const ring = managed ? "#B8860B" : "#2B2B2B";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={`${chsLabel(level)} ${tag ?? ""}`}>
      <defs>
        <path id="chs-top" d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id="chs-bot" d="M 26 100 A 74 74 0 0 0 174 100" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="#fff" stroke={ring} strokeWidth="6" />
      <circle cx="100" cy="100" r="86" fill="none" stroke={ring} strokeWidth="1.5" />
      <circle cx="100" cy="100" r="52" fill={managed ? "#2B2B2B" : "#fff"} stroke={ring} strokeWidth="3" />
      <text fontSize="13" fontWeight="800" fill="#2B2B2B" letterSpacing="2"><textPath href="#chs-top" startOffset="50%" textAnchor="middle">{managed ? "MANAGED & ADVERTISED" : "ADVERTISED BY"}</textPath></text>
      <text fontSize="13" fontWeight="800" fill="#2B2B2B" letterSpacing="3"><textPath href="#chs-bot" startOffset="50%" textAnchor="middle">{tag ?? "CHS"}</textPath></text>
      <text x="100" y="112" textAnchor="middle" fontSize="38" fontWeight="900" fontFamily="serif" fill={managed ? "#F5C542" : "#2B2B2B"}>CHS</text>
      <text x="100" y="128" textAnchor="middle" fontSize="9" fontWeight="700" fill={managed ? "#fff" : "#2B2B2B"} letterSpacing="1">VERIFIED</text>
    </svg>
  );
}
