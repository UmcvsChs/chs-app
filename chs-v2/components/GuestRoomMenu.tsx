"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatNaira } from "@/lib/format";

// Digital menu for a checked-in hotel guest. Shows nothing until the hotel has checked the guest in
// and put at least one item on its menu. Guests pay the hotel directly; CHS does not hold this money.

interface Item { id: string; category: string; name: string; description: string | null; price: number }
interface Menu { property_title: string; room_label: string | null; items: Item[] }
interface MyOrder { id: string; status: string; total: number; placed_at: string; paid_at: string | null; lines: { name: string; qty: number; unit_price: number }[] | null }

export default function GuestRoomMenu({ bookingId }: { bookingId: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_guest_menu", { p_booking_id: bookingId });
    if (error || !data) { setMenu(null); return; }
    setMenu(data as Menu);
    const o = await supabase.rpc("get_my_room_orders", { p_booking_id: bookingId });
    if (!o.error && o.data) setOrders(o.data as MyOrder[]);
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!menu || menu.items.length === 0) return null;

  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([menu_item_id, qty]) => ({ menu_item_id, qty }));
  const total = lines.reduce((s, l) => s + l.qty * Number(menu.items.find((i) => i.id === l.menu_item_id)?.price ?? 0), 0);
  const categories = Array.from(new Set(menu.items.map((i) => i.category)));

  async function order() {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("place_room_order", { p_booking_id: bookingId, p_lines: lines, p_note: note || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Order sent. The hotel will bring it to your room. You pay the hotel directly.");
    setCart({}); setNote(""); load();
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-xl p-3">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center text-sm font-semibold">
        <span>🍽️ Order to your room{menu.room_label ? ` (${menu.room_label})` : ""}</span><span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {categories.map((c) => (
            <div key={c}>
              <p className="text-xs font-semibold text-gray-500 mb-1">{c}</p>
              {menu.items.filter((i) => i.category === c).map((i) => (
                <div key={i.id} className="flex items-center justify-between text-xs py-1">
                  <span>{i.name} <span className="text-gray-500">· {formatNaira(i.price)}</span>{i.description && <span className="block text-[11px] text-gray-500">{i.description}</span>}</span>
                  <span className="flex items-center gap-2">
                    <button className="w-6 h-6 rounded-full border" onClick={() => setCart((x) => ({ ...x, [i.id]: Math.max(0, (x[i.id] ?? 0) - 1) }))}>−</button>
                    <span className="w-5 text-center">{cart[i.id] ?? 0}</span>
                    <button className="w-6 h-6 rounded-full border" onClick={() => setCart((x) => ({ ...x, [i.id]: Math.min(99, (x[i.id] ?? 0) + 1) }))}>+</button>
                  </span>
                </div>
              ))}
            </div>
          ))}
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Any note for the kitchen (optional)" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
          <button disabled={busy || lines.length === 0} onClick={order} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
            Place order{total > 0 ? ` · ${formatNaira(total)}` : ""}
          </button>
          <p className="text-[11px] text-gray-500">You pay the hotel directly (cash, transfer or POS). This is separate from your CHS booking payment.</p>
          {msg && <p className="text-xs text-green-700">{msg}</p>}
          {err && <p className="text-xs text-red-600">{err}</p>}
          {orders.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Your orders</p>
              <ul className="text-xs space-y-1">
                {orders.map((o) => (
                  <li key={o.id} className="border-t border-gray-100 pt-1">
                    {formatDateTime(o.placed_at)} · <span className="capitalize">{o.status}</span> · {formatNaira(o.total)}{o.paid_at ? " · paid" : ""}
                    <span className="block text-gray-500">{(o.lines ?? []).map((l) => `${l.qty} × ${l.name}`).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
