// ============================================================================
// DETERMINISTIC FINANCIAL CALCULATIONS
// ----------------------------------------------------------------------------
// Every number a farmer sees must come from here, never from an LLM.
// Pure functions, fully unit-testable, no side effects, no randomness.
// ============================================================================

import type { FinancialSummary, SellingOption } from "./types";

/**
 * Gross revenue = selling price per quintal × quantity in quintals.
 * Example: ₹4,400 × 50 = ₹2,20,000
 */
export function calculateGrossRevenue(pricePerQuintal: number, quantityQuintals: number): number {
  if (pricePerQuintal < 0 || quantityQuintals < 0) {
    throw new Error("Price and quantity must be non-negative");
  }
  return round2(pricePerQuintal * quantityQuintals);
}

/**
 * Net return = gross revenue − transport cost − other costs.
 * Example: ₹2,20,000 − ₹6,500 = ₹2,13,500
 */
export function calculateNetReturn(
  grossRevenue: number,
  transportCost: number,
  otherCosts = 0
): number {
  return round2(grossRevenue - transportCost - otherCosts);
}

/**
 * Full financial breakdown for one selling option, given the farmer's quantity.
 */
export function calculateFinancials(
  option: Pick<SellingOption, "price" | "transportCost">,
  quantityQuintals: number,
  otherCosts = 0
): FinancialSummary {
  const grossRevenue = calculateGrossRevenue(option.price, quantityQuintals);
  const netReturn = calculateNetReturn(grossRevenue, option.transportCost, otherCosts);
  return {
    grossRevenue,
    transportCost: option.transportCost,
    otherCosts,
    netReturn,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Formats a number of rupees for display, e.g. 220000 -> "₹2,20,000" (Indian digit grouping). */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats minutes as "Xh Ym" or "Ym" for display. */
export function formatWaitingTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
