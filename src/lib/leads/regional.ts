import { EU_COUNTRY_RE, EU_CITY_RE } from './patterns';

// ── EU Country detection from profile signals ────────────────────────────────
const COUNTRY_PATTERNS: Record<string, RegExp> = {
  Germany:     /germany|deutschland|berlin|munich|m.nchen|frankfurt|hamburg|stuttgart|d.sseldorf|cologne|k.ln|dortmund|essen|leipzig|dresden|nuremberg|n.rnberg/i,
  Netherlands: /netherlands|holland|amsterdam|rotterdam|the hague|den haag|eindhoven|utrecht|groningen|delft|leiden/i,
  France:      /france|paris|lyon|marseille|toulouse|nice|nantes|strasbourg|montpellier|bordeaux|lille/i,
  Spain:       /spain|espa.a|madrid|barcelona|valencia|seville|sevilla|bilbao|malaga|m.laga/i,
  Italy:       /italy|italia|milan|milano|rome|roma|turin|torino|florence|firenze|naples|napoli|bologna/i,
  Ireland:     /ireland|dublin|cork|galway|limerick|waterford/i,
  Sweden:      /sweden|stockholm|gothenburg|g.teborg|malm.|uppsala|link.ping/i,
  Denmark:     /denmark|copenhagen|k.benhavn|aarhus|odense/i,
  Austria:     /austria|vienna|wien|graz|salzburg|innsbruck|linz/i,
  Belgium:     /belgium|brussels|bruxelles|antwerp|antwerpen|ghent|gent|leuven/i,
  Switzerland: /switzerland|zurich|z.rich|geneva|gen.ve|basel|bern|lausanne/i,
  Poland:      /poland|warsaw|warszawa|krakow|krak.w|wroclaw|wroc.aw|poznan|pozna./i,
  Portugal:    /portugal|lisbon|lisboa|porto|braga|coimbra/i,
  Finland:     /finland|helsinki|espoo|tampere|turku|oulu/i,
  Norway:      /norway|oslo|bergen|trondheim|stavanger/i,
  Czech:       /czech|prague|praha|brno|ostrava/i,
  UK:          /united kingdom|\buk\b|england|london|manchester|birmingham|edinburgh|glasgow|bristol|leeds|liverpool|cambridge|oxford/i,
};

/**
 * Detect which EU country the profile is associated with.
 * Checks location, headline, university, and summary.
 */
export function detectRegionalTag(p: any): string | undefined {
  const location = (p.location || '').toLowerCase();
  const headline = (p.headline || '').toLowerCase();
  const uni = (p.education?.[0]?.schoolName || p.university || '').toLowerCase();
  const combined = `${location} ${headline} ${uni}`;

  for (const [country, pattern] of Object.entries(COUNTRY_PATTERNS)) {
    if (pattern.test(combined)) return country;
  }
  return undefined;
}

/** Returns the regional outreach suffix with country-specific personalization. */
export function buildRegionalSuffix(tag: string | undefined, undergradSchool: string | null): string {
  if (!tag) return '';
  const schoolRef = undergradSchool ? ` from ${undergradSchool}` : '';
  switch (tag) {
    case 'Germany':
      return `\n\nP.S. The German job market has unique requirements${schoolRef} — from Bewerbungsmappe formatting to work permit navigation. We've helped many professionals land roles at top German companies.`;
    case 'Netherlands':
      return `\n\nP.S. The Dutch tech scene is booming${schoolRef} — from Amsterdam startups to Eindhoven's high-tech campus. We know the 30% ruling and KvK process inside out.`;
    case 'France':
      return `\n\nP.S. Whether you're targeting Paris or Lyon${schoolRef}, the French job market rewards the right network. We've helped candidates navigate titre de séjour and CDI offers.`;
    case 'Ireland':
      return `\n\nP.S. Dublin's tech hub${schoolRef} is one of Europe's strongest — Google, Meta, Stripe all have EU HQs there. We've helped many candidates land roles through the Critical Skills Permit route.`;
    case 'UK':
      return `\n\nP.S. The UK job market${schoolRef} is competitive but full of opportunity — from London's fintech scene to Manchester's growing tech hub. We've helped candidates navigate the Skilled Worker visa process.`;
    case 'Sweden':
      return `\n\nP.S. Sweden's tech ecosystem${schoolRef} — Spotify, Klarna, King — is incredibly welcoming to international talent. We've helped candidates navigate the work permit process.`;
    case 'Spain':
      return `\n\nP.S. Spain's growing tech scene${schoolRef} — from Barcelona's startups to Madrid's enterprise sector — offers great opportunities. We can help navigate the autónomo and work permit process.`;
    case 'Italy':
      return `\n\nP.S. Italy's tech sector is growing fast${schoolRef} — Milan and Turin especially. We can help with the permesso di soggiorno process and connecting you to the right companies.`;
    case 'Switzerland':
      return `\n\nP.S. Swiss salaries are among Europe's highest${schoolRef}, but the job market is unique. We've helped candidates navigate B/L permits and break into companies like Google Zurich, UBS, and Swiss startups.`;
    case 'Poland':
      return `\n\nP.S. Poland has become a major tech hub in Central Europe${schoolRef} — Krakow and Warsaw especially. Competitive salaries with lower cost of living make it an attractive option.`;
    default:
      return `\n\nP.S. We've helped many professionals${schoolRef} land roles across Europe. The EU job market rewards the right approach — and we have the playbook.`;
  }
}
