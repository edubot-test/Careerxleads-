import { NextResponse } from 'next/server';
import { GenerationParams } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ACTOR_CATALOG = {
  LINKEDIN_CORE: 'apify/linkedin-profile-search',
  LINKEDIN_DEEP: 'apify/linkedin-search-scraper',
  GOOGLE_SEARCH: 'apify/google-search-scraper',
  BING_SEARCH: 'apify/bing-search-scraper',
  TWITTER_SEARCH: 'apify/twitter-scraper-lite'
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
    
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === '') {
      console.log('No Gemini API key found, returning mock strategy.');
      return NextResponse.json(DEFAULT_STRATEGY);
    }

    try {
      // Use 'gemini-1.5-flash-latest' which is the common alias for the newest flash model
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash', 
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        You are an elite Lead Discovery Strategist for CareerXcelerator. 
        Your goal is to find the absolute best profiles for:
        - Objective: ${params.audience}
        - Origin: ${params.originCountry}
        - Location: ${params.currentLocation}
        - Fields: ${params.fields}
        
        DYNAMIC INTELLIGENCE RULES:
        1. PLATFORM: Decide which platform is best (LinkedIn for professionals, Google/Bing for broad discovery, X for tech-heavy niches).
        2. ACTOR: Select the specific actor from this verified catalog:
           - "apify/linkedin-profile-search": Best for finding people by specific job/student titles on LinkedIn.
           - "apify/linkedin-search-scraper": Best for deep search queries and broad LinkedIn scraping.
           - "apify/google-search-scraper": Best for finding university directories or public portfolios via Google.
           - "apify/bing-search-scraper": Best alternative to Google for non-indexed profiles.
        3. QUERIES: Generate 3-5 high-intent search queries optimized for the chosen platform.
        
        Respond ONLY with a JSON object:
        {
          "platforms": ["Selected Platform"],
          "searchQueries": ["query 1", "query 2", ...],
          "apifyActors": ["selected-actor-id"],
          "reasoning": "Brief explanation of why this platform/actor was chosen"
        }
      `;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      const response = await result.response;
      let text = response.text();
      
      // Safety parsing
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const strategy = JSON.parse(text);
      
      return NextResponse.json(strategy);

    } catch (apiError: any) {
      console.error('Gemini API Error (generate-strategy):', apiError.message);
      // Absolute safety fallback
      return NextResponse.json(DEFAULT_STRATEGY);
    }

  } catch (error) {
    console.error('Critical Error (generate-strategy):', error);
    return NextResponse.json(DEFAULT_STRATEGY);
  }
}
