import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';

// ── Mock profiles (fallback when Apify is unavailable) ────────────────────────
const mockProfiles = Array.from({ length: 45 }).map((_, i) => ({
  id: `mock-${i}`,
  fullName: ['Priya Sharma', 'Rahul Desai', 'Anita Patel', 'Vikram Singh', 'Neha Gupta'][i % 5],
  url: `https://linkedin.com/in/mock-profile-${i}`,
  headline: ['MS Data Science @ NYU | Seeking Summer Internship 2025', 'MBA Candidate at Boston University', 'Incoming Software Engineer Intern at Google | MS CS @ Georgia Tech', 'Data Analyst | MS Business Analytics', 'Software Engineer @ Amazon | MS CS USC'][i % 5],
  location: ['New York, NY', 'Boston, MA', 'Atlanta, GA', 'San Francisco, CA', 'Seattle, WA'][i % 5],
  education: [
    { schoolName: ['New York University', 'Boston University', 'Georgia Institute of Technology', 'University of Texas at Dallas', 'University of Southern California'][i % 5], degreeName: 'Master of Science', fieldOfStudy: ['Data Science', 'MBA', 'Computer Science', 'Business Analytics', 'Computer Science'][i % 5], endDate: '2025' },
    { schoolName: 'University of Mumbai', degreeName: 'Bachelor of Engineering', fieldOfStudy: 'Computer Engineering', endDate: '2022' }
  ],
  email: i % 3 === 0 ? `mock.email${i}@example.com` : null,
  metadata: { platform: 'LinkedIn', actor: 'mock' },
}));

// ── Platform-native input builders ────────────────────────────────────────────
// Each actor expects a completely different input schema. Generic queries don't work.

function buildLinkedInInput(queries: string[], limit: number): Record<string, unknown> {
  // harvestapi/linkedin-profile-search + logical_scrapers/linkedin-people-search-scraper
  // Both accept a queries array with keyword strings
  return {
    queries,
    resultsPerQuery: Math.ceil(limit / Math.max(queries.length, 1)),
    proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
  };
}

function buildGoogleDorkInput(queries: string[], limit: number): Record<string, unknown> {
  // apify/google-search-scraper expects an array of startUrls or a queries string
  // Best results come from constructing proper Google search URLs
  const resultsPerQuery = Math.ceil(limit / Math.max(queries.length, 1));
  return {
    queries: queries.join('\n'),
    maxPagesPerQuery: Math.ceil(resultsPerQuery / 10),
    resultsPerPage: 10,
    countryCode: 'us',
    languageCode: 'en',
  };
}

function buildGitHubInput(queries: string[], limit: number): Record<string, unknown> {
  // dtrungtin/github-users-scraper expects a single "q" search string
  // GitHub search supports: location:"City" language:Python followers:>N
  return {
    q: queries[0] || 'location:"United States" language:Python followers:>5',
    maxItems: limit,
  };
}

function buildRedditInput(queries: string[], limit: number): Record<string, unknown> {
  // trudax/reddit-scraper expects a searches array
  // Target subreddits known for Indian MS student job discussions
  const targetSubreddits = ['cscareerquestions', 'f1visa', 'gradadmissions', 'datascience'];
  const searches = queries.length > 0
    ? queries
    : targetSubreddits.map(sub => `subreddit:${sub} internship OR "full time" OR "job search"`);
  return {
    searches: searches.slice(0, 4),
    maxItems: limit,
  };
}

function buildActorInput(actorId: string, queries: string[], limit: number): Record<string, unknown> {
  if (actorId.includes('harvestapi') || actorId.includes('logical_scrapers')) {
    return buildLinkedInInput(queries, limit);
  }
  if (actorId.includes('google-search-scraper')) {
    return buildGoogleDorkInput(queries, limit);
  }
  if (actorId.includes('github')) {
    return buildGitHubInput(queries, limit);
  }
  if (actorId.includes('reddit')) {
    return buildRedditInput(queries, limit);
  }
  console.warn(`[scrape-leads] Unknown actor "${actorId}" — using generic query input`);
  return { queries, count: limit };
}

// ── Profile normalizers ───────────────────────────────────────────────────────
// Each platform returns completely different schemas. Normalize to a common shape.

function normalizeLinkedInProfile(item: any, idx: number, actorId: string): any {
  return {
    id: item.id || item.profileId || `li-${idx}`,
    fullName: item.fullName || item.name || 'Unknown',
    url: item.profileUrl || item.url || item.linkedinUrl || '',
    headline: item.headline || item.title || '',
    location: item.location || item.locationName || '',
    education: Array.isArray(item.education)
      ? item.education.map((e: any) => ({
          schoolName: e.schoolName || e.school || '',
          degreeName: e.degreeName || e.degree || '',
          fieldOfStudy: e.fieldOfStudy || e.field || '',
          endDate: e.endDate || e.timePeriod?.endDate?.year?.toString() || '',
        }))
      : [],
    email: item.email || null,
    metadata: { platform: 'LinkedIn', actor: actorId },
  };
}

function extractEducationFromText(text: string): { schoolName: string; degreeName: string; fieldOfStudy: string; endDate: string } | null {
  if (!text) return null;
  // Match patterns like "MS in Data Science at NYU", "MBA Candidate at Boston University",
  // "Master of Science in CS @ Georgia Tech", "MS CS | University of Texas"
  const degreeMatch = text.match(/\b(MS|M\.S\.|MBA|M\.B\.A\.|MEng|M\.Eng|Master(?:s)?(?: of Science)?(?:\s+in)?|MCS|MSCS|MSDS|MS-CS)\b/i);
  const fieldMatch  = text.match(/(?:in|of)\s+([A-Z][a-zA-Z\s&\/]{3,30})(?:\s+[@|at]|\s*[-|]|\s+\d{4}|$)/i);
  const uniMatch    = text.match(/(?:[@|at|@\s])\s*([A-Z][a-zA-Z\s]{4,40})(?:\s*[|·\-,]|$)/i) ||
                      text.match(/([A-Z][a-zA-Z\s]+University|[A-Z][a-zA-Z\s]+Institute|[A-Z]+U\b)/);
  const yearMatch   = text.match(/\b(202[3-9]|203\d)\b/);
  if (!degreeMatch) return null;
  return {
    schoolName:  uniMatch?.[1]?.trim()  || '',
    degreeName:  degreeMatch[0],
    fieldOfStudy: fieldMatch?.[1]?.trim() || '',
    endDate:     yearMatch?.[0] || '',
  };
}

function normalizeGoogleResult(item: any, idx: number, actorId: string): any {
  const url     = item.url || item.link || '';
  const snippet = item.description || item.snippet || '';
  const title   = item.title || '';
  const isLinkedInProfile = url.includes('linkedin.com/in/');

  // Strip "- LinkedIn" / "| LinkedIn" suffix from title to get the name
  const fullName = isLinkedInProfile
    ? title.replace(/\s*[-|].*$/i, '').trim()
    : (title || 'Unknown');

  // Combine title + snippet for education extraction — dork snippets often contain degree info
  const combinedText = `${title} ${snippet}`;
  const edu = extractEducationFromText(combinedText);

  return {
    id: item.id || `goog-${idx}`,
    fullName,
    url,
    headline: snippet || title,
    location: '',
    education: edu ? [edu] : [],
    email: null,
    metadata: { platform: 'Google', actor: actorId, snippet },
  };
}

function normalizeGitHubProfile(item: any, idx: number, actorId: string): any {
  return {
    id: item.id?.toString() || item.login || `gh-${idx}`,
    fullName: item.name || item.login || 'Unknown',
    url: item.url || `https://github.com/${item.login}`,
    headline: item.bio || '',
    location: item.location || '',
    education: [], // GitHub has no structured education — qualify-leads will infer from bio
    email: item.email || item.publicEmail || null,
    metadata: { platform: 'GitHub', actor: actorId, company: item.company || '', repos: item.publicRepos || 0 },
  };
}

function normalizeRedditPost(item: any, idx: number, actorId: string): any {
  const author = item.author || '';
  // Reddit usernames (u/xyz) are not real names — flag them so qualify-leads can handle gracefully
  const isUsername = !author.includes(' ') && author.length < 30;
  // Attempt to extract a real name from post title (e.g. "Hi, I'm Priya Sharma, MS CS student...")
  const titleNameMatch = (item.title || '').match(/(?:I(?:'m| am)\s+)([A-Z][a-z]+ [A-Z][a-z]+)/);
  const fullName = titleNameMatch ? titleNameMatch[1] : (isUsername ? '' : author);

  return {
    id: item.id || `rd-${idx}`,
    fullName: fullName || 'Unknown',
    url: item.url || item.permalink || '',
    // Use both title and body snippet as the headline for better qualification signal
    headline: [item.title, item.body?.slice(0, 200)].filter(Boolean).join(' — '),
    location: '',
    education: [],
    email: null,
    metadata: {
      platform: 'Reddit',
      actor: actorId,
      subreddit: item.subreddit || '',
      redditAuthor: author, // preserve original username for reference
      body: item.body?.slice(0, 500) || '',
    },
  };
}

function normalizeProfile(item: any, idx: number, actorId: string): any {
  if (actorId.includes('harvestapi') || actorId.includes('logical_scrapers')) {
    return normalizeLinkedInProfile(item, idx, actorId);
  }
  if (actorId.includes('google-search-scraper')) {
    return normalizeGoogleResult(item, idx, actorId);
  }
  if (actorId.includes('github')) {
    return normalizeGitHubProfile(item, idx, actorId);
  }
  if (actorId.includes('reddit')) {
    return normalizeRedditPost(item, idx, actorId);
  }
  // Generic fallback
  return {
    id: item.id || `raw-${idx}`,
    fullName: item.fullName || item.name || item.title || 'Unknown',
    url: item.url || item.profileUrl || item.link || '',
    headline: item.headline || item.bio || item.description || '',
    location: item.location || '',
    education: item.education || [],
    email: item.email || null,
    metadata: { platform: 'Unknown', actor: actorId },
  };
}

// ── Single actor runner ───────────────────────────────────────────────────────
async function runSingleActor(
  actorId: string,
  queries: string[],
  perActorLimit: number,
): Promise<any[]> {
  const normalizedActorId = actorId.replace('/', '~');
  const actorInput = buildActorInput(actorId, queries, perActorLimit);

  console.log(`[${actorId}] Starting — ${queries.length} queries, limit ${perActorLimit}`);
  console.log(`[${actorId}] Input:`, JSON.stringify(actorInput).slice(0, 300));

  const startRunRes = await fetch(
    `https://api.apify.com/v2/acts/${normalizedActorId}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
    }
  );

  const runInfo = await startRunRes.json();
  if (!startRunRes.ok) {
    throw new Error(runInfo.error?.message || `Failed to start ${actorId}: HTTP ${startRunRes.status}`);
  }

  const runId: string = runInfo.data.id;
  const datasetId: string = runInfo.data.defaultDatasetId;
  console.log(`[${actorId}] Run started: ${runId}`);

  // Poll until SUCCEEDED, terminal failure, or 90s timeout
  const pollStart = Date.now();
  const TIMEOUT_MS = 90_000;
  let items: any[] = [];

  while (Date.now() - pollStart < TIMEOUT_MS) {
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const { data: { status } } = await statusRes.json();
    console.log(`[${actorId}] Status: ${status}`);

    if (status === 'SUCCEEDED') {
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${perActorLimit}`);
      items = await itemsRes.json();
      break;
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`[${actorId}] Run ended with status: ${status}`);
    }

    // Grab partial results early if we already hit the target
    const partialRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${perActorLimit}`);
    const partial = await partialRes.json();
    if (Array.isArray(partial) && partial.length >= perActorLimit) {
      console.log(`[${actorId}] Early exit — ${partial.length} items collected (target: ${perActorLimit})`);
      items = partial;
      break;
    }

    await new Promise(r => setTimeout(r, 4000));
  }

  if (items.length === 0) throw new Error(`[${actorId}] No items returned`);

  const profiles = items.map((item, idx) => normalizeProfile(item, idx, actorId));
  console.log(`[${actorId}] Yielded ${profiles.length} normalized profiles`);
  return profiles;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const strategy = body.strategy || {};
    const params = body.params || {};
    const leadCount = Math.max(1, parseInt(params.leadCount, 10) || 50);

    if (!APIFY_TOKEN) {
      console.log('[scrape-leads] No Apify token — returning mock profiles.');
      return NextResponse.json({
        profiles: mockProfiles.slice(0, leadCount),
        isMock: true,
        mockReason: 'APIFY_API_TOKEN is not set',
      });
    }

    const actorIds: string[] = strategy.apifyActors?.length > 0
      ? strategy.apifyActors
      : ['harvestapi/linkedin-profile-search', 'apify/google-search-scraper'];

    // perActorQueries: platform-specific queries keyed by actor ID
    // Falls back to shared searchQueries if not present (older strategy shape)
    const perActorQueries: Record<string, string[]> = strategy.perActorQueries || {};
    const fallbackQueries: string[] = strategy.searchQueries || [];

    // Scrape 4x the target per actor — qualification guardrails filter heavily,
    // especially for Google/GitHub profiles without structured education data.
    const perActorLimit = Math.ceil((leadCount * 4) / actorIds.length);

    console.log(`[scrape-leads] Running ${actorIds.length} actors in parallel:`, actorIds);

    const results = await Promise.allSettled(
      actorIds.map(actorId => {
        const queries = perActorQueries[actorId]?.length > 0
          ? perActorQueries[actorId]
          : fallbackQueries;
        return runSingleActor(actorId, queries, perActorLimit);
      })
    );

    // Merge and deduplicate by URL (normalised to lowercase, trailing slash stripped)
    const seenKeys = new Set<string>();
    const allProfiles: any[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const profile of result.value) {
          const rawKey = profile.url || profile.id;
          if (!rawKey) {
            console.warn(`[scrape-leads] Dropping profile with no url or id (name: "${profile.fullName}")`);
            continue;
          }
          const key = rawKey.toLowerCase().replace(/\/$/, '');
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          allProfiles.push(profile);
        }
      } else {
        console.error('[scrape-leads] Actor failed:', (result.reason as Error)?.message || result.reason);
      }
    }

    if (allProfiles.length === 0) {
      console.warn('[scrape-leads] All actors failed — falling back to mock profiles.');
      return NextResponse.json({
        profiles: mockProfiles.slice(0, leadCount),
        isMock: true,
        mockReason: 'All Apify actors failed or returned no results',
        warning: 'All actors failed; using fallback profiles',
      });
    }

    console.log(`[scrape-leads] ${allProfiles.length} deduplicated profiles from ${actorIds.length} actors.`);
    return NextResponse.json({ profiles: allProfiles });

  } catch (error: any) {
    console.error('[scrape-leads] Critical error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
