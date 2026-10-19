"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TeamAdmin = {
  id: string; name: string; phone: string; staff_role: string | null;
  locked: boolean; active: boolean; last_activity: string | null;
  code_requested_at: string | null; has_open_code: boolean;
};
type Invite = { id: string; phone: string; staff_role: string; expires_at: string; used: boolean; revoked: boolean };

const CATEGORIES: [string, string][] = [
  ["customer_care", "Customer Care (disputes, feedback)"],
  ["registration_setup", "Registration & Setup (approvals, face verification)"],
  ["owner_buyer_tenant", "Owner/Buyer/Tenant (properties, applications, sales)"],
  ["agent_relations", "Agent Relations (referral fees)"],
  ["artisan_dev_pm_vendor", "Artisan/Developer/PM/Vendor"],
];

// Super admin only. The ONLY way to create an admin (invite link, 10 minutes,
// bound to the person's phone), and the place to issue login codes (5 minutes),
// unlock a locked admin, or remove an admin. Everything is enforced in the
// database; this screen only calls the checked functions.
export default function AdminTeamPanel({ mode }: { mode: "full" | "requests" }) {
  const supabase = createClient();
  const [admins, setAdmins] = useState<TeamAdmin[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("customer_care");
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expires: number; name: string } | null>(null);
  const [codes, setCodes] = useState<Record<string, { code: string; until: number }>>({});
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_team_overview");
    const d = data as { admins?: TeamAdmin[]; invites?: Invite[] } | null;
    setAdmins(d?.admins ?? []);
    setInvites(d?.invites ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(() => { setNow(Date.now()); }, 1000);
    const r = setInterval(load, 15000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [load]);

  async function createInvite() {
    setMsg(null); setBusy(true);
    const { data, error } = await supabase.rpc("create_admin_invite", { p_phone: phone.trim(), p_staff_role: category });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    const d = data as { token: string; expires_at: string; name: string };
    setLink({ url: `${window.location.origin}/admin-invite/${d.token}`, expires: new Date(d.expires_at).getTime(), name: d.name });
    setPhone("");
    load();
  }
  async function issue(id: string) {
    setMsg(null);
    const { data, error } = await supabase.rpc("admin_issue_code", { p_admin_id: id });
    if (error) { setMsg(error.message); return; }
    setCodes((c) => ({ ...c, [id]: { code: data as string, until: Date.now() + 5 * 60 * 1000 } }));
    load();
  }
  async function unlock(id: string) {
    const { error } = await supabase.rpc("admin_unlock", { p_admin_id: id });
    if (error) setMsg(error.message); else { setMsg("Unlocked. Issue a new code."); load(); }
  }
  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} as admin? Their access stops immediately.`)) return;
    const { error } = await supabase.rpc("remove_admin", { p_admin_id: id });
    if (error) setMsg(error.message); else { setMsg(`${name} was removed as admin.`); load(); }
  }

  const waiting = admins.filter((a) => a.code_requested_at && !a.active && !a.locked && now - new Date(a.code_requested_at).getTime() < 10 * 60 * 1000);
  const secsLeft = (t: number) => Math.max(0, Math.floor((t - now) / 1000));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const CodeRow = ({ a }: { a: TeamAdmin }) => {
    const c = codes[a.id];
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-2.5 mb-1.5">
        <div className="flex justify-between items-center gap-2">
          <div>
            <p className="text-xs text-chs-charcoal">{a.name} — {a.phone}</p>
            <p className="text-[9px] text-gray-500 capitalize">
              {a.staff_role?.replace(/_/g, " ")} · {a.locked ? "LOCKED" : a.active ? "logged in" : "not logged in"}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {a.locked ? (
              <button onClick={() => unlock(a.id)} className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold">Unlock</button>
            ) : (
              <button onClick={() => issue(a.id)} className="px-3 py-1.5 rounded-full bg-green-600 text-white text-[10px] font-semibold">Issue code</button>
            )}
            {mode === "full" && (
              <button onClick={() => remove(a.id, a.name)} className="px-3 py-1.5 rounded-full bg-gray-300 text-gray-700 text-[10px] font-semibold">Remove</button>
            )}
          </div>
        </div>
        {c && secsLeft(c.until) > 0 && (
          <div className="mt-2 bg-chs-charcoal rounded-lg px-3 py-2 text-center">
            <p className="text-[9px] text-white/60 uppercase">Read this code to {a.name} (works once, {mmss(secsLeft(c.until))} left)</p>
            <p className="text-2xl font-bold text-white tracking-[0.3em]">{c.code}</p>
          </div>
        )}
      </div>
    );
  };

  if (mode === "requests") {
    if (waiting.length === 0) return null;
    return (
      <div className="col-span-2 bg-red-50 border-2 border-red-200 rounded-xl p-4">
        <p className="text-sm font-bold text-red-700 mb-2">🔐 Admins asking for a login code</p>
        {waiting.map((a) => <CodeRow key={a.id} a={a} />)}
        {msg && <p className="text-xs text-chs-red mt-1">{msg}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 space-y-2 mb-4">
        <p className="text-sm font-bold text-chs-charcoal">✉️ Invite an admin</p>
        <p className="text-[10px] text-gray-400">
          The only way to create an admin. The person must first sign up normally on CHS with their own phone number. The link works for 10 minutes, once, and only for that phone number.
        </p>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Their phone number (as registered)"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={createInvite} disabled={busy || !phone.trim()} className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
          {busy ? "Creating..." : "Create 10-minute invite link"}
        </button>
        {link && secsLeft(link.expires) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-[10px] text-amber-800 font-semibold">Link for {link.name} — expires in {mmss(secsLeft(link.expires))}</p>
            <p className="text-[11px] break-all text-chs-charcoal my-1 select-all">{link.url}</p>
            <button onClick={() => navigator.clipboard?.writeText(link.url)} className="text-[11px] font-semibold text-chs-red">Copy link</button>
          </div>
        )}
        {link && secsLeft(link.expires) === 0 && <p className="text-xs text-gray-500">The last link has expired. Create a new one if needed.</p>}
        {msg && <p className="text-xs text-chs-red">{msg}</p>}
      </div>

      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Staff admins</p>
      {admins.length === 0 ? <p className="text-xs text-gray-400 mb-3">No staff admins. Only you hold admin access.</p> : admins.map((a) => <CodeRow key={a.id} a={a} />)}

      <p className="text-[10px] font-bold text-gray-400 uppercase mt-4 mb-1.5">Recent invites</p>
      {invites.length === 0 ? <p className="text-xs text-gray-400">None yet.</p> : invites.map((i) => (
        <p key={i.id} className="text-[11px] text-gray-600 mb-0.5">
          {i.phone} · {i.staff_role.replace(/_/g, " ")} · {i.used ? "used" : i.revoked ? "replaced" : new Date(i.expires_at).getTime() > now ? "open" : "expired"}
        </p>
      ))}
    </div>
  );
}
