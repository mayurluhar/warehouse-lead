import { TrustTier } from '../../domains/lead/entities/SourceDocument';

/**
 * The publication feeds a scan reads.
 *
 * These are source *addresses*, not data — nothing here is a fabricated lead,
 * place or coordinate. Every article, headline and date still comes off the wire
 * at scan time. Keeping the list in code means a fresh clone scans successfully
 * with no setup, and adding a publication is a reviewable diff rather than an
 * invisible change to a deployment variable.
 *
 * PUBLICATION_FEEDS still overrides this list when set, so a deployment can swap
 * the whole set without a build. See .env.example for that format.
 *
 * Trust tier feeds directly into scoring, so it is a judgement about the
 * publisher, not a label: `official` is a government or issuing body, and no
 * general news outlet qualifies for it.
 */
export interface PublicationFeed {
  name: string;
  url: string;
  trustTier: TrustTier;
}

export const DEFAULT_PUBLICATION_FEEDS: PublicationFeed[] = [
  // --- Economic Times network ---
  { name: 'ET Industry', url: 'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms', trustTier: 'reputable_media' },
  { name: 'ET Realty', url: 'https://realty.economictimes.indiatimes.com/rss/topstories', trustTier: 'reputable_media' },
  { name: 'ET Realty Industry', url: 'https://realty.economictimes.indiatimes.com/rss/industry', trustTier: 'reputable_media' },
  { name: 'ET Infra', url: 'https://infra.economictimes.indiatimes.com/rss/topstories', trustTier: 'reputable_media' },
  { name: 'ET Retail', url: 'https://retail.economictimes.indiatimes.com/rss/topstories', trustTier: 'reputable_media' },
  { name: 'ET Retail E-commerce', url: 'https://retail.economictimes.indiatimes.com/rss/e-commerce', trustTier: 'reputable_media' },
  { name: 'ET Transportation', url: 'https://economictimes.indiatimes.com/industry/transportation/rssfeeds/13358350.cms', trustTier: 'reputable_media' },
  { name: 'ET Warehouse', url: 'https://retail.economictimes.indiatimes.com/tag/warehousing', trustTier: 'reputable_media'},

  // --- Business Standard ---
  { name: 'Business Standard Companies', url: 'https://www.business-standard.com/rss/companies-101.rss', trustTier: 'reputable_media' },
  { name: 'Business Standard Industry', url: 'https://www.business-standard.com/rss/industry-217.rss', trustTier: 'reputable_media' },
  { name: 'Business Standard Economy', url: 'https://www.business-standard.com/rss/economy-102.rss', trustTier: 'reputable_media' },

  // --- Mint ---
  { name: 'Mint Companies', url: 'https://www.livemint.com/rss/companies', trustTier: 'reputable_media' },
  { name: 'Mint Industry', url: 'https://www.livemint.com/rss/industry', trustTier: 'reputable_media' },
  { name: 'Mint Economy', url: 'https://www.livemint.com/rss/economy', trustTier: 'reputable_media' },

  // --- Moneycontrol ---
  { name: 'Moneycontrol Business', url: 'https://www.moneycontrol.com/rss/business.xml', trustTier: 'reputable_media' },

  // --- The Hindu group ---
  { name: 'BusinessLine Logistics', url: 'https://www.thehindubusinessline.com/economy/logistics/feeder/default.rss', trustTier: 'reputable_media' },
  { name: 'BusinessLine Companies', url: 'https://www.thehindubusinessline.com/companies/feeder/default.rss', trustTier: 'reputable_media' },
  { name: 'BusinessLine Economy', url: 'https://www.thehindubusinessline.com/economy/feeder/default.rss', trustTier: 'reputable_media' },
  { name: 'The Hindu Industry', url: 'https://www.thehindu.com/business/Industry/feeder/default.rss', trustTier: 'reputable_media' },

  // --- General business press ---
  { name: 'Indian Express Business', url: 'https://indianexpress.com/section/business/feed/', trustTier: 'reputable_media' },

  // --- Logistics trade press: highest hit rate per item fetched ---
  { name: 'Logistics Insider', url: 'https://www.logisticsinsider.in/feed/', trustTier: 'reputable_media' },
  { name: 'Cargo Talk', url: 'https://www.cargotalk.in/feed', trustTier: 'reputable_media' },
  { name: 'India Shipping News', url: 'https://www.indiashippingnews.com/feed/', trustTier: 'reputable_media' },

  {name: 'Moneycontrol warehousing news', url: 'https://www.moneycontrol.com/news/tags/warehousing.html', trustTier: 'reputable_media'}
];
