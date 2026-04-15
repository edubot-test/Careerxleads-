/**
 * Apollo.io email enrichment — finds emails from LinkedIn URLs or name+company.
 * Free tier: 10,000 corporate email credits/month, 100 personal email credits/month.
 */

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const APOLLO_BASE = 'https://api.apollo.io/api/v1';
const ENRICHMENT_CONCURRENCY = 3; // parallel requests (conservative for free tier)
const MAX_ENRICHMENTS_PER_RUN = 50; // cap per run to conserve free credits

interface ApolloMatch {
  email: string | null;
  phone: string | null;
  emailStatus: string | null;
  title: string | null;
  company: string | null;
}

/**
 * Enrich a single profile via Apollo.io people/match endpoint.
 * Returns email + phone if found, null fields otherwise.
 */
async function enrichSingle(profile: {
  linkedinUrl?: string;
  name?: string;
  company?: string;
}): Promise<ApolloMatch> {
  const empty: ApolloMatch = { email: null, phone: null, emailStatus: null, title: null, company: null };

  if (!APOLLO_API_KEY) return empty;

  const body: Record<string, unknown> = {
    reveal_personal_emails: true,
  };

  // Prefer LinkedIn URL for matching — most accurate
  if (profile.linkedinUrl && profile.linkedinUrl.includes('linkedin.com/in/')) {
    body.linkedin_url = profile.linkedinUrl;
  } else if (profile.name) {
    // Fallback: name + company
    const parts = profile.name.split(' ');
    body.first_name = parts[0] || '';
    body.last_name = parts.slice(1).join(' ') || '';
    if (profile.company) body.organization_name = profile.company;
  } else {
    return empty;
  }

  try {
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': APOLLO_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 429) console.warn('[Apollo] Rate limited — skipping remaining enrichments');
      return empty;
    }

    const data = await res.json();
    const person = data?.person;
    if (!person) return empty;

    return {
      email: person.email || null,
      phone: person.phone_numbers?.[0]?.sanitized_number || null,
      emailStatus: person.email_status || null,
      title: person.title || null,
      company: person.organization?.name || null,
    };
  } catch (err) {
    console.warn('[Apollo] Enrichment failed:', (err as Error).message);
    return empty;
  }
}

/**
 * Batch-enrich an array of profiles with Apollo.io email lookups.
 * Only enriches profiles that are missing an email.
 * Mutates nothing — returns new array with enriched copies.
 */
export async function enrichWithApollo(
  profiles: any[],
  onProgress?: (enriched: number, total: number) => void,
): Promise<any[]> {
  if (!APOLLO_API_KEY) {
    console.log('[Apollo] No API key — skipping email enrichment');
    return profiles;
  }

  // Only enrich profiles missing email, capped to conserve free credits
  const allNeedsEnrichment = profiles.filter(p => !p.email);
  const alreadyHasEmail = profiles.filter(p => p.email);
  const needsEnrichment = allNeedsEnrichment.slice(0, MAX_ENRICHMENTS_PER_RUN);
  const skipped = allNeedsEnrichment.slice(MAX_ENRICHMENTS_PER_RUN);

  if (needsEnrichment.length === 0) return profiles;

  console.log(`[Apollo] Enriching ${needsEnrichment.length}/${profiles.length} profiles (${alreadyHasEmail.length} have email, ${skipped.length} skipped to save credits)`);

  const enriched: any[] = [...alreadyHasEmail];
  let enrichedCount = 0;
  let rateLimited = false;

  // Process in parallel batches
  for (let i = 0; i < needsEnrichment.length; i += ENRICHMENT_CONCURRENCY) {
    if (rateLimited) {
      // If rate limited, just pass through remaining profiles unchanged
      enriched.push(...needsEnrichment.slice(i));
      break;
    }

    const batch = needsEnrichment.slice(i, i + ENRICHMENT_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(async (p) => {
      const company = (p.experience || [])[0]?.companyName || (p.experience || [])[0]?.company || '';
      const match = await enrichSingle({
        linkedinUrl: p.linkedinUrl || p.url,
        name: p.fullName || p.name,
        company,
      });
      return { profile: p, match };
    }));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { profile, match } = result.value;
        if (match.email || match.phone) {
          enrichedCount++;
          enriched.push({
            ...profile,
            email: profile.email || match.email,
            phone: profile.phone || match.phone,
            apolloEnriched: true,
          });
        } else {
          enriched.push(profile);
        }
      } else {
        // Failed — check for rate limit
        if (String(result.reason).includes('Rate limited')) rateLimited = true;
        enriched.push(batch[results.indexOf(result)] || batch[0]);
      }
    }

    onProgress?.(enrichedCount, needsEnrichment.length);
  }

  // Add back skipped profiles (exceeded per-run cap)
  enriched.push(...skipped);

  console.log(`[Apollo] Enriched ${enrichedCount}/${needsEnrichment.length} profiles with email/phone (${skipped.length} skipped to save credits)`);
  return enriched;
}
