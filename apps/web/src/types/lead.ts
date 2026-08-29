export type Intent = 'tender' | 'rfp' | 'scouting' | 'expansion' | 'land' | 'watch';

export type RequirementType = 'lease' | 'hire' | 'build_to_suit' | 'buy' | 'land' | 'unknown';

export type SourceType =
  | 'google_news'
  | 'rss_feed'
  | 'tender_portal'
  | 'manual_url'
  | 'manual_text'
  | 'trade_newsletter';

export type TrustTier = 'official' | 'reputable_media' | 'aggregator' | 'unverified';

export type LeadStatus = 'inbox' | 'approved' | 'contacted' | 'rejected';

export interface SizeInfo {
  value: number | null;
  unit: 'sqft' | 'acres' | 'lakh_sqft' | 'sqm' | null;
  normalizedSqft: number | null;
}

export interface LocationInfo {
  state: string | null;
  city: string | null;
  corridor: string | null;
  rawText: string | null;
}

export interface ContactInfo {
  name: string | null;
  role: string | null;
  organization: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface EvidenceQuote {
  field: string;
  quote: string;
}

export interface ScoreBreakdown {
  intentStrength: number;
  requirementSpecificity: number;
  sourceTrust: number;
  locationRelevance: number;
  recency: number;
  corroboration: number;
  contactActionability: number;
  total: number;
  explanations: string[];
}

export interface RawDocument {
  id: string;
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  publishedAt: string;
  rawText: string;
  cleanText: string;
  sourceType: SourceType;
  trustTier: TrustTier;
  contentHash: string;
  fetchedAt: string;
}

export interface LeadRecord {
  id: string;
  title: string;
  organizationName: string | null;
  industry: string | null;
  intent: Intent;
  requirementType: RequirementType;
  size: SizeInfo;
  location: LocationInfo;
  specialRequirements: string[];
  deadline: string | null;
  leaseTermMonths: number | null;
  contact: ContactInfo;
  tenderReference: string | null;
  evidence: EvidenceQuote[];
  reasoningSummary: string;
  
  confidence: number;
  scoreBreakdown: ScoreBreakdown;
  status: LeadStatus;
  primarySource: RawDocument;
  corroboratingSources: RawDocument[];
  
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStats {
  totalLeads: number;
  activeTenders: number;
  highConfidenceCount: number;
  totalSignalsScanned: number;
  falsePositivesFiltered: number;
  avgConfidence: number;
  corridorBreakdown: Record<string, number>;
  intentBreakdown: Record<string, number>;
}
