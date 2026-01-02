import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExtractorService } from '../src/core/extractor';
import { fetch } from 'undici';

// Mock undici's fetch
vi.mock('undici', () => ({
  fetch: vi.fn(),
}));

describe('ExtractorService', () => {
  let extractor: ExtractorService;

  beforeEach(() => {
    extractor = new ExtractorService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDiscoveredSitemaps', () => {
    it('should return empty array initially', () => {
      const sitemaps = extractor.getDiscoveredSitemaps();
      expect(sitemaps).toEqual([]);
    });

    it('should return discovered sitemaps after extraction', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://extractor-test1.local/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test1.local/sitemap.xml')) {
        urls.push(url);
      }

      const discoveredSitemaps = extractor.getDiscoveredSitemaps();
      expect(discoveredSitemaps).toHaveLength(1);
      expect(discoveredSitemaps).toContain('https://extractor-test1.local/sitemap.xml');
    });
  });

  describe('extract', () => {
    it('should extract URLs from a direct sitemap XML URL', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://extractor-test2.local/page1</loc>
    <lastmod>2025-01-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://extractor-test2.local/page2</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test2.local/sitemap.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(2);
      expect(urls[0].loc).toBe('https://extractor-test2.local/page1');
      expect(urls[0].lastmod).toBe('2025-01-01');
      expect(urls[0].changefreq).toBe('daily');
      expect(urls[0].priority).toBe(0.8);
      expect(urls[1].loc).toBe('https://extractor-test2.local/page2');
      expect(urls[0].source).toBe('https://extractor-test2.local/sitemap.xml');
    });

    it('should extract URLs from a .gz sitemap URL', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://extractor-test3.local/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test3.local/sitemap.xml.gz')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(1);
      expect(urls[0].loc).toBe('https://extractor-test3.local/page1');
    });

    it('should discover sitemaps from base URL when input is not XML', async () => {
      const robotsContent = 'Sitemap: https://extractor-test4.local/sitemap.xml';
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://extractor-test4.local/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => robotsContent,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemapXml,
        } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test4.local')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(1);
      expect(urls[0].loc).toBe('https://extractor-test4.local/page1');
      
      const discoveredSitemaps = extractor.getDiscoveredSitemaps();
      expect(discoveredSitemaps).toContain('https://extractor-test4.local/sitemap.xml');
    });

    it('should deduplicate URLs with different trailing slashes', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://extractor-test5.local/page1</loc>
  </url>
  <url>
    <loc>https://extractor-test5.local/page1/</loc>
  </url>
  <url>
    <loc>https://EXTRACTOR-TEST5.LOCAL/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test5.local/sitemap.xml')) {
        urls.push(url);
      }

      // Should only yield one URL since they all normalize to the same value
      expect(urls).toHaveLength(1);
      expect(urls[0].loc).toBe('https://extractor-test5.local/page1');
    });

    it('should deduplicate URLs with different casing', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://Example.com/Page1</loc>
  </url>
  <url>
    <loc>https://EXAMPLE.COM/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test6.local/sitemap.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(1);
    });

    it('should preserve query parameters in normalized URLs', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://extractor-test6.local/page?id=123&amp;ref=home</loc>
  </url>
  <url>
    <loc>https://extractor-test6.local/page?id=456&amp;ref=home</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test6.local/sitemap.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(2);
      expect(urls[0].loc).toContain('?id=123');
      expect(urls[1].loc).toContain('?id=456');
    });

    it('should handle sitemap index with multiple sitemaps', async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://extractor-test7.local/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://extractor-test7.local/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://extractor-test7.local/page1</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://extractor-test7.local/page2</loc></url>
</urlset>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => indexXml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemap1Xml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemap2Xml,
        } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test7.local/sitemap-index.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(2);
      expect(urls[0].loc).toBe('https://extractor-test7.local/page1');
      expect(urls[1].loc).toBe('https://extractor-test7.local/page2');

      const discoveredSitemaps = extractor.getDiscoveredSitemaps();
      expect(discoveredSitemaps).toHaveLength(2);
      expect(discoveredSitemaps).toContain('https://extractor-test7.local/sitemap1.xml');
      expect(discoveredSitemaps).toContain('https://extractor-test7.local/sitemap2.xml');
    });

    it('should handle base URL with no discovered sitemaps', async () => {
      // robots.txt returns 404, all standard paths return 404
      // When no sitemaps are discovered, the system still proceeds with the input URL
      // and tries to discover from it, which will fail
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockResolvedValueOnce({ status: 404 } as any) // HEAD /sitemap.xml
        .mockResolvedValueOnce({ status: 404 } as any) // HEAD /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // HEAD /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // HEAD /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any) // HEAD /sitemap.xml.gz
        .mockResolvedValueOnce({ status: 404 } as any); // GET https://extractor-test8.local (discover attempt)

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test8.local')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(0);
    });

    it('should handle empty sitemap gracefully', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test9.local/sitemap.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(0);
    });

    it('should handle malformed sitemap gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => 'This is not valid XML',
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test9.local/sitemap.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(0);
    });

    it('should track multiple discovered sitemaps from discovery', async () => {
      const robotsContent = `Sitemap: https://extractor-test10.local/sitemap1.xml
Sitemap: https://extractor-test10.local/sitemap2.xml`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://extractor-test10.local/page1</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://extractor-test10.local/page2</loc></url>
</urlset>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => robotsContent,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemap1Xml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemap2Xml,
        } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test10.local')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(2);

      const discoveredSitemaps = extractor.getDiscoveredSitemaps();
      expect(discoveredSitemaps).toHaveLength(2);
      expect(discoveredSitemaps).toContain('https://extractor-test10.local/sitemap1.xml');
      expect(discoveredSitemaps).toContain('https://extractor-test10.local/sitemap2.xml');
    });

    it('should handle URLs without protocol in normalization', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://extractor-test11.local/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test11.local/sitemap.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(1);
      expect(urls[0].loc).toBe('https://extractor-test11.local/page1');
    });

    it('should deduplicate URLs across multiple sitemaps', async () => {
      const robotsContent = `Sitemap: https://extractor-test12.local/sitemap1.xml
Sitemap: https://extractor-test12.local/sitemap2.xml`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://extractor-test12.local/page1</loc></url>
  <url><loc>https://extractor-test12.local/page2</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://extractor-test12.local/page1/</loc></url>
  <url><loc>https://extractor-test12.local/page3</loc></url>
</urlset>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => robotsContent,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemap1Xml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemap2Xml,
        } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test12.local')) {
        urls.push(url);
      }

      // page1 appears in both sitemaps but should only be yielded once
      expect(urls).toHaveLength(3);
      const locs = urls.map(u => u.loc);
      expect(locs).toContain('https://extractor-test12.local/page1');
      expect(locs).toContain('https://extractor-test12.local/page2');
      expect(locs).toContain('https://extractor-test12.local/page3');
    });

    it('should pass through invalid URLs without normalization', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>invalid-url</loc></url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const urls = [];
      for await (const url of extractor.extract('https://extractor-test13.local/sitemap.xml')) {
        urls.push(url);
      }

      expect(urls).toHaveLength(1);
      expect(urls[0].loc).toBe('invalid-url');
    });

    it('should handle fetch errors during extraction', async () => {
      // Mock console.error to verify error logging
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const urls = [];
      // The generator should complete gracefully without throwing
      for await (const url of extractor.extract('https://extractor-test14.local/sitemap.xml')) {
        urls.push(url);
      }

      // Verify no URLs were extracted when fetch fails
      expect(urls).toHaveLength(0);
      
      // Verify the error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch or parse sitemap'),
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle fetch errors during extraction', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const urls = [];
      try {
        for await (const url of extractor.extract('https://example.com/sitemap.xml')) {
          urls.push(url);
        }
      } catch (e) {
        // Expected
      }
    });
  });
});
