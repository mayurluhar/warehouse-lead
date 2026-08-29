import { RssNewsConnector, UrlScraperConnector, getSampleDocuments } from '@warehouse-lead/connectors';
import { BedrockLeadExtractor } from '@warehouse-lead/ai';
import { LeadDeduplicator } from '@warehouse-lead/core';
import { globalLeadStore } from './store';
const extractor = new BedrockLeadExtractor();
const deduplicator = new LeadDeduplicator();
const rssConnector = new RssNewsConnector();
const urlScraper = new UrlScraperConnector();
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-Requested-With, Accept, Origin',
    'Content-Type': 'application/json'
};
function response(statusCode, body) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(body)
    };
}
export async function handler(event) {
    const method = event.requestContext.http.method.toUpperCase();
    const rawPath = event.requestContext.http.path || '/';
    // Normalize path (strip trailing slash)
    const path = rawPath.replace(/\/$/, '') || '/';
    if (method === 'OPTIONS') {
        return response(200, { ok: true });
    }
    try {
        // 1. Ingest Multi-Source Scan (Google News RSS + Curated Sources)
        if (method === 'POST' && path === '/api/ingest/scan') {
            const documents = await rssConnector.fetchWarehouseFeeds();
            globalLeadStore.incrementScanned(documents.length);
            let relevantCount = 0;
            let discardedCount = 0;
            let newCount = 0;
            for (const doc of documents) {
                const extracted = await extractor.extract(doc.title, doc.cleanText);
                if (!extracted.isRelevant) {
                    discardedCount++;
                    globalLeadStore.incrementFalsePositives(1);
                    continue;
                }
                relevantCount++;
                const { lead, isNew } = deduplicator.processExtractedLead(extracted, doc, globalLeadStore.getAll());
                globalLeadStore.save(lead);
                if (isNew)
                    newCount++;
            }
            return response(200, {
                success: true,
                scannedCount: documents.length,
                relevantCount,
                discardedCount,
                newLeadsAdded: newCount,
                totalLeads: globalLeadStore.getAll().length
            });
        }
        // 2. Ingest Single URL
        if (method === 'POST' && path === '/api/ingest/url') {
            const body = JSON.parse(event.body || '{}');
            if (!body.url) {
                return response(400, { error: 'url is required' });
            }
            const doc = await urlScraper.scrapeUrl(body.url);
            globalLeadStore.incrementScanned(1);
            const extracted = await extractor.extract(doc.title, doc.cleanText);
            if (!extracted.isRelevant) {
                globalLeadStore.incrementFalsePositives(1);
                return response(200, {
                    success: false,
                    isRelevant: false,
                    reason: extracted.reasoningSummary,
                    document: doc
                });
            }
            const { lead, isNew, isCorroborated } = deduplicator.processExtractedLead(extracted, doc, globalLeadStore.getAll());
            globalLeadStore.save(lead);
            return response(200, {
                success: true,
                isNew,
                isCorroborated,
                lead
            });
        }
        // 3. Ingest Raw Text / Trade Newsletter
        if (method === 'POST' && path === '/api/ingest/text') {
            const body = JSON.parse(event.body || '{}');
            if (!body.text) {
                return response(400, { error: 'text is required' });
            }
            const title = body.title || 'Direct Ingestion Signal';
            const doc = {
                id: `raw_${Date.now()}`,
                sourceUrl: body.sourceUrl || 'direct_input',
                canonicalUrl: body.sourceUrl || `direct_input://${Date.now()}`,
                title,
                publishedAt: new Date().toISOString(),
                rawText: body.text,
                cleanText: body.text,
                sourceType: body.sourceType || 'manual_text',
                trustTier: body.trustTier || 'unverified',
                contentHash: `hash_${Date.now()}`,
                fetchedAt: new Date().toISOString()
            };
            globalLeadStore.incrementScanned(1);
            const extracted = await extractor.extract(title, body.text);
            if (!extracted.isRelevant) {
                globalLeadStore.incrementFalsePositives(1);
                return response(200, {
                    success: false,
                    isRelevant: false,
                    reason: extracted.reasoningSummary
                });
            }
            const { lead, isNew } = deduplicator.processExtractedLead(extracted, doc, globalLeadStore.getAll());
            globalLeadStore.save(lead);
            return response(200, {
                success: true,
                isNew,
                lead
            });
        }
        // 4. Ingest Benchmark Signals
        if (method === 'POST' && path === '/api/ingest/samples') {
            const samples = getSampleDocuments();
            globalLeadStore.incrementScanned(samples.length);
            let relevant = 0;
            let discarded = 0;
            for (const doc of samples) {
                const extracted = await extractor.extract(doc.title, doc.cleanText);
                if (!extracted.isRelevant) {
                    discarded++;
                    globalLeadStore.incrementFalsePositives(1);
                    continue;
                }
                relevant++;
                const { lead } = deduplicator.processExtractedLead(extracted, doc, globalLeadStore.getAll());
                globalLeadStore.save(lead);
            }
            return response(200, {
                success: true,
                scannedCount: samples.length,
                relevantCount: relevant,
                discardedCount: discarded,
                leads: globalLeadStore.getAll()
            });
        }
        // 5. Get Leads (with search & filters)
        if (method === 'GET' && path === '/api/leads') {
            const queryParams = event.queryStringParameters || {};
            const filters = {
                search: queryParams.search,
                intent: queryParams.intent,
                city: queryParams.city,
                corridor: queryParams.corridor,
                minConfidence: queryParams.minConfidence ? parseInt(queryParams.minConfidence, 10) : undefined,
                minSqft: queryParams.minSqft ? parseInt(queryParams.minSqft, 10) : undefined,
                status: queryParams.status,
                sortBy: queryParams.sortBy,
                sortOrder: queryParams.sortOrder
            };
            const leads = globalLeadStore.getAll(filters);
            return response(200, {
                count: leads.length,
                leads
            });
        }
        // 6. Get Lead Detail by ID
        const leadDetailMatch = path.match(/^\/api\/leads\/([a-zA-Z0-9_\-]+)$/);
        if (method === 'GET' && leadDetailMatch) {
            const leadId = leadDetailMatch[1];
            const lead = globalLeadStore.getById(leadId);
            if (!lead) {
                return response(404, { error: 'Lead not found' });
            }
            return response(200, { lead });
        }
        // 7. Update Lead Status (e.g. approve/reject/contacted)
        const statusMatch = path.match(/^\/api\/leads\/([a-zA-Z0-9_\-]+)\/status$/);
        if (method === 'PATCH' && statusMatch) {
            const leadId = statusMatch[1];
            const body = JSON.parse(event.body || '{}');
            const updated = globalLeadStore.updateStatus(leadId, body.status);
            if (!updated) {
                return response(404, { error: 'Lead not found' });
            }
            return response(200, { success: true, lead: updated });
        }
        // 8. Pipeline Statistics
        if (method === 'GET' && path === '/api/stats') {
            return response(200, globalLeadStore.getStats());
        }
        // 9. Reset Leads
        if (method === 'DELETE' && path === '/api/leads') {
            globalLeadStore.clear();
            return response(200, { success: true, message: 'Lead store reset' });
        }
        // Root Health Check
        if (path === '' || path === '/' || path === '/api/health') {
            return response(200, {
                status: 'healthy',
                service: 'Warehouse Lead Intelligence Platform - Ingestion API',
                timestamp: new Date().toISOString(),
                leadsCount: globalLeadStore.getAll().length
            });
        }
        return response(404, { error: 'Not Found', path, method });
    }
    catch (error) {
        console.error('API execution error:', error);
        return response(500, {
            error: 'Internal Server Error',
            message: error.message
        });
    }
}
