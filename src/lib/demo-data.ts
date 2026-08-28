// ============================================================================
// DEMO DATA — NOT REAL-TIME GOVERNMENT DATA
// ----------------------------------------------------------------------------
// Everything in this file is hand-entered sample data for the SIH prototype.
// Every record is stamped isDemoData: true, and the UI must always surface
// that label to the farmer. When real e-NAM / mandi / procurement APIs are
// connected (Milestone 3+), this file is replaced by live fetchers behind the
// same SellingOption shape — nothing downstream should need to change.
// ============================================================================

import type { CropDetails, SellingOption } from "./types";

/** Seeded-demo identity only. The Farmer UI uses the current session name, never this. */
export const DEMO_FARMER = {
  name: "Ramesh Patil",
  location: "Nashik, Maharashtra",
};

export const DEMO_CROP_DETAILS: CropDetails = {
  crop: "Onion",
  quantity: 50, // quintals
  location: "Nashik, Maharashtra",
};

export const DEMO_SELLING_OPTIONS: SellingOption[] = [
  {
    id: "lasalgaon-apmc",
    name: "Lasalgaon APMC",
    type: "APMC",
    price: 4400,
    distance: 45,
    transportCost: 6500,
    waitingMinutes: 120,
    availability: "High",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Nashik",
  },
  {
    id: "manmad-apmc",
    name: "Manmad APMC",
    type: "APMC",
    price: 3800,
    distance: 65,
    transportCost: 8500,
    waitingMinutes: 180,
    availability: "Medium",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Nashik",
  },
  {
    id: "pune-apmc",
    name: "Pune APMC",
    type: "APMC",
    price: 2750,
    distance: 210,
    transportCost: 22000,
    waitingMinutes: 300,
    availability: "Medium",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Pune",
  },
  {
    id: "jalgaon-apmc",
    name: "Jalgaon APMC",
    type: "APMC",
    price: 2500,
    distance: 160,
    transportCost: 17000,
    waitingMinutes: 240,
    availability: "High",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Jalgaon",
  },
  {
    id: "govt-procurement-lasalgaon",
    name: "Lasalgaon Government Procurement Centre",
    type: "GOVERNMENT_PROCUREMENT",
    price: 2150,
    distance: 45,
    transportCost: 6500,
    waitingMinutes: 90,
    availability: "High",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Nashik",
  },
  {
    id: "govt-procurement-manmad",
    name: "Manmad Government Procurement Centre",
    type: "GOVERNMENT_PROCUREMENT",
    price: 2110,
    distance: 65,
    transportCost: 8500,
    waitingMinutes: 110,
    availability: "Medium",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Nashik",
  },
  {
    id: "govt-procurement-nashik",
    name: "Nashik Government Procurement Centre",
    type: "GOVERNMENT_PROCUREMENT",
    price: 2125,
    distance: 55,
    transportCost: 7500,
    waitingMinutes: 180,
    availability: "Medium",
    status: "Busy",
    isDemoData: true,
    state: "Maharashtra",
    district: "Nashik",
  },
  {
    id: "govt-procurement-pune",
    name: "Pune Government Procurement Centre",
    type: "GOVERNMENT_PROCUREMENT",
    price: 2100,
    distance: 210,
    transportCost: 22000,
    waitingMinutes: 150,
    availability: "High",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Pune",
  },
  {
    id: "govt-procurement-nagpur",
    name: "Nagpur Government Procurement Centre",
    type: "GOVERNMENT_PROCUREMENT",
    price: 2050,
    distance: 400,
    transportCost: 35000,
    waitingMinutes: 160,
    availability: "Medium",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Nagpur",
  },
  {
    id: "govt-procurement-jalgaon",
    name: "Jalgaon Government Procurement Centre",
    type: "GOVERNMENT_PROCUREMENT",
    price: 2080,
    distance: 160,
    transportCost: 17000,
    waitingMinutes: 140,
    availability: "High",
    status: "Open",
    isDemoData: true,
    state: "Maharashtra",
    district: "Jalgaon",
  },
  {
    id: "unjha-market",
    name: "Unjha Market",
    type: "APMC",
    price: 4100,
    distance: 550,
    transportCost: 60000,
    waitingMinutes: 240,
    availability: "Medium",
    status: "Open",
    isDemoData: true,
    state: "Gujarat",
    district: "Mehsana",
  },
];

/** Crops offered in the demo dropdown. Real crop list will come from the `crops` table. */
export const DEMO_CROPS = ["Onion", "Tomato", "Soybean", "Cotton", "Wheat"] as const;
