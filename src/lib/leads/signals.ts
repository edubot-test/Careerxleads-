import {
  BODY_SHOP_RE, COMMENT_INTENT_RE, FINANCIAL_CLOCK_RE,
  RESUME_REVIEW_RE, LINKEDIN_PREMIUM_RE, PRODUCT_COMPANY_RE,
  LOW_FIELDS, isEliteUni, categorizeUniversity, WORK_PERMIT_RE,
  CAREER_SWITCH_RE,
} from './patterns';
import { getGradDateEstimate, isWorkPermitSeasonNow, isWorkPermitResultsWindow } from './timing';
import { detectRegionalTag } from './regional';
import { checkEURelevance } from './origin';

// ── SignalSet — single extraction pass per profile ────────────────────────────
export interface SignalSet {
  // Location relevance
  euRelevant: boolean;
  // Degree
  mastersStudent: boolean;
  // Job intent signals
  visaStruggle: boolean;
  workPermitPanic: boolean;
  workPermitResultsPanic: boolean;
  cptSchool: boolean;
  bodyShopExit: boolean;
  bodyShopCompany: string | null;
  commentIntent: boolean;
  financialClock: boolean;
  resumeReview: boolean;
  premiumBadge: boolean;
  frustration: boolean;
  skillGap: boolean;
  timePressure: boolean;
  jobSearchIntent: boolean;
  stillSearching: boolean;
  hasInternSignal: boolean;
  careerSwitch: boolean;
  // Composite
  networkTrap: boolean;
  networkingScore: number;
  // Regional
  regionalTag: string | undefined;
  undergradSchool: string | null;
  // Graduation countdown
  daysAgo: number;
  optDaysRemaining: number | undefined;
  // Profile meta
  relevantField: boolean;
  profileComplete: boolean;
  uniTier: 2 | 3 | 4;
}

export function extractSignals(p: any): SignalSet {
  const edu = p.education?.[0] || {};
  const university = edu.schoolName || p.university || '';
  const degree = edu.degreeName || p.degree || '';
  const fieldOfStudy = edu.fieldOfStudy || p.fieldOfStudy || '';
  const rawEndDate = edu.endDate;
  const graduationYear = (typeof rawEndDate === 'object' ? rawEndDate?.text : rawEndDate) || p.graduationYear || '';
  const headline = (p.headline || '').toLowerCase();
  const fullName = p.fullName || p.name || '';
  const summary = (p.summary || '').toLowerCase();
  const snippet = (p.metadata?.snippet || '').toLowerCase();

  // Find undergrad education
  const undergradEdu = (p.education || []).find((e: any) =>
    /b\.?tech|b\.?e\b|bachelor|b\.?sc|licence|laurea|grado/i.test(e.degreeName || ''),
  ) || p.education?.[1] || {};

  // ── EU relevance check ─────────────────────────────────────────────────────
  const euRelevant = checkEURelevance(p);

  // ── Degree ─────────────────────────────────────────────────────────────────
  const mastersStudent = /master|ms\b|m\.s\.|mba|m\.b\.a\.|meng|m\.eng|m\.sc|msc\b|diplom|magister|ma\b.*in/i.test(degree)
    || /\bms\b|m\.s\.|master|mba|meng|m\.eng|m\.sc|msc\b/i.test(headline);

  // ── Intent signals ─────────────────────────────────────────────────────────
  const visaStruggle = WORK_PERMIT_RE.test(headline)
    && !/no sponsorship needed|does not require sponsorship|authorized to work|eu citizen/i.test(headline);
  const workPermitPanic = isWorkPermitSeasonNow() && /work permit|blue card|visa|sponsorship|residence permit/i.test(headline);
  const workPermitResultsPanic = isWorkPermitResultsWindow() && /work permit|blue card|visa denied|permit rejected|visa expir/i.test(headline);
  const cptSchool = false; // Not applicable in EU context
  const bodyShopExit = (p.experience || []).some((e: any) =>
    BODY_SHOP_RE.test(e.companyName || e.company || ''),
  );
  const bodyShopCompany = (p.experience || []).find((e: any) =>
    BODY_SHOP_RE.test(e.companyName || e.company || ''),
  )?.companyName || null;
  const commentIntent = COMMENT_INTENT_RE.test(headline) || COMMENT_INTENT_RE.test(snippet);
  const financialClock = FINANCIAL_CLOCK_RE.test(headline) || FINANCIAL_CLOCK_RE.test(summary);
  const resumeReview = RESUME_REVIEW_RE.test(headline) || RESUME_REVIEW_RE.test(snippet);
  const premiumBadge = LINKEDIN_PREMIUM_RE.test(headline) || p.isPremium === true;
  const frustration = /no offers|no interviews|struggling|ghosted|no callbacks|rejected|please help|job hunt|resume review/i.test(headline);
  const skillGap = CAREER_SWITCH_RE.test(headline) || /upskilling|self.taught|bootcamp|looking for mentor|udemy|coursera|project.based learning/i.test(headline);
  const careerSwitch = CAREER_SWITCH_RE.test(headline) || CAREER_SWITCH_RE.test(summary);

  const gradYrNum = parseInt(graduationYear || '0', 10);
  const thisYrNum = new Date().getFullYear();
  const timePressure = gradYrNum > 0 && (gradYrNum === thisYrNum || gradYrNum === thisYrNum + 1) &&
    /graduating|incoming|class of|starting (summer|fall|spring|winter)|abschluss/i.test(headline);

  const stillSearching = /student|looking for|seeking|job hunt|open to work|actively|auf der suche|en recherche/i.test(headline);
  const hasInternSignal = /intern|co.?op|werkstudent|stage|praktikum|stagiaire/i.test(headline)
    || (p.experience || []).some((e: any) => /intern|co.?op|werkstudent|praktik/i.test((e.title || e.positionTitle || '').toLowerCase()));

  const jobSearchIntent = visaStruggle || workPermitPanic || workPermitResultsPanic ||
    commentIntent || financialClock || resumeReview || frustration || skillGap || timePressure || careerSwitch ||
    /seeking|looking for|open to|internship|full.?time|actively looking/i.test(headline);

  // ── Networking score ───────────────────────────────────────────────────────
  const expText = (p.experience || []).map((e: any) => e.companyName || e.company || '').join(' ');
  const hasProductExp = PRODUCT_COMPANY_RE.test(expText);
  const hasServiceExp = BODY_SHOP_RE.test(expText);
  const hasProductMention = PRODUCT_COMPANY_RE.test(`${headline} ${summary}`);
  const hasEcosystemEng = /open source|github\.com|hackathon|google developer|aws certified|microsoft certified|leetcode|competitive programming|open.*contribut/i.test(`${headline} ${summary}`);
  let networkingScore = 5;
  if (hasProductExp) networkingScore += 4;
  if (hasProductMention) networkingScore += 2;
  if (hasEcosystemEng) networkingScore += 1;
  if (hasServiceExp) networkingScore -= 3;
  if (!hasProductExp && !hasProductMention && !hasEcosystemEng) networkingScore -= 2;
  networkingScore = Math.max(0, Math.min(10, networkingScore));

  const networkTrap = bodyShopExit && networkingScore <= 4;

  // ── Regional tag (EU country) ──────────────────────────────────────────────
  const regionalTag = detectRegionalTag(p);
  const undergradSchoolFull = undergradEdu?.schoolName || null;
  const undergradSchool = undergradSchoolFull
    ? (undergradSchoolFull.length > 40 ? undergradSchoolFull.slice(0, 38) + '…' : undergradSchoolFull)
    : null;

  // ── Graduation countdown ───────────────────────────────────────────────────
  const UNEMPLOYMENT_LIMIT = 90;
  const STANDARD_VALIDITY = 365;
  const gradDateEst = gradYrNum > 0 ? getGradDateEstimate(gradYrNum, p.headline || '') : null;
  const daysAgo = gradDateEst ? Math.floor((Date.now() - gradDateEst.getTime()) / 86_400_000) : -1;
  const optDaysRemaining = (daysAgo >= 0 && jobSearchIntent)
    ? (daysAgo <= STANDARD_VALIDITY ? Math.max(0, UNEMPLOYMENT_LIMIT - daysAgo) : 0)
    : undefined;

  // ── Profile meta ───────────────────────────────────────────────────────────
  const relevantField = !LOW_FIELDS.some(f => fieldOfStudy.toLowerCase().includes(f));
  const profileComplete = !!(fullName && university && fieldOfStudy && p.linkedinUrl);
  const uniTierRaw = categorizeUniversity(university);
  const uniTier: 2 | 3 | 4 = uniTierRaw === 1 ? 2 : uniTierRaw;

  return {
    euRelevant, mastersStudent,
    visaStruggle, workPermitPanic, workPermitResultsPanic,
    cptSchool, bodyShopExit, bodyShopCompany,
    commentIntent, financialClock, resumeReview, premiumBadge,
    frustration, skillGap, timePressure, careerSwitch,
    jobSearchIntent, stillSearching, hasInternSignal,
    networkTrap, networkingScore,
    regionalTag, undergradSchool,
    daysAgo, optDaysRemaining,
    relevantField, profileComplete, uniTier,
  };
}
