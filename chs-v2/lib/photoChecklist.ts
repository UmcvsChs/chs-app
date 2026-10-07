import { PROPERTY_TYPE_CATEGORIES } from "@/types/propertyTypes";

// The exact photographs an owner must take to list a property — built from the property itself, so it GROWS with
// the rooms the owner declares. A 3-bedroom, 3-bathroom house asks for the master bedroom and two more bedrooms,
// each with its walls, ceiling and floor; for each bathroom, the WC, the shower or basin, the walls and ceiling,
// and the floor — the same breakdown a tenant is later asked to confirm at move-in. The system names every photo
// (so nobody has to), and a buyer or tenant sees the caption beside each one.
//
// Why: a fixed list of ten photos let an owner of a 3-bedroom house show ONE bedroom and ONE bathroom, with
// nothing about ceilings, walls, floors or fixtures — so a buyer could not "inspect" the property from the
// photographs, and a later dispute had no evidence of its condition at listing.

export interface PhotoSlot {
  key: string;      // stable id, e.g. "bed_2_ceiling"
  group: string;    // the area, e.g. "Bedroom 2"
  label: string;    // the item, e.g. "Ceiling"
  caption: string;  // what buyers/tenants see, e.g. "Bedroom 2 — Ceiling"
  hint: string;     // what exactly to photograph
}

export type PropertyKind = "residential" | "commercial" | "land";

export function propertyKind(propertyType: string): PropertyKind {
  const cat = PROPERTY_TYPE_CATEGORIES.find((c) => c.options.includes(propertyType));
  const label = (cat?.label || "").toLowerCase();
  if (label.includes("land") || label.includes("agric")) return "land";
  if (label.includes("residential") || label.includes("hospitality")) return "residential";
  return "commercial";
}

const MAX_ROOMS = 15;

function slot(key: string, group: string, label: string, hint: string): PhotoSlot {
  return { key, group, label, caption: `${group} — ${label}`, hint };
}

const WALLS = "Stand in the doorway and capture all the walls. Show any cracks, damp or stains.";
const CEILING = "Point the camera straight up: the whole ceiling, including any stains or leaks.";
const FLOOR = "Point down: the floor or tiles, clearly, including any cracks or damage.";

function interior(prefix: string, group: string): PhotoSlot[] {
  return [
    slot(`${prefix}_walls`, group, "Walls", WALLS),
    slot(`${prefix}_ceiling`, group, "Ceiling", CEILING),
    slot(`${prefix}_floor`, group, "Floor", FLOOR),
  ];
}

function toilet(prefix: string, group: string, bath: boolean): PhotoSlot[] {
  return [
    slot(`${prefix}_wc`, group, "WC (toilet)", "The toilet seat and cistern, so a buyer can see it is complete and in working order."),
    slot(`${prefix}_basin`, group, bath ? "Shower / bath / wash basin" : "Wash basin", "The shower, bath and wash basin: taps, fittings and drainage."),
    slot(`${prefix}_walls_ceiling`, group, "Walls and ceiling", "The walls (tiles) and the ceiling together, showing any damp or stains."),
    slot(`${prefix}_floor`, group, "Floor", FLOOR),
  ];
}

export function buildPhotoChecklist(o: {
  propertyType: string;
  bedrooms: number | "";
  bathrooms: number | "";
  toilets: number | "";
}): PhotoSlot[] {
  const kind = propertyKind(o.propertyType);
  const n = (v: number | "") => Math.min(MAX_ROOMS, Math.max(0, Number(v) || 0));

  if (kind === "land") {
    return [
      slot("land_access", "The land", "Access road and front", "Stand on the road and show how the land is reached, with the front of the plot."),
      slot("land_left", "The land", "Left boundary", "Walk the left boundary and show where it runs."),
      slot("land_right", "The land", "Right boundary", "Walk the right boundary and show where it runs."),
      slot("land_back", "The land", "Back boundary", "Show the far end of the land."),
      slot("land_beacon", "The land", "Survey beacon / boundary marker", "A survey beacon, pillar or boundary marker, close enough to read any number on it."),
      slot("land_wide", "The land", "Wide view of the whole land", "From the best vantage point, one wide photo showing the whole plot."),
    ];
  }

  const slots: PhotoSlot[] = [
    slot("ext_front", "Outside", "Front of the building", "The whole front of the building. This becomes the main photo buyers see first."),
    slot("ext_rear", "Outside", "Rear of the building", "The whole back of the building."),
    slot("ext_left", "Outside", "Left side", "The left side of the building."),
    slot("ext_right", "Outside", "Right side", "The right side of the building."),
    slot("ext_roof", "Outside", "Roof", "The roof, from the best angle you can safely get, showing its condition."),
    slot("ext_compound", "Outside", "Compound and access road", "The compound or surroundings, and the road that leads to it."),
  ];

  if (kind === "residential") {
    slots.push(...interior("living", "Living room").map((s) => s));
    slots.push(slot("kitchen_cooking", "Kitchen", "Cooking area and sink", "The cooking area, sink and cabinets."));
    slots.push(...interior("kitchen", "Kitchen"));

    const beds = n(o.bedrooms) || 1; // a self-contained, mini flat or bedsitter still has one sleeping area
    for (let i = 1; i <= beds; i++) {
      const group = beds === 1 ? "Bedroom" : i === 1 ? "Master bedroom" : `Bedroom ${i}`;
      slots.push(...interior(`bed_${i}`, group));
    }

    const baths = n(o.bathrooms) || (n(o.toilets) ? 0 : 1);
    for (let i = 1; i <= baths; i++) slots.push(...toilet(`bath_${i}`, baths === 1 ? "Bathroom" : `Bathroom ${i}`, true));
    const extra = Math.max(0, n(o.toilets) - baths);
    for (let i = 1; i <= extra; i++) slots.push(...toilet(`toilet_${i}`, extra === 1 ? "Extra toilet" : `Extra toilet ${i}`, false));
  } else {
    slots.push(...interior("main", "Main interior"));
    const t = n(o.toilets);
    for (let i = 1; i <= t; i++) slots.push(...toilet(`toilet_${i}`, t === 1 ? "Toilet" : `Toilet ${i}`, false));
  }

  slots.push(slot("utility_meter_water", "Utilities", "Electricity meter and water source", "The electricity meter, and the water source (tap, borehole or tank)."));
  return slots;
}

export function groupSlots(slots: PhotoSlot[]): { group: string; slots: PhotoSlot[] }[] {
  const out: { group: string; slots: PhotoSlot[] }[] = [];
  for (const s of slots) {
    const last = out[out.length - 1];
    if (last && last.group === s.group) last.slots.push(s);
    else out.push({ group: s.group, slots: [s] });
  }
  return out;
}
