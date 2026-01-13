import { SitemapUrl } from '../types/sitemap';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
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

    try {
      if (typeof sitemapUrlOrData === 'string') {
        const response = await fetch(sitemapUrl);
        if (response.status !== 200) throw new Error(`Failed to fetch sitemap at ${sitemapUrl}: HTTP ${response.status}`);
        
        if (response.body) {
          source = Readable.fromWeb(response.body as ReadableStream);
        } else {
          // Fallback for environments where body might be missing or mocked without body
          source = await response.text();
        }
      } else if (sitemapUrlOrData.type === 'stream') {
        // Handle both Web ReadableStream and Node.js Readable
        if (sitemapUrlOrData.stream instanceof Readable) {
          source = sitemapUrlOrData.stream;
        } else {
          source = Readable.fromWeb(sitemapUrlOrData.stream as ReadableStream);
        }
      } else {
        source = sitemapUrlOrData.xmlData;
        source = sitemapUrlOrData.xmlData;
      }

      // Yield URL entries directly from the parser generator
      for await (const entry of this.xmlParser.parse(source)) {
        if (entry.type === 'url') {
          yield {
            loc: entry.loc,
            source: sitemapUrl,
            lastmod: entry.lastmod,
            changefreq: entry.changefreq,
            priority: entry.priority,
            risks: [],
          };
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
