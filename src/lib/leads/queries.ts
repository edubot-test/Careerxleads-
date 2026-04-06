import { isWorkPermitSeasonNow, isWorkPermitResultsWindow } from './timing';

export interface PlatformStrategy {
  sequence: string[];
  rationale: Record<string, string>;
}

export function buildPlatformStrategy(params: any): PlatformStrategy {
  const fields           = (params.fields || '').toLowerCase();
  const opportunityTypes = (params.opportunityTypes || '').toLowerCase();
  const target           = parseInt(params.leadCount, 10) || 50;

  const isTech     = /computer|cs\b|data science|engineer|ml\b|ai\b|machine learning|software|developer|swe|information tech|cybersec/.test(fields);
  const isMLAI     = /ml\b|ai\b|machine learning|deep learning|nlp|data science|artificial intelligence|llm/.test(fields);
  const isBusiness = /mba|business|finance|marketing|management|consulting|operations|analytics/.test(fields);
  const needsIntern = /intern/.test(opportunityTypes);
  const isLargeRun  = target >= 100;

  const sequence: string[] = ['linkedin'];
  const rationale: Record<string, string> = {
    linkedin: `Primary source. 2-step pipeline (search → full scrape) returns school + degree + field. Best for verifying education + job search intent. ~$4/1000 profiles. Start here always.`,
  };

  if (isTech) {
    sequence.push('github');
    rationale['github'] = `High value for ${fields}. Real code activity signals genuine tech skill. Bio/location often reveals students and job seekers. ~$0.2/1000.`;
  }

  if (isLargeRun || needsIntern || isTech) {
    sequence.push('google');
    rationale['google'] = `Supplemental LinkedIn coverage. site:linkedin.com/in/ dork queries surface profiles LinkedIn's own search misses (especially intent keywords like "open to work", "seeking", "career switch"). ~$0.5/1000.`;
  }

  if (needsIntern || isBusiness || isMLAI) {
    sequence.push('reddit');
    rationale['reddit'] = `High intent signal. r/cscareerquestions + r/UKjobs + r/DeveloperEire have people actively discussing job hunts. ~$0.1/1000.`;
  }

  return { sequence, rationale };
}

export function buildQueryExamples(params: any, sequence: string[]): string {
  const location = params.visaStatus || 'United States';
  const fields   = params.fields || 'Computer Science';
  const fieldParts: string[] = fields.split(',').map((f: string) => f.trim()).filter(Boolean);
  const field1 = fieldParts[0] || fields.trim();
  const field2 = fieldParts[1] || '';
  const extraFields: string[] = fieldParts.slice(2);

  const rawGradYr = (params.graduationYear || '').match(/\d{4}/g);
  const gradYr    = rawGradYr ? parseInt(rawGradYr[0]) : new Date().getFullYear() + 1;
  const gradYr2   = rawGradYr && rawGradYr[1] ? parseInt(rawGradYr[1]) : gradYr + 1;
  const gradYrStr = rawGradYr ? rawGradYr.join(' OR ') : String(gradYr);

  const isIntern = (params.opportunityTypes || '').toLowerCase().includes('intern');
  const intent   = isIntern ? 'seeking internship' : 'open to work';
  const intKw    = isIntern ? 'internship' : 'full-time';

  // Derive location keywords
  const locRaw = (params.visaStatus || '').toLowerCase();
  const isUK = locRaw.includes('uk') || locRaw.includes('united kingdom');
  const isIreland = locRaw.includes('ireland');
  const isUS = locRaw.includes('united states') || locRaw.includes('usa') || (!isUK && !isIreland);

  const locationKw = isUK ? 'United Kingdom' : isIreland ? 'Ireland' : 'United States';
  const visaKw = isUK ? 'Skilled Worker Visa' : isIreland ? 'Critical Skills Permit' : 'work authorization';

  const cityHint = params.targetCities && !/all/i.test(params.targetCities)
    ? params.targetCities.split(/[,\/]/).map((c: string) => c.trim()).filter(Boolean).join(' OR ')
    : null;

  const exMap: Record<string, string[]> = {
    linkedin: [
      // Tier-1: job search intent + location
      `"${field1}" "open to work" ${gradYrStr} ${locationKw}`,
      `"${field1}" "seeking" ${intKw} ${gradYrStr} ${locationKw}`,
      `"${field1}" "actively looking" ${gradYrStr} ${locationKw}`,
      // Tier-2: degree + year
      `Masters "${field1}" ${gradYrStr} ${locationKw} "seeking"`,
      `"MSc" OR "MS" "${field1}" ${gradYrStr} "open to work" ${locationKw}`,
      `"MBA" "${field1}" ${locationKw} ${gradYrStr} "career switch"`,
      // Career switch signals
      `"career switch" "${field1}" ${locationKw} "seeking" OR "open to work"`,
      `"career change" OR "pivoting" "${field1}" ${locationKw}`,
      `"bootcamp" OR "reskilling" "${field1}" ${locationKw} "seeking"`,
      // Frustration / urgency signals
      `"no offers" OR "struggling" "${field1}" ${locationKw} ${gradYrStr}`,
      `"job hunt" "${field1}" ${locationKw} "entry-level" OR "new grad"`,
      `"not getting interviews" "${field1}" ${locationKw}`,
      // Visa / work permit signals
      `"${visaKw}" "${field1}" "seeking" ${gradYrStr}`,
      `"work permit" OR "visa sponsorship" "${field1}" ${locationKw} "seeking"`,
      // Time pressure
      `"Graduating May ${gradYr}" "${field1}" ${locationKw} "seeking"`,
      `"Graduating ${gradYr}" "${field1}" ${locationKw} "open to work"`,
      `"Class of ${gradYr}" "${field1}" ${locationKw} "seeking"`,
      // Comment intent
      `"interested" "refer me" "${field1}" ${locationKw} ${gradYrStr}`,
      `"looking for referral" "${field1}" ${locationKw}`,
      // Indian-priority queries (still important)
      `"B.Tech" "${field1}" MS ${gradYrStr} ${locationKw}`,
      `"Indian Student Association" "${field1}" ${locationKw}`,
      // Financial pressure
      `"immediate joining" "${field1}" ${locationKw}`,
      `"available immediately" "${field1}" "seeking" ${locationKw}`,
      // Resume help seekers
      `"resume review" "${field1}" ${locationKw} ${gradYrStr}`,
      ...(field2 ? [`"${field2}" "open to work" ${gradYrStr} ${locationKw}`] : []),
      ...extraFields.map(f => `"${f}" "open to work" ${gradYrStr} ${locationKw}`),
    ],
    google: [
      // Profile dorks
      `site:linkedin.com/in/ "${field1}" "open to work" ${locationKw} ${gradYrStr}`,
      `site:linkedin.com/in/ "${field1}" "seeking" ${locationKw} ${gradYrStr}`,
      `site:linkedin.com/in/ "${field1}" "career switch" ${locationKw}`,
      `site:linkedin.com/in/ "${field1}" "${visaKw}" ${locationKw}`,
      `site:linkedin.com/in/ "Masters" "${field1}" ${locationKw} "seeking" ${gradYrStr}`,
      `site:linkedin.com/in/ "actively looking" "${field1}" ${locationKw}`,
      // Frustration dorks
      `site:linkedin.com/in/ "no offers" OR "struggling" "${field1}" ${locationKw}`,
      `site:linkedin.com/in/ "not getting interviews" "${field1}" ${locationKw}`,
      // Time pressure
      `site:linkedin.com/in/ "Graduating ${gradYr}" "${field1}" ${locationKw}`,
      `site:linkedin.com/in/ "Class of ${gradYr}" "${field1}" ${locationKw}`,
      // Comment intent sniffer (posts, not profiles)
      `site:linkedin.com/posts/ "interested" "${field1}" ${locationKw} hiring`,
      `site:linkedin.com/posts/ "please refer me" "${field1}" ${locationKw}`,
      `site:linkedin.com/posts/ "can anyone refer" "${field1}" ${locationKw}`,
      `site:linkedin.com "looking for referral" "${field1}" ${locationKw}`,
      // Resume / CV seekers
      `site:linkedin.com "resume review" "${field1}" ${locationKw}`,
      `site:linkedin.com "CV review" "${field1}" ${locationKw}`,
      // PDF resume hunter
      `"${field1}" ${locationKw} "resume" filetype:pdf "seeking" OR "open to work"`,
      ...(field2 ? [`site:linkedin.com/in/ "${field2}" "${locationKw}" "seeking" ${gradYrStr}`] : []),
      ...extraFields.map(f => `site:linkedin.com/in/ "${f}" "${locationKw}" "seeking" ${gradYrStr}`),
    ],
    github: [
      `location:"${locationKw}" "${field1}" "open to" OR "looking for" language:Python`,
      `location:"${locationKw}" "${field1}" "seeking" followers:>1`,
      ...(cityHint
        ? [`location:${cityHint.split(' OR ').map((c: string) => `"${c}"`).join(' OR location:')} "${field1}" "seeking"`]
        : isUK ? [`location:"London" OR location:"Manchester" OR location:"Edinburgh" "${field1}" "seeking"`]
        : isIreland ? [`location:"Dublin" OR location:"Cork" OR location:"Galway" "${field1}" "seeking"`]
        : [`location:"New York" OR location:"San Francisco" OR location:"Seattle" "${field1}" "seeking"`]
      ),
      `"${field1}" "open to work" OR "job hunting" language:Python ${locationKw}`,
    ],
    reddit: [
      `subreddit:cscareerquestions "${field1}" "no offers" OR "struggling" OR "entry level" ${gradYrStr}`,
      `subreddit:cscareerquestions "international student" "${field1}" ${gradYrStr}`,
      ...(isUK ? [
        `subreddit:UKjobs "${field1}" "graduate" OR "entry level" OR "seeking"`,
        `subreddit:cscareerquestionsEU "${field1}" UK "no interviews" OR "struggling"`,
      ] : isIreland ? [
        `subreddit:DeveloperEire "${field1}" "seeking" OR "job hunt"`,
        `subreddit:ireland "tech jobs" "${field1}" "graduate" OR "entry level"`,
      ] : [
        `subreddit:cscareerquestions "new grad" "${field1}" ${gradYrStr} "no offers"`,
        `subreddit:jobs "${field1}" "entry level" "struggling"`,
      ]),
      `subreddit:careerguidance "career switch" "${field1}" "advice" OR "help"`,
      `subreddit:resumes "${field1}" "feedback" OR "review" OR "not getting interviews"`,
      ...(field2 ? [`subreddit:cscareerquestions "${field2}" "struggling" OR "no offers"`] : []),
      ...extraFields.map(f => `subreddit:cscareerquestions "${f}" "struggling" OR "no offers"`),
    ],
  };

  const annotations: Record<string, string> = {
    linkedin: `(layers: job intent → degree+year → career switch → visa/permit → frustration → resume help)`,
    google:   `(dork layers: profile intent → post comment hunter → frustration → CV sniffer → PDF resume)`,
    github:   `(location → tech hubs → field repo signals)`,
    reddit:   `(cscareerquestions → UK/Ireland specific → career guidance → resumes)`,
  };

  return sequence
    .filter(p => exMap[p])
    .map(p => `- ${p} ${annotations[p] || ''}:\n  ${exMap[p].map((q, i) => `${i + 1}. ${q}`).join('\n  ')}`)
    .join('\n');
}

export function buildAgentPrompt(params: any): string {
  const target = parseInt(params.leadCount, 10) || 50;
  const { sequence, rationale } = buildPlatformStrategy(params);
  const scrapeLimit = Math.min(target * 4, 200);
  const locationKw = params.visaStatus || 'United States';

  const platformGuide = sequence.map((p, i) =>
    `${i + 1}. "${p}" — ${rationale[p]}`
  ).join('\n');

  const queryExamples = buildQueryExamples(params, sequence);

  const peakNote = isWorkPermitResultsWindow()
    ? `\n⚠️ PEAK HIRING SEASON: Spring recruitment is active. Many graduates are finding out about job offers and visa results NOW. Prioritise queries with urgency signals — "no offers", "struggling", "available immediately", "visa expiring".\n`
    : isWorkPermitSeasonNow()
    ? `\n📋 HIRING SEASON ACTIVE: Spring hiring cycle in progress. Many students graduating soon — prioritise "Graduating ${new Date().getFullYear()}", "seeking", "open to work" signals.\n`
    : '';

  return `You are a Lead Discovery Agent for CareerX, a career services platform helping people in the USA, UK, and Ireland land full-time jobs. Find ${target} qualified leads matching the target profile below.
${peakNote}
TARGET PROFILE:
- Audience: ${params.audience}
- Target Location: ${locationKw}
- Target Cities/Hubs: ${params.targetCities || 'All major hubs'}
- Graduation Year: ${params.graduationYear || 'Any (prefer recent: 2024-2026)'}
- Fields: ${params.fields}
- Opportunity: ${params.opportunityTypes}
- Priority: Indian-origin candidates are priority, but include DIVERSE profiles from all backgrounds

RECOMMENDED PLATFORM SEQUENCE:
${platformGuide}

You are NOT locked to this sequence. If feedback shows a platform is underperforming, skip ahead or go back.

QUERY EXAMPLES (adapt freely):
${queryExamples}

EXECUTION RULES:
1. Start with platform #1 in the sequence above.
2. Set limit to ${scrapeLimit} per call (4× remaining gap).
3. After each result, read the REJECTED breakdown and ADAPT hint before deciding the next call.
4. Never repeat a query that already returned < 10% yield — rewrite it or switch platforms.
5. Call report_results when totalQualified >= ${target} OR all platforms exhausted.

HIGH-VALUE INTENT SIGNALS:

COMMENT INTENT SNIFFER (warmest signal — person raised hand publicly):
When Google returns LinkedIn POST results where someone commented "Interested", "Please refer me", "Can anyone refer" — these leads are ACTIVELY applying RIGHT NOW.

CAREER SWITCH SIGNAL (high conversion — they NEED guidance):
People mentioning "career switch", "pivoting", "reskilling", "bootcamp graduate", "self-taught" have decided to change but need help executing. Perfect CareerX candidates.

FRUSTRATION SIGNALS (highest conversion — they need the service):
"no callbacks", "ghosted", "ATS", "rejections", "no response", "struggling", "not getting interviews"

VISA / WORK PERMIT SIGNALS:
"work permit", "visa sponsorship", "skilled worker visa", "critical skills permit", "OPT", "H1B", "work authorization needed"
→ People facing structural barriers need professional career support most.

RESUME REVIEW SEEKERS (self-identified the problem):
"resume review", "CV review", "roast my resume", "not getting interviews", "ATS friendly"
→ They've done 80% of the sales work themselves. Conversion is high.

LINKEDIN PREMIUM BADGE (proven willingness to pay):
Students who bought LinkedIn Premium and are STILL seeking have shown they will pay for career help.

CONSULTING / BODY SHOP EXIT (wants better role):
Experience at TCS, Infosys, Wipro, Cognizant, Accenture, Capgemini + currently seeking = strong CareerX fit.

ACTIVE JOB HUNT signals:
"open to work", "actively looking", "seeking", "job hunt", "entry-level", "new grad", "recent graduate", "career switch", "in transition"

DIVERSITY PRIORITY:
- Indian-origin candidates remain top priority (surnames: Sharma, Patel, Singh, Kumar, Reddy, etc.)
- But ALSO include: European locals, Chinese, Korean, African, Latin American, Middle Eastern candidates
- We want a TRUE diverse mix of genuine leads, not mono-ethnic batches
- Score based on JOB SEARCH INTENT, not ethnicity

ADAPTING FROM FEEDBACK:
Each result returns: yield rate · T1/T2/T3 · REJECTED breakdown · QUALIFIED universities/fields · ADAPT hint.

REJECTED line tells you WHY profiles failed — act on it:
- "too low score" dominant     → add intent signals: "seeking" "open to work" "career switch" "no offers"
- "missing education" dominant → try specific university names or google dork with "university" keyword
- "elite university" dominant  → drop prestige keywords; target regional/mid-tier universities
- "senior title" dominant      → add "student" "entry-level" "recent grad" to exclude experienced hires
- "irrelevant field" dominant  → narrow queries to specific fields like "Computer Science" "Data Science"

PLATFORM SWITCHING LOGIC:
- yield ≥ 20% and still short → stay, rotate intent signals in fresh queries
- yield 10–20%               → try one more call with rewritten queries, then switch
- yield < 10%                → follow ADAPT hint, then switch to next platform

Begin now with platform #1: "${sequence[0]}".`;
}
