"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ValidatedInput from "@/components/ValidatedInput";
import { validatePhone } from "@/lib/validators";
import { formatDateTime } from "@/lib/format";

// Team: people the owner trusts to run the property. They must already have a CHS account. Each has a
// role (what they can do) and, optionally, the properties they work at (none picked = every property).
// Nobody on the team can see the owner's wallet or earnings.
interface StaffRow { id: string; name: string; phone: string; role: string; added_at: string; property_ids: string[] }
interface Prop { id: string; title: string }

export const STAFF_ROLES: { key: string; label: string; can: string }[] = [
  { key: "manager", label: "Manager", can: "Assigns duties, reads shift reports, runs front desk, housekeeping and repairs, sees the financial report and records expenses." },
  { key: "front_desk", label: "Front desk", can: "Arrivals board, check-in, housekeeping, repairs and recording income." },
  { key: "housekeeping", label: "Housekeeping", can: "Housekeeping board, repairs and their own duties." },
  { key: "kitchen_bar", label: "Kitchen / bar", can: "Records restaurant and bar income, repairs and their own duties." },
  { key: "accountant", label: "Accountant", can: "Financial report, ledger and expenses. No front desk." },
];
const roleLabel = (k: string) => STAFF_ROLES.find((r) => r.key === k)?.label || k;

export default function HostStaffManager() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("front_desk");
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("front_desk");
  const [editPicked, setEditPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([supabase.rpc("get_my_staff"), supabase.rpc("get_my_work_properties")]);
    setStaff((s.data as StaffRow[]) || []);
    setProps(((p.data as { id: string; title: string; role: string }[]) || []).filter((x) => x.role === "owner").map((x) => ({ id: x.id, title: x.title })));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function add() {
    setErr(null); setMsg(null);
    const v = validatePhone(phone, { international: true });
    if (!v.valid) { setErr(v.message); return; }
    const { error } = await supabase.rpc("host_add_staff_v2", { p_phone: v.value, p_role: role, p_property_ids: picked.length ? picked : null });
    if (error) { setErr(error.message); return; }
    setPhone(""); setPicked([]); setMsg("Added. They have been notified and can open their Work page.");
    load();
  }

  async function saveEdit(id: string) {
    setErr(null); setMsg(null);
    const { error } = await supabase.rpc("host_update_staff", { p_staff_row: id, p_role: editRole, p_property_ids: editPicked.length ? editPicked : null });
    if (error) { setErr(error.message); return; }
    setEditing(null); setMsg("Saved."); load();
  }

  function renderProps(selected: string[], set: (v: string[]) => void) {
    if (props.length < 2) return null;
    return (
      <div className="mt-1">
        <p className="text-[10px] text-gray-500">Works at (leave all unticked for every property):</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {props.map((p) => (
            <button key={p.id} type="button" onClick={() => set(toggle(selected, p.id))} className={`text-[10px] px-2 py-0.5 rounded-full border ${selected.includes(p.id) ? "bg-chs-charcoal text-white border-chs-charcoal" : "border-gray-300 text-chs-charcoal"}`}>{p.title}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
      <p className="text-xs font-bold text-chs-charcoal">👥 My team</p>
      <p className="text-[10px] text-gray-500 mb-2">Add staff by the phone number on their CHS account and give each a role. They cannot see your wallet or earnings.</p>
      {staff.map((s) => (
        <div key={s.id} className="text-[11px] bg-gray-50 rounded-lg px-2 py-1.5 mb-1">
          <div className="flex justify-between items-center">
            <span className="text-chs-charcoal">{s.name} · {s.phone} · <b>{roleLabel(s.role)}</b></span>
            <span className="flex gap-2">
              <button type="button" onClick={() => { setEditing(editing === s.id ? null : s.id); setEditRole(s.role); setEditPicked(s.property_ids); }} className="underline text-[10px]">Edit</button>
              <button type="button" onClick={async () => { if (!window.confirm(`Remove ${s.name} from your team?`)) return; await supabase.rpc("host_remove_staff", { p_staff_row: s.id }); load(); }} className="text-chs-red underline text-[10px]">Remove</button>
            </span>
          </div>
          <p className="text-[9px] text-gray-400">Added {formatDateTime(s.added_at)}{s.property_ids.length ? ` · ${s.property_ids.length} property(ies)` : " · all properties"}</p>
          {editing === s.id && (
            <div className="mt-1">
              <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[11px]">{STAFF_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
              <p className="text-[10px] text-gray-500 mt-0.5">{STAFF_ROLES.find((r) => r.key === editRole)?.can}</p>
              {renderProps(editPicked, setEditPicked)}
              <button type="button" onClick={() => saveEdit(s.id)} className="mt-1 px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">Save</button>
            </div>
          )}
        </div>
      ))}
      <div className="mt-1.5 space-y-1">
        <div className="flex gap-1.5">
          <div className="flex-1"><ValidatedInput kind="phoneIntl" value={phone} onChange={setPhone} placeholder="Staff phone, 08XXXXXXXXX" className="w-full px-2 py-1.5 rounded text-[11px]" /></div>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-gray-300 rounded px-2 text-[11px]">{STAFF_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
        </div>
        <p className="text-[10px] text-gray-500">{STAFF_ROLES.find((r) => r.key === role)?.can}</p>
        {renderProps(picked, setPicked)}
        <button type="button" onClick={add} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">Add to team</button>
      </div>
      {msg && <p className="text-[10px] text-green-700 mt-1">{msg}</p>}
      {err && <p className="text-[10px] text-chs-red mt-1">{err}</p>}
    </div>
  );
}
