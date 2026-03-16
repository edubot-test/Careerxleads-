import { NextResponse } from 'next/server';
import { GenerationParams } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const ACTOR_CATALOG = {
  LINKEDIN_CORE: 'harvestapi/linkedin-profile-search',
  LINKEDIN_DEEP: 'logical_scrapers/linkedin-people-search-scraper',
  GOOGLE_SEARCH: 'apify/google-search-scraper',
  BING_SEARCH: 'tri_angle/bing-search-scraper',
  TWITTER_SEARCH: 'apify/twitter-scraper-lite',
  GITHUB_SEARCH: 'dtrungtin/github-users-scraper',
  INSTAGRAM: 'apify/instagram-scraper',
  REDDIT: 'trudax/reddit-scraper'
};

const DEFAULT_STRATEGY = {
  platforms: ['LinkedIn', 'Google Search', 'GitHub'],
  searchQueries: [
    'MS student computer science USA indian origin',
    'site:linkedin.com/in/ "MS in Data Science" "seeking internships"',
    'MS computer science student USA seeking internship 2025'
  ],
  apifyActors: [ACTOR_CATALOG.LINKEDIN_CORE, ACTOR_CATALOG.GOOGLE_SEARCH, ACTOR_CATALOG.GITHUB_SEARCH]
};

export async function POST(req: Request) {
  try {
    const params = await req.json() as GenerationParams;
    
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '') {
      console.log('No Anthropic API key found, returning mock strategy.');
      return NextResponse.json(DEFAULT_STRATEGY);
    }

    try {
      const prompt = `
        You are an elite Multi-Channel Lead Discovery Strategist for CareerXcelerator. 
        Analyze the candidate persona:
        - Objective: ${params.audience}
        - Origin: ${params.originCountry}
        - Location: ${params.currentLocation}
        - Fields: ${params.fields}
        
        MULTI-CHANNEL STRATEGY RULES:
        Always select 2–3 actors from different platforms for maximum coverage and deduplication.

        PLATFORM MATCHING:
        1. All professional/academic targets: Always include LinkedIn (primary) + Google Search (broad coverage).
        2. Software/Tech/Open Source: Add GitHub as third channel.
        3. Creative/Design/Influencer: Replace GitHub with Instagram.
        4. Niche Communities: Replace GitHub with Reddit.
        5. General audience: LinkedIn + Google Search + GitHub is the safe default trio.

        ACTOR CATALOG (pick 2–3, from DIFFERENT platforms):
        - "harvestapi/linkedin-profile-search": Precision LinkedIn profiles. Always include for professional targets.
        - "logical_scrapers/linkedin-people-search-scraper": Broader LinkedIn harvesting (use instead of harvestapi when volume matters).
        - "dtrungtin/github-users-scraper": GitHub profiles, essential for tech/SWE leads.
        - "apify/instagram-scraper": Instagram, for creative/portfolio leads.
        - "trudax/reddit-scraper": Reddit, for community-sourced leads.
        - "apify/google-search-scraper": Broad web discovery, always a strong secondary actor.

        Respond ONLY with a JSON object:
        {
          "platforms": ["Platform 1", "Platform 2", "Platform 3"],
          "searchQueries": ["Optimized query 1", "query 2", "query 3"],
          "apifyActors": ["actor-id-1", "actor-id-2", "actor-id-3"],
          "reasoning": "Why this specific multi-channel combination was chosen"
        }
      `;

      const msg = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: "You are a professional lead generation AI. You must respond in valid JSON format only."
      });

      // #14: Guard content[0] access
      if (!msg.content?.length || msg.content[0].type !== 'text') {
        throw new Error('Unexpected response shape from Claude');
      }

      const jsonStr = msg.content[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const strategy = JSON.parse(jsonStr);

      // #18: Log reasoning so strategy choices are visible in server logs
      if (strategy.reasoning) {
        console.log('[generate-strategy] Reasoning:', strategy.reasoning);
      }

      return NextResponse.json(strategy);

    } catch (apiError: any) {
      console.error('Anthropic API Error (generate-strategy):', apiError.message);
      return NextResponse.json({ ...DEFAULT_STRATEGY, warning: 'AI strategy unavailable; using default' });
    }

  } catch (error: any) {
    console.error('Critical Error (generate-strategy):', error);
    return NextResponse.json({ ...DEFAULT_STRATEGY, warning: 'Critical error; using default', details: error.message });
  }
}
