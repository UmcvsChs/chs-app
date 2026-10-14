"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import NotificationBell from "@/components/NotificationBell";
import PropertyCard from "@/components/PropertyCard";
import { Property } from "@/types/property";
import BookingsPanel from "@/components/BookingsPanel";
import BillsPanel from "@/components/BillsPanel";
import TransactionsPanel from "@/components/TransactionsPanel";
import ApplicationsPanel from "@/components/ApplicationsPanel";
import SavedPanel from "@/components/SavedPanel";
import WalletPanel from "@/components/WalletPanel";
import RefundsPanel from "@/components/RefundsPanel";
import SplitJoin from "@/components/SplitJoin";

// The guest's home: everything a guest does, one tab each, with a badge where something is waiting on them.
interface Home {
  balance: number; awaiting_host: number; to_pay: number; confirmed_upcoming: number; bills_open: number; topups_due: number; changes_pending: number; saved: number;
  next_stay: { id: string; title: string; check_in: string; check_out: string; status: string } | null;
}
type TabKey = "overview" | "browse" | "bookings" | "bills" | "transactions" | "applications" | "refunds" | "saved" | "wallet" | "past";

const GUEST_CATEGORIES = [
  { key: "shortlet", label: "🏠 Shortlet Apartments", match: (p: Property) => p.purpose === "shortlet" && p.hire_category !== "event_centre" },
  { key: "hotel_lodge", label: "🏨 Hotels & Lodges", match: (p: Property) => p.purpose === "hire" && p.hire_category === "hotel_lodge" },
  { key: "event_centre", label: "🎪 Event Centres & Halls", match: (p: Property) => p.hire_category === "event_centre" },
  { key: "recreational_sports", label: "⚽ Recreational & Sports", match: (p: Property) => p.purpose === "hire" && p.hire_category === "recreational_sports" },
  { key: "open_field", label: "🌳 Open Fields & Grounds", match: (p: Property) => p.purpose === "hire" && p.hire_category === "open_field" },
  { key: "stadium", label: "🏟️ Stadiums & Sports Grounds", match: (p: Property) => p.purpose === "hire" && p.hire_category === "stadium" },
  { key: "car_park_casual", label: "🚗 Casual Car Parks", match: (p: Property) => p.purpose === "hire" && p.hire_category === "car_park_casual" },
  { key: "cinema_entertainment", label: "🎬 Cinema & Entertainment", match: (p: Property) => p.purpose === "hire" && p.hire_category === "cinema_entertainment" },
];
const day = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00+01:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export default function GuestDashboardPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [home, setHome] = useState<Home | null>(null);
  const [listings, setListings] = useState<Property[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState("");

  const loadHome = useCallback(async () => {
    const { data } = await supabase.rpc("get_guest_home");
    if (data) setHome(data as Home);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHome();
    const t = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setTab(t);
    supabase.from("properties").select("*").eq("status", "active")
      .or("purpose.eq.shortlet,and(purpose.eq.hire,hire_category.not.is.null)").order("created_at", { ascending: false }).limit(150)
      .then(({ data }) => setListings((data as unknown as Property[]) || []));
  }, [authLoading, session, router, loadHome]);

  function go(t: TabKey) {
    setTab(t);
    try { window.history.replaceState(null, "", `/guest?tab=${t}`); } catch { /* ignore */ }
    loadHome();
  }

  if (authLoading || !session) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;

  const todo = (home?.to_pay || 0) + (home?.bills_open || 0) + (home?.topups_due || 0);
  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: "overview", label: "Overview", badge: todo },
    { key: "browse", label: "Browse" },
    { key: "bookings", label: "My bookings", badge: (home?.awaiting_host || 0) + (home?.to_pay || 0) + (home?.topups_due || 0) },
    { key: "bills", label: "Bills & quotations", badge: home?.bills_open },
    { key: "transactions", label: "Transactions" },
    { key: "applications", label: "Applications" },
    { key: "refunds", label: "Cancelled & refunds" },
    { key: "saved", label: "Saved ❤️" },
    { key: "wallet", label: "Wallet" },
    { key: "past", label: "Past stays" },
  ];

  const filtered = listings.filter((p) => {
    const c = GUEST_CATEGORIES.find((x) => x.key === cat);
    if (c && !c.match(p)) return false;
    if (q.trim() && !`${p.title} ${p.location_area || ""}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    const price = Number(p.price_per_night || p.price || 0);
    if (maxPrice && price > Number(maxPrice)) return false;
    return true;
  });

  const action = (label: string, n: number | undefined, t: TabKey, hint: string) => !n ? null : (
    <button key={t + label} onClick={() => go(t)} className="w-full text-left bg-white rounded-xl border border-chs-red/40 p-3 flex justify-between items-center">
      <span><span className="text-sm font-semibold text-chs-charcoal">{label}</span><span className="block text-[11px] text-gray-500">{hint}</span></span>
      <span className="text-xs font-bold bg-chs-red text-white rounded-full px-2 py-0.5">{n}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-24 zone-guest">
      <div className="bg-[var(--zone-accent)] text-white px-4 pt-4 pb-3">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Guest" />
        <div className="flex items-center gap-2"><h1 className="font-serif text-lg font-bold mt-1">My Guest Dashboard</h1><NotificationBell /></div>
        <div className="mt-2 flex items-center justify-between bg-white/15 rounded-xl px-3 py-2">
          <div><p className="text-[10px] text-white/70">Wallet balance</p><p className="text-lg font-bold">{home ? formatNaira(home.balance) : "…"}</p></div>
          <div className="flex gap-1.5">
            <button onClick={() => go("wallet")} className="bg-white text-chs-charcoal text-[11px] font-semibold px-3 py-1.5 rounded-full">Fund</button>
            <button onClick={() => go("wallet")} className="bg-white/20 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">Withdraw</button>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex px-2 min-w-max">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => go(t.key)} className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 ${tab === t.key ? "border-chs-red text-chs-red" : "border-transparent text-gray-500"}`}>
              {t.label}{t.badge ? <span className="ml-1 text-[9px] bg-chs-red text-white rounded-full px-1.5 py-0.5">{t.badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="px-4 py-4 space-y-3">
          {home?.next_stay ? (
            <button onClick={() => go("bookings")} className="w-full text-left bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[10px] uppercase font-bold text-gray-400">Your next booking</p>
              <p className="text-sm font-bold text-chs-charcoal">{home.next_stay.title}</p>
              <p className="text-xs text-gray-500">{day(home.next_stay.check_in)} → {day(home.next_stay.check_out)} · {home.next_stay.status.replace(/_/g, " ")}</p>
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-sm font-semibold text-chs-charcoal">Nothing booked yet</p>
              <button onClick={() => go("browse")} className="mt-2 text-xs font-semibold bg-chs-charcoal text-white rounded-full px-4 py-1.5">Find a place or venue</button>
            </div>
          )}
          <p className="text-xs font-bold text-chs-charcoal">Needs your attention</p>
          {action("Pay to confirm a booking", home?.to_pay, "bookings", "The host said yes. Pay from your wallet to secure the dates.")}
          {action("Quotation or bill to pay", home?.bills_open, "bills", "A venue sent extra services. Pay each instalment from your wallet.")}
          {action("Extra payment for a change", home?.topups_due, "bookings", "The venue approved your change. Pay the difference to apply it.")}
          {!todo && <p className="text-xs text-gray-400">You are all caught up.</p>}
          <p className="text-xs font-bold text-chs-charcoal pt-2">In progress</p>
          {action("Waiting for the host", home?.awaiting_host, "bookings", "Your request is with the host. You are not charged until they accept.")}
          {action("Change requests waiting", home?.changes_pending, "bookings", "The venue has not answered your change yet.")}
          {action("Confirmed and upcoming", home?.confirmed_upcoming, "bookings", "Open a booking to change guests or dates, message the venue or cancel.")}
          {action("Saved places", home?.saved, "saved", "Places you want to come back to.")}
          <div className="pt-2"><SplitJoin /></div>
          <p className="text-xs font-bold text-chs-charcoal pt-2">Recent money movements</p>
          <TransactionsPanel compact limit={10} />
          <button onClick={() => go("transactions")} className="text-xs underline text-chs-charcoal">See all transactions →</button>
        </div>
      )}

      {tab === "browse" && (
        <div className="px-4 py-4 space-y-3">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or area" className="flex-1 border border-gray-300 rounded-full px-3 py-2 text-xs" />
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Max ₦" className="w-24 border border-gray-300 rounded-full px-3 py-2 text-xs" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[{ key: "all", label: "All" }, ...GUEST_CATEGORIES].map((c) => (
              <button key={c.key} onClick={() => setCat(c.key)} className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border ${cat === c.key ? "bg-chs-charcoal text-white border-chs-charcoal" : "bg-white text-gray-600 border-gray-300"}`}>{c.label}</button>
            ))}
          </div>
          {GUEST_CATEGORIES.map((c) => {
            const items = filtered.filter(c.match);
            if (!items.length) return null;
            return (
              <div key={c.key}>
                <p className="text-xs font-bold text-chs-charcoal mb-2">{c.label} ({items.length})</p>
                <div className="grid grid-cols-2 gap-3">{items.map((p) => <PropertyCard key={p.id} property={p} />)}</div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nothing matches. Try a wider search.</p>}
          <Link href="/" className="block text-center text-xs underline text-chs-charcoal">Browse everything on the homepage →</Link>
        </div>
      )}

      {tab === "bookings" && <BookingsPanel embedded filter="active" />}
      {tab === "past" && <BookingsPanel embedded filter="past" />}
      {tab === "bills" && <BillsPanel />}
      {tab === "transactions" && <TransactionsPanel />}
      {tab === "applications" && <ApplicationsPanel embedded />}
      {tab === "refunds" && <RefundsPanel />}
      {tab === "saved" && <SavedPanel embedded />}
      {tab === "wallet" && <WalletPanel embedded />}
    </div>
  );
}
