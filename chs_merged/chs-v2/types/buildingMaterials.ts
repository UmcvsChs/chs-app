// The real, complete building materials catalog from the original app,
// restored faithfully — 7 real sections, 66 real materials, each with
// its own correctly locked pricing unit. This is what makes genuine
// price comparison between vendors possible: everyone selling "Cement
// (50kg bag)" is priced "per bag", not one vendor "per tonne" and
// another "per truckload" with no way to compare.

export interface MaterialEntry {
  name: string;
  unit: string | null; // null means "Others" — free-text unit instead
}

export const BUILDING_MATERIALS_CATALOG: Record<string, MaterialEntry[]> = {
  "Foundation / Substructure": [
    {
      "name": "Cement (50kg bag)",
      "unit": "per bag"
    },
    {
      "name": "Sharp sand",
      "unit": "per trip (truckload)"
    },
    {
      "name": "Soft/plastering sand",
      "unit": "per trip (truckload)"
    },
    {
      "name": "Granite chippings / gravel",
      "unit": "per trip (truckload)"
    },
    {
      "name": "Laterite",
      "unit": "per trip (truckload)"
    },
    {
      "name": "Hardcore / broken stones",
      "unit": "per trip (truckload)"
    },
    {
      "name": "Sandcrete foundation blocks (6-inch)",
      "unit": "per piece"
    },
    {
      "name": "Sandcrete foundation blocks (9-inch)",
      "unit": "per piece"
    },
    {
      "name": "Reinforcement rods / rebar",
      "unit": "per length (12m)"
    },
    {
      "name": "Binding wire",
      "unit": "per roll"
    },
    {
      "name": "Damp Proof Course (DPC) membrane",
      "unit": "per roll"
    },
    {
      "name": "Waterproofing compound",
      "unit": "per bag"
    },
    {
      "name": "Others (foundation)",
      "unit": null
    }
  ],
  "Structural / Superstructure": [
    {
      "name": "Sandcrete walling blocks (6-inch)",
      "unit": "per piece"
    },
    {
      "name": "Sandcrete walling blocks (9-inch)",
      "unit": "per piece"
    },
    {
      "name": "Formwork timber",
      "unit": "per length"
    },
    {
      "name": "Formwork plywood",
      "unit": "per sheet"
    },
    {
      "name": "Lintel blocks",
      "unit": "per piece"
    },
    {
      "name": "Scaffolding pipes",
      "unit": "per length"
    },
    {
      "name": "Others (structural)",
      "unit": null
    }
  ],
  "Roofing": [
    {
      "name": "Aluminium long-span roofing sheets",
      "unit": "per length"
    },
    {
      "name": "Stone-coated roofing sheets",
      "unit": "per sheet"
    },
    {
      "name": "Zinc roofing sheets",
      "unit": "per sheet"
    },
    {
      "name": "Roofing timber (trusses)",
      "unit": "per length"
    },
    {
      "name": "Roofing nails",
      "unit": "per kg"
    },
    {
      "name": "Ridge caps",
      "unit": "per piece"
    },
    {
      "name": "Fascia boards",
      "unit": "per length"
    },
    {
      "name": "Gutters",
      "unit": "per length"
    },
    {
      "name": "Downpipes",
      "unit": "per length"
    },
    {
      "name": "Ceiling boards (POP/gypsum)",
      "unit": "per sheet"
    },
    {
      "name": "Others (roofing)",
      "unit": null
    }
  ],
  "Finishing — Walls, Floors & Ceilings": [
    {
      "name": "Plastering/rendering cement",
      "unit": "per bag"
    },
    {
      "name": "Floor tiles",
      "unit": "per carton"
    },
    {
      "name": "Wall tiles",
      "unit": "per carton"
    },
    {
      "name": "Paint — primer/undercoat",
      "unit": "per 20L bucket"
    },
    {
      "name": "Paint — emulsion/gloss",
      "unit": "per 20L bucket"
    },
    {
      "name": "POP cornices",
      "unit": "per length"
    },
    {
      "name": "Skirting boards",
      "unit": "per length"
    },
    {
      "name": "Others (walls/floors/ceilings)",
      "unit": null
    }
  ],
  "Finishing — Doors, Windows & Fittings": [
    {
      "name": "Flush doors",
      "unit": "per piece"
    },
    {
      "name": "Panel/security doors",
      "unit": "per piece"
    },
    {
      "name": "Door frames",
      "unit": "per piece"
    },
    {
      "name": "Aluminium casement windows",
      "unit": "per piece"
    },
    {
      "name": "Aluminium sliding windows",
      "unit": "per piece"
    },
    {
      "name": "Window frames",
      "unit": "per piece"
    },
    {
      "name": "Hinges",
      "unit": "per set"
    },
    {
      "name": "Locks",
      "unit": "per piece"
    },
    {
      "name": "Handles",
      "unit": "per piece"
    },
    {
      "name": "Others (doors/windows)",
      "unit": null
    }
  ],
  "Electrical & Plumbing": [
    {
      "name": "Electrical cable/wire",
      "unit": "per roll"
    },
    {
      "name": "Switches",
      "unit": "per piece"
    },
    {
      "name": "Sockets",
      "unit": "per piece"
    },
    {
      "name": "Conduits",
      "unit": "per length"
    },
    {
      "name": "Distribution boards",
      "unit": "per piece"
    },
    {
      "name": "PVC pipes (water/drainage)",
      "unit": "per length"
    },
    {
      "name": "Water storage tanks",
      "unit": "per piece"
    },
    {
      "name": "Taps/mixers",
      "unit": "per piece"
    },
    {
      "name": "Sanitary ware (WC, basins, tubs)",
      "unit": "per piece"
    },
    {
      "name": "Kitchen cabinets/countertops",
      "unit": "per project (custom quote)"
    },
    {
      "name": "Others (electrical/plumbing)",
      "unit": null
    }
  ],
  "General / Miscellaneous": [
    {
      "name": "Timber/wood (general)",
      "unit": "per length"
    },
    {
      "name": "Nails/screws/bolts",
      "unit": "per kg"
    },
    {
      "name": "Adhesives/construction glue",
      "unit": "per bag or per litre"
    },
    {
      "name": "Damp-proofing chemicals",
      "unit": "per litre"
    },
    {
      "name": "Termite/insecticide treatment",
      "unit": "per litre"
    },
    {
      "name": "Others (general)",
      "unit": null
    }
  ]
};

export const MATERIAL_SECTIONS = Object.keys(BUILDING_MATERIALS_CATALOG);
