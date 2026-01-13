import { XMLParser } from 'fast-xml-parser';
import { Readable } from 'node:stream';
import { gunzipSync } from 'node:zlib';

export interface SitemapIndexEntry {
  type: 'sitemap';
  loc: string;
}

export interface SitemapUrlEntry {
  type: 'url';
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export type ParsedEntry = SitemapIndexEntry | SitemapUrlEntry;

/**
 * A unified streaming XML parser for sitemaps.
 * Uses fast-xml-parser's XMLParser in a way that could be adapted for streaming if needed,
 * but currently focuses on providing a consistent interface for both discovery and extraction.
 */
export class StreamingXmlParser {
  private readonly parser: XMLParser;
  private lastParsedXml?: string;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      // Ensure we always get arrays for sitemap and url tags
      isArray: (name) => name === 'sitemap' || name === 'url',
      removeNSPrefix: true,
    });
  }

  /**
   * Parses an XML stream and yields typed entries as they are found.
   * Generator-first design allows consumers to process entries without pre-collecting.
   */
  async *parse(stream: Readable | string): AsyncGenerator<ParsedEntry> {
    const xmlData = typeof stream === 'string' ? stream : await this.streamToString(stream);
    
    // Store the decompressed XML for consumers who need it
    this.lastParsedXml = xmlData;
    
    const jsonObj = this.parser.parse(xmlData);

    // Yield sitemap index entries
    if (jsonObj.sitemapindex?.sitemap) {
      const sitemaps = jsonObj.sitemapindex.sitemap;
      for (const sitemap of sitemaps) {
        if (sitemap?.loc) {
          yield { type: 'sitemap', loc: sitemap.loc };
        }
      }
    }

    // Yield URL entries
    if (jsonObj.urlset?.url) {
      const urls = jsonObj.urlset.url;
      for (const url of urls) {
        if (url?.loc) {
          yield {
            type: 'url',
            loc: url.loc,
            lastmod: url.lastmod,
            changefreq: url.changefreq,
            priority: url.priority,
          };
        }
      }
    }
  }
  
  /**
   * Get the last parsed XML data (useful to avoid re-fetching).
   */
  getLastParsedXml(): string | undefined {
    return this.lastParsedXml;
  }

  private async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    
    // Check if content is gzipped (magic number: 1f 8b)
    if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      try {
        const decompressed = gunzipSync(buffer);
        return decompressed.toString('utf8');
      } catch (error) {
        throw new Error(`Failed to decompress gzipped content: ${error}`);
      }
    }
    
    return buffer.toString('utf8');
  }
}
