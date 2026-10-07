// The real, distance-based inspection fee calculator — restored
// from the original app. A real ₦150/km one-way rate, doubled for the round trip.
// RULE: the photographs, videos and "ask for more" tools are there so nobody needs to travel. If a buyer or tenant
// still insists on a physical visit, the WHOLE transport cost is theirs — not split with the owner, not carried by
// CHS — and it is worked out from where the CHS agent actually sets off, not from a fixed office.

export const CHS_OFFICE = "CHS Office — near Leventis Roundabout Post Office, Kaduna North";
export const RATE_PER_KM = 150; // ₦ per km, one way; doubled for the round trip; paid 100% by the requester

// Real, approximate road distance (km) from CHS Office to each area —
// restored exactly from the original app's own real data.
export const AREA_DISTANCE_KM: Record<string, number> = {
  "Malali GRA": 4, "Kaduna North LGA": 3,
  "Barnawa": 6, "Kaduna South LGA": 6,
  "Kawo": 5,
  "Sabon Tasha": 12, "Chikun LGA": 12,
  "Millennium City": 15, "Igabi LGA": 14,
  "Tudun Wada": 3,
  "Ungwan Rimi": 4,
  "Kachia LGA": 55,
  "Independence Way": 2,
  "Kakuri": 7,
};

// Real, popular, well-known bus stops/roundabouts per area, for a real
// meeting point selector — restored exactly.
export const AREA_MEETING_POINTS: Record<string, string[]> = {
  "Malali GRA": ["Malali Roundabout", "NNPC Filling Station Malali"],
  "Barnawa": ["Barnawa Roundabout", "Television Roundabout"],
  "Kawo": ["Kawo Bus Stop", "Kawo Market Gate"],
  "Sabon Tasha": ["Sabon Tasha Market", "Kujama Junction"],
  "Millennium City": ["Millennium City Gate", "Rigasa Roundabout"],
  "Tudun Wada": ["Tudun Wada Roundabout", "Kaduna Central Market"],
  "Ungwan Rimi": ["Ungwan Rimi Roundabout"],
  "Kachia LGA": ["Kachia Motor Park"],
  "Independence Way": ["Kaduna Central Market", "Leventis Roundabout"],
  "Kakuri": ["Air Force Base Bus Stop", "New Market Kakuri", "Galadimawa Roundabout"],
};

export function findAreaKey(locationText: string | null): string | null {
  if (!locationText) return null;
  const keys = Object.keys(AREA_DISTANCE_KM);
  for (const key of keys) {
    if (locationText.includes(key)) return key;
  }
  return null;
}

export interface InspectionFeeBreakdown {
  known: boolean;               // false = CHS has no distance data for this area, so no number is invented
  distanceKm: number | null;    // one way
  totalFee: number | null;      // the WHOLE round trip — borne 100% by whoever asks for the physical visit
  areaKey: string | null;
}

// The estimate shown BEFORE an agent is assigned. The distance table below was measured from the CHS office, so
// it is only an estimate: when CHS assigns the agent it records where that agent actually sets off from and the
// real distance (set_inspection_takeoff), and the final cost is calculated from that. The requester bears 100% of it.
export function calcInspectionFee(locationText: string | null): InspectionFeeBreakdown {
  const areaKey = findAreaKey(locationText);
  if (!areaKey) return { known: false, distanceKm: null, totalFee: null, areaKey: null };
  const distanceKm = AREA_DISTANCE_KM[areaKey];
  return { known: true, distanceKm, totalFee: distanceKm * RATE_PER_KM * 2, areaKey };
}

// One plain sentence for places that only mention the fee (e.g. the property page).
export function inspectionEstimateText(locationText: string | null): string {
  const f = calcInspectionFee(locationText);
  return f.known
    ? `about ₦${(f.totalFee as number).toLocaleString("en-NG")} for the round trip (an estimate; CHS confirms the final amount when your agent is assigned)`
    : "quoted by CHS for this area before the visit is confirmed";
}
