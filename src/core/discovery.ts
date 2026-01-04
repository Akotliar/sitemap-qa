import { fetch } from 'undici';
import { XMLParser } from 'fast-xml-parser';

export interface DiscoveredSitemap {
  url: string;
  xmlData: string;
}

export class DiscoveryService {
  private readonly parser: XMLParser;
  private readonly visited = new Set<string>();
  private readonly STANDARD_PATHS = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/sitemap.php',
    '/sitemap.xml.gz'
  ];

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
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
        
        // We need to peek at the XML to see if it's an index or a leaf.
        // If it's a leaf, we want to pass the stream to the parser.
        // If it's an index, we need to parse it here to find more sitemaps.
        const xmlData = await response.text();
        const jsonObj = this.parser.parse(xmlData);

        if (jsonObj.sitemapindex) {
          const sitemaps = Array.isArray(jsonObj.sitemapindex.sitemap)
            ? jsonObj.sitemapindex.sitemap
            : [jsonObj.sitemapindex.sitemap];

          for (const sitemap of sitemaps) {
            if (sitemap?.loc) {
              queue.push(sitemap.loc);
            }
          }
        } else if (jsonObj.urlset) {
          // This is a leaf sitemap - yield the XML data
          // Note: Since we already called response.text(), we can't use the stream anymore.
          // For true streaming, we'd need to clone the stream or use a streaming XML parser here too.
          yield { url: currentUrl, xmlData };
        }
      } catch (error) {
        console.error(`Failed to fetch or parse sitemap at ${currentUrl}:`, error);
      }
    }
  }
}
