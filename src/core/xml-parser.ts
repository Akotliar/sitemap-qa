import { XMLParser } from 'fast-xml-parser';
import { Readable } from 'node:stream';

export interface XmlParserOptions {
  onSitemap?: (loc: string) => void;
  onUrl?: (url: any) => void;
  onError?: (error: Error) => void;
}

/**
 * A unified streaming XML parser for sitemaps.
 * Uses fast-xml-parser's XMLParser in a way that could be adapted for streaming if needed,
 * but currently focuses on providing a consistent interface for both discovery and extraction.
 */
export class StreamingXmlParser {
  private readonly parser: XMLParser;

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
   * Parses an XML stream and calls callbacks for found elements.
   * Returns the full XML string that was parsed.
   */
  async parse(stream: Readable | string, options: XmlParserOptions): Promise<string> {
    try {
      const xmlData = typeof stream === 'string' ? stream : await this.streamToString(stream);
      const jsonObj = this.parser.parse(xmlData);

      // Handle sitemap index
      if (jsonObj.sitemapindex && options.onSitemap) {
        const sitemaps = jsonObj.sitemapindex.sitemap || [];

        for (const sitemap of sitemaps) {
          if (sitemap?.loc) {
            options.onSitemap(sitemap.loc);
          }
        }
      }

      // Handle leaf sitemap
      if (jsonObj.urlset && options.onUrl) {
        const urls = jsonObj.urlset.url || [];

        for (const url of urls) {
          if (url?.loc) {
            options.onUrl(url);
          }
        }
      }

      return xmlData;
    } catch (error) {
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
        return typeof stream === 'string' ? stream : ''; // Return what we have or empty
      } else {
        throw error;
      }
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
