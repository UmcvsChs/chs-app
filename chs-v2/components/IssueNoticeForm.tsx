"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { NOTICE_TYPE_LABELS, NOTICE_CATEGORY_FIELDS } from "@/types/formalNotice";

function generateReference(): string {
  return "CHS-NOTICE-" + Math.floor(1000 + Math.random() * 9000);
}

export default function IssueNoticeForm({
  tenancyId,
  tenantId,
  session,
  onSuccess,
  onCancel,
}: {
  tenancyId: string;
  tenantId: string;
  session: Session;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [noticeType, setNoticeType] = useState<"sale" | "renovation" | "rent_review" | "quit" | "warning" | "query">("sale");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegalWarning, setShowLegalWarning] = useState(false);
  const [legalWarningAcknowledged, setLegalWarningAcknowledged] = useState(false);

  const categoryFields = NOTICE_CATEGORY_FIELDS[noticeType] || [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // A notice to quit must state a reason — this protects both the
    // owner and the tenant if it's ever disputed, matching the exact
    // real requirement from the original app.
    if (noticeType === "quit" && !fieldValues.reason?.trim()) {
      setError("A notice to quit must state a reason — this protects both you and the tenant if it's ever disputed.");
      return;
    }
    // Real, sourced legal safeguard: under Nigerian tenancy law, a
    // yearly tenant (the standard CHS tenancy) is entitled to a real
    // 6-month notice to quit — a shorter notice has genuinely been
    // struck down in real Nigerian case law (e.g. ODIGBO v. ABUBAKAR).
    // Real, narrow exceptions do exist (rent arrears, misconduct), so
    // this warns clearly rather than blocking outright.
    if (noticeType === "quit" && fieldValues.vacate_by && !legalWarningAcknowledged) {
      const daysNotice = Math.ceil((new Date(fieldValues.vacate_by).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysNotice < 180) {
        setShowLegalWarning(true);
        setError(`Under Nigerian tenancy law, a yearly tenant is entitled to at least 6 months' (180 days) real notice — this is only ${daysNotice} real days. A shorter notice may be legally invalid unless a real exception applies (e.g. genuine rent arrears or tenant misconduct). Please confirm below if you have a valid legal reason to proceed anyway.`);
        return;
      }
    }
    if (noticeType === "warning" && !fieldValues.reason?.trim()) {
      setError("A formal warning must state what it's about — this protects both you and the tenant if it's ever disputed.");
      return;
    }
    if (noticeType === "query" && !fieldValues.subject?.trim()) {
      setError("A query must state its subject clearly.");
      return;
    }
    setError(null);
    setSubmitting(true);

    // Build a details object keyed by real field label, matching the
    // original's own real structure, so what's displayed later reads
    // naturally rather than as raw field IDs.
    const details: Record<string, string> = {};
    categoryFields.forEach((f) => {
      details[f.label] = fieldValues[f.id] || "";
    });

    const { data: notice, error: insertError } = await supabase
      .from("formal_notices")
      .insert({
        reference: generateReference(),
        tenancy_id: tenancyId,
        notice_type: noticeType,
        details,
        issued_by: session.user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError("Could not issue this notice. Please try again.");
      setSubmitting(false);
      return;
    }

    // A real notification to the real tenant — matching the original
    // app's exact behaviour, so this isn't just recorded silently.
    if (notice) {
      await supabase.rpc("notify_user", {
        p_user_id: tenantId,
        p_title: NOTICE_TYPE_LABELS[noticeType],
        p_body: `Your landlord has issued a formal notice (Ref ${notice.reference}). Open your Tenant dashboard to view the full details.`,
        p_link: "/tenant",
      });
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-[10px] text-gray-400">
        Recorded permanently — this stays on your tenant&apos;s account as proof of delivery. Once issued, a notice cannot be edited or deleted.
      </p>

      <div>
        <label className="text-xs font-semibold text-gray-600">Notice type</label>
        <select
          value={noticeType}
          onChange={(e) => { setNoticeType(e.target.value as typeof noticeType); setFieldValues({}); }}
          className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
        >
          {Object.entries(NOTICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {categoryFields.map((f) => (
        <div key={f.id}>
          <label className="text-xs font-semibold text-gray-600">{f.label}</label>
          {f.type === "select" ? (
            <select
              value={fieldValues[f.id] || ""}
              onChange={(e) => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="">Select...</option>
              {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.type === "date" ? "date" : "text"}
              value={fieldValues[f.id] || ""}
              onChange={(e) => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          )}
        </div>
      ))}

      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
      {showLegalWarning && (
        <label className="flex items-start gap-2 bg-white border border-chs-amber-dark rounded-lg p-2.5">
          <input type="checkbox" checked={legalWarningAcknowledged} onChange={(e) => { setLegalWarningAcknowledged(e.target.checked); setError(null); }} className="mt-0.5" />
          <span className="text-[11px] text-gray-600">I confirm I have a genuine legal reason for a shorter notice period (e.g. real rent arrears or documented tenant misconduct), and wish to proceed.</span>
        </label>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
          {submitting ? "Issuing..." : "Issue notice"}
        </button>
      </div>
    </form>
  );
}
