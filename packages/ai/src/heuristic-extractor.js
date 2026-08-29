export function extractWithHeuristics(title, text) {
    const combined = `${title}\n${text}`;
    const evidence = [];
    // 1. Relevance Classification
    const relevanceCheck = classifyRelevance(combined);
    if (!relevanceCheck.isRelevant) {
        return {
            isRelevant: false,
            organizationName: null,
            industry: null,
            intent: 'watch',
            requirementType: 'unknown',
            size: { value: null, unit: null, normalizedSqft: null },
            location: { state: null, city: null, corridor: null, rawText: null },
            specialRequirements: [],
            deadline: null,
            leaseTermMonths: null,
            contact: { name: null, role: null, organization: null },
            tenderReference: null,
            evidence: [],
            reasoningSummary: relevanceCheck.reason
        };
    }
    // 2. Intent Classification
    const intent = detectIntent(combined);
    // 3. Requirement Type
    const requirementType = detectRequirementType(combined);
    // 4. Size & Unit Extraction
    const size = extractSize(combined, evidence);
    // 5. Location & Corridor Extraction
    const location = extractLocation(combined, evidence);
    // 6. Organization & Industry Extraction
    const organizationName = extractOrganization(title, combined, evidence);
    const industry = detectIndustry(combined);
    // 7. Special Requirements
    const specialRequirements = extractSpecialRequirements(combined, evidence);
    // 8. Tender Reference & Deadline
    const tenderReference = extractTenderReference(combined, evidence);
    const deadline = extractDeadline(combined, evidence);
    // 9. Contact details
    const contact = extractContact(combined, organizationName, evidence);
    // 10. Reasoning Summary
    const reasoningSummary = generateReasoningSummary({
        organizationName,
        intent,
        size,
        location,
        tenderReference
    });
    return {
        isRelevant: true,
        organizationName,
        industry,
        intent,
        requirementType,
        size,
        location,
        specialRequirements,
        deadline,
        leaseTermMonths: extractLeaseTerm(combined),
        contact,
        tenderReference,
        evidence,
        reasoningSummary
    };
}
function classifyRelevance(text) {
    const lower = text.toLowerCase();
    const falsePositivePatterns = [
        /\b(residential apartments|flat for sale|2bhk|3bhk|villa for sale)\b/i,
        /\b(share price target|quarterly results declared|stock plunges|market index falls)\b/i
    ];
    for (const pattern of falsePositivePatterns) {
        if (pattern.test(lower) && !/(warehouse|godown|logistics park|fulfillment centre)/i.test(lower)) {
            return { isRelevant: false, reason: 'Filtered as irrelevant residential/stock news.' };
        }
    }
    const demandSignals = [
        /warehouse/i,
        /godown/i,
        /logistics\s*(park|facility|hub|space)/i,
        /distribution\s*cent(er|re)/i,
        /fulfil{1,2}ment\s*cent(er|re)/i,
        /cold\s*storage/i,
        /built[- ]to[- ]suit/i,
        /industrial\s*shed/i,
        /storage\s*(space|facility)/i
    ];
    const hasDemandTerm = demandSignals.some((regex) => regex.test(lower));
    if (!hasDemandTerm) {
        return { isRelevant: false, reason: 'No warehousing or logistics demand keywords identified.' };
    }
    const actionSignals = [
        /require/i, /need/i, /lease/i, /rent/i, /hire/i, /tender/i, /eoi/i, /rfp/i, /procur/i,
        /scout/i, /expand/i, /setting up/i, /plan(s|ning)? to (set up|acquire|take)/i, /invites bids/i,
        /expression of interest/i, /looking for/i, /allotment/i, /land acquisition/i
    ];
    const hasAction = actionSignals.some((regex) => regex.test(lower));
    if (!hasAction) {
        return { isRelevant: false, reason: 'General market commentary without explicit occupier or procurement action.' };
    }
    return { isRelevant: true, reason: 'Contains clear warehouse requirement or expansion intent.' };
}
function detectIntent(text) {
    const lower = text.toLowerCase();
    if (/\b(tender|nit\b|eoi|expression of interest|notice inviting tender|bidding|bidder|gem portal|eprocure|cppp)\b/i.test(lower)) {
        return 'tender';
    }
    if (/\b(rfp|request for proposal|inviting proposals|commercial bid)\b/i.test(lower)) {
        return 'rfp';
    }
    if (/\b(scouting|searching for|hunting for|looking to lease|seeking warehouse space|space requirement)\b/i.test(lower)) {
        return 'scouting';
    }
    if (/\b(expansion|expand|new distribution centre|new fulfillment center|scaling operations|additional capacity)\b/i.test(lower)) {
        return 'expansion';
    }
    if (/\b(logistics land|industrial land|plot required|bts|built to suit|land acquisition)\b/i.test(lower)) {
        return 'land';
    }
    return 'watch';
}
function detectRequirementType(text) {
    const lower = text.toLowerCase();
    if (/\b(built[- ]to[- ]suit|bts|construction[- ]cum[- ]lease)\b/i.test(lower))
        return 'build_to_suit';
    if (/\b(hiring of godown|hiring warehouse|godown on hire)\b/i.test(lower))
        return 'hire';
    if (/\b(lease|on lease|leasing|rent|rental)\b/i.test(lower))
        return 'lease';
    if (/\b(buy|purchase|outright purchase|land allotment)\b/i.test(lower))
        return 'buy';
    if (/\b(land requirement|industrial plot)\b/i.test(lower))
        return 'land';
    return 'lease';
}
function extractSize(text, evidence) {
    const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lacs|lakhs)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i);
    if (lakhMatch) {
        const val = parseFloat(lakhMatch[1]);
        const normalized = Math.round(val * 100000);
        evidence.push({ field: 'size', quote: lakhMatch[0] });
        return { value: val, unit: 'lakh_sqft', normalizedSqft: normalized };
    }
    const sqftMatch = text.match(/(\d{1,3}(?:,\d{3})+|\d{3,7})\s*(?:sq\.?\s*ft|sqft|square\s*feet|sq\.\s*feet)/i);
    if (sqftMatch) {
        const numStr = sqftMatch[1].replace(/,/g, '');
        const val = parseInt(numStr, 10);
        evidence.push({ field: 'size', quote: sqftMatch[0] });
        return { value: val, unit: 'sqft', normalizedSqft: val };
    }
    const acreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:acres?|acre)/i);
    if (acreMatch) {
        const val = parseFloat(acreMatch[1]);
        const normalized = Math.round(val * 43560);
        evidence.push({ field: 'size', quote: acreMatch[0] });
        return { value: val, unit: 'acres', normalizedSqft: normalized };
    }
    const sqmMatch = text.match(/(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:sqm|sq\.?\s*m|square\s*met(?:er|re)s?)/i);
    if (sqmMatch) {
        const numStr = sqmMatch[1].replace(/,/g, '');
        const val = parseInt(numStr, 10);
        const normalized = Math.round(val * 10.7639);
        evidence.push({ field: 'size', quote: sqmMatch[0] });
        return { value: val, unit: 'sqm', normalizedSqft: normalized };
    }
    return { value: null, unit: null, normalizedSqft: null };
}
function extractLocation(text, evidence) {
    const corridorPatterns = [
        { corridor: 'Sanand', city: 'Ahmedabad', state: 'Gujarat', regex: /\b(sanand|sanand industrial estate|bol gidc)\b/i },
        { corridor: 'Changodar', city: 'Ahmedabad', state: 'Gujarat', regex: /\b(changodar|moraiya|matoda|sarkhej[- ]bavla)\b/i },
        { corridor: 'Aslali', city: 'Ahmedabad', state: 'Gujarat', regex: /\b(aslali|bareja|kheda|dholka|barejadi|pirana)\b/i },
        { corridor: 'Chhatral / Kadi', city: 'Gandhinagar', state: 'Gujarat', regex: /\b(chhatral|kadi|kalol|mehsana highway)\b/i },
        { corridor: 'Dahej / Bharuch', city: 'Bharuch', state: 'Gujarat', regex: /\b(dahej|bharuch|ankleshwar|vilayat)\b/i },
        { corridor: 'Hazira / Surat', city: 'Surat', state: 'Gujarat', regex: /\b(hazira|surat|sachin|kadodara|palsana)\b/i },
        { corridor: 'Savli / Halol', city: 'Vadodara', state: 'Gujarat', regex: /\b(savli|halol|manjusar|waghodia|vadodara)\b/i },
        { corridor: 'Bhiwandi', city: 'Mumbai MMR', state: 'Maharashtra', regex: /\b(bhiwandi|thane|mankoli|padgha)\b/i },
        { corridor: 'Chakan / Talegaon', city: 'Pune', state: 'Maharashtra', regex: /\b(chakan|talegaon|shikrapur|ranjangaon)\b/i },
        { corridor: 'Taloja / Panvel', city: 'Navi Mumbai', state: 'Maharashtra', regex: /\b(taloja|panvel|jnpt|uran)\b/i }
    ];
    for (const item of corridorPatterns) {
        const match = text.match(item.regex);
        if (match) {
            evidence.push({ field: 'location', quote: match[0] });
            return {
                state: item.state,
                city: item.city,
                corridor: item.corridor,
                rawText: match[0]
            };
        }
    }
    const cityList = [
        { city: 'Ahmedabad', state: 'Gujarat' },
        { city: 'Surat', state: 'Gujarat' },
        { city: 'Vadodara', state: 'Gujarat' },
        { city: 'Rajkot', state: 'Gujarat' },
        { city: 'Gandhinagar', state: 'Gujarat' },
        { city: 'Mumbai', state: 'Maharashtra' },
        { city: 'Pune', state: 'Maharashtra' },
        { city: 'Delhi', state: 'Delhi NCR' },
        { city: 'Bengaluru', state: 'Karnataka' },
        { city: 'Hyderabad', state: 'Telangana' }
    ];
    for (const c of cityList) {
        const regex = new RegExp(`\\b${c.city}\\b`, 'i');
        const match = text.match(regex);
        if (match) {
            evidence.push({ field: 'location', quote: match[0] });
            return {
                state: c.state,
                city: c.city,
                corridor: c.city,
                rawText: match[0]
            };
        }
    }
    if (/\bGujarat\b/i.test(text)) {
        evidence.push({ field: 'location', quote: 'Gujarat' });
        return { state: 'Gujarat', city: null, corridor: null, rawText: 'Gujarat' };
    }
    return { state: null, city: null, corridor: null, rawText: null };
}
function extractOrganization(title, fullText, evidence) {
    const knownCompanies = [
        'Reliance Retail', 'Reliance', 'Flipkart', 'Amazon', 'Tata Consumer', 'Tata Motors',
        'Mahindra Logistics', 'DP World', 'Delhivery', 'Blinkit', 'Zepto', 'Instamart',
        'Adani Logistics', 'Adani Ports', 'Welspun One', 'Allcargo', 'Blue Dart', 'DHL Supply Chain',
        'Maersk', 'Castrol India', 'Asian Paints', 'Maruti Suzuki', 'Pidilite', 'Zomato', 'Amul',
        'Food Corporation of India', 'FCI', 'Central Warehousing Corporation', 'CWC',
        'Gujarat State Warehousing Corporation', 'GSWC', 'GIDC', 'Gujarat Alkalies',
        'Indian Oil', 'IOCL', 'Bharat Petroleum', 'BPCL', 'HPCL', 'Larsen & Toubro', 'L&T',
        'Sun Pharma', 'Zydus Lifesciences', 'Cadila', 'Torrent Pharma', 'Alkem Labs', 'Intas'
    ];
    for (const org of knownCompanies) {
        const regex = new RegExp(`\\b${org}\\b`, 'i');
        if (regex.test(title)) {
            evidence.push({ field: 'organization', quote: org });
            return org;
        }
        if (regex.test(fullText)) {
            evidence.push({ field: 'organization', quote: org });
            return org;
        }
    }
    const authorityMatch = fullText.match(/([A-Z][A-Za-z0-9&.\s]{3,35}(?:Corporation|Limited|Ltd|Authority|Department|Logistics|Industries|Enterprises|Pvt Ltd))\s+(?:invites|seeks|requires|tenders|plans)/i);
    if (authorityMatch) {
        const org = authorityMatch[1].trim();
        evidence.push({ field: 'organization', quote: org });
        return org;
    }
    return null;
}
function detectIndustry(text) {
    const lower = text.toLowerCase();
    if (/\b(e-commerce|ecommerce|quick commerce|q-commerce|online delivery)\b/i.test(lower))
        return 'E-commerce';
    if (/\b(3pl|logistics service provider|freight forwarder|supply chain|contract logistics)\b/i.test(lower))
        return '3PL & Logistics';
    if (/\b(fmcg|packaged goods|food processing|grain|dairy|beverage|edible oil)\b/i.test(lower))
        return 'FMCG & Food';
    if (/\b(pharma|pharmaceutical|vaccine|healthcare|api manufacturer)\b/i.test(lower))
        return 'Pharmaceuticals';
    if (/\b(auto|automobile|automotive|oem|spare parts|ev\b|electric vehicle)\b/i.test(lower))
        return 'Automotive';
    if (/\b(chemical|speciality chemical|fertilizer|petrochemical|hazardous)\b/i.test(lower))
        return 'Chemicals';
    if (/\b(retail|apparel|electronics|appliances|hardware)\b/i.test(lower))
        return 'Retail & Electronics';
    if (/\b(government|psu|central government|state government|procurement cell)\b/i.test(lower))
        return 'Government & PSU';
    return 'Industrial & Warehousing';
}
function extractSpecialRequirements(text, evidence) {
    const tags = [];
    const specs = [
        { tag: 'cold_storage', regex: /\b(cold\s*storage|temperature\s*controlled|reefer|chilled|frozen)\b/i },
        { tag: 'bonded_warehouse', regex: /\b(bonded|customs\s*bonded|sez\s*warehouse)\b/i },
        { tag: 'grade_a', regex: /\b(grade[- ]a|fm2\s*floor|high\s*ceiling|dock\s*leveler|12\s*meter\s*height)\b/i },
        { tag: 'hazmat', regex: /\b(hazmat|hazardous|chemical\s*storage|fire\s*noc|explosion\s*proof)\b/i },
        { tag: 'crane_facility', regex: /\b(overhead\s*crane|heavy\s*duty\s*floor|gantry)\b/i }
    ];
    for (const spec of specs) {
        const match = text.match(spec.regex);
        if (match) {
            tags.push(spec.tag);
            evidence.push({ field: 'specialRequirements', quote: match[0] });
        }
    }
    return tags;
}
function extractTenderReference(text, evidence) {
    const patterns = [
        /Tender\s*(?:Ref|No|Reference|Notice\s*No)?\.?\s*[:\-]?\s*([A-Za-z0-9\/\-_]{5,35})/i,
        /NIT\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\/\-_]{5,35})/i,
        /Bid\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\/\-_]{5,35})/i,
        /EOI\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\/\-_]{5,35})/i
    ];
    for (const pat of patterns) {
        const match = text.match(pat);
        if (match) {
            evidence.push({ field: 'tenderReference', quote: match[0] });
            return match[1].trim();
        }
    }
    return null;
}
function extractDeadline(text, evidence) {
    const patterns = [
        /(?:last date|closing date|bid submission|submission deadline|due date|by)\s*(?:is|on|before)?\s*[:\-]?\s*(\d{1,2}[-\/\.](?:\d{1,2}|[A-Za-z]{3,9})[-\/\.]\d{2,4})/i,
        /(\d{4}-\d{2}-\d{2})/
    ];
    for (const pat of patterns) {
        const match = text.match(pat);
        if (match) {
            evidence.push({ field: 'deadline', quote: match[0] });
            return match[1].trim();
        }
    }
    return null;
}
function extractLeaseTerm(text) {
    const match = text.match(/(\d+)\s*(?:year|years|yr|yrs|months)\s*(?:lease|contract|period|tenure)/i);
    if (match) {
        const val = parseInt(match[1], 10);
        if (/month/i.test(match[0]))
            return val;
        return val * 12;
    }
    return null;
}
function extractContact(text, orgName, evidence) {
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    const phoneMatch = text.match(/(?:\+91[- ]?)?[6-9]\d{9}/);
    const email = emailMatch ? emailMatch[1] : null;
    const phone = phoneMatch ? phoneMatch[0] : null;
    if (email)
        evidence.push({ field: 'contact.email', quote: email });
    if (phone)
        evidence.push({ field: 'contact.phone', quote: phone });
    return {
        name: null,
        role: null,
        organization: orgName,
        email,
        phone
    };
}
function generateReasoningSummary(data) {
    const org = data.organizationName || 'Unspecified entity';
    const intentMap = {
        tender: 'official public tender for warehouse capacity',
        rfp: 'commercial request for proposal',
        scouting: 'active market requirement scouting',
        expansion: 'facility footprint expansion',
        land: 'logistics land acquisition / BTS requirement',
        watch: 'preliminary industry demand signal'
    };
    const parts = [`Identified ${intentMap[data.intent]} from ${org}.`];
    if (data.size.value && data.size.unit) {
        parts.push(`Requirement size: ${data.size.value.toLocaleString()} ${data.size.unit.replace('_', ' ')} (~${data.size.normalizedSqft?.toLocaleString()} sqft).`);
    }
    if (data.location.corridor || data.location.city) {
        parts.push(`Target location: ${data.location.corridor || data.location.city}${data.location.state ? ', ' + data.location.state : ''}.`);
    }
    if (data.tenderReference) {
        parts.push(`Tender ref: ${data.tenderReference}.`);
    }
    return parts.join(' ');
}
