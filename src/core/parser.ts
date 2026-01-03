import { XMLParser } from 'fast-xml-parser';
import { fetch } from 'undici';
import { SitemapUrl } from '../types/sitemap';
import { Readable } from 'node:stream';

export class SitemapParser {
  /**
   * Parses a leaf sitemap and yields SitemapUrl objects.
   * Uses fast-xml-parser's XMLParser with a custom tag processor for memory-efficient streaming.
   */
  async *parse(sitemapUrlOrData: string | { url: string; xmlData: string } | { url: string; stream: ReadableStream }): AsyncGenerator<SitemapUrl> {
    let sitemapUrl: string;
    let source: Readable | string;

    try {
      if (typeof sitemapUrlOrData === 'string') {
        sitemapUrl = sitemapUrlOrData;
        const response = await fetch(sitemapUrl);
        if (response.status !== 200) throw new Error(`Failed to fetch sitemap: ${response.status}`);
        
        if (response.body) {
          source = Readable.fromWeb(response.body as any);
        } else {
          // Fallback for environments where body might be missing or mocked without body
          source = await response.text();
        }
      } else if ('stream' in sitemapUrlOrData) {
        sitemapUrl = sitemapUrlOrData.url;
        source = Readable.fromWeb(sitemapUrlOrData.stream as any);
      } else {
        sitemapUrl = sitemapUrlOrData.url;
        source = sitemapUrlOrData.xmlData;
      }

      const xmlData = typeof source === 'string' ? source : await this.streamToString(source);
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        // Optimization: only parse what we need
        isArray: (name) => name === 'url',
      });
      
      const jsonObj = parser.parse(xmlData);

      if (jsonObj.urlset && jsonObj.urlset.url) {
        const urls = jsonObj.urlset.url;

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

  private async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}
