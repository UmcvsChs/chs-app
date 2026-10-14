"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import InfoTip from "@/components/InfoTip";

// Seating floor plans: a small diagram for each layout the venue offers. The guest picks one for their event and
// the venue is told. editable=false just shows the choice (host side).
function Plan({ kind }: { kind: string }) {
  const dots: [number, number][] = [];
  const shapes: React.ReactNode[] = [];
  if (kind.startsWith("Banquet")) {
    [[20, 18], [50, 18], [80, 18], [20, 46], [50, 46], [80, 46]].forEach(([x, y], i) => {
      shapes.push(<circle key={i} cx={x} cy={y} r={7} fill="#cbd5e1" />);
      for (let a = 0; a < 6; a++) dots.push([x + 11 * Math.cos((a * Math.PI) / 3), y + 11 * Math.sin((a * Math.PI) / 3)]);
    });
  } else if (kind === "Theatre") {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) dots.push([14 + c * 9, 10 + r * 9]);
    shapes.push(<rect key="s" x={30} y={0} width={40} height={4} fill="#94a3b8" />);
  } else if (kind === "Classroom") {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { shapes.push(<rect key={`${r}${c}`} x={14 + c * 28} y={14 + r * 16} width={22} height={6} fill="#cbd5e1" />); dots.push([25 + c * 28, 26 + r * 16]); }
  } else if (kind === "U-shape") {
    shapes.push(<path key="u" d="M20 10 H80 M20 10 V50 M80 10 V50" stroke="#cbd5e1" strokeWidth={6} fill="none" />);
    for (let i = 0; i < 6; i++) { dots.push([14, 14 + i * 7]); dots.push([86, 14 + i * 7]); }
  } else if (kind === "Boardroom") {
    shapes.push(<rect key="t" x={20} y={22} width={60} height={14} fill="#cbd5e1" />);
    for (let i = 0; i < 6; i++) { dots.push([26 + i * 10, 18]); dots.push([26 + i * 10, 40]); }
  } else {
    for (let i = 0; i < 28; i++) dots.push([12 + (i % 7) * 12 + (Math.floor(i / 7) % 2) * 4, 10 + Math.floor(i / 7) * 12]);
  }
  return (
    <svg viewBox="0 0 100 60" className="w-full h-14 bg-gray-50 rounded" aria-label={kind}>
      {shapes}
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} fill="#475569" />)}
    </svg>
  );
}

export default function SeatingPicker({ bookingId, editable = true }: { bookingId: string; editable?: boolean }) {
  const [layouts, setLayouts] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [guests, setGuests] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_booking_seating", { p_booking: bookingId });
    const d = data as { layouts: string[]; chosen: string | null; caps?: Record<string, number>; guests?: number | null } | null;
    setCaps(d?.caps || {}); setGuests(d?.guests ?? null);
    setLayouts(d?.layouts || []); setChosen(d?.chosen ?? null);
  }, [bookingId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function pick(l: string) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("set_booking_seating", { p_booking: bookingId, p_layout: l });
    setBusy(false);
    if (error) setErr(error.message); else setChosen(l);
  }

  if (layouts.length === 0 && !chosen) return null;
  if (!editable) return chosen ? <p className="text-[11px] font-semibold text-chs-charcoal">🪑 Seating: {chosen}</p> : null;
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2.5">
      <p className="text-xs font-bold">🪑 Choose your seating layout <InfoTip term="seating_layouts_and_diagrams" /></p>
      <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {layouts.map((l) => (
          <button key={l} disabled={busy || (guests != null && caps[l] != null && guests > caps[l])} onClick={() => pick(l)} className={`rounded-lg border p-1.5 text-left disabled:opacity-40 ${chosen === l ? "border-green-600 ring-1 ring-green-600" : "border-gray-200"}`}>
            <Plan kind={l} />
            <span className="mt-1 block text-[10px] font-semibold">{chosen === l ? "✓ " : ""}{l}{caps[l] ? ` · up to ${caps[l]}` : ""}</span>
          </button>
        ))}
      </div>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
