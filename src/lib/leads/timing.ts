/**
 * Estimate graduation date from year + month hint in headline.
 * Checks for explicit month names, then "Spring" → May, "Fall/Winter" → December.
 * Defaults to May 15 (spring commencement — most common US/EU grad date).
 */
export function getGradDateEstimate(gradYr: number, headline: string): Date {
  const h = headline.toLowerCase();
  if (/\b(january|jan)\b/.test(h))   return new Date(gradYr, 0,  15);
  if (/\b(february|feb)\b/.test(h))  return new Date(gradYr, 1,  15);
  if (/\b(march|mar)\b/.test(h))     return new Date(gradYr, 2,  15);
  if (/\b(april|apr)\b/.test(h))     return new Date(gradYr, 3,  15);
  if (/\b(may)\b/.test(h))           return new Date(gradYr, 4,  15);
  if (/\b(june|jun)\b/.test(h))      return new Date(gradYr, 5,  15);
  if (/\b(july|jul)\b/.test(h))      return new Date(gradYr, 6,  15);
  if (/\b(august|aug)\b/.test(h))    return new Date(gradYr, 7,  15);
  if (/\b(september|sep)\b/.test(h)) return new Date(gradYr, 8,  15);
  if (/\b(october|oct)\b/.test(h))   return new Date(gradYr, 9,  15);
  if (/\b(november|nov)\b/.test(h))  return new Date(gradYr, 10, 15);
  if (/\b(december|dec)\b/.test(h))  return new Date(gradYr, 11, 15);
  if (/\bfall\b|\bwinter\b/.test(h)) return new Date(gradYr, 11, 15);
  if (/\bspring\b/.test(h))          return new Date(gradYr, 4,  15);
  return new Date(gradYr, 4, 15); // default: May 15
}

// Work permit / visa season timing — configurable via env vars.
// US: H1B season March–May. UK: Graduate visa year-round. Ireland: Critical Skills year-round.
// We keep a generic "peak hiring season" window that applies across markets.
function safeInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = parseInt(raw || String(fallback), 10);
  return (isNaN(n) || n < min || n > max) ? fallback : n;
}

const PEAK_SEASON_START = safeInt(process.env.H1B_SEASON_START_MONTH, 1, 1, 12); // Jan — spring hiring
const PEAK_SEASON_END   = safeInt(process.env.H1B_SEASON_END_MONTH,   5, 1, 12); // May
const RESULTS_START_MONTH = safeInt(process.env.H1B_RESULTS_START_MONTH, 3, 1, 12);
const RESULTS_START_DAY   = safeInt(process.env.H1B_RESULTS_START_DAY,   1, 1, 31);
const RESULTS_END_MONTH   = safeInt(process.env.H1B_RESULTS_END_MONTH,   6, 1, 12);
const RESULTS_END_DAY     = safeInt(process.env.H1B_RESULTS_END_DAY,     30, 1, 31);

/** Peak hiring / work permit season (default: January–May) */
export function isWorkPermitSeasonNow(): boolean {
  const m = new Date().getMonth() + 1;
  return m >= PEAK_SEASON_START && m <= PEAK_SEASON_END;
}

/** Work permit results / peak urgency window (default: March 1 – June 30) */
export function isWorkPermitResultsWindow(): boolean {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const afterStart = m > RESULTS_START_MONTH || (m === RESULTS_START_MONTH && d >= RESULTS_START_DAY);
  const beforeEnd  = m < RESULTS_END_MONTH   || (m === RESULTS_END_MONTH   && d <= RESULTS_END_DAY);
  return afterStart && beforeEnd;
}

// Backward compat aliases
export const isH1BSeasonNow = isWorkPermitSeasonNow;
export const isH1BResultsWindow = isWorkPermitResultsWindow;
