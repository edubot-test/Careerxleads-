import type { SignalSet } from './signals';

/**
 * Struggle score 0–10.
 *
 * Calibration: EU-diverse targeting with Indians as priority.
 * - EU relevance gives a small bonus (replaces Indian-only origin check)
 * - Career switch is now a scored signal
 * - Work permit panic replaces H1B-specific panic
 * - CPT school signal disabled (US-only, not relevant for EU)
 *
 * Max path: work permit panic (3) + frustration (2) + financial (2) + career switch (2) + resume (1) = 10
 */
export function calcStruggleScore(s: SignalSet): number {
  let score = 0;

  // Graduation urgency (universal — not US/EU specific)
  if (s.daysAgo >= 70 && s.daysAgo <= 85 && s.stillSearching) score += 4;
  else if (s.daysAgo >= 60 && s.daysAgo < 90 && s.stillSearching) score += 3;
  else if (s.daysAgo >= 90 && s.daysAgo <= 180 && s.stillSearching) score += 3;
  else if (s.daysAgo > 180 && s.daysAgo <= 900 && s.stillSearching) score += 2;
  else if (s.daysAgo > 180 && s.daysAgo <= 730) score += 1;

  // High-priority signals
  if (s.commentIntent) score += 2;
  if (s.visaStruggle) score += 2;
  if (s.workPermitPanic || s.workPermitResultsPanic) score += 2;
  if (s.bodyShopExit && s.stillSearching) score += 2;
  if (s.financialClock) score += 2;
  if (s.frustration) score += 2;
  if (s.careerSwitch) score += 2;

  // Lower-priority signals
  if (s.resumeReview) score += 1;
  if (!s.hasInternSignal && s.relevantField) score += 1;
  if (s.uniTier === 4) score += 1;
  if (s.premiumBadge) score += 1;
  if (s.skillGap) score += 1;
  if (s.timePressure) score += 1;

  return Math.min(score, 10);
}

export function assignTier(qualityScore: number, intentScore: number, struggleScore?: number): 1 | 2 | 3 {
  if (qualityScore >= 8 && intentScore === 3) return 1;
  if (qualityScore >= 6 || intentScore >= 2 || (struggleScore !== undefined && struggleScore >= 6)) return 2;
  return 3;
}
