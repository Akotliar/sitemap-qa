import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscoveryService } from '../src/core/discovery';
import { fetch } from 'undici';

// Mock undici's fetch
vi.mock('undici', () => ({
  fetch: vi.fn(),
}));

describe('DiscoveryService', () => {
  let discovery: DiscoveryService;

  beforeEach(() => {
    discovery = new DiscoveryService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findSitemaps', () => {
    it('should discover sitemaps from robots.txt', async () => {
      const testDomain = 'discovery-test1.local';
      const robotsContent = `User-agent: *
Disallow: /admin/

Sitemap: https://${testDomain}/sitemap.xml
Sitemap: https://${testDomain}/sitemap-index.xml`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(fetch).toHaveBeenCalledWith(`https://${testDomain}/robots.txt`);
      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap.xml`);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap-index.xml`);
    });

    it('should handle multiple sitemap declarations with different cases', async () => {
      const testDomain = 'discovery-test2.local';
      const robotsContent = `Sitemap: https://${testDomain}/sitemap1.xml
sitemap: https://${testDomain}/sitemap2.xml
SITEMAP: https://${testDomain}/sitemap3.xml`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(3);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap1.xml`);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap2.xml`);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap3.xml`);
    });

    it('should trim whitespace from sitemap URLs in robots.txt', async () => {
      const testDomain = 'discovery-test3.local';
      const robotsContent = `Sitemap:   https://${testDomain}/sitemap.xml   
Sitemap: https://${testDomain}/other.xml  `;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap.xml`);
      expect(sitemaps).toContain(`https://${testDomain}/other.xml`);
    });

    it('should fall back to standard paths when robots.txt has no sitemaps', async () => {
      const testDomain = 'discovery-test4.local';
      const robotsContent = `User-agent: *
Disallow: /admin/`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => robotsContent,
        } as any)
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.xml
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(1);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap_index.xml`);
    });

    it('should fall back to standard paths when robots.txt returns 404', async () => {
      const testDomain = 'discovery-test5.local';
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap.xml
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap.xml`);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap_index.xml`);
    });

    it('should check all standard paths', async () => {
      const testDomain = 'discovery-test6.local';
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 200 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap.php`);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap.xml.gz`);
    });

    it('should return empty array when no sitemaps are found', async () => {
      const testDomain = 'discovery-test7.local';
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(0);
    });

    it('should handle robots.txt fetch errors gracefully', async () => {
      const testDomain = 'discovery-test8.local';
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error')) // robots.txt error
        .mockResolvedValueOnce({ status: 200 } as any); // /sitemap.xml

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(1);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap.xml`);
    });

    it('should handle standard path fetch errors gracefully', async () => {
      const testDomain = 'discovery-test9.local';
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockRejectedValueOnce(new Error('Network error')) // /sitemap.xml
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap_index.xml
        .mockRejectedValueOnce(new Error('Timeout')) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}`);

      expect(sitemaps).toHaveLength(1);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap_index.xml`);
    });

    it('should preserve origin from base URL with path', async () => {
      const testDomain = 'discovery-test10.local';
      const robotsContent = `Sitemap: https://${testDomain}/sitemap.xml`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps(`https://${testDomain}/some/page`);

      expect(fetch).toHaveBeenCalledWith(`https://${testDomain}/robots.txt`);
      expect(sitemaps).toContain(`https://${testDomain}/sitemap.xml`);
    });

    it('should handle base URL with www subdomain', async () => {
      const testDomain = 'discovery-test11.local';
      const robotsContent = `Sitemap: https://www.${testDomain}/sitemap.xml`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps(`https://www.${testDomain}`);

      expect(fetch).toHaveBeenCalledWith(`https://www.${testDomain}/robots.txt`);
      expect(sitemaps).toContain(`https://www.${testDomain}/sitemap.xml`);
    });
  });

  describe('discover', () => {
    it('should yield leaf sitemap URL when urlset is found', async () => {
      const testDomain = 'discover-test1.local';
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${testDomain}/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/sitemap.xml`)) {
        results.push(discovered.url);
        if (discovered.type === 'xmlData') {
          expect(discovered.xmlData).toBe(sitemapXml);
        }
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(`https://${testDomain}/sitemap.xml`);
    });

    it('should recursively discover sitemaps from sitemap index', async () => {
      const testDomain = 'discover-test2.local';
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${testDomain}/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://${testDomain}/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${testDomain}/page1</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${testDomain}/page2</loc></url>
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

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/sitemap-index.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(2);
      expect(results).toContain(`https://${testDomain}/sitemap1.xml`);
      expect(results).toContain(`https://${testDomain}/sitemap2.xml`);
    });

    it('should handle nested sitemap indexes', async () => {
      const testDomain = 'discover-test3.local';
      const rootIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${testDomain}/nested-index.xml</loc>
  </sitemap>
</sitemapindex>`;

      const nestedIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${testDomain}/leaf-sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;

      const leafSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${testDomain}/page1</loc></url>
</urlset>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => rootIndexXml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => nestedIndexXml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => leafSitemapXml,
        } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/root-index.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(`https://${testDomain}/leaf-sitemap.xml`);
    });

    it('should handle single sitemap in index (not array)', async () => {
      const testDomain = 'discover-test4.local';
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${testDomain}/sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${testDomain}/page1</loc></url>
</urlset>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => indexXml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemapXml,
        } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/index.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(`https://${testDomain}/sitemap.xml`);
    });

    it('should skip already visited URLs to prevent infinite loops', async () => {
      const testDomain = 'discover-test5.local';
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${testDomain}/sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://${testDomain}/sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${testDomain}/page1</loc></url>
</urlset>`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => indexXml,
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          text: async () => sitemapXml,
        } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/index.xml`)) {
        results.push(discovered.url);
      }

      // Should only yield once even though the sitemap appears twice
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(`https://${testDomain}/sitemap.xml`);
      
      // Fetch should be called only twice (once for index, once for leaf)
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP errors gracefully', async () => {
      const testDomain = 'discover-test6.local';
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 404,
      } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/missing.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(0);
    });

    it('should handle network errors gracefully', async () => {
      const testDomain = 'discover-test7.local';
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/error.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(0);
    });

    it('should handle malformed XML gracefully', async () => {
      const testDomain = 'discover-test8.local';
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => 'This is not valid XML',
      } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/malformed.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(0);
    });

    it('should skip sitemap entries without loc element', async () => {
      const testDomain = 'discover-test9.local';
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${testDomain}/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <lastmod>2025-01-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://${testDomain}/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${testDomain}/page1</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${testDomain}/page2</loc></url>
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

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/index.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(2);
      expect(results).toContain(`https://${testDomain}/sitemap1.xml`);
      expect(results).toContain(`https://${testDomain}/sitemap2.xml`);
    });

    it('should handle empty sitemap index', async () => {
      const testDomain = 'discover-test10.local';
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</sitemapindex>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => indexXml,
      } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/empty-index.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(0);
    });

    it('should handle HTTP 500 errors gracefully', async () => {
      const testDomain = 'discover-test11.local';
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
      } as any);

      const results: string[] = [];
      for await (const discovered of discovery.discover(`https://${testDomain}/error.xml`)) {
        results.push(discovered.url);
      }

      expect(results).toHaveLength(0);
    });
  });
});
