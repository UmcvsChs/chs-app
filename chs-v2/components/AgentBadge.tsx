"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// "CHS-approved agent". Drawn only from what the database says (an admin approved this agent and the agent is still
// verified and in good standing), so an agent cannot put it on themselves. Anyone can check the agent ID.
export interface AgentBadgeData { approved: boolean; chs_agent_id?: string; entity_name?: string; reg_body?: string; reg_number?: string; since?: string; valid_until?: string; deals?: number }
export const REG_BODY_LABEL: Record<string, string> = { CAC_COMPANY: "CAC-registered company", ESVARBON_FIRM: "ESVARBON-registered firm", QSRBN_FIRM: "QSRBN-registered firm" };

export function useAgentBadge(agentId?: string | null) {
  const [badge, setBadge] = useState<AgentBadgeData | null>(null);
  useEffect(() => {
    if (!agentId) return;
    let live = true;
    supabase.rpc("get_agent_badge", { p_agent: agentId }).then(({ data }) => { if (live) setBadge(data as AgentBadgeData); });
    return () => { live = false; };
  }, [agentId]);
  return agentId ? badge : null;
}

export function AgentBadgeChip() {
  return <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-1 rounded-full bg-chs-charcoal text-amber-300 border border-amber-300"><span aria-hidden>✔</span>CHS-APPROVED AGENT</span>;
}

export default function AgentBadgeStrip({ agentId }: { agentId?: string | null }) {
  const badge = useAgentBadge(agentId);
  if (!badge?.approved) return null;
  return (
    <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-chs-charcoal text-white px-3 py-2.5 flex items-center gap-3">
      <span className="text-xl" aria-hidden>✔</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold text-amber-300">Listed by a CHS-approved agent</p>
        <p className="text-[11px]">{badge.entity_name} · <span className="font-mono">{badge.chs_agent_id}</span></p>
        <p className="text-[10px] text-white/70">{REG_BODY_LABEL[badge.reg_body ?? ""] ?? "Registered body"} {badge.reg_number}. CHS checked its registration, directors and track record. Pay only through your CHS account.</p>
      </div>
      <Link href={`/verify-agent/${badge.chs_agent_id}`} className="shrink-0 text-[10px] font-bold underline text-amber-300">Check this agent</Link>
    </div>
  );
}

