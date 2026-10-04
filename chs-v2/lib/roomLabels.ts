// Turns what a hotel owner types — "101-112, 201, 204" or "A1-A5" — into the
// individual room labels to create. Ranges expand ("101-103" -> 101, 102, 103),
// the prefix and zero-padding are kept ("B01-B03" -> B01, B02, B03), duplicates
// are dropped, and anything that is not a range is taken as a literal name
// ("Room 7", "Penthouse").
export const MAX_ROOMS_AT_ONCE = 300;

export interface ParsedRooms {
  labels: string[];
  error: string | null;
}

export function parseRoomLabels(input: string): ParsedRooms {
  const tokens = input.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (l: string) => { if (!seen.has(l)) { seen.add(l); out.push(l); } };

  for (const token of tokens) {
    const range = token.match(/^([A-Za-z]*)(\d+)\s*-\s*([A-Za-z]*)(\d+)$/);
    if (range) {
      const [, prefixA, startStr, prefixB, endStr] = range;
      if (prefixB && prefixB.toLowerCase() !== prefixA.toLowerCase()) {
        return { labels: [], error: `"${token}" mixes different prefixes — type it like 101-112 or A1-A5.` };
      }
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (end < start) return { labels: [], error: `"${token}" runs backwards — the second number must be larger.` };
      if (end - start + 1 > MAX_ROOMS_AT_ONCE) return { labels: [], error: `"${token}" is more than ${MAX_ROOMS_AT_ONCE} rooms at once.` };
      const width = startStr.startsWith("0") ? startStr.length : 0;
      for (let n = start; n <= end; n++) push(prefixA + (width ? String(n).padStart(width, "0") : String(n)));
    } else {
      push(token);
    }
    if (out.length > MAX_ROOMS_AT_ONCE) return { labels: [], error: `That is more than ${MAX_ROOMS_AT_ONCE} rooms at once — add them in batches.` };
  }
  return { labels: out, error: null };
}
