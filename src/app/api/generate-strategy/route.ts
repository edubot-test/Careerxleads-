import { NextResponse } from 'next/server';
import { GenerationParams } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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
  platforms: ['LinkedIn', 'Google Search'],
  searchQueries: [
    'MS student computer science USA indian origin',
    'site:linkedin.com/in/ "MS in Data Science" "seeking internships"'
  ],
  apifyActors: [ACTOR_CATALOG.LINKEDIN_CORE]
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
        
        DYNAMIC INTELLIGENCE RULES (PLATFORM MATCHING):
        1. Professional/Corporate/Academic: Use LinkedIn or Google Search.
        2. Software/Tech/Open Source: Use GitHub or LinkedIn.
        3. Creative/Design/Influencer/Fashion: Use Instagram or Google Search.
        4. Niche Communities/Unfiltered Sentiment: Use Reddit.
        5. Tech-Talk/Real-time/Industry News: Use Twitter (X).
        
        ACTOR CATALOG MAP (Choose the absolute best):
        - "harvestapi/linkedin-profile-search": Precision lead finding on LinkedIn.
        - "logical_scrapers/linkedin-people-search-scraper": Broad profile harvesting.
        - "dtrungtin/github-users-scraper": Essential for Technical/SWE leads.
        - "apify/instagram-scraper": Best for finding portfolios and creators.
        - "trudax/reddit-scraper": Use for community-based sentiment or gathering handles.
        - "apify/google-search-scraper": Best for broad web/directory discovery.
        
        Respond ONLY with a JSON object:
        {
          "platforms": ["Selected Platform"],
          "searchQueries": ["Optimized query 1", "query 2", ...],
          "apifyActors": ["selected-actor-id"],
          "reasoning": "Detailed logic for choosing this specific mix"
        }
      `;

      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: "You are a professional lead generation AI. You must respond in valid JSON format only."
      });

      const responseContent = msg.content[0].type === 'text' ? msg.content[0].text : '';
      
      // Safety parsing
      const jsonStr = responseContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const strategy = JSON.parse(jsonStr);
      
      return NextResponse.json(strategy);

    } catch (apiError: any) {
      console.error('Anthropic API Error (generate-strategy):', apiError.message);
      // Absolute safety fallback
      return NextResponse.json(DEFAULT_STRATEGY);
    }

  } catch (error) {
    console.error('Critical Error (generate-strategy):', error);
    return NextResponse.json(DEFAULT_STRATEGY);
  }
}
