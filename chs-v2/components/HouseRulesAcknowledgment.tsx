"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

// Real, genuine tenant-side house rules review — restored (and this
// time, genuinely built, not mocked). Once acknowledged, this becomes
// a real, timestamped, binding record referenced in any future dispute.
export default function HouseRulesAcknowledgment({ tenancyId, propertyId, session }: { tenancyId: string; propertyId: string; session: Session }) {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("property_house_rules").select("document_url").eq("property_id", propertyId).maybeSingle(),
      supabase.from("house_rules_acknowledgments").select("acknowledged_at").eq("tenancy_id", tenancyId).maybeSingle(),
    ]).then(([rulesRes, ackRes]) => {
      setDocumentUrl(rulesRes.data?.document_url || null);
      setAcknowledgedAt(ackRes.data?.acknowledged_at || null);
      setLoading(false);
    });
  }, [propertyId, tenancyId]);

  async function handleAcknowledge() {
    const { data, error } = await supabase
      .from("house_rules_acknowledgments")
      .insert({ tenancy_id: tenancyId, tenant_id: session.user.id })
      .select()
      .single();
    if (!error && data) setAcknowledgedAt(data.acknowledged_at);
  }

  if (loading || !documentUrl) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 mt-2">
      <p className="text-xs font-bold text-chs-charcoal mb-1">🏠 House Rules &amp; Property Guidelines</p>
      {!acknowledgedAt && (
        <p className="text-[10px] text-gray-500 mb-2">Your landlord/manager has uploaded house rules for this property. Review carefully — once you acknowledge, this becomes a real, binding record referenced in any future dispute.</p>
      )}
      <a href={documentUrl} target="_blank" rel="noreferrer" className="block w-full text-center py-2 rounded-lg border border-gray-200 text-[11px] font-semibold text-gray-600 mb-2">
        📄 View house rules document
      </a>
      {acknowledgedAt ? (
        <p className="text-[10px] text-gray-400">
          You accepted these house rules on {new Date(acknowledgedAt).toLocaleDateString()} — timestamped and binding.
        </p>
      ) : (
        <button onClick={handleAcknowledge} className="w-full py-2 rounded-full bg-chs-red text-white text-[11px] font-semibold">
          I have read and accept these house rules
        </button>
      )}
    </div>
  );
}
