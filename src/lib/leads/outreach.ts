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
 * Priority branch order mirrors intentScore ranking — highest urgency first.
 */
export function buildOutreachMessage(ctx: OutreachContext, s: SignalSet): string {
  const { firstName, university, degree, fieldOfStudy, graduationYear } = ctx;
  const regionalSuffix = buildRegionalSuffix(s.regionalTag, s.undergradSchool);
  const bodyShop = s.bodyShopCompany || 'a consulting firm';

  const body = (() => {
    if (s.workPermitResultsPanic)
      return `With work permit/visa results coming through, if yours didn't come through, the next 60 days are critical — you need a solid offer lined up.${regionalSuffix} CareerX specialises in exactly this kind of urgent career support.`;
    if (s.workPermitPanic)
      return `With visa and work permit deadlines approaching, locking in an offer NOW is the smartest move.${regionalSuffix} CareerX helps job seekers get offers before permit windows close.`;
    if (s.commentIntent)
      return `Saw you looking for a referral in ${fieldOfStudy} — referral competition is intense without the right network. CareerX gives you a strategy that's helped candidates at similar schools beat those odds.${regionalSuffix}`;
    if (s.optDaysRemaining !== undefined && s.optDaysRemaining <= 15)
      return `With ~${s.optDaysRemaining} days left on your job search clock, this is a rescue mission, not a casual search.${regionalSuffix} CareerX has helped candidates go from zero offers to signed offers in under 3 weeks.`;
    if (s.networkTrap)
      return `Noticed your background at ${bodyShop} — the jump from consulting to a product company requires a different network than most graduates have access to.${regionalSuffix} That's exactly what we provide.`;
    if (s.careerSwitch)
      return `Making a career switch into ${fieldOfStudy} is one of the hardest transitions — but also one of the most rewarding when done right.${regionalSuffix} CareerX has a specific roadmap for career changers.`;
    if (s.financialClock)
      return `With your ${degree || 'degree'} in ${fieldOfStudy} wrapping up, the pressure to land something fast is real.${regionalSuffix} CareerX has helped candidates go from zero offers to signed offers in weeks, not months.`;
    if (s.resumeReview)
      return `Not getting interviews usually isn't a resume problem — it's a targeting strategy problem.${regionalSuffix} CareerX can show you exactly what's blocking your ${fieldOfStudy} applications.`;
    if (s.bodyShopExit)
      return `The jump from ${bodyShop} to a product company is real — but it requires a different playbook.${regionalSuffix} We have a specific roadmap for this transition.`;
    if (s.visaStruggle)
      return `Navigating work permits and the ${fieldOfStudy} job market is a tough combo, especially without the right leads.${regionalSuffix}`;
    if (s.premiumBadge)
      return `You've already invested in LinkedIn Premium — that shows you're serious. CareerX takes it further with direct recruiter access and offer negotiation.${regionalSuffix}`;
    if (s.frustration)
      return `The ${fieldOfStudy} entry-level market is brutal right now.${regionalSuffix}`;
    if (s.skillGap)
      return `The gap between what courses teach and what ${fieldOfStudy} recruiters want is real, and hard to bridge alone.${regionalSuffix}`;
    if (s.timePressure)
      return `Graduating ${graduationYear ? `in ${graduationYear} ` : ''}with your ${degree || 'degree'} in ${fieldOfStudy}${university ? ` at ${university}` : ''} — that countdown to offers is intense.${regionalSuffix}`;
    if (s.jobSearchIntent)
      return `The ${fieldOfStudy} job market is competitive right now, especially without the right connections.${regionalSuffix}`;
    return `Finishing your ${degree || 'degree'} in ${fieldOfStudy}${graduationYear ? ` in ${graduationYear}` : ''}${university ? ` at ${university}` : ''}.${regionalSuffix}`;
  })();

  return `Hi ${firstName},\n\n${body} CareerX helps people go from applications to real offers. Worth a quick chat?`;
}

/**
 * Generate a short LinkedIn connection request note (max 300 chars).
 * LinkedIn limits connection notes to 300 characters.
 */
export function buildLinkedInNote(ctx: OutreachContext, s: SignalSet): string {
  const { firstName, fieldOfStudy, university } = ctx;
  const name = firstName || 'there';

  // Pick the most relevant short hook
  let hook: string;
  if (s.careerSwitch)
    hook = `making a career switch into ${fieldOfStudy || 'tech'}`;
  else if (s.visaStruggle || s.workPermitPanic)
    hook = `navigating work permits in ${fieldOfStudy || 'your field'}`;
  else if (s.frustration)
    hook = `the tough ${fieldOfStudy || 'job'} market right now`;
  else if (s.jobSearchIntent)
    hook = `your job search in ${fieldOfStudy || 'your field'}`;
  else if (university)
    hook = `your ${fieldOfStudy || 'studies'} at ${university}`;
  else
    hook = `your background in ${fieldOfStudy || 'your field'}`;

  const note = `Hi ${name}, noticed ${hook}. CareerX helps people land real offers — from skills to placement. Open to connecting?`;

  // Hard trim to 300 chars
  return note.length <= 300 ? note : note.slice(0, 297) + '...';
}

/**
 * Generate a WhatsApp message URL for a lead with a phone number.
 * Returns the full wa.me URL with pre-filled message, or null if no phone.
 */
export function buildWhatsAppUrl(phone: string | null, firstName: string, fieldOfStudy: string): string | null {
  if (!phone) return null;

  // Clean phone number — keep only digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length < 8) return null;

  const msg = encodeURIComponent(
    `Hi ${firstName || 'there'}, I came across your profile and thought CareerX could help with your ${fieldOfStudy || 'career'} goals — from skill building to job placement. Would you be open to a quick chat?`
  );

  return `https://wa.me/${cleaned.replace(/^\+/, '')}?text=${msg}`;
}
