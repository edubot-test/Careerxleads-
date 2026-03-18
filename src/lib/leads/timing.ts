/**
 * Estimate graduation date from year + month hint in headline.
 * Checks for explicit month names, then "Spring" → May, "Fall/Winter" → December.
 * Defaults to May 15 (spring commencement — most common US grad date).
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

/** H1B lottery season: March 1 – May 31 (registration March, results April/May) */
export function isH1BSeasonNow(): boolean {
  const m = new Date().getMonth(); // 0=Jan
  return m >= 2 && m <= 4;
}

/** H1B Results Window: March 25 – April 30 (USCIS announces lottery selections) */
export function isH1BResultsWindow(): boolean {
  const now = new Date();
  const m = now.getMonth();
  const d = now.getDate();
  return (m === 2 && d >= 25) || m === 3;
}
