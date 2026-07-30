import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { DemandEntry } from "@/types/demandRegistry";
import { formatNaira } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketDemandPage() {
  const supabase = await createClient();
  const { data: demand } = await supabase
    .from("demand_registry")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const entries = (demand || []) as DemandEntry[];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <h1 className="font-serif text-lg font-bold mt-1">What people are looking for</h1>
        <p className="text-xs text-white/60 mt-1">Real, anonymous demand signals — genuinely useful for deciding what to list</p>
      </div>

      <div className="px-4 py-4 space-y-2">
        {entries.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">No demand recorded yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-sm text-chs-charcoal">{entry.search_summary}</p>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                {entry.area_filter && <span>{entry.area_filter}</span>}
                {(entry.min_price || entry.max_price) && (
                  <span>
                    {entry.min_price ? formatNaira(entry.min_price) : "Any"} — {entry.max_price ? formatNaira(entry.max_price) : "Any"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
