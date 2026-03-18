import type { SignalSet } from './signals';
import { buildRegionalSuffix } from './regional';

export interface OutreachContext {
  firstName: string;
  university: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
}

/**
 * Builds the full outreach message from signals + profile context.
 * Replaces the inline IIFE previously living inside mockScore().
 * Priority branch order mirrors intentScore ranking — highest urgency first.
 */
export function buildOutreachMessage(ctx: OutreachContext, s: SignalSet): string {
  const { firstName, university, degree, fieldOfStudy, graduationYear } = ctx;
  const regionalSuffix = buildRegionalSuffix(s.regionalTag, s.undergradSchool);
  const bodyShop = s.bodyShopCompany || 'a consulting firm';

  const body = (() => {
    if (s.cptSchool)
      return `Noticed you're at ${university || 'a Day 1 CPT school'} — staying in the US while job hunting is stressful and expensive.${regionalSuffix} CareerXcelerator has helped students in exactly your situation land product-company offers.`;
    if (s.h1bResultsPanic)
      return `With H1B lottery results just out, if you didn't get selected, the next 60 days are critical — you need a product company offer or a Day 1 CPT plan.${regionalSuffix} CareerXcelerator specialises in exactly this pivot.`;
    if (s.h1bPanic)
      return `With H1B lottery results coming any day, locking in a product company offer NOW is the safest move.${regionalSuffix} CareerXcelerator helps international students get offers before the lottery results change everything.`;
    if (s.commentIntent)
      return `Saw you looking for a referral in ${fieldOfStudy} — referral competition is typically 500:1 without the right network. CareerXcelerator gives you a "Desi Referral" strategy that's helped students at similar schools beat those odds.${regionalSuffix}`;
    if (s.optDaysRemaining !== undefined && s.optDaysRemaining <= 15)
      return `With ~${s.optDaysRemaining} days left on your OPT unemployment clock, this is a rescue mission, not a job search.${regionalSuffix} CareerXcelerator has gotten students from zero offers to signed offers in under 3 weeks.`;
    if (s.networkTrap)
      return `Noticed your background at ${bodyShop} — the jump from service sector to a product company (and a $60k→$130k salary bump) requires a different network than most Tier 3/4 grads have access to.${regionalSuffix} That's exactly what we provide.`;
    if (s.financialClock)
      return `With your ${degree || 'MS'} in ${fieldOfStudy} wrapping up, the financial pressure to land something fast is real.${regionalSuffix} CareerXcelerator has helped students go from zero offers to signed offers in weeks, not months.`;
    if (s.resumeReview)
      return `Not getting interviews usually isn't a resume problem — it's a targeting strategy problem.${regionalSuffix} CareerXcelerator can show you exactly what's blocking your ${fieldOfStudy} applications.`;
    if (s.bodyShopExit)
      return `The jump from ${bodyShop} to a product company that pays $130k+ is real — but it requires a different playbook.${regionalSuffix} We have a specific roadmap for this transition.`;
    if (s.visaStruggle)
      return `Navigating OPT/F1 and the ${fieldOfStudy} job market is a brutal combo, especially without the right sponsorship leads.${regionalSuffix}`;
    if (s.premiumBadge)
      return `You've already invested in LinkedIn Premium — that shows you're serious. CareerXcelerator takes it further with direct recruiter access and offer negotiation.${regionalSuffix}`;
    if (s.frustration)
      return `The ${fieldOfStudy} entry-level market is brutal for international students right now.${regionalSuffix}`;
    if (s.skillGap)
      return `The gap between what bootcamps teach and what ${fieldOfStudy} recruiters want is real, and hard to bridge alone.${regionalSuffix}`;
    if (s.timePressure)
      return `Graduating ${graduationYear ? `in ${graduationYear} ` : ''}with your ${degree || 'MS'} in ${fieldOfStudy}${university ? ` at ${university}` : ''} — that countdown to offers is intense.${regionalSuffix}`;
    if (s.jobSearchIntent)
      return `The ${fieldOfStudy} job market is tough right now, especially for international students.${regionalSuffix}`;
    return `Finishing your ${degree || 'MS'} in ${fieldOfStudy}${graduationYear ? ` in ${graduationYear}` : ''}${university ? ` at ${university}` : ''}.${regionalSuffix}`;
  })();

  return `Hi ${firstName},\n\n${body} CareerXcelerator helps students go from applications to real offers. Worth a quick chat?`;
}
