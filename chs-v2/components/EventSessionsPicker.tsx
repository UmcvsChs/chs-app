"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { QSession, Rules, Sess, fmtDay, fmtHours, fmtTime, timeOptions } from "@/lib/eventSessions";

// The guest chooses when the event happens as one or more SESSIONS (a date with a start and end time): a one-day book
// launch is one session; a wedding with a traditional ceremony on Friday and a reception on Saturday is two. A hall
// that is free after an earlier event finishes can be booked for the rest of the same day.

interface Avail { rules: Rules; days: { date: string; full_day: boolean; busy: { from: string; to: string }[] }[] }

export default function EventSessionsPicker({
  propertyId, sessions, onChange, quoted, refreshKey, onRules,
}: {
  propertyId: string;
  sessions: Sess[];
  onChange: (s: Sess[]) => void;
  quoted: QSession[] | null;
  refreshKey: number;
  onRules?: (r: Rules) => void;
}) {
  const [avail, setAvail] = useState<Avail | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }));
  }, []);

  useEffect(() => {
    supabase.rpc("get_event_availability", { p_property_id: propertyId, p_from: null, p_days: 190 }).then(({ data }) => {
      if (data) { setAvail(data as Avail); onRules?.((data as Avail).rules); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, refreshKey]);

  const rules = avail?.rules;
  const hourly = rules ? rules.allow_hourly : true;
  const open = rules?.open || "06:00";
  const close = rules?.close || "24:00";

  function patch(i: number, p: Partial<Sess>) {
    onChange(sessions.map((s, j) => {
      if (j !== i) return s;
      const n = { ...s, ...p };
      if (p.start && n.end && p.start >= n.end) {
        const opts = timeOptions(open, close, "end", p.start);
        n.end = opts.find((o) => o >= (p.start as string)) || opts[0] || n.end;
      }
      return n;
    }));
  }

  function addSession() {
    const last = sessions[sessions.length - 1];
    let next = "";
    if (last?.date) {
      const d = new Date(last.date + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      next = d.toISOString().slice(0, 10);
    }
    onChange([...sessions, { date: next, start: last?.start || "10:00", end: last?.end || "17:00", label: "" }]);
  }

  function busyFor(date: string) {
    return avail?.days.find((d) => d.date === date) || null;
  }

  function matchQuote(s: Sess): QSession | undefined {
    return quoted?.find((q) => q.date === s.date && (!hourly || (q.start === s.start && q.end === s.end)));
  }

  return (
    <div className="space-y-2">
      {rules && (
        <p className="text-[10px] text-gray-500">
          {hourly
            ? `Book by the hour (at least ${rules.min_hours} hours per session). The venue takes bookings from ${fmtTime(rules.open)} to ${fmtTime(rules.close)}, and needs ${rules.setup_min + rules.cleanup_min} minutes between two events for clean-up and set-up.`
            : "This venue is booked by the day: each session takes the whole day."}
          {" "}A two-day event (for example a traditional ceremony on Friday and a reception on Saturday) is two sessions.
        </p>
      )}
      {sessions.map((s, i) => {
        const b = s.date ? busyFor(s.date) : null;
        const q = matchQuote(s);
        return (
          <div key={i} className="border border-gray-200 rounded-xl p-2.5 space-y-1.5 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-chs-charcoal">Session {i + 1}</p>
              {sessions.length > 1 && <button type="button" onClick={() => onChange(sessions.filter((_, j) => j !== i))} className="text-[10px] text-chs-red">Remove</button>}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className={hourly ? "col-span-3 sm:col-span-1" : "col-span-3"}>
                <label className="text-[10px] text-gray-500">Date</label>
                <input type="date" min={today} value={s.date} onChange={(e) => patch(i, { date: e.target.value })} className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white" />
              </div>
              {hourly && (
                <>
                  <div>
                    <label className="text-[10px] text-gray-500">From</label>
                    <select value={s.start} onChange={(e) => patch(i, { start: e.target.value })} className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white">
                      {timeOptions(open, close, "start").map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Until</label>
                    <select value={s.end} onChange={(e) => patch(i, { end: e.target.value })} className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white">
                      {timeOptions(open, close, "end", s.start).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <input value={s.label} onChange={(e) => patch(i, { label: e.target.value })} maxLength={60} placeholder="What happens in this session? (optional, e.g. Traditional ceremony)" className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white" />
            {s.date && b && (
              <p className="text-[10px] text-amber-700">
                {b.full_day ? "This day is fully booked." : `Already taken that day: ${b.busy.map((w) => `${fmtTime(w.from)} to ${fmtTime(w.to)}`).join(", ")}. Pick a time outside this.`}
              </p>
            )}
            {s.date && !b && avail && <p className="text-[10px] text-green-700">✓ The hall is free all day.</p>}
            {q && !q.reason && q.fee > 0 && (
              <p className="text-[10px] text-gray-600">{fmtDay(q.date)}{q.start ? `, ${fmtTime(q.start)} to ${fmtTime(q.end)}` : ""} ({fmtHours(q.mins)}): {formatNaira(q.fee)}</p>
            )}
            {q?.reason && <p className="text-[10px] text-chs-red">{q.reason}</p>}
          </div>
        );
      })}
      {rules && sessions.length < rules.max_sessions && (
        <button type="button" onClick={addSession} className="w-full py-2 rounded-full border border-dashed border-gray-400 text-xs font-semibold text-chs-charcoal">
          + Add another day or session
        </button>
      )}
    </div>
  );
}
