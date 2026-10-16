"use client";

import { useCallback, useEffect, useState } from "react";

// The shopping cart lives in the buyer's own browser (so it survives a back button, a refresh or closing the page on a
// phone) and is re-priced by the server every time it is shown, so a stale price or stock count can never be paid.
export interface CartLine { product_id: string; quantity: number; options: Record<string, string>; }

const keyFor = (userId?: string | null) => `chs_cart_${userId || "guest"}`;
const lineId = (l: CartLine) => `${l.product_id}|${JSON.stringify(Object.entries(l.options || {}).sort())}`;

function read(key: string): CartLine[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((l) => l && l.product_id && l.quantity > 0) : [];
  } catch { return []; }
}

export function useCart(userId?: string | null) {
  const [items, setItems] = useState<CartLine[]>([]);
  useEffect(() => {
    let cur = read(keyFor(userId));
    // items added before logging in follow the buyer into their own cart
    if (userId) {
      const guest = read(keyFor(null));
      if (guest.length) {
        for (const g of guest) {
          const i = cur.findIndex((l) => lineId(l) === lineId(g));
          if (i >= 0) cur[i] = { ...cur[i], quantity: Math.min(cur[i].quantity + g.quantity, 1000) }; else cur.push(g);
        }
        try { localStorage.setItem(keyFor(userId), JSON.stringify(cur)); localStorage.removeItem(keyFor(null)); } catch { /* ignore */ }
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(cur);
  }, [userId]);

  const save = useCallback((next: CartLine[]) => {
    setItems(next);
    try { localStorage.setItem(keyFor(userId), JSON.stringify(next)); } catch { /* storage blocked: cart still works for this visit */ }
  }, [userId]);

  const add = useCallback((line: CartLine) => {
    const cur = read(keyFor(userId));
    const i = cur.findIndex((l) => lineId(l) === lineId(line));
    if (i >= 0) cur[i] = { ...cur[i], quantity: Math.min(cur[i].quantity + line.quantity, 1000) };
    else cur.push(line);
    save(cur);
  }, [userId, save]);

  const setQty = useCallback((index: number, quantity: number) => {
    const cur = read(keyFor(userId));
    if (!cur[index]) return;
    if (quantity < 1) cur.splice(index, 1); else cur[index] = { ...cur[index], quantity: Math.min(quantity, 1000) };
    save(cur);
  }, [userId, save]);

  const remove = useCallback((index: number) => setQty(index, 0), [setQty]);
  const clear = useCallback(() => save([]), [save]);
  const count = items.reduce((n, l) => n + l.quantity, 0);
  return { items, add, setQty, remove, clear, count };
}
