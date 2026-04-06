import { EU_COUNTRY_RE, EU_CITY_RE, EU_UNI_RE, JOB_SEARCH_INTENT_RE, WORK_PERMIT_RE } from './patterns';

/**
 * Check if a profile is EU-based or EU-relevant.
 * Returns true if ANY signal indicates they're in or targeting EU.
 * This is intentionally broad — we want diverse profiles, not origin filtering.
 */
export function checkEURelevance(p: any): boolean {
  const location = (p.location || '').toLowerCase();
  const headline = (p.headline || '').toLowerCase();
  const summary = (p.summary || '').toLowerCase();
  const combinedText = `${location} ${headline} ${summary}`;

  const currentUni = (p.education?.[0]?.schoolName || p.university || '').toLowerCase();

  // Signal 1: Located in EU
  const euLocation = EU_COUNTRY_RE.test(location) || EU_CITY_RE.test(location);
  // Signal 2: Studying at EU university
  const euUni = EU_UNI_RE.test(currentUni);
  // Signal 3: Mentions EU work permit / visa
  const euVisa = WORK_PERMIT_RE.test(combinedText);
  // Signal 4: EU city/country mentioned in headline/summary
  const euMention = EU_COUNTRY_RE.test(combinedText) || EU_CITY_RE.test(combinedText);
  // Signal 5: Active job search (universal — not origin-specific)
  const jobSearch = JOB_SEARCH_INTENT_RE.test(headline);

  return euLocation || euUni || euVisa || euMention || jobSearch;
}
