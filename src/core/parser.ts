import { XMLParser } from 'fast-xml-parser';
import { fetch } from 'undici';
import { SitemapUrl } from '../types/sitemap';
import { Readable } from 'node:stream';

export class SitemapParser {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      // Optimization: only parse what we need
      isArray: (name) => name === 'url',
    });
  }

  /**
   * Parses a leaf sitemap and yields SitemapUrl objects.
   * Fetches or reads the full XML into memory and parses it using fast-xml-parser's XMLParser.
   */
  async *parse(sitemapUrlOrData: string | { url: string; xmlData: string } | { url: string; stream: ReadableStream }): AsyncGenerator<SitemapUrl> {
    // Extract URL first so it's available in catch block
    const sitemapUrl = typeof sitemapUrlOrData === 'string' 
      ? sitemapUrlOrData 
      : sitemapUrlOrData.url;
    
    let source: Readable | string;

    try {
      if (typeof sitemapUrlOrData === 'string') {
        const response = await fetch(sitemapUrl);
        if (response.status !== 200) throw new Error(`Failed to fetch sitemap at ${sitemapUrl}: HTTP ${response.status}`);
        
        if (response.body) {
          source = Readable.fromWeb(response.body);
        } else {
          // Fallback for environments where body might be missing or mocked without body
          source = await response.text();
        }
      } else if ('stream' in sitemapUrlOrData) {
        source = Readable.fromWeb(sitemapUrlOrData.stream);
      } else {
        source = sitemapUrlOrData.xmlData;
      }

      const xmlData = typeof source === 'string' ? source : await this.streamToString(source);
      
      const jsonObj = this.parser.parse(xmlData);

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
