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
   * Note: For true streaming of massive files, we'd use a SAX-like approach.
   * fast-xml-parser's parse() is fast but loads the whole string.
   * Given the 50k URL requirement, we'll use a more memory-efficient approach if needed,
   * but let's start with a clean AsyncGenerator interface.
   */
  async *parse(sitemapUrl: string): AsyncGenerator<SitemapUrl> {
    try {
      const response = await fetch(sitemapUrl);
      const xmlData = await response.text();
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
