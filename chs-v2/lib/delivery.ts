"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface NgCity { id: number; state: string; name: string; }
export interface DeliveryHint {
  product_id: string; vendor_city: string | null; vendor_state: string | null; km: number; band: string; nearby: boolean;
  mode: "vendor_free" | "chs_local" | "courier"; est_fee: number; eta_min_days: number; eta_max_days: number; handling: string; weight_kg: number;
}
export interface DeliveryOption { mode: "vendor_free" | "chs_local" | "courier" | "hub_pickup"; label: string; fee: number; insurance: number; eta_min: number; eta_max: number; }
export interface DeliveryGroup {
  vendor_id: string; vendor_name: string; vendor_city: string | null; km: number; band: string; weight_kg: number; goods_value: number; handling: string;
  options: DeliveryOption[]; mode: DeliveryOption["mode"]; fee: number; insurance: number; consolidated: boolean; eta_min: number; eta_max: number;
}
export interface DeliveryPreview { groups: DeliveryGroup[]; delivery_total: number; }

export const MODE_LABEL: Record<string, string> = {
  vendor_free: "Delivered free by the seller", chs_local: "CHS city delivery", courier: "Intercity door delivery", hub_pickup: "Pick up at a CHS centre",
};
export const STATUS_LABEL: Record<string, string> = {
  awaiting_dispatch: "Seller is preparing it", dispatched: "Handed over for delivery", at_origin_hub: "At CHS origin centre", in_transit: "On the road",
  at_destination_hub: "Arrived at your city's CHS centre", out_for_delivery: "Out for delivery", delivered_by_carrier: "Delivered, awaiting your confirmation",
  delivered: "Delivered and confirmed", problem: "Problem reported", cancelled: "Cancelled",
};

const KEY = "chs_delivery_city";

export function etaText(minDays: number, maxDays: number): string {
  const f = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }); };
  if (maxDays <= 0) return "Today";
  return minDays === maxDays ? f(maxDays) : `${f(minDays)} to ${f(maxDays)}`;
}

export function distanceLabel(km: number): string {
  if (km <= 30) return km <= 10 ? "in your city" : `about ${km} km away`;
  return `about ${km} km away`;
}

// The city the buyer wants goods delivered to. Kept in this browser (so browsing works before login) and, when logged in, saved to the account.
export function useDeliveryCity(userId?: string) {
  const [cities, setCities] = useState<NgCity[]>([]);
  const [cityId, setCityIdState] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("ng_cities").select("id,state,name").order("state").order("name").then(({ data }) => setCities((data as NgCity[]) || []));
    try { const v = localStorage.getItem(KEY); // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v) setCityIdState(Number(v)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!userId) return;
    supabase.from("user_delivery_prefs").select("city_id").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data?.city_id) { setCityIdState(data.city_id); try { localStorage.setItem(KEY, String(data.city_id)); } catch { /* ignore */ } }
    });
  }, [userId]);

  const setCityId = useCallback((id: number) => {
    setCityIdState(id);
    try { localStorage.setItem(KEY, String(id)); } catch { /* ignore */ }
    if (userId) supabase.rpc("set_my_delivery_city", { p_city_id: id }).then(() => {});
  }, [userId]);

  return { cities, cityId, setCityId, city: cities.find((c) => c.id === cityId) || null };
}
