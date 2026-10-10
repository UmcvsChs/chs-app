"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatNaira } from "@/lib/format";

// Hotel services: room-order board, quick sales (POS), digital menu with recipes, stock and the asset register.
// Everything is enforced in the database; the screen only hides what a role cannot use.

type Sub = "orders" | "sell" | "menu" | "stock" | "assets";
const CENTRES = ["restaurant", "bar", "laundry", "gym", "events", "other"];
const METHODS = ["cash", "transfer", "pos", "charged_to_room"];
const CONDITIONS = ["good", "fair", "poor", "out_of_service"];
const pretty = (s: string) => s.replace(/_/g, " ");

interface Line { name: string; qty: number; unit_price: number }
interface Order { id: string; source: string; room_label: string | null; status: string; note: string | null; total: number; placed_at: string; delivered_at: string | null; paid_at: string | null; paid_method: string | null; lines: Line[] | null }
interface RecipeLine { stock_item_id: string; stock_name: string; unit: string; qty: number }
interface MenuItem { id: string; category: string; name: string; description: string | null; price: number; centre: string; available: boolean; recipe: RecipeLine[] }
interface StockItem { id: string; name: string; unit: string; quantity: number; reorder_level: number; cost_per_unit: number | null; low: boolean }
interface Movement { item: string; unit: string; change: number; after: number; reason: string; note: string | null; by: string | null; at: string }
interface AssetEvent { kind: string; note: string | null; by: string | null; at: string }
interface Asset { id: string; name: string; category: string; location: string | null; serial: string | null; purchase_date: string | null; purchase_cost: number | null; condition: string; notes: string | null; history: AssetEvent[] }

export default function HotelServices({ propertyId, role = "owner" }: { propertyId: string; role?: string }) {
  const canEdit = role === "owner" || role === "manager";
  const [sub, setSub] = useState<Sub>("orders");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [stock, setStock] = useState<StockItem[] | null>(null);
  const [moves, setMoves] = useState<Movement[] | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  // POS
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payMethod, setPayMethod] = useState("cash");
  const [posLabel, setPosLabel] = useState("");
  // menu form
  const [mId, setMId] = useState<string | null>(null);
  const [mName, setMName] = useState(""); const [mCat, setMCat] = useState("Mains"); const [mPrice, setMPrice] = useState("");
  const [mCentre, setMCentre] = useState("restaurant"); const [mDesc, setMDesc] = useState("");
  const [recipeFor, setRecipeFor] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<Record<string, string>>({});
  // stock form
  const [sName, setSName] = useState(""); const [sUnit, setSUnit] = useState("pcs"); const [sReorder, setSReorder] = useState("0");
  const [sCost, setSCost] = useState(""); const [sOpen, setSOpen] = useState("0");
  const [adjFor, setAdjFor] = useState<string | null>(null);
  const [adjReason, setAdjReason] = useState("purchase"); const [adjAmount, setAdjAmount] = useState(""); const [adjNote, setAdjNote] = useState("");
  // asset form
  const [aId, setAId] = useState<string | null>(null);
  const [aName, setAName] = useState(""); const [aCat, setACat] = useState("Furniture"); const [aLoc, setALoc] = useState("");
  const [aSerial, setASerial] = useState(""); const [aDate, setADate] = useState(""); const [aCost, setACost] = useState("");
  const [aCond, setACond] = useState("good"); const [aNotes, setANotes] = useState("");

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_room_orders", { p_property_id: propertyId, p_limit: 60 });
    if (error) setErr(error.message); else setOrders(data as Order[]);
  }, [propertyId]);
  const loadMenu = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_menu_admin", { p_property_id: propertyId });
    if (error) { setErr(error.message); return; }
    const d = data as { items: MenuItem[]; stock: StockItem[] };
    setMenu(d.items); setStock(d.stock);
  }, [propertyId]);
  const loadMoves = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_stock_movements", { p_property_id: propertyId, p_limit: 30 });
    if (error) setErr(error.message); else setMoves(data as Movement[]);
  }, [propertyId]);
  const loadAssets = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_assets", { p_property_id: propertyId });
    if (error) setErr(error.message); else setAssets(data as Asset[]);
  }, [propertyId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (sub === "orders") loadOrders();
    if (sub === "sell" || sub === "menu") loadMenu();
    if (sub === "stock") { loadMenu(); loadMoves(); }
    if (sub === "assets") loadAssets();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [sub, loadOrders, loadMenu, loadMoves, loadAssets]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, after?: () => void) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setErr(error.message); return false; }
    setMsg(ok); after?.(); return true;
  }

  const setStatus = (id: string, status: string) => run(() => supabase.rpc("set_room_order_status", { p_order_id: id, p_status: status }), "Order updated.", loadOrders);
  const markPaid = (id: string, method: string) => run(() => supabase.rpc("mark_room_order_paid", { p_order_id: id, p_method: method }), "Payment recorded in your income.", loadOrders);

  const cartLines = Object.entries(cart).filter(([, q]) => q > 0).map(([menu_item_id, qty]) => ({ menu_item_id, qty }));
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * Number(menu?.find((m) => m.id === l.menu_item_id)?.price ?? 0), 0);

  function renderOrders() {
    if (!orders) return <p className="text-xs text-gray-500">Loading…</p>;
    if (orders.length === 0) return <p className="text-xs text-gray-500">No orders yet. Guests who are checked in can order from your menu on their booking page.</p>;
    return (
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="border border-gray-200 rounded-lg p-2.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{o.room_label || "Counter"} · {o.source === "pos" ? "Sale" : "Room order"}</span>
              <span className="font-semibold">{formatNaira(o.total)}</span>
            </div>
            <p className="text-gray-500">{formatDateTime(o.placed_at)} · <span className="capitalize">{o.status}</span>{o.paid_at ? ` · paid (${pretty(o.paid_method || "")})` : ""}</p>
            <ul className="mt-1 text-gray-700">{(o.lines ?? []).map((l, i) => <li key={i}>{l.qty} × {l.name}</li>)}</ul>
            {o.note && <p className="mt-1 italic text-gray-600">“{o.note}”</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {o.status === "placed" && <button disabled={busy} onClick={() => setStatus(o.id, "preparing")} className="px-2.5 py-1 rounded-full border border-gray-300">Preparing</button>}
              {(o.status === "placed" || o.status === "preparing") && <button disabled={busy} onClick={() => setStatus(o.id, "delivered")} className="px-2.5 py-1 rounded-full bg-chs-charcoal text-white">Delivered</button>}
              {(o.status === "placed" || o.status === "preparing") && !o.paid_at && <button disabled={busy} onClick={() => setStatus(o.id, "cancelled")} className="px-2.5 py-1 rounded-full border border-red-300 text-red-600">Cancel</button>}
              {o.status === "delivered" && !o.paid_at && METHODS.map((m) => (
                <button key={m} disabled={busy} onClick={() => markPaid(o.id, m)} className="px-2.5 py-1 rounded-full border border-green-600 text-green-700">Paid: {pretty(m)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSell() {
    if (!menu) return <p className="text-xs text-gray-500">Loading…</p>;
    const sellable = menu.filter((m) => m.available);
    if (sellable.length === 0) return <p className="text-xs text-gray-500">Add items on the Menu tab first.</p>;
    return (
      <div className="space-y-2">
        {sellable.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1.5">
            <span>{m.name} <span className="text-gray-500">· {formatNaira(m.price)}</span></span>
            <span className="flex items-center gap-2">
              <button className="w-6 h-6 rounded-full border" onClick={() => setCart((c) => ({ ...c, [m.id]: Math.max(0, (c[m.id] ?? 0) - 1) }))}>−</button>
              <span className="w-5 text-center">{cart[m.id] ?? 0}</span>
              <button className="w-6 h-6 rounded-full border" onClick={() => setCart((c) => ({ ...c, [m.id]: Math.min(99, (c[m.id] ?? 0) + 1) }))}>+</button>
            </span>
          </div>
        ))}
        <input value={posLabel} onChange={(e) => setPosLabel(e.target.value)} placeholder="Table or note (optional)" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs">
          {METHODS.map((m) => <option key={m} value={m}>{pretty(m)}</option>)}
        </select>
        <button disabled={busy || cartLines.length === 0} onClick={() => run(() => supabase.rpc("record_pos_sale", { p_property_id: propertyId, p_lines: cartLines, p_method: payMethod, p_label: posLabel || null, p_note: null }), "Sale recorded.", () => { setCart({}); setPosLabel(""); })} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
          Record sale {cartTotal > 0 ? `· ${formatNaira(cartTotal)}` : ""}
        </button>
      </div>
    );
  }

  function saveMenuItem() {
    return run(() => supabase.rpc("upsert_menu_item", { p_property_id: propertyId, p_id: mId, p_category: mCat, p_name: mName, p_description: mDesc || null, p_price: Number(mPrice), p_centre: mCentre, p_available: true, p_archived: false }),
      "Menu item saved.", () => { setMId(null); setMName(""); setMPrice(""); setMDesc(""); loadMenu(); });
  }
  function toggleMenu(m: MenuItem, patch: { available?: boolean; archived?: boolean }) {
    return run(() => supabase.rpc("upsert_menu_item", { p_property_id: propertyId, p_id: m.id, p_category: m.category, p_name: m.name, p_description: m.description, p_price: m.price, p_centre: m.centre, p_available: patch.available ?? m.available, p_archived: patch.archived ?? false }), "Menu updated.", loadMenu);
  }
  function saveRecipe(m: MenuItem) {
    const lines = Object.entries(recipeDraft).filter(([, q]) => Number(q) > 0).map(([stock_item_id, q]) => ({ stock_item_id, qty: Number(q) }));
    return run(() => supabase.rpc("set_recipe", { p_menu_item_id: m.id, p_lines: lines }), "Recipe saved.", () => { setRecipeFor(null); loadMenu(); });
  }

  function renderMenu() {
    if (!menu) return <p className="text-xs text-gray-500">Loading…</p>;
    return (
      <div className="space-y-3">
        {canEdit && (
          <div className="border border-gray-200 rounded-lg p-2.5 space-y-1.5">
            <p className="text-xs font-semibold">{mId ? "Edit item" : "Add a menu item"}</p>
            <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Name (e.g. Jollof rice)" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            <div className="flex gap-1.5">
              <input value={mCat} onChange={(e) => setMCat(e.target.value)} placeholder="Category" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
              <input value={mPrice} onChange={(e) => setMPrice(e.target.value)} inputMode="decimal" placeholder="Price ₦" className="w-24 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            </div>
            <select value={mCentre} onChange={(e) => setMCentre(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs">
              {CENTRES.map((c) => <option key={c} value={c}>Income goes to: {pretty(c)}</option>)}
            </select>
            <input value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="Short description (optional)" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            <div className="flex gap-2">
              <button disabled={busy || !mName.trim() || !(Number(mPrice) > 0)} onClick={saveMenuItem} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-xs disabled:opacity-50">Save item</button>
              {mId && <button onClick={() => { setMId(null); setMName(""); setMPrice(""); setMDesc(""); }} className="px-3 py-1.5 rounded-full border text-xs">Cancel edit</button>}
            </div>
          </div>
        )}
        {menu.length === 0 && <p className="text-xs text-gray-500">Your menu is empty.</p>}
        {menu.map((m) => (
          <div key={m.id} className="border border-gray-200 rounded-lg p-2.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{m.name} <span className="font-normal text-gray-500">· {m.category} · {pretty(m.centre)}</span></span>
              <span className="font-semibold">{formatNaira(m.price)}</span>
            </div>
            <p className="text-gray-500">{m.available ? "On the guest menu" : "Hidden from guests"}{m.recipe.length ? ` · uses ${m.recipe.map((r) => `${r.qty} ${r.unit} ${r.stock_name}`).join(", ")}` : ""}</p>
            {canEdit && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <button className="px-2.5 py-1 rounded-full border" onClick={() => { setMId(m.id); setMName(m.name); setMCat(m.category); setMPrice(String(m.price)); setMCentre(m.centre); setMDesc(m.description ?? ""); }}>Edit</button>
                <button disabled={busy} className="px-2.5 py-1 rounded-full border" onClick={() => toggleMenu(m, { available: !m.available })}>{m.available ? "Hide" : "Show"}</button>
                <button className="px-2.5 py-1 rounded-full border" onClick={() => { setRecipeFor(recipeFor === m.id ? null : m.id); setRecipeDraft(Object.fromEntries(m.recipe.map((r) => [r.stock_item_id, String(r.qty)]))); }}>Recipe</button>
                <button disabled={busy} className="px-2.5 py-1 rounded-full border border-red-300 text-red-600" onClick={() => toggleMenu(m, { archived: true })}>Remove</button>
              </div>
            )}
            {recipeFor === m.id && (
              <div className="mt-2 space-y-1.5 bg-gray-50 rounded-lg p-2">
                <p className="text-gray-600">How much stock does one portion use? Leave blank for none.</p>
                {(stock ?? []).length === 0 && <p className="text-gray-500">Add stock items first.</p>}
                {(stock ?? []).map((s) => (
                  <label key={s.id} className="flex items-center justify-between gap-2">
                    <span>{s.name} ({s.unit})</span>
                    <input value={recipeDraft[s.id] ?? ""} onChange={(e) => setRecipeDraft((d) => ({ ...d, [s.id]: e.target.value }))} inputMode="decimal" className="w-20 border border-gray-300 rounded px-2 py-1" />
                  </label>
                ))}
                <button disabled={busy} onClick={() => saveRecipe(m)} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white disabled:opacity-50">Save recipe</button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderStock() {
    if (!stock) return <p className="text-xs text-gray-500">Loading…</p>;
    return (
      <div className="space-y-3">
        {canEdit && (
          <div className="border border-gray-200 rounded-lg p-2.5 space-y-1.5">
            <p className="text-xs font-semibold">Add a stock item</p>
            <div className="flex gap-1.5">
              <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Name (e.g. Rice)" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
              <input value={sUnit} onChange={(e) => setSUnit(e.target.value)} placeholder="Unit" className="w-16 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            </div>
            <div className="flex gap-1.5">
              <input value={sOpen} onChange={(e) => setSOpen(e.target.value)} inputMode="decimal" placeholder="Opening qty" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
              <input value={sReorder} onChange={(e) => setSReorder(e.target.value)} inputMode="decimal" placeholder="Reorder at" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
              <input value={sCost} onChange={(e) => setSCost(e.target.value)} inputMode="decimal" placeholder="Cost ₦/unit" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            </div>
            <button disabled={busy || !sName.trim()} onClick={() => run(() => supabase.rpc("upsert_stock_item", { p_property_id: propertyId, p_id: null, p_name: sName, p_unit: sUnit, p_reorder_level: Number(sReorder) || 0, p_cost_per_unit: sCost ? Number(sCost) : null, p_opening_quantity: Number(sOpen) || 0, p_active: true }), "Stock item added.", () => { setSName(""); setSOpen("0"); setSReorder("0"); setSCost(""); loadMenu(); })} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-xs disabled:opacity-50">Add item</button>
          </div>
        )}
        {stock.length === 0 && <p className="text-xs text-gray-500">No stock items yet.</p>}
        {stock.map((s) => (
          <div key={s.id} className="border border-gray-200 rounded-lg p-2.5 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold">{s.name}</span>
              <span className={s.low ? "font-semibold text-red-600" : "font-semibold"}>{s.quantity} {s.unit}{s.low ? " · low" : ""}</span>
            </div>
            <button className="mt-1 px-2.5 py-1 rounded-full border" onClick={() => { setAdjFor(adjFor === s.id ? null : s.id); setAdjAmount(""); setAdjNote(""); }}>Update</button>
            {adjFor === s.id && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <select value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="border border-gray-300 rounded px-2 py-1">
                  <option value="purchase">Bought / received</option><option value="use">Used</option><option value="waste">Wasted</option>{canEdit && <option value="adjust">Correct the count (+/−)</option>}
                </select>
                <input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} inputMode="decimal" placeholder="Qty" className="w-20 border border-gray-300 rounded px-2 py-1" />
                <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Note" className="flex-1 min-w-[6rem] border border-gray-300 rounded px-2 py-1" />
                <button disabled={busy || !Number(adjAmount)} onClick={() => run(() => supabase.rpc("adjust_stock", { p_item_id: s.id, p_amount: Number(adjAmount), p_reason: adjReason, p_note: adjNote || null }), "Stock updated.", () => { setAdjFor(null); loadMenu(); loadMoves(); })} className="px-3 py-1 rounded-full bg-chs-charcoal text-white disabled:opacity-50">Save</button>
              </div>
            )}
          </div>
        ))}
        {moves && moves.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1">Recent stock movements</p>
            <ul className="text-[11px] text-gray-600 space-y-0.5">
              {moves.map((x, i) => <li key={i}>{formatDateTime(x.at)} · {x.item} {x.change > 0 ? "+" : ""}{x.change} {x.unit} ({pretty(x.reason)}) → {x.after}{x.by ? ` · ${x.by}` : ""}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function resetAsset() { setAId(null); setAName(""); setALoc(""); setASerial(""); setADate(""); setACost(""); setACond("good"); setANotes(""); }
  function saveAsset(retire = false) {
    return run(() => supabase.rpc("upsert_asset", { p_property_id: propertyId, p_id: aId, p_name: aName, p_category: aCat, p_location: aLoc || null, p_serial: aSerial || null, p_purchase_date: aDate || null, p_purchase_cost: aCost ? Number(aCost) : null, p_condition: aCond, p_notes: aNotes || null, p_active: !retire }),
      retire ? "Asset retired." : "Asset saved.", () => { resetAsset(); loadAssets(); });
  }

  function renderAssets() {
    if (!assets) return <p className="text-xs text-gray-500">Loading…</p>;
    return (
      <div className="space-y-3">
        {canEdit && (
          <div className="border border-gray-200 rounded-lg p-2.5 space-y-1.5">
            <p className="text-xs font-semibold">{aId ? "Edit asset" : "Add an asset"}</p>
            <input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Name (e.g. Generator 20kVA)" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            <div className="flex gap-1.5">
              <input value={aCat} onChange={(e) => setACat(e.target.value)} placeholder="Category" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
              <input value={aLoc} onChange={(e) => setALoc(e.target.value)} placeholder="Location" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            </div>
            <div className="flex gap-1.5">
              <input value={aSerial} onChange={(e) => setASerial(e.target.value)} placeholder="Serial no." className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
              <input type="date" value={aDate} onChange={(e) => setADate(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            </div>
            <div className="flex gap-1.5">
              <input value={aCost} onChange={(e) => setACost(e.target.value)} inputMode="decimal" placeholder="Cost ₦" className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
              <select value={aCond} onChange={(e) => setACond(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs">{CONDITIONS.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}</select>
            </div>
            <input value={aNotes} onChange={(e) => setANotes(e.target.value)} placeholder="Notes" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
            <div className="flex gap-2">
              <button disabled={busy || !aName.trim()} onClick={() => saveAsset(false)} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-xs disabled:opacity-50">Save asset</button>
              {aId && <button disabled={busy} onClick={() => saveAsset(true)} className="px-3 py-1.5 rounded-full border border-red-300 text-red-600 text-xs">Retire</button>}
              {aId && <button onClick={resetAsset} className="px-3 py-1.5 rounded-full border text-xs">Cancel</button>}
            </div>
          </div>
        )}
        {assets.length === 0 && <p className="text-xs text-gray-500">No assets recorded yet.</p>}
        {assets.map((a) => (
          <div key={a.id} className="border border-gray-200 rounded-lg p-2.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{a.name} <span className="font-normal text-gray-500">· {a.category}{a.location ? ` · ${a.location}` : ""}</span></span>
              <span className={a.condition === "good" ? "text-green-700" : a.condition === "fair" ? "text-amber-700" : "text-red-600"}>{pretty(a.condition)}</span>
            </div>
            {a.purchase_cost != null && <p className="text-gray-500">Cost {formatNaira(a.purchase_cost)}</p>}
            {a.history.length > 0 && <p className="text-[11px] text-gray-500 mt-0.5">Last: {pretty(a.history[0].kind)}{a.history[0].note ? ` (${a.history[0].note})` : ""} · {formatDateTime(a.history[0].at)}</p>}
            {canEdit && <button className="mt-1.5 px-2.5 py-1 rounded-full border" onClick={() => { setAId(a.id); setAName(a.name); setACat(a.category); setALoc(a.location ?? ""); setASerial(a.serial ?? ""); setADate(a.purchase_date ?? ""); setACost(a.purchase_cost != null ? String(a.purchase_cost) : ""); setACond(a.condition); setANotes(a.notes ?? ""); }}>Edit</button>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {([["orders", "🛎️ Orders"], ["sell", "🧾 Sell"], ["menu", "📋 Menu"], ["stock", "📦 Stock"], ["assets", "🏷️ Assets"]] as [Sub, string][]).map(([k, label]) => (
          <button key={k} onClick={() => { setSub(k); setMsg(null); setErr(null); }} className={`whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full ${sub === k ? "bg-chs-charcoal text-white" : "border border-gray-300 text-chs-charcoal"}`}>{label}</button>
        ))}
      </div>
      <p className="text-[11px] text-gray-500">Your public hotel page (photos, rooms, prices and menu): <a href={`/hotel/${propertyId}`} target="_blank" rel="noreferrer" className="underline">open and share it</a>. It shows only once the listing is verified and active.</p>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
      {sub === "orders" && renderOrders()}
      {sub === "sell" && renderSell()}
      {sub === "menu" && renderMenu()}
      {sub === "stock" && renderStock()}
      {sub === "assets" && renderAssets()}
    </div>
  );
}
