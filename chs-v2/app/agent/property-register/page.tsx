"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";

// Real, new page per direct client request: a genuine register of
// properties and owners under an agent/manager's real management —
// parallel to the tenant register, confirmed as genuinely missing
// before this.
interface RegisterEntry {
  id: string;
  title: string;
  purpose: string;
  status: string;
  street_address: string | null;
  location_area: string;
  location_state: string;
  agent_commission_pct: number | null;
  owner_name: string;
  owner_phone: string;
}

export default function PropertyRegisterPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    supabase.rpc("get_my_managed_property_register").then(({ data }) => {
      setEntries(data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10 zone-agent">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/agent" className="text-xs text-white/70">← Back to Agent dashboard</Link>
        <RoleBadge label="Agent" />
        <h1 className="font-serif text-lg font-bold mt-1">My Properties &amp; Owners Register</h1>
        <p className="text-xs text-white/60 mt-1">{entries.length} real propert{entries.length === 1 ? "y" : "ies"} under your management</p>
      </div>

      <div className="px-4 py-4 space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No properties under your management yet.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-chs-charcoal">{e.title}</p>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-gray-500 bg-gray-100">{e.status}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {e.street_address ? `${e.street_address}, ` : ""}{e.location_area}, {e.location_state}
              </p>
              <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-chs-charcoal">👤 {e.owner_name}</p>
                  <a href={`tel:${e.owner_phone}`} className="text-[10px] text-chs-red underline">{e.owner_phone}</a>
                </div>
                {e.agent_commission_pct != null && (
                  <p className="text-[10px] font-bold text-chs-charcoal">{e.agent_commission_pct}% agreed</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
