"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import InfoTip from "@/components/InfoTip";

// VAT recording on CHS's own fees. OFF by default. The fee a guest pays does not change: the VAT is treated as
// included in CHS's fee and is recorded in a ledger so the monthly figure to remit is ready.

interface Line { id: string; source: string; booking_id: string | null; fee: number; vat: number; rate: number; reversed: boolean; at: string }
interface Report { period: string; fees: number; vat: number; net: number; reversed_vat: number; lines: Line[] }

export default function AdminVatPanel() {
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState("7.5");
  const [tin, setTin] = useState("");
  const [since, setSince] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<Report | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_vat_settings");
    if (error) { setMsg(error.message); return; }
    const d = data as { enabled: boolean; rate: number; tin: string; since: string };
    setEnabled(d.enabled); setRate(String(d.rate)); setTin(d.tin); setSince(d.since);
  }, []);
  const loadReport = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_vat_report", { p_period: period });
    if (error) { setMsg(error.message); return; }
    setReport(data as Report);
  }, [period]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSettings(); }, [loadSettings]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReport(); }, [loadReport]);

  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("admin_save_vat_settings", { p_enabled: enabled, p_rate: Number(rate), p_tin: tin, p_since: since });
    setBusy(false);
    setMsg(error ? error.message : "Saved.");
  }
  function csv() {
    if (!report) return;
    const rows = ["source,booking,fee,vat,rate,reversed,date", ...report.lines.map(l => [l.source, l.booking_id ?? "", l.fee, l.vat, l.rate, l.reversed, l.at].join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = `chs-vat-${period}.csv`; a.click();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-lg font-bold">VAT on CHS fees <InfoTip term="vat_recording_on_chs_fees" /></h2>
        <p className="text-sm text-gray-600">Switch this on only after CHS is VAT-registered and your accountant confirms the rate. Guests keep paying the same amounts; CHS&apos;s fee is treated as VAT-inclusive and the VAT part is recorded for each fee collected. Fees already collected before you switch it on are not back-filled.</p>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Record VAT on CHS fees</label>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <label>Rate (%)<input className="mt-1 w-full rounded border p-2" value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" /></label>
          <label>CHS tax ID (TIN)<input className="mt-1 w-full rounded border p-2" value={tin} onChange={e => setTin(e.target.value)} /></label>
          <label>Registered since<input type="date" className="mt-1 w-full rounded border p-2" value={since} onChange={e => setSince(e.target.value)} /></label>
        </div>
        <button disabled={busy} onClick={save} className="rounded bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save tax settings</button>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Month<input type="month" className="mt-1 block rounded border p-2" value={period} onChange={e => setPeriod(e.target.value)} /></label>
          <button onClick={csv} className="rounded border px-3 py-2 text-sm font-semibold">Download CSV</button>
        </div>
        {report && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded bg-gray-50 p-3"><div className="text-gray-500">CHS fees collected</div><b>{formatNaira(report.fees)}</b></div>
              <div className="rounded bg-green-50 p-3"><div className="text-gray-500">VAT to remit</div><b>{formatNaira(report.vat)}</b></div>
              <div className="rounded bg-gray-50 p-3"><div className="text-gray-500">Fee excluding VAT</div><b>{formatNaira(report.net)}</b></div>
              <div className="rounded bg-amber-50 p-3"><div className="text-gray-500">Reversed (refunds)</div><b>{formatNaira(report.reversed_vat)}</b></div>
            </div>
            <div className="max-h-80 overflow-auto text-xs">
              <table className="w-full text-left">
                <thead><tr className="text-gray-500"><th>Date</th><th>Type</th><th>Fee</th><th>VAT</th><th></th></tr></thead>
                <tbody>{report.lines.map(l => (
                  <tr key={l.id} className="border-t"><td>{l.at.slice(0, 10)}</td><td>{l.source}</td><td>{formatNaira(l.fee)}</td><td>{formatNaira(l.vat)}</td><td>{l.reversed ? "reversed" : ""}</td></tr>
                ))}</tbody>
              </table>
              {report.lines.length === 0 && <p className="py-3 text-gray-500">Nothing recorded for this month.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
