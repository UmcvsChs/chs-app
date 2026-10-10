// Rule-based helpers for bringing an operator's own spreadsheet into CHS: guess which column is which from its
// heading, turn messy cell values (₦12,500 · 03/09/2026 · "Food & drink") into clean ones. Nothing is saved
// from here: the person sees a preview and confirms.
export type ImportKind = "rooms" | "income" | "expense";
export interface FieldDef { key: string; label: string; required: boolean; words: string[] }

export const FIELDS: Record<ImportKind, FieldDef[]> = {
  rooms: [
    { key: "room", label: "Room number or name", required: true, words: ["room number", "room no", "room name", "room", "number", "no", "unit", "name"] },
    { key: "type", label: "Room type", required: false, words: ["room type", "type", "category", "class", "kind"] },
    { key: "price", label: "Price per night", required: true, words: ["price", "rate", "tariff", "per night", "amount", "cost"] },
    { key: "guests", label: "Maximum guests", required: false, words: ["guests", "capacity", "max", "pax", "occupancy", "persons"] },
  ],
  income: [
    { key: "date", label: "Date", required: true, words: ["date", "day", "when", "received"] },
    { key: "centre", label: "Department", required: false, words: ["department", "centre", "center", "outlet", "source", "category", "type"] },
    { key: "amount", label: "Amount", required: true, words: ["amount", "total", "sales", "value", "naira", "paid", "price"] },
    { key: "description", label: "Description", required: false, words: ["description", "details", "narration", "note", "item", "remark", "customer"] },
  ],
  expense: [
    { key: "date", label: "Date", required: true, words: ["date", "day", "when", "spent"] },
    { key: "category", label: "Category", required: false, words: ["category", "type", "expense", "department", "head"] },
    { key: "amount", label: "Amount", required: true, words: ["amount", "total", "cost", "value", "naira", "paid"] },
    { key: "description", label: "Description", required: false, words: ["description", "details", "narration", "note", "item", "remark", "payee"] },
  ],
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// For each field, the index of the best-matching column heading (or -1). A column is used at most once.
export function guessMapping(kind: ImportKind, headers: string[]): Record<string, number> {
  const used = new Set<number>();
  const out: Record<string, number> = {};
  const h = headers.map(norm);
  for (const f of FIELDS[kind]) {
    let best = -1, bestScore = 0;
    h.forEach((head, i) => {
      if (used.has(i) || !head) return;
      f.words.forEach((w, rank) => {
        const score = head === w ? 100 - rank : head.includes(w) ? 50 - rank : 0;
        if (score > bestScore) { best = i; bestScore = score; }
      });
    });
    out[f.key] = best;
    if (best >= 0) used.add(best);
  }
  return out;
}

export function cleanAmount(v: unknown): string {
  if (typeof v === "number") return String(v);
  return String(v ?? "").replace(/[^0-9.]/g, "");
}

// Dates in Nigerian sheets are day-first (03/09/2026 = 3 September). Returns ISO at midday Nigerian time.
export function cleanDate(v: unknown): string | null {
  let y: number, m: number, d: number;
  if (v instanceof Date) { y = v.getFullYear(); m = v.getMonth() + 1; d = v.getDate(); }
  else {
    const s = String(v ?? "").trim();
    let mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (mt) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
    else if ((mt = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/))) { d = +mt[1]; m = +mt[2]; y = +mt[3]; if (y < 100) y += 2000; }
    else {
      const t = Date.parse(s);
      if (isNaN(t)) return null;
      const dt = new Date(t); y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
    }
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+01:00`;
}

export function mapCentre(v: unknown): string {
  const s = norm(v);
  if (/restaurant|food|kitchen|meal|dining/.test(s)) return "restaurant";
  if (/bar|drink|beverage|liquor|wine|beer/.test(s)) return "bar";
  if (/laundry|dry ?clean|wash/.test(s)) return "laundry";
  if (/gym|fitness|spa|pool|sauna/.test(s)) return "gym";
  if (/event|hall|conference|meeting/.test(s)) return "events";
  if (/room|accommodation|lodging|walk in|walkin|reception/.test(s)) return "walk_in_rooms";
  return "other";
}

export function mapCategory(v: unknown): string {
  const s = norm(v);
  if (/salar|wage|staff|payroll/.test(s)) return "salaries";
  if (/electric|nepa|power|water|diesel|fuel|petrol|internet|data|gen|utilit/.test(s)) return "utilities";
  if (/food|drink|kitchen|beverage|grocer|bar stock/.test(s)) return "food_drink";
  if (/suppl|cleaning|toilet|stationer|linen|detergent/.test(s)) return "supplies";
  if (/repair|maintenan|plumb|paint|fix|service/.test(s)) return "repairs";
  if (/advert|marketing|promo|ads|social/.test(s)) return "marketing";
  if (/tax|levy|licen|permit|bank|charge|fee/.test(s)) return "taxes_fees";
  return "other";
}

export interface BuiltRow { row: Record<string, string>; problem: string | null }

export function buildRows(kind: ImportKind, data: unknown[][], mapping: Record<string, number>): BuiltRow[] {
  const get = (r: unknown[], key: string) => (mapping[key] >= 0 ? r[mapping[key]] : undefined);
  return data.filter((r) => r.some((c) => c !== null && c !== "" && c !== undefined)).map((r): BuiltRow => {
    if (kind === "rooms") {
      const room = String(get(r, "room") ?? "").trim();
      const price = cleanAmount(get(r, "price"));
      const problem = !room ? "Room name missing" : !price || Number(price) <= 0 ? "Price missing" : null;
      return { row: { room, type: String(get(r, "type") ?? "").trim(), price, guests: cleanAmount(get(r, "guests")) }, problem };
    }
    const date = cleanDate(get(r, "date"));
    const amount = cleanAmount(get(r, "amount"));
    const problem = !date ? "Date not understood" : !amount || Number(amount) <= 0 ? "Amount missing" : new Date(date).getTime() > Date.now() + 86400000 ? "Date is in the future" : null;
    const description = String(get(r, "description") ?? "").trim();
    return kind === "income"
      ? { row: { date: date || "", centre: mapCentre(get(r, "centre")), amount, description }, problem }
      : { row: { date: date || "", category: mapCategory(get(r, "category")), amount, description }, problem };
  });
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let cur: string[] = []; let cell = ""; let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") { cur.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; cur.push(cell); rows.push(cur); cur = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || cur.length) { cur.push(cell); rows.push(cur); }
  return rows;
}
