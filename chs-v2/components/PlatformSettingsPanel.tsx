"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Real, new component for the Super-Admin-only "Settings" sidebar
// destination — every real, currently-configured platform setting
// (commission rates, fees, and similar), directly editable rather
// than requiring a database migration for a routine rate change.
export default function PlatformSettingsPanel() {
  const [settings, setSettings] = useState<{ key: string; value: string }[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value").order("key", { ascending: true })
      .then(({ data }) => setSettings(data || []));
  }, []);

  async function handleSave(key: string) {
    const newValue = editing[key];
    if (newValue === undefined) return;
    setSavingKey(key);
    setSavedKey(null);
    const { error } = await supabase.from("platform_settings").update({ value: newValue }).eq("key", key);
    setSavingKey(null);
    if (!error) {
      setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value: newValue } : s)));
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    }
  }

  const filtered = settings.filter((s) => s.key.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
        ⚙️ Every real, currently-configured platform setting — commission rates, fees, and similar. Edit and save directly; changes apply immediately, platform-wide.
      </p>
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search settings, e.g. commission" className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
      {filtered.map((s) => (
        <div key={s.key} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{s.key.replace(/_/g, " ")}</p>
          <div className="flex gap-2">
            <input type="text" value={editing[s.key] ?? s.value}
              onChange={(e) => setEditing({ ...editing, [s.key]: e.target.value })}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <button onClick={() => handleSave(s.key)} disabled={savingKey === s.key}
              className="px-3 py-1.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
              {savingKey === s.key ? "..." : savedKey === s.key ? "✓ Saved" : "Save"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
