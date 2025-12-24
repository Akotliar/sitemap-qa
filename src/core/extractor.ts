import { DiscoveryService } from './discovery';
import { SitemapParser } from './parser';
import { SitemapUrl } from '../types/sitemap';

export class ExtractorService {
  private readonly discovery: DiscoveryService;
  private readonly parser: SitemapParser;
  private readonly seenUrls = new Set<string>();

  constructor() {
    this.discovery = new DiscoveryService();
    this.parser = new SitemapParser();
  }

  /**
   * Normalizes a URL by removing trailing slashes and converting to lowercase.
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      let normalized = parsed.origin + parsed.pathname.replace(/\/$/, '');
      if (parsed.search) normalized += parsed.search;
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  /**
   * Extracts all unique URLs from a root sitemap URL or website base URL.
   */
  async *extract(inputUrl: string): AsyncGenerator<SitemapUrl> {
    let startUrls = [inputUrl];

    // If the URL doesn't end in .xml or .gz, it might be a website root
    if (!inputUrl.endsWith('.xml') && !inputUrl.endsWith('.gz')) {
      const discovered = await this.discovery.findSitemaps(inputUrl);
      if (discovered.length > 0) {
        console.log(`✅ Discovered ${discovered.length} sitemap(s): ${discovered.join(', ')}`);
        startUrls = discovered;
      } else {
        console.log(`⚠️ No sitemaps discovered via robots.txt or standard paths. Proceeding with input URL.`);
      }
    }

    for (const startUrl of startUrls) {
      for await (const sitemapUrl of this.discovery.discover(startUrl)) {
        for await (const urlObj of this.parser.parse(sitemapUrl)) {
          const normalized = this.normalizeUrl(urlObj.loc);
          if (!this.seenUrls.has(normalized)) {
            this.seenUrls.add(normalized);
            yield urlObj;
          }
        }
      }
    }
  }
}
