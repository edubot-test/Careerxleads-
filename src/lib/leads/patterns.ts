// ── Qualification constants ────────────────────────────────────────────────────
export const SENIOR_TITLES = [
  'director', 'vp', 'vice president', 'head of', 'chief',
  'cto', 'ceo', 'principal', 'senior manager',
];
export const LOW_FIELDS = [
  'history', 'philosophy', 'literature', 'fine arts', 'art history', 'music', 'theater',
];

// ── EU location signals ──────────────────────────────────────────────────────
export const EU_COUNTRY_RE = /germany|deutschland|france|netherlands|holland|spain|italia|italy|portugal|ireland|austria|belgium|sweden|denmark|finland|norway|switzerland|poland|czech|romania|hungary|greece|croatia|bulgaria|slovakia|slovenia|estonia|latvia|lithuania|luxembourg|malta|cyprus|uk|united kingdom|england|scotland|wales/i;

export const EU_CITY_RE = /berlin|munich|frankfurt|hamburg|paris|lyon|marseille|amsterdam|rotterdam|the hague|barcelona|madrid|lisbon|dublin|vienna|brussels|stockholm|copenhagen|helsinki|oslo|zurich|warsaw|prague|bucharest|budapest|athens|milan|rome|turin|london|manchester|birmingham|edinburgh|glasgow/i;

export const EU_UNI_RE = /technische universit|tu berlin|tu munich|tum\b|rwth|lmu|uni heidelberg|humboldt|freie universit|universit.{1,3}t|politecnico|sorbonne|sciences po|ecole|grande ecole|universiteit|delft|eindhoven|erasmus|wageningen|ku leuven|universidad|universitat|politecnica|aalto|kth|chalmers|dtu\b|ntnu|eth zurich|epfl|agh\b|charles university|jagiellonian|university college|trinity college dublin|ucd\b|nuig|dit\b|imperial|ucl\b|kings college|university of|bocconi|luiss|sapienza/i;

// ── Career service signals (replaces Indian-specific patterns) ───────────────
export const CAREER_SERVICE_RE = /career coach|career service|job placement|recruitment agency|staffing|career counseling|employment service|job centre|arbeitsagentur|pole emploi|arbetsf.rmedlingen/i;

export const CAREER_SWITCH_RE = /career switch|career change|career transition|pivoting|reskill|upskill|bootcamp|career pivot|changing career|reconversion|umschulung|berufswechsel/i;

export const JOB_SEARCH_INTENT_RE = /seeking|looking for|open to work|actively looking|job hunt|job search|job seeker|available for hire|in transition|between jobs|on the market|searching for opportunities/i;

export const WORK_PERMIT_RE = /work permit|blue card|eu blue card|work visa|aufenthaltstitel|arbeitserlaubnis|tier 2|skilled worker visa|residence permit|permesso di soggiorno|titre de s.jour|work authorization|visa sponsorship|right to work|sponsorship required|needs sponsorship/i;

export const BODY_SHOP_RE = /\btcs\b|tata consultancy|infosys\b|wipro\b|cognizant\b|hcl technologies|tech mahindra|mphasis|hexaware|mindtree|ltimindtree|accenture|capgemini|atos\b|sopra steria|adecco|randstad|hays\b|manpower|modis\b|alten\b|altran|bertrandt|ferchau|brunel\b|staffing|body shop|outsourc/i;

export const COMMENT_INTENT_RE = /\binterested\b|please refer me|can anyone refer|refer me|dm me|looking to connect|open for referral|would love to be referred|can refer|actively applying|please share.*resume|tag me|drop your resume|referral.*request|looking for referral|would appreciate a referral/i;

export const FINANCIAL_CLOCK_RE = /loan repayment|education loan|student loan|need job urgently|immediate joining|immediate start|financial pressure|can.{0,10}join immediately|available immediately|notice period.*zero|zero notice period|relieve.*immediately|dringend|urgently seeking/i;

export const RESUME_REVIEW_RE = /resume review|critique my resume|please review my resume|roast my resume|resume feedback|resume help|\bcv review\b|resume critique|ats score|ats friendly|resume tips|career review|profile review|improving my resume|rewriting my resume|resume not getting|resume getting rejected|not getting interviews|lebenslauf/i;

export const LINKEDIN_PREMIUM_RE = /linkedin premium|premium member|open link|career insights|inmail credit|premium subscriber|career premium|linkedin career/i;

export const PRODUCT_COMPANY_RE = /\bgoogle\b|alphabet\b|meta\b|facebook\b|amazon\b|\baws\b|microsoft\b|apple\b|netflix\b|uber\b|airbnb\b|stripe\b|databricks\b|openai\b|salesforce\b|adobe\b|nvidia\b|palantir\b|doordash\b|spotify\b|sap\b|siemens\b|bosch\b|bmw\b|daimler\b|volkswagen\b|philips\b|asml\b|adyen\b|klarna\b|revolut\b|n26\b|deliveroo\b|just eat|booking\.com\b|trivago\b|zalando\b|wise\b|skyscanner\b|king\.com\b|ubisoft\b|criteo\b|datadog\b|contentful\b|celonis\b|personio\b/i;

// ── Elite university set (HARD REJECT — outside ICP) ─────────────────────────
// These graduates don't need career services — they have strong employer pipelines
const ELITE_UNIS = new Set([
  // US elite
  'mit', 'massachusetts institute of technology',
  'stanford', 'stanford university',
  'harvard', 'harvard university',
  'carnegie mellon', 'carnegie mellon university', 'cmu',
  'uc berkeley', 'university of california berkeley', 'berkeley',
  'caltech', 'california institute of technology',
  'princeton', 'princeton university', 'yale', 'yale university',
  'columbia', 'columbia university', 'cornell', 'cornell university',
  // UK elite
  'university of oxford', 'oxford university', 'university of cambridge', 'cambridge university',
  'imperial college', 'imperial college london',
  'london school of economics', 'lse', 'ucl', 'university college london',
  // EU elite
  'eth zurich', 'epfl',
  'tu munich', 'technical university of munich', 'tum',
  'lmu munich', 'ludwig maximilian university', 'rwth aachen',
  // Asia elite
  'peking university', 'pku', 'tsinghua', 'tsinghua university',
  'national university of singapore', 'nus', 'nanyang technological university', 'ntu singapore',
  'hkust', 'hong kong university of science and technology',
  // Indian elite
  'indian institute of technology',
  'iit bombay', 'iit delhi', 'iit madras', 'iit kanpur', 'iit kharagpur',
  'iisc', 'indian institute of science',
  // Other elite
  'university of toronto', 'mcgill', 'mcgill university',
  'university of melbourne', 'university of sydney',
]);

export function isEliteUni(university: string): boolean {
  const u = university.toLowerCase().trim();
  if (!u) return false;
  if (ELITE_UNIS.has(u)) return true;
  return Array.from(ELITE_UNIS).some(e => {
    if (e.length < 7) return false;
    const re = new RegExp(`(?:^|\\W)${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\W|$)`, 'i');
    return re.test(u);
  });
}

// ── University tiering (EU-focused) ──────────────────────────────────────────
// Tier 2: well-known EU universities — good programs but graduates still need career support
const TIER2_UNI_PATTERNS = [
  'tu berlin', 'tu darmstadt', 'tu dresden', 'kit', 'karlsruhe',
  'university of amsterdam', 'vrije universiteit', 'tu delft', 'tu eindhoven',
  'university of barcelona', 'universidad complutense', 'politecnica de madrid',
  'sorbonne', 'université paris', 'ecole polytechnique',
  'politecnico di milano', 'politecnico di torino', 'sapienza',
  'ku leuven', 'ghent university',
  'aalto university', 'kth royal', 'chalmers',
  'trinity college dublin', 'university college dublin',
  'university of warsaw', 'agh university', 'charles university',
  'university of vienna', 'tu wien',
  'university of copenhagen', 'dtu', 'ntnu',
  // US mid-tier (for immigrants from US)
  'san jose state', 'sjsu', 'northeastern', 'arizona state', 'asu',
  'university of florida', 'ohio state', 'penn state', 'rutgers',
];

// Tier 3: regional EU universities — prime CareerX targets
const TIER3_UNI_PATTERNS = [
  // Germany regional
  'universität', 'hochschule', 'fachhochschule', 'fh ',
  'university of applied sciences', 'htw', 'hawk',
  // Netherlands regional
  'hogeschool', 'hanze', 'saxion', 'fontys', 'avans',
  // France regional
  'université de', 'inalco', 'esiee', 'efrei',
  // Spain/Italy regional
  'universidad de', 'università di', 'universitat de',
  // Nordics regional
  'university of turku', 'university of tampere', 'lund university',
  'stockholm university', 'gothenburg',
  // Ireland regional
  'technological university', 'institute of technology',
  'munster technological', 'atlantic technological',
  // Eastern Europe
  'university of bucharest', 'technical university', 'polytechnic',
  'university of debrecen', 'university of pécs',
];

/** 1=elite (reject), 2=mid-tier target, 3=prime regional, 4=ultra-prime small */
export function categorizeUniversity(university: string): 1 | 2 | 3 | 4 {
  if (isEliteUni(university)) return 1;
  const u = university.toLowerCase().trim();
  if (TIER2_UNI_PATTERNS.some(p => u.includes(p))) return 2;
  if (TIER3_UNI_PATTERNS.some(p => u.includes(p))) return 3;
  return 4;
}
