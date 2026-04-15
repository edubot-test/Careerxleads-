import Anthropic from '@anthropic-ai/sdk';
import { extractSignals } from './signals';
import { calcStruggleScore, assignTier } from './scoring';
import { buildOutreachMessage, buildLinkedInNote, buildWhatsAppUrl } from './outreach';
import type { OutreachContext } from './outreach';
import { buildRegionalSuffix } from './regional';
import { isEliteUni, SENIOR_TITLES, LOW_FIELDS } from './patterns';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const CLAUDE_MODEL = process.env.QUALIFY_MODEL || 'claude-haiku-4-5-20251001';

export function mockScore(p: any): any {
  const signals = extractSignals(p);
  const edu = p.education?.[0] || {};
  const university    = edu.schoolName   || p.university    || '';
  const degree        = edu.degreeName   || p.degree        || '';
  const fieldOfStudy  = edu.fieldOfStudy || p.fieldOfStudy  || '';
  const rawEndDate    = edu.endDate;
  const graduationYear = (typeof rawEndDate === 'object' ? rawEndDate?.text : rawEndDate) || p.graduationYear || '2025';
  const fullName      = p.fullName || p.name || '';
  const headline      = p.headline || '';
  const headlineLower = headline.toLowerCase();

  const {
    euRelevant, mastersStudent, jobSearchIntent, relevantField, profileComplete,
    visaStruggle, workPermitPanic, workPermitResultsPanic,
    bodyShopExit, commentIntent, financialClock, resumeReview, premiumBadge,
    frustration, skillGap, timePressure, careerSwitch,
    networkTrap, networkingScore, regionalTag, uniTier, optDaysRemaining,
  } = signals;

  // Hard reject: elite current university
  if (isEliteUni(university)) {
    return {
      id: p.id || Math.random().toString(36).slice(2, 11),
      qualityScore: 0, tier: 3 as const,
      name: fullName || 'Unknown', linkedinUrl: p.linkedinUrl || '',
      university, degree, fieldOfStudy, graduationYear,
      location: p.location || '', headline, email: p.email || null, phone: p.phone || null,
      socialMediaUrl: null, seekingInternship: false, seekingFullTime: false,
      intentScore: 1 as const, outreachMessage: '', status: 'new',
      reviewFlag: 'review_needed' as const,
      qualityBreakdown: {
        euRelevant: false, mastersStudent: false, jobSearchIntent: false,
        relevantField: false, profileComplete: false, nonTier1University: false,
      },
      metadata: p.metadata || undefined,
    };
  }

  // Quality score: EU relevance gives +2, job search intent +3, degree +2, field +1, profile +1, non-elite +1
  const qualityScore = (euRelevant ? 2 : 0) + (mastersStudent ? 2 : 0)
    + (jobSearchIntent ? 3 : 0) + (relevantField ? 1 : 0) + (profileComplete ? 1 : 0) + 1;

  const intentScore: 1 | 2 | 3 =
    (workPermitPanic || workPermitResultsPanic || visaStruggle || commentIntent || (timePressure && jobSearchIntent)) ? 3
    : (frustration || skillGap || bodyShopExit || financialClock || resumeReview || premiumBadge || networkTrap || careerSwitch || jobSearchIntent) ? 2
    : 1;

  const struggleScore = calcStruggleScore(signals);
  const tier = assignTier(qualityScore, intentScore, struggleScore);

  const ctx: OutreachContext = {
    firstName: fullName.split(' ')[0] || 'there',
    university, degree, fieldOfStudy, graduationYear,
  };
  const outreachMessage = buildOutreachMessage(ctx, signals);

  return {
    id: p.id || Math.random().toString(36).slice(2, 11),
    name: fullName || 'Unknown',
    linkedinUrl: p.linkedinUrl || '',
    university, degree, fieldOfStudy, graduationYear,
    location: p.location || '',
    headline,
    email: p.email || null,
    phone: p.phone || null,
    socialMediaUrl: p.metadata?.platform === 'GitHub' ? (p.url || null) : null,
    seekingInternship: /intern|werkstudent|praktik/i.test(headlineLower),
    seekingFullTime: /full.?time|new grad|recent grad|open to work|actively looking|job hunt|career switch/i.test(headlineLower)
      || (headlineLower.includes('seeking') && !/intern/i.test(headlineLower)),
    tier, intentScore, qualityScore, struggleScore,
    universityTier: uniTier,
    networkingScore,
    optDaysRemaining,
    detectedLanguage: regionalTag || undefined,
    regionalTag: regionalTag || undefined,
    outreachMessage,
    linkedInNote: buildLinkedInNote(ctx, signals),
    whatsAppUrl: buildWhatsAppUrl(p.phone || null, ctx.firstName, fieldOfStudy),
    status: 'new',
    reviewFlag: qualityScore >= 8 ? 'approved' : 'review_needed',
    qualityBreakdown: { euRelevant, mastersStudent, jobSearchIntent, relevantField, profileComplete, nonTier1University: true },
    metadata: p.metadata || undefined,
  };
}

// Hard cap to prevent unbounded API token burn
const MAX_PROFILES = 500;

export async function qualifyProfiles(
  profiles: any[],
  params: any,
  onTokens?: (input: number, output: number) => void,
): Promise<any[]> {
  const capped = profiles.slice(0, MAX_PROFILES);
  if (capped.length < profiles.length) {
    console.warn(`[qualify] Capped from ${profiles.length} to ${MAX_PROFILES} profiles`);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return capped.map(mockScore).filter(l => l.qualityScore >= 6);
  }

  const CHUNK = 100;
  const CONCURRENCY = 3;
  const allLeads: any[] = [];

  const chunks: any[][] = [];
  for (let i = 0; i < capped.length; i += CHUNK) {
    chunks.push(capped.slice(i, i + CHUNK));
  }

  for (let b = 0; b < chunks.length; b += CONCURRENCY) {
    const batch = chunks.slice(b, b + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(async (chunk) => {
      const phoneMap = new Map(chunk.map((p: any) => [String(p.id), p.phone || null]));

      const prompt = `You are a Lead Qualifier for CareerX, a career services platform helping people in the USA, UK, and Ireland land full-time jobs — from skill assessment to placement.

TARGET: Location=${params.visaStatus || 'USA, UK, Ireland'}, Fields=${params.fields}, Opportunity=${params.opportunityTypes}
Priority: Indian-origin candidates are priority, but we want a DIVERSE mix — include candidates of all backgrounds who are in our target locations.

SCORING (max 10):
+3 active job search / career switch intent | +2 relevant degree (Masters, MBA, professional) | +2 EU/UK/US location relevance | +1 relevant field | +1 complete profile | +1 non-elite university

INTENT BOOSTERS:
intentScore=3 if: work permit/visa struggle + actively seeking | career switch with urgency | "open to work" + graduating soon | commented "interested"/"refer me" on job posts
intentScore=2 if: job-hunt signals ("seeking", "open to work", "entry-level", "no offers") | career switch signals ("pivoting", "reskilling", "bootcamp") | frustration signals ("struggling", "ghosted", "no interviews") | resume help seekers | LinkedIn Premium + still seeking | financial pressure
intentScore=1 otherwise

ICP: Students, recent graduates, and working professionals in USA/UK/Ireland who need career services — job placement, skill building, career switching. All backgrounds welcome. Indians are priority but NOT the only target. We want genuinely diverse leads.

HARD REJECT (omit from leads array) if ANY of:
- Current university is elite (MIT, Stanford, Harvard, CMU, Berkeley, Oxford, Cambridge, Imperial, LSE, ETH Zurich, EPFL, TU Munich, IITs, NUS, Tsinghua, Peking)
- qualityScore < 6
- Senior title (director, VP, chief, principal, senior manager)
- Irrelevant field (history, philosophy, literature, fine arts)
- Missing name or profile URL

For profiles with no education array: infer from headline. Don't reject for missing education.

OUTREACH MESSAGE RULES:
- Address by first name only
- Reference ONE specific detail from their headline
- Mention their field and university if known
- Keep it 3 sentences max, conversational
- End with a soft open question
- Do NOT assume ethnicity or nationality in the message
- Example: "Hi Alex, saw you're finishing your MSc in Data Science at TU Berlin and actively looking for roles — that final semester job hunt is intense. CareerX helps graduates go from applications to real offers. Worth a quick chat?"

RAW PROFILES:
${JSON.stringify(chunk)}

RESPOND ONLY WITH VALID JSON:
{"leads":[{"id":"","name":"","linkedinUrl":"","university":"","degree":"","fieldOfStudy":"","graduationYear":"","location":"","headline":"","email":null,"socialMediaUrl":null,"seekingInternship":false,"seekingFullTime":false,"intentScore":2,"qualityScore":8,"outreachMessage":"","status":"new","reviewFlag":"approved","qualityBreakdown":{"euRelevant":true,"mastersStudent":true,"jobSearchIntent":true,"relevantField":true,"profileComplete":true,"nonTier1University":true}}]}`;

      const msg = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        system: 'You are a lead qualification expert. Respond only in valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      });

      if (msg.usage) onTokens?.(msg.usage.input_tokens, msg.usage.output_tokens);
      if (msg.content[0].type !== 'text') throw new Error('Unexpected response shape');
      const raw = msg.content[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw);
      const leads: any[] = Array.isArray(parsed?.leads) ? parsed.leads
        : Array.isArray(parsed) ? parsed
        : (() => { throw new Error(`Claude returned JSON without a leads array: ${raw.slice(0, 120)}`); })();

      const filtered = (leads || []).filter((l: any) => {
        if ((l.qualityScore ?? 0) < 6) return false;
        if (isEliteUni(l.university || '')) return false;
        if (SENIOR_TITLES.some(t => (l.headline || '').toLowerCase().includes(t))) return false;
        if (LOW_FIELDS.some(f => (l.fieldOfStudy || '').toLowerCase().includes(f))) return false;
        if (!l.name || l.name === 'Unknown' || !(l.linkedinUrl || l.url)) return false;
        return true;
      }).map((l: any) => {
        const signals = extractSignals(l);
        const struggleScore = calcStruggleScore(signals);
        const tier = assignTier(l.qualityScore ?? 0, l.intentScore ?? 1, struggleScore);

        let outreachMessage = l.outreachMessage || '';
        const regionalSuffix = buildRegionalSuffix(signals.regionalTag, signals.undergradSchool);
        const alreadyPersonalized = signals.regionalTag
          ? outreachMessage.toLowerCase().includes(signals.regionalTag.toLowerCase())
          : true;
        if (!alreadyPersonalized && regionalSuffix) {
          outreachMessage = outreachMessage.trimEnd() + regionalSuffix;
        }

        return {
          ...l,
          phone: l.phone || phoneMap.get(String(l.id)) || null,
          struggleScore,
          universityTier: signals.uniTier,
          networkingScore: signals.networkingScore,
          optDaysRemaining: signals.optDaysRemaining,
          detectedLanguage: signals.regionalTag || undefined,
          regionalTag: signals.regionalTag || undefined,
          outreachMessage,
          linkedInNote: buildLinkedInNote(
            { firstName: (l.name || '').split(' ')[0] || 'there', university: l.university || '', degree: l.degree || '', fieldOfStudy: l.fieldOfStudy || '', graduationYear: l.graduationYear || '' },
            signals,
          ),
          whatsAppUrl: buildWhatsAppUrl(l.phone || phoneMap.get(String(l.id)) || null, (l.name || '').split(' ')[0], l.fieldOfStudy || ''),
          tier,
        };
      });

      return filtered;
    }));

    for (let r = 0; r < results.length; r++) {
      const result = results[r];
      if (result.status === 'fulfilled') {
        allLeads.push(...result.value);
      } else {
        allLeads.push(...batch[r].map(mockScore).filter(l => l.qualityScore >= 6));
      }
    }
  }
  return allLeads;
}
