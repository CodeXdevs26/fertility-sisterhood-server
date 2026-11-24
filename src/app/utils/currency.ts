/** Reporting currency of the admin dashboard. */
export const REPORTING_CURRENCY = "gbp";

// fixed conversion rates to GBP (update here if they drift too far)
const USD_TO_GBP = 0.79;
const EUR_TO_GBP = 0.85;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Converts an amount to GBP for revenue reporting.
 * - GBP: as is.
 * - USD / EUR: the fixed rates above.
 * - Anything else: RevenueCat's USD price (`priceUsd`) converted from USD.
 * Returns null when it cannot be converted (then it is left out of revenue).
 */
export const toGbp = (
  amount: number,
  currency?: string | null,
  priceUsd?: number | null
): number | null => {
  switch ((currency ?? "").toLowerCase()) {
    case "gbp":
      return round2(amount);
    case "usd":
      return round2(amount * USD_TO_GBP);
    case "eur":
      return round2(amount * EUR_TO_GBP);
    default:
      return priceUsd != null ? round2(Math.abs(priceUsd) * USD_TO_GBP) : null;
  }
};
