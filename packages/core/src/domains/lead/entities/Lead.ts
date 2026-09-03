import { GeoRadius } from './Geo';
import { SourceDocument } from './SourceDocument';

/**
 * The Lead aggregate and its value objects.
 *
 * These are plain interfaces rather than the blueprint's entity classes with a
 * validating constructor and an immutable `.with()` helper. That design belongs
 * to the blueprint's switchable-persistence section, which is out of scope for
 * this pass — and adopting it now would change behaviour, because the
 * deduplication service currently merges corroborating evidence by mutating a
 * lead in place. Introducing entity classes is a behavioural refactor worth
 * doing on its own, not smuggled into a structural one.
 */

/** How strong a demand signal the source represents. */
export type Intent = 'tender' | 'rfp' | 'scouting' | 'expansion' | 'land' | 'watch';

/** What the occupier wants to do with the space. */
export type RequirementType = 'lease' | 'hire' | 'build_to_suit' | 'buy' | 'land' | 'unknown';

/** Position in the review/sales workflow. */
export type LeadStatus = 'inbox' | 'approved' | 'contacted' | 'rejected';

export interface SizeInfo {
  value: number | null;
  unit: 'sqft' | 'acres' | 'lakh_sqft' | 'sqm' | null;
  /** Converted to sqft so leads of differing units stay comparable. */
  normalizedSqft: number | null;
}

export interface LocationInfo {
  state: string | null;
  city: string | null;
  corridor: string | null;
  /** The original location phrase, kept alongside the normalized geography. */
  rawText: string | null;
  /**
   * Coordinates resolved from the named place during ingestion, so leads can be
   * searched by distance from an arbitrary point rather than only by exact
   * corridor name. Null when the source named no place the gazetteer knows —
   * such leads are excluded from radius searches rather than guessed at.
   */
  latitude: number | null;
  longitude: number | null;
}

export interface ContactInfo {
  name: string | null;
  role: string | null;
  organization: string | null;
  email?: string | null;
  phone?: string | null;
}

/** Verbatim source text backing one extracted field. */
export interface EvidenceQuote {
  field: string;
  quote: string;
}

/**
 * The explainable 0-100 confidence score, kept as components so a reviewer can
 * see why a lead scored the way it did rather than trusting a bare number.
 */
export interface ScoreBreakdown {
  intentStrength: number;         // Max 25
  requirementSpecificity: number; // Max 20
  sourceTrust: number;            // Max 15
  locationRelevance: number;      // Max 15
  recency: number;                // Max 10
  corroboration: number;          // Max 10
  contactActionability: number;   // Max 5
  total: number;                  // 0 - 100
  explanations: string[];
}

/**
 * What the AI extractor returns for one document, before deduplication and
 * scoring turn it into a Lead. Unknown fields are explicitly null — the
 * extractor is forbidden from inventing values.
 */
export interface ExtractedLead {
  isRelevant: boolean;
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
  modelUsed?: string;
  /**
   * Present when the primary extractor failed and a fallback produced this
   * result. Carries a user-facing reason so the desk can report reduced
   * accuracy instead of silently presenting degraded output as normal.
   */
  extractionFallback?: { reason: string };
}

/**
 * One deduplicated warehouse requirement, assembled from one or more source
 * documents.
 */
export interface Lead {
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

  // Scoring & workflow metadata
  confidence: number;
  scoreBreakdown: ScoreBreakdown;
  status: LeadStatus;
  /** The document the lead was first built from. */
  primarySource: SourceDocument;
  /** Independent sources describing the same underlying requirement. */
  corroboratingSources: SourceDocument[];

  createdAt: string;
  updatedAt: string;
}

/** Whitelisted filter/sort vocabulary for lead queries. */
export interface LeadFilterOptions {
  search?: string;
  intent?: Intent;
  city?: string;
  corridor?: string;
  /**
   * Restrict to leads whose resolved coordinates fall within a radius of a
   * point. Leads without coordinates are governed by `includeUnlocated`.
   */
  near?: GeoRadius;
  /**
   * Whether leads with no resolved coordinates survive a `near` filter.
   *
   * A radius can only prove a lead is *outside* it. A lead whose source never
   * named a place is not outside the circle — its position is unknown — so
   * dropping it states something the data does not support, and hides real
   * leads with no trace in the UI. Off by default to keep a geographic query
   * strictly geographic; the desk turns it on so nothing disappears silently.
   */
  includeUnlocated?: boolean;
  minConfidence?: number;
  minSqft?: number;
  status?: LeadStatus;
  sortBy?: 'confidence' | 'date' | 'size' | 'distance';
  sortOrder?: 'asc' | 'desc';
}
