"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ValidatedInput from "@/components/ValidatedInput";
import { validatePhone } from "@/lib/validators";

// Front-desk staff: people the host trusts to check guests in. They must
// already have a CHS account. They can open the arrivals board for the host's
// hotels and nothing else (no wallet, no earnings).
interface StaffRow { id: string; name: string; phone: string }

export default function HostStaffManager() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_staff");
    setStaff((data as StaffRow[]) || []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add() {
    setErr(null); setMsg(null);
    const v = validatePhone(phone, { international: true });
    if (!v.valid) { setErr(v.message); return; }
    const { error } = await supabase.rpc("host_add_staff", { p_phone: v.value });
    if (error) { setErr(error.message); return; }
    setPhone(""); setMsg("Added. They can now open the arrivals board.");
    load();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
      <p className="text-xs font-bold text-chs-charcoal">👥 Front-desk staff</p>
      <p className="text-[10px] text-gray-500 mb-2">Add a receptionist by the phone number on their CHS account. They can verify arrival passes and check guests in. They cannot see your wallet or earnings.</p>
      {staff.map((s) => (
        <div key={s.id} className="flex justify-between items-center text-[11px] bg-gray-50 rounded-lg px-2 py-1.5 mb-1">
          <span className="text-chs-charcoal">{s.name} · {s.phone}</span>
          <button type="button" onClick={async () => { await supabase.rpc("host_remove_staff", { p_staff_row: s.id }); load(); }} className="text-chs-red underline text-[10px]">Remove</button>
        </div>
      ))}
      <div className="flex gap-1.5 mt-1.5">
        <div className="flex-1"><ValidatedInput kind="phoneIntl" value={phone} onChange={setPhone} placeholder="Staff phone, 08XXXXXXXXX" className="w-full px-2 py-1.5 rounded text-[11px]" /></div>
        <button type="button" onClick={add} className="px-3 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">Add</button>
      </div>
      {msg && <p className="text-[10px] text-green-700 mt-1">{msg}</p>}
      {err && <p className="text-[10px] text-chs-red mt-1">{err}</p>}
    </div>
  );
}
