"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { catInfo, PAY_NOTICE } from "@/components/ServiceCategories";

// Public list of the services a hotel or lodge offers, shown on its page so guests know what is available
// before they book. Prices are the hotel's own guide and are shown only if the hotel entered them.

interface Svc { id: string; category: string; name: string; description: string | null; price_from: number | null; price_note: string | null; capacity: string | null; hours: string | null; bookable: boolean }

export default function PropertyServicesList({ propertyId }: { propertyId: string }) {
  const [list, setList] = useState<Svc[] | null>(null);
  useEffect(() => {
    supabase.rpc("get_offered_services", { p_property_id: propertyId }).then(({ data }) => setList((data as Svc[]) ?? []));
  }, [propertyId]);
  if (!list || list.length === 0) return null;
  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <p className="text-sm font-bold text-chs-charcoal">🏨 Services at this hotel</p>
      <ul className="mt-2 space-y-1.5">
        {list.map((s) => (
          <li key={s.id} className="text-xs">
            <span className="font-semibold">{catInfo(s.category).icon} {s.name}</span>
            <span className="text-gray-600"> {s.price_from ? `· from ${formatNaira(s.price_from)}${s.price_note ? " " + s.price_note : ""}` : "· available"}{s.capacity ? ` · ${s.capacity}` : ""}{s.hours ? ` · ${s.hours}` : ""}</span>
            {s.description && <span className="block text-gray-500">{s.description}</span>}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-500 mt-2">After you book a room you can reserve these from <b>My bookings</b>. {PAY_NOTICE}</p>
    </div>
  );
}
