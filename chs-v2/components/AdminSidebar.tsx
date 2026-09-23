"use client";

// Real, new component per direct client design request — a genuine,
// permanent left sidebar (matching the vertical bar shown in both
// their Word reference and their own hand-drawn sketch), listing the
// ten specific items named, in the exact order confirmed: Notification,
// Quick Search, Sub-Admin Activities, Customer Care, Assign Role to
// Staff, Staff Daily Report, Sub-Admin's Daily Report, Sub-Admin
// Panel, Settings, Audit Trail.
//
// Real, second-round fixes following direct client testing on the
// live, deployed version:
//
// (1) A real, genuine background color — the client explicitly
// insisted on this after the first version shipped plain white.
// Uses zone-admin's own established --zone-accent (the same dark
// charcoal already used on this page's own header bar), not an
// arbitrary new color — matching "one of those colors that is
// familiar or synchronized with this present design."
//
// (2) Feature Catalog and Document Site, confirmed genuinely missing
// from the sidebar — both were real, working pages, just never
// listed here. Added as real links (not tab switches, since both are
// separate routes).
//
// (3) A real "Super Admin" entry — a direct answer to a specific,
// detailed request: a genuine shortcut/index into the full ~25-tab
// horizontal bar below, grouped by real category (every verification
// item together, every review-queue item together, and so on) so a
// super admin never has to scroll that long bar to find one thing.
// Opens the same real, grouped index built into admin/page.tsx.
//
// (4) Sticky positioning with its own real scroll, so all ten items
// stay reachable regardless of how tall the main content area gets —
// a real, preventive fix for a reported "can't find it" complaint
// that may have been this, even though the item itself was correctly
// present in the underlying code the whole time.

import Link from "next/link";
import type { Tab } from "@/app/admin/page";

interface SidebarItem {
  key: Tab;
  label: string;
  icon: string;
  superAdminOnly?: boolean;
  // Real, direct fix following a genuine gap found during review:
  // these sidebar shortcuts were bypassing the same domain-based
  // restriction that already, correctly, protects the horizontal tab
  // bar and the underlying data itself — a customer_care sub-admin's
  // own actual access never changed, but the sidebar was showing them
  // (and letting them click into) destinations meant only for other
  // domains or Super Admin. requiresDomain matches this item to the
  // one real domain it's genuinely relevant to.
  requiresDomain?: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "notificationsfeed", label: "Notification", icon: "🔔" },
  { key: "trace", label: "Quick Search", icon: "🔎", superAdminOnly: true },
  { key: "superadminindex", label: "Super Admin", icon: "🧭", superAdminOnly: true },
  { key: "subadminactivities", label: "Sub-Admin Activities", icon: "📜", superAdminOnly: true },
  { key: "disputes", label: "Customer Care", icon: "💬", requiresDomain: "customer_care" },
  { key: "assignrole", label: "Assign Role to Staff", icon: "👥", superAdminOnly: true },
  { key: "staffreports", label: "Staff Daily Report", icon: "📋", superAdminOnly: true },
  { key: "subadmindailyreports", label: "Sub-Admin's Daily Report", icon: "🗂️", superAdminOnly: true },
  { key: "subadminpanel", label: "Sub-Admin Panel", icon: "🛡️", superAdminOnly: true },
  { key: "settings", label: "Settings", icon: "⚙️", superAdminOnly: true },
  { key: "userregistry", label: "User Registry", icon: "🗂️", superAdminOnly: true },
  { key: "auditlog", label: "Audit Trail", icon: "🧾", superAdminOnly: true },
];

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  isSuperAdmin,
  viewerDomain,
  sidebarOpen,
  setSidebarOpen,
}: {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isSuperAdmin: boolean;
  viewerDomain: string | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const items = SIDEBAR_ITEMS.filter((item) => {
    if (isSuperAdmin) return true;
    if (item.superAdminOnly) return false;
    if (item.requiresDomain) return item.requiresDomain === viewerDomain;
    return true;
  });

  const listContent = (
    <nav className="py-3">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold ${
            activeTab === item.key
              ? "bg-white text-chs-charcoal"
              : "text-white/85 hover:bg-white/10"
          }`}
        >
          <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
      <div className="border-t border-white/15 my-2" />
      <Link href="/admin/feature-catalog" onClick={() => setSidebarOpen(false)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-white/85 hover:bg-white/10">
        <span className="text-base w-5 text-center shrink-0">📋</span>
        <span className="truncate">Feature Catalog</span>
      </Link>
      <Link href="/admin/document-site" onClick={() => setSidebarOpen(false)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-white/85 hover:bg-white/10">
        <span className="text-base w-5 text-center shrink-0">📁</span>
        <span className="truncate">Document Site</span>
      </Link>
    </nav>
  );

  return (
    <>
      {/* Real, permanent sidebar — desktop/tablet only (md and up).
          Genuinely wider than a typical icon-only rail, real text
          labels always visible, a real background color, and sticky
          with its own scroll so every item stays reachable no matter
          how tall the page becomes. */}
      <aside className="hidden md:block w-56 shrink-0 bg-[var(--zone-accent)] sticky top-0 self-start max-h-screen overflow-y-auto">
        {listContent}
      </aside>

      {/* Real, mobile equivalent — a slide-in drawer triggered by the
          ☰ button in the header, since a permanent 224px sidebar
          would eat too much of a small phone screen's real content
          space. Same items, same order, same routing, same color. */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-[var(--zone-accent)] h-full overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/15">
              <p className="text-sm font-bold text-white">Admin Menu</p>
              <button onClick={() => setSidebarOpen(false)} className="text-white/70 text-xl leading-none" aria-label="Close menu">×</button>
            </div>
            {listContent}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}
    </>
  );
}
