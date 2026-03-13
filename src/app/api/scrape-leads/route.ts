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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const strategy = body.strategy || {};
    const queries = strategy.searchQueries || [];
    
    if (!APIFY_TOKEN || APIFY_TOKEN === 'mock-token') {
      console.log('No Apify Token found. Returning mock results.');
      return NextResponse.json({ profiles: mockProfiles });
    }
    
    // ── Smart Actor Router ──
    const actorId = strategy.apifyActors?.[0] || 'apify/linkedin-profile-search';
    const normalizedActorId = actorId.replace('/', '~');
    
    // Normalize Input Schema
    let actorInput: any = { count: 20 };
    if (actorId.includes('linkedin-profile-search') || actorId.includes('linkedin-search-scraper')) {
      actorInput.queries = queries;
    } else if (actorId.includes('google-search-scraper') || actorId.includes('bing-search-scraper')) {
      actorInput.queries = queries.join('\n');
    } else if (actorId.includes('github-user-scraper')) {
      actorInput.q = queries[0]; // GitHub scraper usually takes a single query or list
    } else if (actorId.includes('instagram-scraper')) {
      actorInput.search = queries[0];
    } else if (actorId.includes('reddit-scraper')) {
      actorInput.searches = queries;
    } else {
      actorInput.queries = queries;
    }

    console.log(`Routing to Actor: ${actorId} with ${queries.length} queries...`);
    
    try {
      // 1. Start the actor run
      const startRunRes = await fetch(`https://api.apify.com/v2/acts/${normalizedActorId}/runs?token=${APIFY_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput)
      });

      const runInfo = await startRunRes.json();
      if (!startRunRes.ok) {
        throw new Error(runInfo.error?.message || 'Failed to start run');
      }

      const runId = runInfo.data.id;
      const datasetId = runInfo.data.defaultDatasetId;
      
      console.log('Apify Run started:', runId);

      // 2. Poll for results (Wait for at least some items to appear)
      let items = [];
      const pollStartTime = Date.now();
      const timeout = 90000; // 90s timeout

      while (Date.now() - pollStartTime < timeout) {
        const checkRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
        const statusData = await checkRes.json();
        const status = statusData.data.status;
        
        console.log(`Run status: ${status}`);

        if (status === 'SUCCEEDED') {
          const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
          items = await itemsRes.json();
          break;
        } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          throw new Error(`Apify Run ${status}`);
        }
        
        // Grab partials
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        const currentItems = await itemsRes.json();
        if (currentItems.length > 0) {
          items = currentItems;
          if (items.length >= 5) break; 
        }

        await new Promise(r => setTimeout(r, 4000));
      }

      if (items.length === 0) {
        throw new Error('No items found in dataset');
      }
      
      // Normalize Output Schema for AI Gatekeeper
      const profiles = items.map((item: any, idx: number) => {
        const isSearch = actorId.includes('search-scraper') && !actorId.includes('linkedin');
        const isGithub = actorId.includes('github');
        const isInstagram = actorId.includes('instagram');
        const isReddit = actorId.includes('reddit');
        
        return {
          id: item.id || `sc-${idx}`,
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
          metadata: { platform: strategy.platforms?.[0] || 'Unknown', actor: actorId }
        };
      });

      return NextResponse.json({ profiles });

    } catch (apifyError: any) {
      console.error('Apify API failure:', apifyError.message);
      return NextResponse.json({ 
        profiles: mockProfiles, 
        warning: 'Apify search failed or timed out, using fallback profiles',
        errorDetails: apifyError.message 
      });
    }

  } catch (error: any) {
    console.error('Scrape-leads critical error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
