"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Shown to the owner on a listing that is not live yet: exactly what is still missing, with a link to fix it.
export default function ListingGapsNotice({ propertyId }: { propertyId: string }) {
  const [gaps, setGaps] = useState<string[]>([]);
  useEffect(() => {
    supabase.rpc("get_listing_gaps", { p_property_id: propertyId }).then(({ data }) => setGaps((data as string[]) || []));
  }, [propertyId]);
  if (gaps.length === 0) return null;
  return (
    <div className="mt-1.5 rounded-lg bg-chs-amber-light px-2.5 py-1.5 text-[10px] text-chs-charcoal">
      <span className="font-semibold">Cannot go live yet. Still needed: </span>{gaps.join(", ")}.{" "}
      <Link href={`/edit-listing/${propertyId}`} className="underline font-semibold">Add it now</Link>
    </div>
  );
}
