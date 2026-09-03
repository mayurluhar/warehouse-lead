import {
  ContactInfo,
  EvidenceQuote,
  ExtractedLead,
  Intent,
  LocationInfo,
  RequirementType,
  SizeInfo
} from "../../domains/lead/entities/Lead";
import { ILeadExtractor } from "../../domains/lead/ports/ILeadExtractor";

/**
 * Rule-based NLP extraction.
 *
 * Serves two purposes: it is the fallback when Bedrock is unavailable or
 * errors, and it makes the whole pipeline runnable with no AWS access at all,
 * which is what lets the local dev server work offline.
 *
 * It satisfies the same ILeadExtractor Port as the Bedrock adapter, so callers
 * cannot tell which one produced a result apart from the recorded modelUsed.
 */
export class HeuristicLeadExtractor implements ILeadExtractor {
  public readonly extractorName = "nlp-heuristic-fallback";

  /** Model-independent, so any modelId option is ignored. */
  public async extract(title: string, text: string): Promise<ExtractedLead> {
    return {
      ...extractWithHeuristics(title, text),
      modelUsed: this.extractorName
    };
  }
}

export function extractWithHeuristics(title: string, text: string): ExtractedLead {
  const combined = `${title}\n${text}`;
  const evidence: EvidenceQuote[] = [];

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
      location: { state: null, city: null, corridor: null, rawText: null, latitude: null, longitude: null },
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

function classifyRelevance(text: string): { isRelevant: boolean; reason: string } {
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

function detectIntent(text: string): Intent {
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

function detectRequirementType(text: string): RequirementType {
  const lower = text.toLowerCase();
  if (/\b(built[- ]to[- ]suit|bts|construction[- ]cum[- ]lease)\b/i.test(lower)) return 'build_to_suit';
  if (/\b(hiring of godown|hiring warehouse|godown on hire)\b/i.test(lower)) return 'hire';
  if (/\b(lease|on lease|leasing|rent|rental)\b/i.test(lower)) return 'lease';
  if (/\b(buy|purchase|outright purchase|land allotment)\b/i.test(lower)) return 'buy';
  if (/\b(land requirement|industrial plot)\b/i.test(lower)) return 'land';
  return 'lease';
}

function extractSize(text: string, evidence: EvidenceQuote[]): SizeInfo {
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

/**
 * Names a location by reading the text, not by matching a built-in place list.
 *
 * The earlier version compared against a hardcoded table of corridors and
 * cities, which meant it could only ever recognise places somebody had already
 * typed into the repository — a document about a town nobody listed produced no
 * location at all. This version pulls candidate place phrases out of the prose
 * and leaves verification to the gazetteer, which geocodes them live. A phrase
 * that is not a real place simply fails to geocode and the lead ends up with no
 * coordinates, exactly as an unrecognised name did before.
 *
 * Two cues are read, most specific first:
 *   - An industrial-estate phrase ("Sanand GIDC", "Oragadam Industrial Area"),
 *     which names a warehousing cluster and is the best possible search term.
 *   - A locative preposition ("in Bhiwandi", "near Chakan"), which usually
 *     names the town.
 *
 * Coordinates are attached later by the ingestion pipeline via IGazetteer;
 * this function only names the place.
 */

/**
 * Words that begin a capitalised phrase without naming a place. Without this,
 * "expansion in September" and "space in Grade A facilities" both read as
 * towns. Kept deliberately short: the geocoder is the real filter, and a
 * false candidate costs one failed lookup, not a wrong answer.
 */
const NON_PLACE_WORDS = new Set([
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'grade', 'phase', 'the', 'this', 'that', 'these', 'those', 'a', 'an',
  'india', 'indian', 'north', 'south', 'east', 'west', 'central',
  'q1', 'q2', 'q3', 'q4', 'fy', 'rs', 'inr', 'usd', 'crore', 'lakh',
  'company', 'firm', 'group', 'limited', 'ltd', 'pvt', 'private', 'corporation',
  'warehouse', 'warehousing', 'godown', 'logistics', 'storage', 'facility',
  'lease', 'tender', 'rfp', 'eoi', 'bid', 'space', 'sq', 'sqft', 'acres',
  'new', 'mega', 'large', 'modern', 'first', 'second', 'third', 'its', 'their'
]);

/** A capitalised word run: "Sanand", "Navi Mumbai", "Sriperumbudur Oragadam". */
const PROPER_NOUN = '([A-Z][a-zA-Z]+(?:[ -][A-Z][a-zA-Z]+){0,2})';

/**
 * Industrial-cluster naming, which pins a lead far better than a town does.
 *
 * Captures exactly one word before the keyword, not a multi-word run. The
 * keyword list has to be case-insensitive ("Industrial Estate" and "industrial
 * estate" both occur), and that same insensitivity makes a greedy capture
 * swallow ordinary prose: "a plant at Chakan MIDC" yielded "plant at Chakan".
 * An estate is named by the word immediately in front of it, so taking only
 * that word removes the ambiguity instead of trying to filter it afterwards.
 */
const CLUSTER_PATTERN = new RegExp(
  `([A-Z][a-zA-Z]+)\\s+(?:GIDC|MIDC|SEZ|PCPIR|Industrial\\s+(?:Estate|Area|Park|Corridor|Cluster)|Logistics\\s+(?:Park|Hub)|Industrial\\s+Belt)`,
  'i'
);

/** "in Bhiwandi", "near Chakan", "located at Dahej". */
const LOCATIVE_PATTERN = new RegExp(
  `\\b(?:in|at|near|around|across|located\\s+(?:in|at)|based\\s+(?:in|at)|outskirts\\s+of)\\s+${PROPER_NOUN}`,
  'g'
);

/**
 * Filler that can precede a place name inside a captured phrase.
 *
 * The capture is greedy by necessity — "Navi Mumbai" and "Sriperumbudur
 * Oragadam" are both real, so the pattern must allow several words — and that
 * greed also swallows whatever came before. "a facility at Sanand GIDC"
 * captures "facility at Sanand", which is not a place but *contains* one.
 */
const LEADING_FILLER = new Set([
  'at', 'in', 'near', 'on', 'of', 'for', 'to', 'from', 'with', 'by', 'and', 'or'
]);

/**
 * Strips leading filler off a captured phrase and returns the place inside it,
 * or null when nothing plausible survives.
 *
 * Trimming rather than rejecting matters: rejecting the whole match threw away
 * a correct place name because of the word in front of it, which sent "Sanand
 * GIDC" — an industrial estate, the single most useful kind of match — down to
 * the weaker locative branch and out as a city.
 */
function trimToPlace(candidate: string): string | null {
  const tokens = candidate.split(/[\s-]+/).filter(Boolean);

  while (tokens.length > 0) {
    const first = tokens[0].toLowerCase();
    if (!LEADING_FILLER.has(first) && !NON_PLACE_WORDS.has(first)) break;
    tokens.shift();
  }

  const place = tokens.join(' ');
  return place.length >= 3 ? place : null;
}

function extractLocation(text: string, evidence: EvidenceQuote[]): LocationInfo {
  const empty: LocationInfo = {
    state: null, city: null, corridor: null, rawText: null, latitude: null, longitude: null
  };

  const cluster = text.match(CLUSTER_PATTERN);
  const clusterPlace = cluster ? trimToPlace(cluster[1]) : null;
  if (cluster && clusterPlace) {
    evidence.push({ field: 'location', quote: cluster[0] });
    // Keep the estate suffix on the corridor name: "Sanand GIDC" geocodes to
    // the industrial estate, whereas "Sanand" lands on the town centre.
    const suffix = cluster[0].slice(cluster[0].indexOf(cluster[1]) + cluster[1].length).trim();
    return { ...empty, corridor: `${clusterPlace} ${suffix}`.trim(), rawText: cluster[0] };
  }

  // Locatives are scanned in order and the first plausible one wins; an
  // article's opening sentence names where the action is far more reliably
  // than a passing mention further down.
  for (const match of text.matchAll(LOCATIVE_PATTERN)) {
    const candidate = trimToPlace(match[1]);
    if (!candidate) continue;

    evidence.push({ field: 'location', quote: match[0] });
    return { ...empty, city: candidate, rawText: candidate };
  }

  return empty;
}

function extractOrganization(title: string, fullText: string, evidence: EvidenceQuote[]): string | null {
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

function detectIndustry(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(e-commerce|ecommerce|quick commerce|q-commerce|online delivery)\b/i.test(lower)) return 'E-commerce';
  if (/\b(3pl|logistics service provider|freight forwarder|supply chain|contract logistics)\b/i.test(lower)) return '3PL & Logistics';
  if (/\b(fmcg|packaged goods|food processing|grain|dairy|beverage|edible oil)\b/i.test(lower)) return 'FMCG & Food';
  if (/\b(pharma|pharmaceutical|vaccine|healthcare|api manufacturer)\b/i.test(lower)) return 'Pharmaceuticals';
  if (/\b(auto|automobile|automotive|oem|spare parts|ev\b|electric vehicle)\b/i.test(lower)) return 'Automotive';
  if (/\b(chemical|speciality chemical|fertilizer|petrochemical|hazardous)\b/i.test(lower)) return 'Chemicals';
  if (/\b(retail|apparel|electronics|appliances|hardware)\b/i.test(lower)) return 'Retail & Electronics';
  if (/\b(government|psu|central government|state government|procurement cell)\b/i.test(lower)) return 'Government & PSU';
  return 'Industrial & Warehousing';
}

function extractSpecialRequirements(text: string, evidence: EvidenceQuote[]): string[] {
  const tags: string[] = [];
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

function extractTenderReference(text: string, evidence: EvidenceQuote[]): string | null {
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

function extractDeadline(text: string, evidence: EvidenceQuote[]): string | null {
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

function extractLeaseTerm(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:year|years|yr|yrs|months)\s*(?:lease|contract|period|tenure)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (/month/i.test(match[0])) return val;
    return val * 12;
  }
  return null;
}

function extractContact(text: string, orgName: string | null, evidence: EvidenceQuote[]): {
  name: string | null;
  role: string | null;
  organization: string | null;
  email?: string | null;
  phone?: string | null;
} {
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const phoneMatch = text.match(/(?:\+91[- ]?)?[6-9]\d{9}/);

  const email = emailMatch ? emailMatch[1] : null;
  const phone = phoneMatch ? phoneMatch[0] : null;

  if (email) evidence.push({ field: 'contact.email', quote: email });
  if (phone) evidence.push({ field: 'contact.phone', quote: phone });

  return {
    name: null,
    role: null,
    organization: orgName,
    email,
    phone
  };
}

function generateReasoningSummary(data: {
  organizationName: string | null;
  intent: Intent;
  size: SizeInfo;
  location: LocationInfo;
  tenderReference: string | null;
}): string {
  const org = data.organizationName || 'Unspecified entity';
  const intentMap: Record<Intent, string> = {
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
