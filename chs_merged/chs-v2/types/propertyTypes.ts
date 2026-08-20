// The real, complete property type list, restored exactly from the
// original app — organized by category, not the bare 6-item list this
// rebuild had reduced it to. Genuinely comprehensive: residential,
// commercial, industrial, hospitality, land, institutional, and
// agricultural — matching real Nigerian real estate categories, not
// just houses and flats.
export const PROPERTY_TYPE_CATEGORIES: { label: string; icon: string; options: string[] }[] = [
  {
    label: "Residential", icon: "🏠",
    options: [
      "Self-Contained / Mini Flat", "1-Bedroom Flat / Apartment", "2-Bedroom Flat / Apartment",
      "3-Bedroom Flat / Apartment", "4+ Bedroom Flat / Apartment", "Bungalow (detached)",
      "Duplex (semi-detached)", "Duplex (fully detached)", "Terrace House", "Maisonette",
      "Penthouse", "Boys' Quarters (BQ) standalone", "Block of Flats (whole building)",
      "Mini Estate / Gated Compound", "Mansion",
    ],
  },
  {
    label: "Commercial", icon: "🏢",
    options: [
      "Shop / Lock-up Store", "Office Space (open plan)", "Serviced Office / Co-working Space",
      "Showroom", "Supermarket Space", "Restaurant / Eatery Space", "Bank Space / Branch Premises",
      "Plaza (whole building)", "Plaza Unit (shop within plaza)", "Shopping Complex / Mall Space",
      "Business Centre",
    ],
  },
  {
    label: "Industrial", icon: "🏭",
    options: [
      "Warehouse", "Factory", "Workshop / Fabrication Shop", "Cold Room / Storage Facility",
      "Distribution / Logistics Centre", "Container Yard",
    ],
  },
  {
    label: "Hospitality", icon: "🏨",
    options: [
      "Hotel", "Guest House / Lodge", "Event Centre / Hall", "Resort",
      "Short-let / Service Apartment", "Recreational Centre / Club House",
    ],
  },
  {
    label: "Land", icon: "🌳",
    options: [
      "Residential Land / Plot", "Commercial Land / Plot", "Industrial Land",
      "Farmland (agricultural)", "Waterfront Land", "Estate Plot (within layout)", "Mixed-use Land",
    ],
  },
  {
    label: "Special Purpose / Institutional", icon: "🏛️",
    options: [
      "School / Educational Facility", "Hospital / Clinic Premises", "Fuel / Filling Station",
      "Motor Park / Garage", "Market Stall / Market Space", "Market Square (open)",
      "Place of Worship (Church/Mosque)", "Car Park (parking facility)",
      "Cinema / Entertainment Centre", "Sports Facility",
    ],
  },
  {
    label: "Agricultural", icon: "🌾",
    options: [
      "Farmland (crop)", "Ranch / Livestock Land", "Poultry Farm", "Fishery / Fish Pond", "Plantation",
    ],
  },
];
