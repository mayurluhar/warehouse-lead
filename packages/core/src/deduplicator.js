import { LeadScoringEngine } from './scoring';
export class LeadDeduplicator {
    scoringEngine;
    constructor() {
        this.scoringEngine = new LeadScoringEngine();
    }
    processExtractedLead(extracted, doc, existingLeads) {
        // 1. Check for exact document duplication
        for (const lead of existingLeads) {
            if (lead.primarySource.contentHash === doc.contentHash || lead.primarySource.canonicalUrl === doc.canonicalUrl) {
                return { lead, isNew: false, isCorroborated: false };
            }
            if (lead.corroboratingSources.some((s) => s.contentHash === doc.contentHash || s.canonicalUrl === doc.canonicalUrl)) {
                return { lead, isNew: false, isCorroborated: false };
            }
        }
        // 2. Check for corroborating requirement
        const matchingLead = existingLeads.find((lead) => {
            if (extracted.tenderReference && lead.tenderReference && extracted.tenderReference.toLowerCase() === lead.tenderReference.toLowerCase()) {
                return true;
            }
            if (extracted.organizationName &&
                lead.organizationName &&
                extracted.organizationName.toLowerCase() === lead.organizationName.toLowerCase() &&
                extracted.location.city &&
                lead.location.city &&
                extracted.location.city.toLowerCase() === lead.location.city.toLowerCase()) {
                return true;
            }
            return false;
        });
        if (matchingLead) {
            matchingLead.corroboratingSources.push(doc);
            // Merge higher-specificity details
            if (!matchingLead.size.value && extracted.size.value)
                matchingLead.size = extracted.size;
            if (!matchingLead.location.corridor && extracted.location.corridor)
                matchingLead.location = extracted.location;
            if (!matchingLead.deadline && extracted.deadline)
                matchingLead.deadline = extracted.deadline;
            if (!matchingLead.contact.email && extracted.contact.email)
                matchingLead.contact = extracted.contact;
            extracted.evidence.forEach((ev) => {
                if (!matchingLead.evidence.some((e) => e.quote === ev.quote)) {
                    matchingLead.evidence.push(ev);
                }
            });
            const newScore = this.scoringEngine.calculateScore({ ...matchingLead, isRelevant: true }, matchingLead.primarySource, matchingLead.corroboratingSources);
            matchingLead.scoreBreakdown = newScore;
            matchingLead.confidence = newScore.total;
            matchingLead.updatedAt = new Date().toISOString();
            return { lead: matchingLead, isNew: false, isCorroborated: true };
        }
        // 3. Create new lead card
        const initialScore = this.scoringEngine.calculateScore(extracted, doc, []);
        const newLead = {
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        return { lead: newLead, isNew: true, isCorroborated: false };
    }
}
