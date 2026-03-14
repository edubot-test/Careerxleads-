import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    const { params } = await req.json();
    const leadCount = parseInt(params.leadCount) || 100;

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '') {
      return NextResponse.json({
        total: leadCount * 0.007,
        apify: leadCount * 0.005,
        ai: leadCount * 0.002,
        complexity: 'Medium',
        reasoning: 'Basic estimation applied due to missing API key.'
      });
    }

    try {
      const prompt = `
        As an AI Lead Generation Cost Estimator, analyze these discovery parameters:
        - Audience: ${params.audience}
        - Origin: ${params.originCountry}
        - Location: ${params.currentLocation}
        - Fields: ${params.fields}
        - Target Lead Count: ${params.leadCount}

        Estimate the budget for:
        1. Apify LinkedIn Scraper (Standard is $0.005/lead, but niche audiences or hard-to-find locations can be $0.01-$0.02/lead).
        2. AI Qualification Credits ($0.002/lead).
        
        Provide a "Complexity Score" (Low/Medium/High) based on the niche.
        
        Respond ONLY with JSON:
        {
          "total": 0.00,
          "apify": 0.00,
          "ai": 0.00,
          "complexity": "Low/Medium/High",
          "reasoning": "string"
        }
      `;

      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
        system: "You are a cost estimation expert. You must respond in valid JSON format only."
      });

      const responseContent = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const estimate = JSON.parse(responseContent.replace(/```json/g, '').replace(/```/g, '').trim());

      return NextResponse.json(estimate);

    } catch (apiError: any) {
      console.error('Claude Budget Estimation Error:', apiError.message);
      return NextResponse.json({
        total: leadCount * 0.007,
        apify: leadCount * 0.005,
        ai: leadCount * 0.002,
        complexity: 'Medium',
        reasoning: 'Fallback estimation applied due to API error.'
      });
    }

  } catch (error) {
    console.error('Critical Budget Estimation Error:', error);
    return NextResponse.json({ error: 'Failed to estimate budget' }, { status: 500 });
  }
}
