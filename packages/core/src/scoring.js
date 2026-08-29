/**
 * Deterministic Explainable Lead Confidence Scoring Engine (0 - 100)
 * Evaluates 7 distinct business-rule components as defined in Section 6.1.
 */
export class LeadScoringEngine {
    calculateScore(extracted, primarySource, corroboratingSources = []) {
        const explanations = [];
        // 1. Intent Strength (0 - 25)
        let intentStrength = 0;
        switch (extracted.intent) {
            case 'tender':
                intentStrength = 25;
                explanations.push('Formal public tender / official procurement requirement (+25)');
                break;
            case 'rfp':
                intentStrength = 23;
                explanations.push('Commercial RFP / structured proposal invitation (+23)');
                break;
            case 'scouting':
                intentStrength = 19;
                explanations.push('Active market requirement scouting (+19)');
                break;
            case 'expansion':
                intentStrength = 16;
                explanations.push('Announced logistics footprint expansion (+16)');
                break;
            case 'land':
                intentStrength = 14;
                explanations.push('Logistics land / BTS park acquisition (+14)');
                break;
            case 'watch':
            default:
                intentStrength = 8;
                explanations.push('General market commentary / watch signal (+8)');
                break;
        }
        // 2. Requirement Specificity (0 - 20)
        let requirementSpecificity = 0;
        if (extracted.size.value && extracted.size.unit) {
            requirementSpecificity += 8;
            explanations.push(`Explicit area size specified: ${extracted.size.value} ${extracted.size.unit} (+8)`);
        }
        if (extracted.location.corridor) {
            requirementSpecificity += 7;
            explanations.push(`Specific micro-corridor identified: ${extracted.location.corridor} (+7)`);
        }
        else if (extracted.location.city) {
            requirementSpecificity += 4;
            explanations.push(`Target city identified: ${extracted.location.city} (+4)`);
        }
        if (extracted.deadline) {
            requirementSpecificity += 3;
            explanations.push(`Defined submission deadline: ${extracted.deadline} (+3)`);
        }
        if (extracted.specialRequirements && extracted.specialRequirements.length > 0) {
            requirementSpecificity += 2;
            explanations.push(`Facility specifications stated: ${extracted.specialRequirements.join(', ')} (+2)`);
        }
        requirementSpecificity = Math.min(20, requirementSpecificity);
        // 3. Source Trust (0 - 15)
        let sourceTrust = 0;
        switch (primarySource.trustTier) {
            case 'official':
                sourceTrust = 15;
                explanations.push('Official government tender portal / primary company press release (+15)');
                break;
            case 'reputable_media':
                sourceTrust = 12;
                explanations.push('Reputable business publication / verified trade wire (+12)');
                break;
            case 'aggregator':
                sourceTrust = 8;
                explanations.push('Public news index / aggregator (+8)');
                break;
            case 'unverified':
            default:
                sourceTrust = 4;
                explanations.push('Unverified web source (+4)');
                break;
        }
        // 4. Location Relevance (0 - 15)
        let locationRelevance = 0;
        const gujaratCorridors = ['Sanand', 'Changodar', 'Aslali', 'Chhatral / Kadi', 'Dahej / Bharuch', 'Hazira / Surat', 'Savli / Halol'];
        if (extracted.location.corridor && gujaratCorridors.includes(extracted.location.corridor)) {
            locationRelevance = 15;
            explanations.push(`Prime Gujarat logistics corridor: ${extracted.location.corridor} (+15)`);
        }
        else if (extracted.location.state === 'Gujarat') {
            locationRelevance = 12;
            explanations.push('Core client target state: Gujarat (+12)');
        }
        else if (extracted.location.city) {
            locationRelevance = 9;
            explanations.push(`Major Indian warehousing hub: ${extracted.location.city} (+9)`);
        }
        else {
            locationRelevance = 2;
            explanations.push('General or unmapped territory (+2)');
        }
        // 5. Recency (0 - 10)
        let recency = 10;
        const publishedTime = new Date(primarySource.publishedAt).getTime();
        if (!isNaN(publishedTime)) {
            const daysOld = (Date.now() - publishedTime) / (1000 * 60 * 60 * 24);
            if (daysOld <= 7) {
                recency = 10;
                explanations.push('Fresh signal published < 7 days ago (+10)');
            }
            else if (daysOld <= 30) {
                recency = 7;
                explanations.push('Recent signal published 7-30 days ago (+7)');
            }
            else {
                recency = 4;
                explanations.push('Older signal published > 30 days ago (+4)');
            }
        }
        else {
            explanations.push('Recent timestamp (+10)');
        }
        // 6. Corroboration (0 - 10)
        let corroboration = 0;
        const totalSources = 1 + corroboratingSources.length;
        if (totalSources >= 3) {
            corroboration = 10;
            explanations.push(`Corroborated by ${totalSources} independent sources (+10)`);
        }
        else if (totalSources === 2) {
            corroboration = 6;
            explanations.push('Corroborated by 2 distinct sources (+6)');
        }
        else {
            corroboration = 0;
            explanations.push('Single source signal (+0)');
        }
        // 7. Contact Actionability (0 - 5)
        let contactActionability = 0;
        if (extracted.contact.email || extracted.contact.phone || extracted.tenderReference) {
            contactActionability = 5;
            explanations.push('Directly actionable: Direct email/phone or official tender reference (+5)');
        }
        else if (extracted.organizationName) {
            contactActionability = 3;
            explanations.push('Target organization identified (+3)');
        }
        else {
            contactActionability = 1;
            explanations.push('Action route requires secondary discovery (+1)');
        }
        const total = Math.min(100, intentStrength +
            requirementSpecificity +
            sourceTrust +
            locationRelevance +
            recency +
            corroboration +
            contactActionability);
        return {
            intentStrength,
            requirementSpecificity,
            sourceTrust,
            locationRelevance,
            recency,
            corroboration,
            contactActionability,
            total,
            explanations
        };
    }
}
