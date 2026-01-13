import { fetch } from 'undici';
import { Readable } from 'node:stream';
import { StreamingXmlParser } from './xml-parser';

export interface DiscoveredSitemap {
  url: string;
  xmlData: string;
}

export class DiscoveryService {
  private readonly xmlParser: StreamingXmlParser;
  private readonly visited = new Set<string>();
  private readonly STANDARD_PATHS = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/sitemap.php',
    '/sitemap.xml.gz'
  ];

  constructor() {
    this.xmlParser = new StreamingXmlParser();
  }

  /**
   * Attempts to find sitemaps for a given base website URL.
   */
  async findSitemaps(baseUrl: string): Promise<string[]> {
    const sitemaps = new Set<string>();
    const url = new URL(baseUrl);
    const origin = url.origin;

    // 1. Try robots.txt
    try {
      const robotsUrl = `${origin}/robots.txt`;
      const response = await fetch(robotsUrl);
      if (response.status === 200) {
        const text = await response.text();
        const matches = text.matchAll(/^Sitemap:\s*(.+)$/gim);
        for (const match of matches) {
          if (match[1]) sitemaps.add(match[1].trim());
        }
      }
    } catch (e) {
      // Ignore robots.txt errors
    }

    // 2. Try standard paths if none found in robots.txt
    if (sitemaps.size === 0) {
      for (const path of this.STANDARD_PATHS) {
        try {
          const sitemapUrl = `${origin}${path}`;
          const response = await fetch(sitemapUrl, { method: 'HEAD' });
          if (response.status === 200) {
            sitemaps.add(sitemapUrl);
          }
        } catch (e) {
          // Ignore path errors
        }
      }
    }

    return Array.from(sitemaps);
  }

  /**
   * Recursively discovers all leaf sitemaps from a root URL.
   * Returns both the sitemap URL and its XML data to avoid duplicate fetches.
   */
  async *discover(rootUrl: string): AsyncGenerator<DiscoveredSitemap> {
    const queue: string[] = [rootUrl];

    while (queue.length > 0) {
      const currentUrl = queue.shift()!;
      if (this.visited.has(currentUrl)) continue;
      this.visited.add(currentUrl);

      try {
        const response = await fetch(currentUrl);
        if (response.status !== 200) continue;
        
        let isIndex = false;
        let isLeaf = false;
        const childSitemaps: string[] = [];
        
        let xmlData: string | undefined;
        let source: any;

        if (response.body) {
          // Convert Web Stream to Node Stream
          const nodeStream = Readable.fromWeb(response.body as any);
          source = nodeStream;
        } else {
          // Fallback for environments/mocks where body is not available
          xmlData = await response.text();
          source = xmlData;
        }

        // Process entries as they're yielded from the parser
        for await (const entry of this.xmlParser.parse(source)) {
          if (entry.type === 'sitemap') {
            isIndex = true;
            childSitemaps.push(entry.loc);
          } else if (entry.type === 'url') {
            isLeaf = true;
          }
        }

        if (isIndex) {
          for (const loc of childSitemaps) {
            queue.push(loc);
          }
        }
        
        // Get xmlData for downstream consumers (parser caches it for us)
        if (!xmlData) {
          xmlData = this.xmlParser.getLastParsedXml() || '';
        }
        
        // If it's a leaf, or if it's neither (but has urlset), yield it.
        if (isLeaf || (!isIndex && xmlData.includes('<urlset'))) {
          yield { 
            url: currentUrl, 
            xmlData,
          };
        }
      } catch (error) {
        console.error(`Failed to fetch or parse sitemap at ${currentUrl}:`, error);
      }
    }
  }
}

