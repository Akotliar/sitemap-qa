import { describe, it, expect, vi } from 'vitest';
import { DiscoveryService } from '../src/core/discovery';
import { SitemapParser } from '../src/core/parser';
import { fetch } from 'undici';
import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';

vi.mock('undici', () => ({
  fetch: vi.fn(),
}));

describe('Gzip Support', () => {
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://gzip-test.local/page1</loc>
  </url>
</urlset>`;
  const gzippedContent = zlib.gzipSync(xmlContent);

  describe('DiscoveryService', () => {
    it('should handle gzipped sitemaps', async () => {
      const discovery = new DiscoveryService();
      const url = 'https://gzip-test.local/sitemap.xml.gz';

      // Ensure we have a clean ArrayBuffer not shared with other tests or pooled
      const cleanArrayBuffer = gzippedContent.buffer.slice(
        gzippedContent.byteOffset,
        gzippedContent.byteOffset + gzippedContent.byteLength
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        arrayBuffer: async () => cleanArrayBuffer,
        text: async () => gzippedContent.toString(),
        headers: new Map([['content-type', 'application/x-gzip']]),
      } as any);

      const results = [];
      for await (const result of discovery.discover(url)) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0].url).toBe(url);
      expect(results[0].xmlData).toBe(xmlContent);
    });
  });

  describe('SitemapParser', () => {
    it('should handle gzipped sitemaps from URL', async () => {
      const parser = new SitemapParser();
      const url = 'https://gzip-test.local/sitemap.xml.gz';

      const cleanArrayBuffer = gzippedContent.buffer.slice(
        gzippedContent.byteOffset,
        gzippedContent.byteOffset + gzippedContent.byteLength
      );

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        arrayBuffer: async () => cleanArrayBuffer,
        body: Readable.toWeb(Readable.from(gzippedContent)),
        headers: new Map([['content-type', 'application/x-gzip']]),
      } as any);

      const urls = [];
      for await (const sitemapUrl of parser.parse(url)) {
        urls.push(sitemapUrl);
      }

      expect(urls).toHaveLength(1);
      expect(urls[0].loc).toBe('https://gzip-test.local/page1');
    });
  });
});
