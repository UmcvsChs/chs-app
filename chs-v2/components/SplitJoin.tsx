"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Chip in toward someone else's booking: enter a code, and see what you have put in.
interface Mine { id: string; amount: number; status: string; returned_back: number; title: string; check_in: string; code: string; split_status: string; organiser: string }
const STATE: Record<string, string> = { held: "Held until the full amount is raised", applied: "Paid toward the booking", returned: "Returned to your wallet" };

export default function SplitJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);
  useEffect(() => {
    supabase.rpc("get_my_split_contributions").then(({ data }) => setMine((data as Mine[]) || []));
  }, []);
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-chs-charcoal">Helping someone pay?</p>
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="Enter the payment code" className="flex-1 border border-gray-300 rounded-full px-3 py-2 text-xs tracking-widest" />
        <button disabled={code.length < 4} onClick={() => router.push(`/split/${code}`)} className="px-4 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">Open</button>
      </div>
      {mine.map((m) => (
        <Link key={m.id} href={`/split/${m.code}`} className="block bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-semibold text-chs-charcoal">{m.title} · for {m.organiser}</p>
          <p className="text-[11px] text-gray-500">{formatNaira(m.amount)} · {STATE[m.status] || m.status}{m.returned_back ? ` · ${formatNaira(m.returned_back)} shared back from a refund` : ""}</p>
        </Link>
      ))}
    </div>
  );
}
