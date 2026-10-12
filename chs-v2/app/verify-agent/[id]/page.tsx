import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AgentBadgeChip } from "@/components/AgentBadge";

export const dynamic = "force-dynamic";

interface Result { found: boolean; approved?: boolean; chs_agent_id?: string; entity_name?: string; reg_body?: string; reg_number?: string; since?: string; valid_until?: string; deals?: number }
const BODY: Record<string, string> = { CAC_COMPANY: "a company registered with the CAC", ESVARBON_FIRM: "a firm registered with ESVARBON", QSRBN_FIRM: "a firm registered with QSRBN" };
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }) : "");

export default async function VerifyAgentResult({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_chs_agent", { p_chs_agent_id: id });
  const r = (data as Result | null) ?? { found: false };

  let tone = "red"; let heading = "CHS has no agent with this ID"; let body = "Do not pay any fee, deposit or inspection fee to anyone using this ID.";
  if (r.found && r.approved) { tone = "green"; heading = "Genuine: CHS-approved agent"; body = `${r.entity_name} is ${BODY[r.reg_body ?? ""] ?? "a registered body"}, number ${r.reg_number}. CHS verified its owners and registration and approved it on ${fmt(r.since)}. The approval runs to ${fmt(r.valid_until)}.`; }
  else if (r.found) { tone = "amber"; heading = "Not currently approved"; body = "This agent is registered with CHS but does not hold the CHS-approved badge right now. Be careful, and pay only through your CHS account."; }
  const colors: Record<string, string> = { green: "bg-green-50 border-green-300 text-green-800", amber: "bg-amber-50 border-amber-300 text-amber-800", red: "bg-red-50 border-red-300 text-red-800" };

  return (
    <div className="min-h-screen bg-[var(--zone-bg)]">
      <div className="bg-chs-charcoal text-white px-4 py-3"><Link href="/verify-agent" className="text-sm">← Check another agent</Link></div>
      <div className="px-4 py-6 max-w-md mx-auto">
        <div className={`rounded-xl border-2 p-4 ${colors[tone]}`}>
          <p className="text-[11px] font-mono mb-1">{id.toUpperCase()}</p>
          <h1 className="font-serif text-lg font-bold">{tone === "green" ? "✓ " : tone === "amber" ? "⚠ " : "✕ "}{heading}</h1>
          <p className="text-xs mt-1">{body}</p>
        </div>
        {r.found && r.approved && <div className="mt-4 flex justify-center"><AgentBadgeChip /></div>}
        <p className="text-[11px] text-gray-500 mt-6">An approved agent is still not CHS. Confirm the agent&apos;s ID here, and pay only through your CHS account so you get a receipt. CHS will never ask you to pay into a personal account.</p>
      </div>
    </div>
  );
}
