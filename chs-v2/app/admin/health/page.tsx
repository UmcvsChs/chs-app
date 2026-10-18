"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

type Alert = { id: string; kind: string; summary: string; created_at: string };
type Json = Record<string, unknown>;

// Super-admin only: real security alerts, real reminder delivery results,
// and the split between real data and test data. Every figure comes from
// the database; nothing here is typed in.
export default function AdminHealthPage() {
  const router = useRouter();
  const supabase = createClient();
  const { session, profile, loading: authLoading } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reminders, setReminders] = useState<Json | null>(null);
  const [testData, setTestData] = useState<Json | null>(null);
  const [error, setError] = useState("");
  const isSuper = profile?.role === "admin" && profile?.is_super_admin;

  const load = useCallback(async () => {
    const a = await supabase.rpc("admin_security_alerts", { p_only_open: true });
    if (a.error) setError(a.error.message); else setAlerts((a.data as Alert[]) ?? []);
    const r = await supabase.rpc("admin_reminder_delivery_report");
    if (!r.error) setReminders(r.data as Json);
    const t = await supabase.rpc("admin_test_data_summary");
    if (!t.error) setTestData(t.data as Json);
  }, [supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!session || !isSuper) { router.push("/"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, session, isSuper, router, load]);

  async function ack(id: string) {
    await supabase.rpc("admin_acknowledge_alert", { p_id: id });
    load();
  }

  if (authLoading || !session || !isSuper) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  const byStatus = (reminders?.by_status ?? {}) as Record<string, number>;
  const failures = (reminders?.recent_failures ?? []) as { reminder_type: string; sent_at: string; delivery_results: Json }[];

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-admin pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/admin" className="text-xs text-white/70">← Back to Admin Dashboard</Link>
        <h1 className="font-serif text-lg font-bold mt-1">🛡️ Platform health</h1>
        <p className="text-xs text-white/60 mt-1">Security alerts, message delivery, test data — super admin only</p>
      </div>
      <div className="px-4 py-4 space-y-4">
        {error && <p className="text-xs text-red-600">{error}</p>}

        <section className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-chs-charcoal mb-2">Open security alerts ({alerts.length})</p>
          {alerts.length === 0 && <p className="text-xs text-gray-400">No open alerts.</p>}
          {alerts.map((a) => (
            <div key={a.id} className="border-t border-gray-100 py-2">
              <p className="text-xs text-chs-charcoal">{a.summary}</p>
              <p className="text-[10px] text-gray-400">{a.kind} · {new Date(a.created_at).toLocaleString()}</p>
              <button onClick={() => ack(a.id)} className="text-[11px] text-chs-red mt-1">I have reviewed this</button>
            </div>
          ))}
        </section>

        <section className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-chs-charcoal mb-2">Reminder delivery (email / SMS / WhatsApp)</p>
          <p className="text-xs text-gray-600">
            Sent: {byStatus.sent ?? 0} · Failed: {byStatus.failed ?? 0} · Waiting: {byStatus.pending ?? 0} · Overdue: {String(reminders?.overdue_pending ?? 0)}
          </p>
          {failures.map((f, i) => (
            <p key={i} className="text-[10px] text-gray-500 border-t border-gray-100 mt-2 pt-1 break-words">
              {f.reminder_type} · {f.sent_at ? new Date(f.sent_at).toLocaleString() : ""} · {JSON.stringify(f.delivery_results)}
            </p>
          ))}
        </section>

        <section className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-chs-charcoal mb-2">Real data vs test data</p>
          {testData && (
            <div className="text-xs text-gray-600 space-y-1">
              <p>Accounts: {String(testData.real_accounts)} real · {String(testData.test_accounts)} test</p>
              <p>Properties: {String(testData.real_properties)} real · {String(testData.test_properties)} test (hidden from the public)</p>
              <p>Test vendors / products: {String(testData.test_vendors)} / {String(testData.test_products)}</p>
              <p>Wallet money: ₦{Number(testData.real_wallet_money).toLocaleString()} real · ₦{Number(testData.test_wallet_money).toLocaleString()} test (not real money)</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
