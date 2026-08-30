import { ExtractedLead, Lead } from '../entities/Lead';
import { SourceDocument } from '../entities/SourceDocument';
import { LeadScoringService } from './LeadScoringService';

/** Outcome of reconciling one extracted document against the existing leads. */
export interface ReconciliationResult {
  lead: Lead;
  /** True when this produced a brand new lead card. */
  isNew: boolean;
  /** True when it attached to an existing lead as independent evidence. */
  isCorroborated: boolean;
}

/**
 * Collapses repeated reporting of the same underlying requirement into one lead
 * with several evidence records, rather than several near-identical lead cards.
 *
 * Three passes, in order of confidence:
 *   1. Exact duplicate  — same content hash or canonical URL, already seen.
 *   2. Correlated       — same tender reference, or same organization in the
 *                         same city; attach as corroborating evidence and
 *                         rescore, since independent confirmation raises
 *                         confidence.
 *   3. Otherwise        — a new lead.
 */
export class LeadDeduplicationService {
  private readonly scoringService: LeadScoringService;

  constructor(deps: { scoringService: LeadScoringService }) {
    this.scoringService = deps.scoringService;
  }

  public reconcile(
    extracted: ExtractedLead,
    doc: SourceDocument,
    existingLeads: Lead[]
  ): ReconciliationResult {
    // 1. Exact document duplication — nothing to merge, nothing to rescore.
    for (const lead of existingLeads) {
      if (lead.primarySource.contentHash === doc.contentHash || lead.primarySource.canonicalUrl === doc.canonicalUrl) {
        return { lead, isNew: false, isCorroborated: false };
      }
      if (lead.corroboratingSources.some((s) => s.contentHash === doc.contentHash || s.canonicalUrl === doc.canonicalUrl)) {
        return { lead, isNew: false, isCorroborated: false };
      }
    }

    // 2. A different source describing the same requirement.
    const matchingLead = existingLeads.find((lead) => {
      if (extracted.tenderReference && lead.tenderReference && extracted.tenderReference.toLowerCase() === lead.tenderReference.toLowerCase()) {
        return true;
      }
      if (
        extracted.organizationName &&
        lead.organizationName &&
        extracted.organizationName.toLowerCase() === lead.organizationName.toLowerCase() &&
        extracted.location.city &&
        lead.location.city &&
        extracted.location.city.toLowerCase() === lead.location.city.toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (matchingLead) {
      matchingLead.corroboratingSources.push(doc);

      // Fill gaps only — an existing specific value is never overwritten by a
      // later, possibly vaguer, report of the same requirement.
      if (!matchingLead.size.value && extracted.size.value) matchingLead.size = extracted.size;
      if (!matchingLead.location.corridor && extracted.location.corridor) matchingLead.location = extracted.location;
      if (!matchingLead.deadline && extracted.deadline) matchingLead.deadline = extracted.deadline;
      if (!matchingLead.contact.email && extracted.contact.email) matchingLead.contact = extracted.contact;

      extracted.evidence.forEach((ev) => {
        if (!matchingLead.evidence.some((e) => e.quote === ev.quote)) {
          matchingLead.evidence.push(ev);
        }
      });

      const newScore = this.scoringService.calculateScore(
        { ...matchingLead, isRelevant: true },
        matchingLead.primarySource,
        matchingLead.corroboratingSources
      );

      matchingLead.scoreBreakdown = newScore;
      matchingLead.confidence = newScore.total;
      matchingLead.updatedAt = new Date().toISOString();

      return { lead: matchingLead, isNew: false, isCorroborated: true };
    }

    // 3. A requirement not seen before.
    const initialScore = this.scoringService.calculateScore(extracted, doc, []);
    const now = new Date().toISOString();

    const newLead: Lead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: doc.title,
      organizationName: extracted.organizationName,
      industry: extracted.industry,
      intent: extracted.intent,
      requirementType: extracted.requirementType,
      size: extracted.size,
      location: extracted.location,
      specialRequirements: extracted.specialRequirements,
      deadline: extracted.deadline,
      leaseTermMonths: extracted.leaseTermMonths,
      contact: extracted.contact,
      tenderReference: extracted.tenderReference,
      evidence: extracted.evidence,
      reasoningSummary: extracted.reasoningSummary,
      confidence: initialScore.total,
      scoreBreakdown: initialScore,
      status: 'inbox',
      primarySource: doc,
      corroboratingSources: [],
      createdAt: now,
      updatedAt: now
    };

    return { lead: newLead, isNew: true, isCorroborated: false };
  }
}
