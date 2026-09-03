import axios from 'axios';
import Parser from 'rss-parser';

/**
 * Thrown when a provider serves an anti-bot interstitial instead of a feed.
 *
 * Distinguished from an ordinary failure because it means "you are being rate
 * limited", not "this feed is broken". Without it the response is HTML, the XML
 * parser throws a confusing syntax error, and the scan reports zero results as
 * though the feed were simply empty — which is how a blocked source stays
 * invisible for weeks.
 */
export class FeedBlockedError extends Error {
  constructor(url: string) {
    super(`Feed provider is rate-limiting automated requests: ${url}`);
    this.name = 'FeedBlockedError';
  }
}

const BLOCK_MARKERS = [
  'your computer or network may be sending automated queries',
  'unusual traffic from your computer network',
  'detected unusual traffic',
  'captcha'
];

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const parser = new Parser();

/**
 * Fetches and parses one RSS feed.
 *
 * Deliberately fetches with axios rather than letting rss-parser do it, so the
 * raw body can be inspected before parsing: an interstitial is valid HTML and
 * invalid XML, and telling those two failures apart is the whole point.
 */
export async function fetchFeed(url: string, timeoutMs = 8000): Promise<Parser.Output<Record<string, unknown>>> {
  const response = await axios.get<string>(url, {
    timeout: timeoutMs,
    responseType: 'text',
    // Handle the status ourselves so a 429/503 can be reported precisely.
    validateStatus: () => true,
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/rss+xml, application/xml, text/xml, */*'
    }
  });

  const body = typeof response.data === 'string' ? response.data : String(response.data);
  const sample = body.slice(0, 2000).toLowerCase();

  if (BLOCK_MARKERS.some((marker) => sample.includes(marker))) {
    throw new FeedBlockedError(url);
  }

  // 429/503 accompanied by HTML is the usual shape of a soft block.
  if (response.status === 429 || response.status === 503) {
    throw new FeedBlockedError(url);
  }

  if (response.status >= 400) {
    throw new Error(`Feed returned HTTP ${response.status}: ${url}`);
  }

  if (sample.trimStart().startsWith('<html')) {
    throw new Error(`Feed returned HTML instead of XML: ${url}`);
  }

  return parser.parseString(body);
}
