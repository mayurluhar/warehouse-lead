import { computeContentHash } from '@warehouse-lead/core';
export const BENCHMARK_SIGNALS = [
    {
        title: 'Food Corporation of India (FCI) Invites Bids for Hiring 150,000 Sq Ft Godown Space in Ahmedabad Aslali',
        sourceUrl: 'https://eprocure.gov.in/eprocure/app?page=FrontEndTenderDetails&service=page&tnid=FCI/GUJ/2026/044',
        canonicalUrl: 'https://eprocure.gov.in/eprocure/app?tnid=FCI/GUJ/2026/044',
        publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        rawText: `Food Corporation of India (Regional Office, Gujarat) invites online tenders under two-bid system from godown owners, warehouse developers and warehouse logistics companies for hiring of 150,000 sq ft covered godown / warehouse space with plinth height minimum 4 feet, equipped with truck weighbridge and 24x7 security access. Preferred location: Aslali - Kheda Highway corridor, Ahmedabad. Tender Ref: FCI/GUJ/ENG/2026/044. Last date for online bid submission is 15-Sep-2026. For queries contact procurement cell at fci-procure-guj@fci.gov.in or call 079-26584910. Minimum lease term 3 years.`,
        cleanText: `Food Corporation of India (Regional Office, Gujarat) invites online tenders under two-bid system from godown owners, warehouse developers and warehouse logistics companies for hiring of 150,000 sq ft covered godown / warehouse space with plinth height minimum 4 feet, equipped with truck weighbridge and 24x7 security access. Preferred location: Aslali - Kheda Highway corridor, Ahmedabad. Tender Ref: FCI/GUJ/ENG/2026/044. Last date for online bid submission is 15-Sep-2026. For queries contact procurement cell at fci-procure-guj@fci.gov.in or call 079-26584910. Minimum lease term 3 years.`,
        sourceType: 'tender_portal',
        trustTier: 'official'
    },
    {
        title: 'Blinkit scouts 2.5 lakh sq ft mega dark store and distribution hub in Sanand Industrial Corridor',
        sourceUrl: 'https://economictimes.indiatimes.com/industry/services/retail/blinkit-scouts-large-distribution-hub-sanand-gujarat/articleshow/109283741.cms',
        canonicalUrl: 'https://economictimes.indiatimes.com/industry/services/retail/blinkit-scouts-large-distribution-hub-sanand-gujarat/articleshow/109283741.cms',
        publishedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        rawText: `Quick commerce giant Blinkit is actively scouting for 2.5 lakh sq ft of Grade-A warehouse space in the Sanand industrial corridor near Ahmedabad to cater to explosive demand across Gujarat. According to sources familiar with the development, the company requires 12-meter clear height, dock levelers for 20 trucks simultaneously, and FM2 flooring. The company plans to take the facility on a 5-year lease starting Q4 2026. Commercial proposals can be submitted to leasing@blinkit.com.`,
        cleanText: `Quick commerce giant Blinkit is actively scouting for 2.5 lakh sq ft of Grade-A warehouse space in the Sanand industrial corridor near Ahmedabad to cater to explosive demand across Gujarat. According to sources familiar with the development, the company requires 12-meter clear height, dock levelers for 20 trucks simultaneously, and FM2 flooring. The company plans to take the facility on a 5-year lease starting Q4 2026. Commercial proposals can be submitted to leasing@blinkit.com.`,
        sourceType: 'google_news',
        trustTier: 'reputable_media'
    },
    {
        title: 'Sun Pharma Seeks 50,000 Sq Ft Temperature Controlled Cold Storage Facility in Changodar GIDC',
        sourceUrl: 'https://pharma-biz-weekly.in/news/sun-pharma-expands-cold-chain-logistics-changodar',
        canonicalUrl: 'https://pharma-biz-weekly.in/news/sun-pharma-expands-cold-chain-logistics-changodar',
        publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        rawText: `Leading pharmaceutical manufacturer Sun Pharma has issued a request for proposal (RFP) for leasing 50,000 sq ft temperature controlled cold storage (2°C to 8°C and 15°C to 25°C zones) warehouse facility in Changodar industrial cluster, Ahmedabad. The facility must comply with WHO-GMP logistics guidelines with 100% power backup. Bid Submission due date: 2026-09-28. Inquiries: supplychain.guj@sunpharma.com.`,
        cleanText: `Leading pharmaceutical manufacturer Sun Pharma has issued a request for proposal (RFP) for leasing 50,000 sq ft temperature controlled cold storage (2°C to 8°C and 15°C to 25°C zones) warehouse facility in Changodar industrial cluster, Ahmedabad. The facility must comply with WHO-GMP logistics guidelines with 100% power backup. Bid Submission due date: 2026-09-28. Inquiries: supplychain.guj@sunpharma.com.`,
        sourceType: 'trade_newsletter',
        trustTier: 'reputable_media'
    },
    {
        title: 'GIDC Announces Allotment & Tender for 25 Acres Built-to-Suit Logistics Park at Dahej PCPIR',
        sourceUrl: 'https://gidc.gujarat.gov.in/tenders/bts-logistics-dahej-2026',
        canonicalUrl: 'https://gidc.gujarat.gov.in/tenders/bts-logistics-dahej-2026',
        publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        rawText: `Gujarat Industrial Development Corporation (GIDC) invites Expression of Interest (EOI) from logistics developers and industrial park operators for developing 25 acres built-to-suit hazardous and chemical storage park at Dahej PCPIR, Bharuch district. Tender Reference No: GIDC/DAHEJ/LOG/2026/102. Applications open until 2026-10-15. Dedicated chemical effluent discharge and fire NOC compliance mandatory. Contact: support@gidc.gov.in.`,
        cleanText: `Gujarat Industrial Development Corporation (GIDC) invites Expression of Interest (EOI) from logistics developers and industrial park operators for developing 25 acres built-to-suit hazardous and chemical storage park at Dahej PCPIR, Bharuch district. Tender Reference No: GIDC/DAHEJ/LOG/2026/102. Applications open until 2026-10-15. Dedicated chemical effluent discharge and fire NOC compliance mandatory. Contact: support@gidc.gov.in.`,
        sourceType: 'tender_portal',
        trustTier: 'official'
    },
    {
        title: 'Mahindra Logistics expands 3PL multi-client facility footprint by 1.8 lakh sqft in Bhiwandi',
        sourceUrl: 'https://logistics-insider.in/mahindra-logistics-bhiwandi-expansion-2026',
        canonicalUrl: 'https://logistics-insider.in/mahindra-logistics-bhiwandi-expansion-2026',
        publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
        rawText: `Mahindra Logistics has announced plans to expand its multi-client warehousing capacity in Bhiwandi by leasing an additional 1.8 lakh sq ft Grade-A facility. The new facility will cater to automotive spare parts and consumer electronics clients. Operations are scheduled to commence in late 2026.`,
        cleanText: `Mahindra Logistics has announced plans to expand its multi-client warehousing capacity in Bhiwandi by leasing an additional 1.8 lakh sq ft Grade-A facility. The new facility will cater to automotive spare parts and consumer electronics clients. Operations are scheduled to commence in late 2026.`,
        sourceType: 'rss_feed',
        trustTier: 'reputable_media'
    },
    {
        title: 'Stock Market Weekly: Indian real estate sector sees steady institutional capital inflow',
        sourceUrl: 'https://markets.moneycontrol.com/news/realty-stocks-weekly-analysis',
        canonicalUrl: 'https://markets.moneycontrol.com/news/realty-stocks-weekly-analysis',
        publishedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        rawText: `Shares of major residential real estate developers traded higher on Friday. Brokerages maintain positive outlook on 2BHK and 3BHK residential sales across metropolitan cities. The Nifty Realty index gained 1.4% during the week.`,
        cleanText: `Shares of major residential real estate developers traded higher on Friday. Brokerages maintain positive outlook on 2BHK and 3BHK residential sales across metropolitan cities. The Nifty Realty index gained 1.4% during the week.`,
        sourceType: 'google_news',
        trustTier: 'reputable_media'
    }
];
export function getSampleDocuments() {
    return BENCHMARK_SIGNALS.map((s, idx) => {
        const contentHash = computeContentHash(`${s.title}\n${s.cleanText}`);
        return {
            ...s,
            id: `sample_${idx + 1}_${Date.now()}`,
            contentHash,
            fetchedAt: new Date().toISOString()
        };
    });
}
