"use client";

// Real, new component per direct client design request — a genuine,
// permanent left sidebar (matching the vertical bar shown in both
// their Word reference and their own hand-drawn sketch), listing the
// ten specific items named, in the exact order confirmed: Notification,
// Quick Search, Sub-Admin Activities, Customer Care, Assign Role to
// Staff, Staff Daily Report, Sub-Admin's Daily Report, Sub-Admin
// Panel, Settings, Audit Trail.
//
// Deliberately narrower in scope than the existing ~25-tab horizontal
// bar, which stays exactly as it was for day-to-day operational work
// (Sale Approvals, Face Verification, Properties, and the rest) — the
// client named these ten specific items, not a request to migrate
// everything.
//
// Uses CHS's own real, established brand colors rather than the blue
// shown in the Word reference, per direct instruction ("that doesn't
// mean we should use that blue color... one of those colors that is
// familiar or synchronized with this present design").
//
// Real, permanent width, genuinely wider than a typical icon-only
// sidebar (per "add half of it to what it is in wideness") — real
// text labels stay visible, not just icons.

import type { Tab } from "@/app/admin/page";

interface SidebarItem {
  key: Tab;
  label: string;
  icon: string;
  superAdminOnly?: boolean;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "notificationsfeed", label: "Notification", icon: "🔔" },
  { key: "trace", label: "Quick Search", icon: "🔎" },
  { key: "subadminactivities", label: "Sub-Admin Activities", icon: "📜" },
  { key: "disputes", label: "Customer Care", icon: "💬" },
  { key: "assignrole", label: "Assign Role to Staff", icon: "👥" },
  { key: "staffreports", label: "Staff Daily Report", icon: "📋" },
  { key: "subadmindailyreports", label: "Sub-Admin's Daily Report", icon: "🗂️" },
  { key: "subadminpanel", label: "Sub-Admin Panel", icon: "🛡️", superAdminOnly: true },
  { key: "settings", label: "Settings", icon: "⚙️" },
  { key: "auditlog", label: "Audit Trail", icon: "🧾" },
];

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  isSuperAdmin,
  sidebarOpen,
  setSidebarOpen,
}: {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isSuperAdmin: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const items = SIDEBAR_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);

  const listContent = (
    <nav className="py-3">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold ${
            activeTab === item.key
              ? "bg-chs-red text-white"
              : "text-chs-charcoal hover:bg-gray-50"
          }`}
        >
          <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      {/* Real, permanent sidebar — desktop/tablet only (md and up).
          Genuinely wider than a typical icon-only rail, per direct
          instruction, with real text labels always visible. */}
      <aside className="hidden md:block w-56 shrink-0 bg-white border-r border-gray-200 min-h-full">
        {listContent}
      </aside>

      {/* Real, mobile equivalent — a slide-in drawer triggered by the
          ☰ button in the header, since a permanent 224px sidebar
          would eat too much of a small phone screen's real content
          space. Same items, same order, same routing. */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-white h-full overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-chs-charcoal">Admin Menu</p>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 text-xl leading-none" aria-label="Close menu">×</button>
            </div>
            {listContent}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}
    </>
  );
}
