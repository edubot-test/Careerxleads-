export interface Lead {
  id: string;
  name: string;
  linkedinUrl: string;
  university: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
  location: string;
  headline: string;
  email: string | null;
  socialMediaUrl: string | null;
  seekingInternship: boolean;
  seekingFullTime: boolean;
  tier: 1 | 2 | 3;       // 1=hot (score≥8+intent3), 2=warm, 3=cold
  intentScore: number;   // 1, 2, or 3
  qualityScore: number;  // 0–10 composite quality score
  outreachMessage: string;
  status: 'new' | 'contacted' | 'replied' | 'call booked' | 'converted';
  reviewFlag: 'approved' | 'review_needed';
  feedback?: 'good_lead' | 'irrelevant_lead' | 'converted_lead';
  qualityBreakdown: {
    indianOriginConfirmed: boolean;
    mastersStudent: boolean;
    jobSearchIntent: boolean;
    relevantField: boolean;
    profileComplete: boolean;
    nonTier1University: boolean;
  };
  metadata?: { platform?: string; actor?: string; [key: string]: unknown };
}

export interface GenerationParams {
  audience: string;
  originCountry: string;
  currentLocation: string;
  stage: string;
  fields: string;
  opportunityTypes: string;
  leadCount: string;
}

export interface PipelineStats {
  scraped: number;
  qualified: number;
  rejected: number;
}

export interface SearchHistoryEntry {
  id: string;
  timestamp: string;
  params: GenerationParams;
  qualifiedCount: number;
}
