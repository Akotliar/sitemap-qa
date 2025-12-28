import { XMLParser } from 'fast-xml-parser';
import { fetch } from 'undici';
import { SitemapUrl } from '../types/sitemap';

export class SitemapParser {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
  }

  /**
   * Parses a leaf sitemap and yields SitemapUrl objects.
   * Can accept either a URL to fetch or pre-fetched XML data with the source URL.
   * Note: For true streaming of massive files, we'd use a SAX-like approach.
   * fast-xml-parser's parse() is fast but loads the whole string.
   * Given the 50k URL requirement, we'll use a more memory-efficient approach if needed,
   * but let's start with a clean AsyncGenerator interface.
   */
  async *parse(sitemapUrlOrData: string | { url: string; xmlData: string }): AsyncGenerator<SitemapUrl> {
    let sitemapUrl: string = typeof sitemapUrlOrData === 'string' ? sitemapUrlOrData : sitemapUrlOrData.url;
    try {
      let xmlData: string;

      if (typeof sitemapUrlOrData === 'string') {
        // Legacy behavior: fetch the sitemap
        const response = await fetch(sitemapUrl);
        xmlData = await response.text();
      } else {
        // New behavior: use pre-fetched data
        xmlData = sitemapUrlOrData.xmlData;
      }

      const jsonObj = this.parser.parse(xmlData);

      if (jsonObj.urlset && jsonObj.urlset.url) {
        const urls = Array.isArray(jsonObj.urlset.url)
          ? jsonObj.urlset.url
          : [jsonObj.urlset.url];

        for (const url of urls) {
          if (url.loc) {
            yield {
              loc: url.loc,
              source: sitemapUrl,
              lastmod: url.lastmod,
              changefreq: url.changefreq,
              priority: url.priority,
              risks: [],
            };
          }
        }
      }
    } catch (error) {
      console.error(`Failed to parse sitemap at ${sitemapUrl}:`, error);
    }
  }
}
