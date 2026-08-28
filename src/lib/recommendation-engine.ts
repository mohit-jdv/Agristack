// ============================================================================
// RECOMMENDATION ENGINE
// ----------------------------------------------------------------------------
// Pure, deterministic, rule-based scoring. No LLM is involved anywhere in
// this file — an AI agent (Milestone 4) may later CALL this engine as a tool
// and explain its output in natural language, but it must never be allowed
// to compute or override the numbers themselves.
//
// SCORING MODEL (intentionally simple + easy to tune):
//   final score = 100 * (
//       WEIGHTS.netReturn   * normalize(netReturn, best-to-worst among options)
//     + WEIGHTS.waitingTime * normalize(-waitingMinutes, best-to-worst)
//     + WEIGHTS.availability * availabilityScore
//   )
//
// - Net return dominates, since "expected net benefit" is the whole point of
//   the product (not just headline price).
// - Waiting time is normalized *within this comparison set* (the option with
//   the shortest wait among the candidates gets full marks for that factor,
//   the longest gets zero), so the score adapts to whatever options are on
//   the table rather than using a fixed, possibly-wrong absolute scale.
// - Availability is a small bonus/penalty, since it mostly affects reliability
//   rather than money in hand.
// ============================================================================

import { calculateFinancials } from "./calculations";
import type {
  Availability,
  RecommendationResult,
  ScoreFactor,
  ScoredOption,
  SellingOption,
} from "./types";

/** Edit these to change how much each factor matters. Must sum to 1. */
export const WEIGHTS = {
  netReturn: 0.7,
  waitingTime: 0.2,
  availability: 0.1,
} as const;

const AVAILABILITY_SCORE: Record<Availability, number> = {
  High: 1,
  Medium: 0.6,
  Low: 0.2,
};

export function rankSellingOptions(
  options: SellingOption[],
  quantityQuintals: number
): RecommendationResult["rankedOptions"] {
  if (options.length === 0) {
    throw new Error("At least one selling option is required to generate a recommendation");
  }

  const withFinancials = options.map((option) => ({
    option,
    financials: calculateFinancials(option, quantityQuintals),
  }));

  const netReturns = withFinancials.map((o) => o.financials.netReturn);
  const waitTimes = withFinancials.map((o) => o.option.waitingMinutes);

  const netReturnRange = minMax(netReturns);
  const waitTimeRange = minMax(waitTimes);

  const scored: ScoredOption[] = withFinancials.map(({ option, financials }) => {
    const netReturnNorm = normalize(financials.netReturn, netReturnRange);
    // Shorter wait is better, so invert by normalizing the negative.
    const waitingNorm = waitTimeRange.max === waitTimeRange.min
      ? 1
      : 1 - normalize(option.waitingMinutes, waitTimeRange);
    const availabilityNorm = AVAILABILITY_SCORE[option.availability];

    const netReturnContribution = WEIGHTS.netReturn * netReturnNorm * 100;
    const waitingContribution = WEIGHTS.waitingTime * waitingNorm * 100;
    const availabilityContribution = WEIGHTS.availability * availabilityNorm * 100;

    const score = round1(netReturnContribution + waitingContribution + availabilityContribution);

    const scoreFactors: ScoreFactor[] = [
      {
        label: "Net return",
        impact: round1(netReturnContribution),
        detail: `Net return ranks ${describeRank(netReturnNorm)} among compared options`,
      },
      {
        label: "Waiting time",
        impact: round1(waitingContribution),
        detail: `Estimated wait ranks ${describeRank(waitingNorm)} among compared options`,
      },
      {
        label: "Availability",
        impact: round1(availabilityContribution),
        detail: `Availability is ${option.availability}`,
      },
    ];

    return {
      ...option,
      financials,
      score,
      scoreFactors,
      rank: 0, // assigned after sort
    };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((option, index) => {
    option.rank = index + 1;
  });

  return scored;
}

export function generateRecommendation(
  cropDetails: RecommendationResult["cropDetails"],
  options: SellingOption[]
): RecommendationResult {
  const rankedOptions = rankSellingOptions(options, cropDetails.quantity);
  const recommended = rankedOptions[0];
  if (!recommended) {
    throw new Error("Failed to compute a recommendation from the given options");
  }

  return {
    cropDetails,
    rankedOptions,
    recommended,
    generatedAt: new Date().toISOString(),
  };
}

// -- helpers ----------------------------------------------------------------

function minMax(values: number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Linearly maps value into [0, 1] given the observed min/max. Flat range -> 1 for all. */
function normalize(value: number, range: { min: number; max: number }): number {
  if (range.max === range.min) return 1;
  return (value - range.min) / (range.max - range.min);
}

function describeRank(norm: number): string {
  if (norm >= 0.85) return "best";
  if (norm >= 0.6) return "above average";
  if (norm >= 0.4) return "average";
  if (norm >= 0.15) return "below average";
  return "worst";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
