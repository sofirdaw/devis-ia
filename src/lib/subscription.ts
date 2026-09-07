export const PLANS = {
  monthly: { id: "monthly", label: "1 mois", months: 1, price: 300 },
  quarter: { id: "quarter", label: "3 mois", months: 3, price: 900 },
  year: { id: "year", label: "1 an", months: 12, price: 3500 },
};

export type PlanId = keyof typeof PLANS;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getRemainingTrialDays(trialEndsAt: string | null | undefined, now = new Date()) {
  if (!trialEndsAt) return 0;
  const endTime = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.ceil((endTime - now.getTime()) / DAY_IN_MS));
}
