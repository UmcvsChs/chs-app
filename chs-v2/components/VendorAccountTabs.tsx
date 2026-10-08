"use client";

import { useMemo, useState } from "react";
import { formatNaira } from "@/lib/format";
import type { MarketplaceProduct } from "@/types/marketplace";
import type { ServiceQuoteRequest } from "@/types/serviceQuoteRequest";

// The vendor's whole account at a glance: stock, orders, subscription, sales,
// bids, earnings, commission and a plain statement of account. Money only
// counts as a sale or earning once CHS has released it; money still held in
// escrow is shown separately so the numbers always tally.

export interface VendorOrder {
  id: string; reference_number: string; amount: number; vendor_commission_amount: number;
  payment_status: string; created_at: string; quantity?: number | null;
  marketplace_products: { name: string }[] | null;
}
export interface VendorSubscription {
  id: string; status: string; next_billing_date: string | null; created_at: string;
  promotion_packages: { name: string; monthly_price_naira: number | null; star_rating: number | null } | null;
}
type Product = MarketplaceProduct & { quoteRequests: ServiceQuoteRequest[] };

type RangeKey = "24h" | "7d" | "30d" | "quarter" | "all" | "custom";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "24h", label: "Last 24 hours" }, { key: "7d", label: "Last 7 days" }, { key: "30d", label: "Last 30 days" },
  { key: "quarter", label: "Last quarter" }, { key: "all", label: "All time" }, { key: "custom", label: "Custom" },
];
const TABS = ["Stock", "Orders", "Subscription", "Sales", "Bids", "Earnings", "Commission", "Statistics"] as const;
type Tab = typeof TABS[number];

// one row per money event, from direct orders and from paid quotes
interface Line { id: string; ref: string; name: string; gross: number; commission: number; status: string; at: string; kind: "Order" | "Quote" }

const Row = ({ l }: { l: Line }) => (
  <div className="flex justify-between gap-2 py-1.5 border-b border-gray-100 text-[11px]">
    <div className="min-w-0">
      <p className="font-semibold text-chs-charcoal truncate">{l.name}</p>
      <p className="text-gray-400">{l.kind} {l.ref} · {new Date(l.at).toLocaleDateString()}</p>
    </div>
    <div className="text-right shrink-0">
      <p className="font-bold text-chs-charcoal">{formatNaira(l.gross)}</p>
      <p className={l.status === "released" ? "text-green-700" : l.status === "refunded" ? "text-gray-500" : "text-amber-700"}>
        {l.status === "released" ? "Paid out" : l.status === "refunded" ? "Refunded" : "Held by CHS"}
      </p>
    </div>
  </div>
);
const Empty = ({ text }: { text: string }) => <p className="text-[11px] text-gray-400 py-3">{text}</p>;
const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="bg-white rounded-lg border border-gray-100 p-2.5"><p className="text-[9px] uppercase font-bold text-gray-400">{label}</p><p className={`text-sm font-bold ${tone || "text-chs-charcoal"}`}>{value}</p></div>
);

export default function VendorAccountTabs({ products, orders, subscriptions }: { products: Product[]; orders: VendorOrder[]; subscriptions: VendorSubscription[] }) {
  const [tab, setTab] = useState<Tab>("Stock");
  const [range, setRange] = useState<RangeKey>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // the moment the page was opened; keeps the screen's maths stable between renders
  const [now] = useState(() => Date.now());

  const lines: Line[] = useMemo(() => {
    const fromOrders: Line[] = orders.map((o) => ({
      id: o.id, ref: o.reference_number, name: o.marketplace_products?.[0]?.name || "Item", gross: Number(o.amount),
      commission: Number(o.vendor_commission_amount || 0), status: o.payment_status, at: o.created_at, kind: "Order",
    }));
    const fromQuotes: Line[] = products.flatMap((p) => p.quoteRequests
      .filter((q) => q.payment_status && q.payment_status !== "unpaid" && q.quoted_amount)
      .map((q) => ({
        id: q.id, ref: q.reference_number, name: p.name, gross: Number(q.quoted_amount),
        commission: Number(q.vendor_commission_amount || 0), status: q.payment_status as string, at: q.created_at, kind: "Quote" as const,
      })));
    return [...fromOrders, ...fromQuotes].sort((a, b) => b.at.localeCompare(a.at)); // newest first
  }, [orders, products]);

  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    if (range === "all") return true;
    if (range === "custom") {
      const f = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
      const e = to ? new Date(to + "T23:59:59").getTime() : Infinity;
      return t >= f && t <= e;
    }
    const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 91;
    return t >= now - days * 86400000;
  };

  const ranged = lines.filter((l) => inRange(l.at));
  const released = ranged.filter((l) => l.status === "released");
  const held = ranged.filter((l) => l.status === "held_escrow");
  const refunded = ranged.filter((l) => l.status === "refunded");
  const sum = (a: Line[], k: "gross" | "commission") => a.reduce((s, l) => s + l[k], 0);
  const gross = sum(released, "gross"), commission = sum(released, "commission"), net = gross - commission;

  const stockProducts = products.filter((p) => p.listing_type === "product");
  const stockValue = stockProducts.reduce((s, p) => s + (p.stock_quantity ?? 0) * Number(p.price || 0), 0);
  const bids = products.flatMap((p) => p.quoteRequests.filter((q) => q.quoted_amount || q.vendor_response).map((q) => ({ q, name: p.name })))
    .filter((b) => inRange(b.q.created_at)).sort((a, b) => b.q.created_at.localeCompare(a.q.created_at));

  const usesRange = tab === "Orders" || tab === "Sales" || tab === "Bids" || tab === "Earnings" || tab === "Commission" || tab === "Statistics";

  return (
    <div className="px-4 pt-4">
      <p className="text-xs font-bold text-chs-charcoal mb-1.5">📒 My account</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap ${tab === t ? "bg-chs-charcoal text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            {t === "Stock" ? "My Stocks" : t === "Orders" ? "My Orders" : t === "Subscription" ? "My Subscription" : t === "Sales" ? "My Sales" : t === "Bids" ? "My Recent Bids" : t === "Earnings" ? "My Total Earnings" : t === "Commission" ? "Commission Paid" : "General Statistics"}
          </button>
        ))}
      </div>

      {usesRange && (
        <div className="mt-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RANGES.map((r) => (
              <button key={r.key} type="button" onClick={() => setRange(r.key)}
                className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap ${range === r.key ? "bg-chs-red text-white font-semibold" : "bg-gray-100 text-gray-600"}`}>{r.label}</button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex gap-2 mt-1.5 items-center text-[10px] text-gray-500">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1 rounded border border-gray-200 text-[11px]" />
              <span>to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1 rounded border border-gray-200 text-[11px]" />
            </div>
          )}
        </div>
      )}

      <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mt-2">
        {tab === "Stock" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Stat label="Products" value={String(stockProducts.length)} />
              <Stat label="Units in stock" value={String(stockProducts.reduce((s, p) => s + (p.stock_quantity ?? 0), 0))} />
              <Stat label="Stock value" value={formatNaira(stockValue)} />
            </div>
            {stockProducts.length === 0 ? <Empty text="No products listed yet. Add a listing below." /> : stockProducts.map((p) => (
              <div key={p.id} className="flex justify-between py-1.5 border-b border-gray-100 text-[11px]">
                <span className="text-chs-charcoal">{p.name}</span>
                <span className={p.status === "sold_out" || (p.stock_quantity ?? 1) === 0 ? "text-chs-red font-semibold" : "text-gray-600"}>
                  {p.stock_quantity == null ? "not tracked" : `${p.stock_quantity} left`}{p.status === "sold_out" ? " · sold out" : ""}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 mt-2">Change stock numbers in the listing cards below.</p>
          </>
        )}

        {tab === "Orders" && (
          <>
            <p className="text-[10px] text-gray-500 mb-1">Orders and paid quotes that came through CHS. Newest first.</p>
            {ranged.length === 0 ? <Empty text="No orders in this period." /> : ranged.map((l) => <Row key={l.kind + l.id} l={l} />)}
          </>
        )}

        {tab === "Subscription" && (
          subscriptions.length === 0 ? (
            <Empty text="You have no promotion or advertising plan. If you pay CHS to promote your shop, the plan, amount, status and renewal date will show here." />
          ) : subscriptions.map((s) => (
            <div key={s.id} className="py-2 border-b border-gray-100 text-[11px]">
              <p className="font-semibold text-chs-charcoal">{s.promotion_packages?.name || "Plan"} {s.promotion_packages?.star_rating ? "★".repeat(s.promotion_packages.star_rating) : ""}</p>
              <p className="text-gray-600">{s.promotion_packages?.monthly_price_naira ? `${formatNaira(s.promotion_packages.monthly_price_naira)} a month` : "Price not set"} · {s.status}</p>
              <p className="text-gray-400">Started {new Date(s.created_at).toLocaleDateString()}{s.next_billing_date ? ` · renews ${s.next_billing_date}` : ""}</p>
            </div>
          ))
        )}

        {tab === "Sales" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Stat label="Sales paid out" value={String(released.length)} />
              <Stat label="Sales value" value={formatNaira(gross)} />
              <Stat label="Still held" value={formatNaira(sum(held, "gross"))} tone="text-amber-700" />
            </div>
            {released.length === 0 ? <Empty text="No completed sales in this period." /> : released.map((l) => <Row key={l.kind + l.id} l={l} />)}
          </>
        )}

        {tab === "Bids" && (
          <>
            <p className="text-[10px] text-gray-500 mb-1">Every quote you have given a buyer. CHS relays the best options to the buyer.</p>
            {bids.length === 0 ? <Empty text="No bids in this period." /> : bids.map(({ q, name }) => (
              <div key={q.id} className="py-1.5 border-b border-gray-100 text-[11px] flex justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold text-chs-charcoal truncate">{name}</p><p className="text-gray-400">{q.reference_number} · {new Date(q.created_at).toLocaleDateString()}</p></div>
                <div className="text-right shrink-0"><p className="font-bold text-chs-charcoal">{q.quoted_amount ? formatNaira(Number(q.quoted_amount)) : "no price yet"}</p><p className="text-gray-500 capitalize">{String(q.status).replace(/_/g, " ")}</p></div>
              </div>
            ))}
          </>
        )}

        {tab === "Earnings" && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Stat label="Sales" value={formatNaira(gross)} />
              <Stat label="Commission" value={formatNaira(commission)} tone="text-chs-red" />
              <Stat label="You earned" value={formatNaira(net)} tone="text-green-700" />
            </div>
            {released.length === 0 ? <Empty text="No earnings in this period." /> : released.map((l) => (
              <div key={l.kind + l.id} className="flex justify-between py-1.5 border-b border-gray-100 text-[11px]">
                <span className="text-chs-charcoal truncate pr-2">{l.name} · {new Date(l.at).toLocaleDateString()}</span>
                <span className="font-bold text-green-700 shrink-0">{formatNaira(l.gross - l.commission)}</span>
              </div>
            ))}
          </>
        )}

        {tab === "Commission" && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Stat label="Commission paid" value={formatNaira(commission)} tone="text-chs-red" />
              <Stat label="On sales of" value={formatNaira(gross)} />
            </div>
            <p className="text-[10px] text-gray-500 mb-1">Taken by CHS from each sale when it is paid out. You never send commission separately.</p>
            {released.length === 0 ? <Empty text="No commission in this period." /> : released.map((l) => (
              <div key={l.kind + l.id} className="flex justify-between py-1.5 border-b border-gray-100 text-[11px]">
                <span className="text-chs-charcoal truncate pr-2">{l.name} · {l.ref}</span>
                <span className="text-chs-red font-semibold shrink-0">{formatNaira(l.commission)}</span>
              </div>
            ))}
          </>
        )}

        {tab === "Statistics" && (
          <>
            <p className="text-[10px] text-gray-500 mb-2">A plain statement of your account for the period chosen above.</p>
            <table className="w-full text-[11px]">
              <tbody>
                <tr><td colSpan={2} className="font-bold text-chs-charcoal pt-1">Sales</td></tr>
                <tr><td className="text-gray-600">Sales paid out ({released.length})</td><td className="text-right">{formatNaira(gross)}</td></tr>
                <tr><td className="text-gray-600">Less CHS commission</td><td className="text-right text-chs-red">− {formatNaira(commission)}</td></tr>
                <tr className="border-t border-gray-200 font-bold"><td>Earnings (cash received)</td><td className="text-right text-green-700">{formatNaira(net)}</td></tr>
                <tr><td colSpan={2} className="font-bold text-chs-charcoal pt-3">Money not yet yours</td></tr>
                <tr><td className="text-gray-600">Held by CHS awaiting release ({held.length})</td><td className="text-right">{formatNaira(sum(held, "gross"))}</td></tr>
                <tr><td className="text-gray-600">Refunded to buyers ({refunded.length})</td><td className="text-right">{formatNaira(sum(refunded, "gross"))}</td></tr>
                <tr><td colSpan={2} className="font-bold text-chs-charcoal pt-3">Stock (today)</td></tr>
                <tr><td className="text-gray-600">Units in stock</td><td className="text-right">{stockProducts.reduce((s, p) => s + (p.stock_quantity ?? 0), 0)}</td></tr>
                <tr><td className="text-gray-600">Stock value at your prices</td><td className="text-right">{formatNaira(stockValue)}</td></tr>
                <tr><td colSpan={2} className="font-bold text-chs-charcoal pt-3">Balance sheet (today)</td></tr>
                <tr><td className="text-gray-600">Assets: stock + money held by CHS</td><td className="text-right">{formatNaira(stockValue + sum(lines.filter((l) => l.status === "held_escrow"), "gross"))}</td></tr>
                <tr><td className="text-gray-600">Liabilities: commission owed</td><td className="text-right">{formatNaira(0)}</td></tr>
                <tr className="border-t border-gray-200 font-bold"><td>Net position</td><td className="text-right">{formatNaira(stockValue + sum(lines.filter((l) => l.status === "held_escrow"), "gross"))}</td></tr>
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-2">Commission is deducted when a sale is paid out, so nothing is owed afterwards. The balance sheet counts today&apos;s stock and held money regardless of the period.</p>
          </>
        )}
      </div>
    </div>
  );
}
