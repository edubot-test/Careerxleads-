import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';

// Mock profiles for development fallback
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
  email: i % 3 === 0 ? `mock.email${i}@example.com` : null
}));

// Build actor-specific input payload
function buildActorInput(actorId: string, queries: string[], perActorLimit: number): Record<string, unknown> {
  const base = { count: perActorLimit };
  if (actorId.includes('linkedin')) {
    return { ...base, queries };
  } else if (actorId.includes('google-search-scraper') || actorId.includes('bing-search-scraper')) {
    return { ...base, queries: queries.join('\n') };
  } else if (actorId.includes('github')) {
    return { ...base, q: queries[0] };
  } else if (actorId.includes('instagram')) {
    return { ...base, search: queries[0] };
  } else if (actorId.includes('reddit')) {
    return { ...base, searches: queries };
  }
  // #22: Log unknown actor types so misconfigurations are visible
  console.warn(`[scrape-leads] buildActorInput: unrecognised actor "${actorId}", falling back to generic "queries" input`);
  return { ...base, queries };
}

// Normalize each actor's raw output into a common profile shape
function normalizeProfile(item: any, idx: number, actorId: string, platform: string) {
  const isSearch = actorId.includes('search-scraper') && !actorId.includes('linkedin');
  const isGithub = actorId.includes('github');
  const isInstagram = actorId.includes('instagram');
  const isReddit = actorId.includes('reddit');

  return {
    id: item.id || `sc-${actorId.split('/')[1]?.slice(0, 4)}-${idx}`,
    fullName: isGithub ? (item.name || item.username) :
              isInstagram ? (item.fullName || item.username) :
              isReddit ? item.author :
              isSearch ? (item.title || 'Unknown') :
              (item.fullName || item.name || 'Unknown'),
    url: isGithub ? (item.url || `https://github.com/${item.username}`) :
         isInstagram ? (item.url || `https://instagram.com/${item.username}`) :
         isReddit ? item.url :
         isSearch ? (item.url || item.link || '') :
         (item.url || item.profileUrl || ''),
    headline: isGithub ? item.bio :
              isInstagram ? item.biography :
              isReddit ? item.body :
              isSearch ? (item.description || item.snippet || '') :
              (item.headline || item.title || ''),
    location: item.location || '',
    education: item.education || [],
    email: item.email || item.publicEmail || null,
    metadata: { platform, actor: actorId }
  };
}

// Run a single Apify actor end-to-end and return normalized profiles
async function runSingleActor(
  actorId: string,
  queries: string[],
  perActorLimit: number,
  platform: string
): Promise<any[]> {
  const normalizedActorId = actorId.replace('/', '~');
  const actorInput = buildActorInput(actorId, queries, perActorLimit);

  console.log(`[${actorId}] Starting with ${queries.length} queries, limit ${perActorLimit}`);

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

  // Poll until succeeded, failed, or 90s timeout
  const pollStart = Date.now();
  const TIMEOUT_MS = 90_000;
  let items: any[] = [];

  while (Date.now() - pollStart < TIMEOUT_MS) {
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const { data: { status } } = await statusRes.json();
    console.log(`[${actorId}] Status: ${status}`);

    if (status === 'SUCCEEDED') {
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
      items = await itemsRes.json();
      break;
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`[${actorId}] Run ended with status: ${status}`);
    }

    // #7/#17: Grab partial results only when we have at least perActorLimit items
    const partialRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
    const partial = await partialRes.json();
    if (Array.isArray(partial) && partial.length >= perActorLimit) {
      console.log(`[${actorId}] Early exit with ${partial.length} partial items (target: ${perActorLimit})`);
      items = partial;
      break;
    }

    await new Promise(r => setTimeout(r, 4000));
  }

  if (items.length === 0) throw new Error(`[${actorId}] No items returned`);

  const profiles = items.map((item, idx) => normalizeProfile(item, idx, actorId, platform));
  console.log(`[${actorId}] Yielded ${profiles.length} profiles`);
  return profiles;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const strategy = body.strategy || {};
    const params = body.params || {};
    const queries: string[] = strategy.searchQueries || [];
    const leadCount = Math.max(1, parseInt(params.leadCount, 10) || 50);

    if (!APIFY_TOKEN) {
      console.log('No Apify token. Returning mock profiles.');
      return NextResponse.json({ profiles: mockProfiles.slice(0, leadCount) });
    }

    const actorIds: string[] = strategy.apifyActors?.length > 0
      ? strategy.apifyActors
      : ['harvestapi/linkedin-profile-search'];

    const platforms: string[] = strategy.platforms || [];

    // Distribute the lead target evenly across actors
    const perActorLimit = Math.ceil(leadCount / actorIds.length);

    console.log(`Running ${actorIds.length} actors in parallel:`, actorIds);

    // Fire all actors concurrently — failures don't block the others
    const results = await Promise.allSettled(
      actorIds.map((actorId, idx) =>
        runSingleActor(actorId, queries, perActorLimit, platforms[idx] || 'Unknown')
      )
    );

    // Merge results, deduplicate by URL (or id as fallback)
    const seenKeys = new Set<string>();
    const allProfiles: any[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const profile of result.value) {
          const key = profile.url || profile.id;
          if (!key) {
            // #8: Log profiles dropped because both url and id are empty
            console.warn(`[scrape-leads] Dropping profile with no url or id (name: "${profile.fullName}")`);
            continue;
          }
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          allProfiles.push(profile);
        }
      } else {
        console.error('Actor failed:', (result.reason as Error)?.message || result.reason);
      }
    }

    if (allProfiles.length === 0) {
      console.warn('All actors failed or returned nothing. Falling back to mock profiles.');
      return NextResponse.json({
        profiles: mockProfiles.slice(0, leadCount),
        warning: 'All actors failed, using fallback profiles',
      });
    }

    console.log(`Merged ${allProfiles.length} deduplicated profiles from ${actorIds.length} actors.`);
    return NextResponse.json({ profiles: allProfiles });

  } catch (error: any) {
    console.error('scrape-leads critical error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
