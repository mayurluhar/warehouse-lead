import axios from 'axios';
import { getLogger } from '../../common/Logger';

const logger = getLogger('webSearch');

/**
 * Web search, behind one interface with several providers.
 *
 * This exists because some sources have no feed and no public API. LinkedIn is
 * the case in point: it publishes no search API for posts, and its own pages
 * sit behind an authentication wall that its terms forbid circumventing. What
 * *is* public is the subset of LinkedIn pages that search engines have indexed,
 * so those are reached the legitimate way — by asking a search provider, with
 * the query restricted to the site.
 *
 * That means this connector can only ever see what the provider has indexed and
 * what LinkedIn chose to make publicly visible. It is a genuinely narrower view
 * than a logged-in human has, and no amount of engineering here changes that.
 *
 * Providers are swappable because none of them is free forever and their free
 * tiers differ: pick whichever suits, set two environment variables, done.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  /** The provider's snippet — usually the only body text available. */
  snippet: string;
  /** ISO date when the provider reports one; most do not. */
  publishedAt: string | null;
}

export type SearchProviderName = 'serper' | 'brave' | 'none';

export interface WebSearchOptions {
  provider?: SearchProviderName;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Thrown when a search is attempted with no provider configured.
 *
 * A distinct type so the caller can report "not configured" as a setup problem
 * rather than as an empty result, which would look like "LinkedIn had nothing".
 */
export class SearchNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchNotConfiguredError';
  }
}

interface SerperResponse {
  organic?: { title?: string; link?: string; snippet?: string; date?: string }[];
}

interface BraveResponse {
  web?: { results?: { title?: string; url?: string; description?: string; age?: string }[] };
}

/** Best-effort parse of a provider's loose date string; null when unusable. */
function toIsoDate(value?: string): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export class WebSearchClient {
  private readonly provider: SearchProviderName;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: WebSearchOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.SEARCH_API_KEY ?? '';
    this.timeoutMs = options.timeoutMs ?? 10000;

    const configured = options.provider ?? (process.env.SEARCH_PROVIDER as SearchProviderName);
    // A provider named without a key is the same as no provider — say so once,
    // at construction, rather than failing per query.
    this.provider = configured && this.apiKey ? configured : 'none';

    if (configured && !this.apiKey) {
      logger.warn('SEARCH_PROVIDER is set but SEARCH_API_KEY is empty; web search is disabled', {
        provider: configured
      });
    }
  }

  public get isConfigured(): boolean {
    return this.provider !== 'none';
  }

  public get providerName(): SearchProviderName {
    return this.provider;
  }

  public async search(query: string, limit = 10): Promise<WebSearchResult[]> {
    if (!this.isConfigured) {
      throw new SearchNotConfiguredError(
        'No web search provider configured. Set SEARCH_PROVIDER (serper or brave) and SEARCH_API_KEY — see .env.example.'
      );
    }

    if (this.provider === 'serper') return this.searchSerper(query, limit);
    return this.searchBrave(query, limit);
  }

  private async searchSerper(query: string, limit: number): Promise<WebSearchResult[]> {
    const { data } = await axios.post<SerperResponse>(
      'https://google.serper.dev/search',
      { q: query, num: limit },
      {
        timeout: this.timeoutMs,
        headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' }
      }
    );

    return (data.organic ?? [])
      .filter((r) => r.link)
      .map((r) => ({
        title: r.title?.trim() || r.link!,
        url: r.link!,
        snippet: r.snippet?.trim() ?? '',
        publishedAt: toIsoDate(r.date)
      }));
  }

  private async searchBrave(query: string, limit: number): Promise<WebSearchResult[]> {
    const { data } = await axios.get<BraveResponse>('https://api.search.brave.com/res/v1/web/search', {
      params: { q: query, count: limit },
      timeout: this.timeoutMs,
      headers: { 'X-Subscription-Token': this.apiKey, Accept: 'application/json' }
    });

    return (data.web?.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        title: r.title?.trim() || r.url!,
        url: r.url!,
        snippet: r.description?.replace(/<[^>]+>/g, '').trim() ?? '',
        publishedAt: toIsoDate(r.age)
      }));
  }
}
