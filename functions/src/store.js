class LeadStore {
    leads = new Map();
    scannedTotal = 0;
    falsePositivesTotal = 0;
    getAll(filters = {}) {
        let result = Array.from(this.leads.values());
        if (filters.status) {
            result = result.filter((l) => l.status === filters.status);
        }
        if (filters.intent) {
            result = result.filter((l) => l.intent === filters.intent);
        }
        if (filters.city) {
            result = result.filter((l) => l.location.city?.toLowerCase() === filters.city?.toLowerCase());
        }
        if (filters.corridor) {
            result = result.filter((l) => l.location.corridor?.toLowerCase() === filters.corridor?.toLowerCase());
        }
        if (filters.minConfidence !== undefined) {
            result = result.filter((l) => l.confidence >= filters.minConfidence);
        }
        if (filters.minSqft !== undefined) {
            result = result.filter((l) => (l.size.normalizedSqft || 0) >= filters.minSqft);
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            result = result.filter((l) => l.title.toLowerCase().includes(q) ||
                l.organizationName?.toLowerCase().includes(q) ||
                l.industry?.toLowerCase().includes(q) ||
                l.location.corridor?.toLowerCase().includes(q) ||
                l.location.city?.toLowerCase().includes(q) ||
                l.tenderReference?.toLowerCase().includes(q));
        }
        // Default sorting
        const sortBy = filters.sortBy || 'date';
        const sortOrder = filters.sortOrder || 'desc';
        result.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'confidence') {
                comparison = a.confidence - b.confidence;
            }
            else if (sortBy === 'size') {
                comparison = (a.size.normalizedSqft || 0) - (b.size.normalizedSqft || 0);
            }
            else {
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        return result;
    }
    getById(id) {
        return this.leads.get(id);
    }
    save(lead) {
        this.leads.set(lead.id, lead);
    }
    updateStatus(id, status) {
        const lead = this.leads.get(id);
        if (!lead)
            return null;
        lead.status = status;
        lead.updatedAt = new Date().toISOString();
        return lead;
    }
    incrementScanned(count) {
        this.scannedTotal += count;
    }
    incrementFalsePositives(count) {
        this.falsePositivesTotal += count;
    }
    clear() {
        this.leads.clear();
        this.scannedTotal = 0;
        this.falsePositivesTotal = 0;
    }
    getStats() {
        const all = Array.from(this.leads.values());
        const totalLeads = all.length;
        const activeTenders = all.filter((l) => l.intent === 'tender' || l.intent === 'rfp').length;
        const highConfidenceCount = all.filter((l) => l.confidence >= 75).length;
        const sumConfidence = all.reduce((acc, curr) => acc + curr.confidence, 0);
        const avgConfidence = totalLeads > 0 ? Math.round(sumConfidence / totalLeads) : 0;
        const corridorBreakdown = {};
        const intentBreakdown = {};
        for (const lead of all) {
            const loc = lead.location.corridor || lead.location.city || 'Other';
            corridorBreakdown[loc] = (corridorBreakdown[loc] || 0) + 1;
            intentBreakdown[lead.intent] = (intentBreakdown[lead.intent] || 0) + 1;
        }
        return {
            totalLeads,
            activeTenders,
            highConfidenceCount,
            totalSignalsScanned: this.scannedTotal || totalLeads,
            falsePositivesFiltered: this.falsePositivesTotal,
            avgConfidence,
            corridorBreakdown,
            intentBreakdown
        };
    }
}
export const globalLeadStore = new LeadStore();
