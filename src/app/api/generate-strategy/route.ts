import { NextResponse } from 'next/server';
import { GenerationParams } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ACTOR_CATALOG = {
  LINKEDIN_CORE: 'apify/linkedin-profile-search',
  LINKEDIN_DEEP: 'apify/linkedin-search-scraper',
  GOOGLE_SEARCH: 'apify/google-search-scraper',
  BING_SEARCH: 'apify/bing-search-scraper',
  TWITTER_SEARCH: 'apify/twitter-scraper-lite',
  GITHUB_SEARCH: 'apify/github-user-scraper',
  INSTAGRAM: 'apify/instagram-scraper',
  REDDIT: 'apify/reddit-scraper'
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
        - "apify/linkedin-profile-search": Precision lead finding on LinkedIn.
        - "apify/linkedin-search-scraper": Broad profile harvesting.
        - "apify/github-user-scraper": Essential for Technical/SWE leads.
        - "apify/instagram-scraper": Best for finding portfolios and creators.
        - "apify/reddit-scraper": Use for community-based sentiment or gathering handles.
        - "apify/google-search-scraper": Best for broad web/directory discovery.
        
        Respond ONLY with a JSON object:
        {
          "platforms": ["Selected Platform"],
          "searchQueries": ["Optimized query 1", "query 2", ...],
          "apifyActors": ["selected-actor-id"],
          "reasoning": "Detailed logic for choosing this specific mix"
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
