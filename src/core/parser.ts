import { SitemapUrl } from '../types/sitemap';
import { Readable } from 'node:stream';
import { StreamingXmlParser } from './xml-parser';
import { fetch } from 'undici';

export class SitemapParser {
  private readonly xmlParser: StreamingXmlParser;

  constructor() {
    this.xmlParser = new StreamingXmlParser();
  }

  /**
   * Parses a leaf sitemap and yields SitemapUrl objects.
   * Uses the shared StreamingXmlParser for consistent and efficient parsing.
   * 
   * @param sitemapUrlOrData - Accepts one of three input types:
   *   - `string`: A URL string. The method will fetch the sitemap from this URL.
   *     Use this when you need to fetch a sitemap from a remote location.
   *   - `{ type: 'xmlData'; url: string; xmlData: string }`: An object with a URL and pre-fetched XML data.
   *     Use this when you already have the XML content (e.g., from a cache or file)
   *     and want to avoid an additional HTTP request.
   *   - `{ type: 'stream'; url: string; stream: ReadableStream | Readable }`: An object with a URL and a stream.
   *     Accepts either a Web ReadableStream or Node.js Readable stream.
   *     Use this when you have a stream source (e.g., from a streaming HTTP response)
   *     that should be consumed and parsed. Web streams are converted to Node.js Readable internally.
   * 
   * @yields {SitemapUrl} Parsed sitemap URL entries containing `loc` (URL), `source` (sitemap URL),
   *   optional metadata (`lastmod`, `changefreq`, `priority`), and a `risks` array (initialized as empty,
   *   populated later in the processing pipeline). Other properties like `ignored`/`ignoredBy` are not
   *   set by this method and may be added by downstream processors.
   */
  async *parse(sitemapUrlOrData: string | { type: 'xmlData'; url: string; xmlData: string } | { type: 'stream'; url: string; stream: ReadableStream | Readable }): AsyncGenerator<SitemapUrl> {
    // Extract URL first so it's available in catch block
    const sitemapUrl = typeof sitemapUrlOrData === 'string' 
      ? sitemapUrlOrData 
      : sitemapUrlOrData.url;
    
    try {
      let source: Readable | string;

      if (typeof sitemapUrlOrData === 'string') {
        const response = await fetch(sitemapUrl);
        if (response.status !== 200) throw new Error(`Failed to fetch sitemap at ${sitemapUrl}: HTTP ${response.status}`);
        
        if (response.body) {
          source = Readable.fromWeb(response.body as any);
        } else {
          // Fallback for environments where body might be missing or mocked without body
          source = await response.text();
        }
      } else if (sitemapUrlOrData.type === 'stream') {
        // Handle both Web ReadableStream and Node.js Readable
        if (sitemapUrlOrData.stream instanceof Readable) {
          source = sitemapUrlOrData.stream;
        } else {
          // @ts-expect-error - DOM ReadableStream and node:stream/web ReadableStream are incompatible types but compatible at runtime
          source = Readable.fromWeb(sitemapUrlOrData.stream);
        }
      } else {
        source = sitemapUrlOrData.xmlData;
      }

      const urls: SitemapUrl[] = [];
      
      await this.xmlParser.parse(source, {
        onUrl: (url) => {
          urls.push({
            loc: url.loc,
            source: sitemapUrl,
            lastmod: url.lastmod,
            changefreq: url.changefreq,
            priority: url.priority,
            risks: [],
          });
        }
      });

      for (const url of urls) {
        yield url;
      }
    } catch (error) {
      console.error(`Failed to parse sitemap at ${sitemapUrl}:`, error);
    }
  }
}
