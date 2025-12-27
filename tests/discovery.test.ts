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
      const robotsContent = `User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-index.xml`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(fetch).toHaveBeenCalledWith('https://example.com/robots.txt');
      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain('https://example.com/sitemap.xml');
      expect(sitemaps).toContain('https://example.com/sitemap-index.xml');
    });

    it('should handle multiple sitemap declarations with different cases', async () => {
      const robotsContent = `Sitemap: https://example.com/sitemap1.xml
sitemap: https://example.com/sitemap2.xml
SITEMAP: https://example.com/sitemap3.xml`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(3);
      expect(sitemaps).toContain('https://example.com/sitemap1.xml');
      expect(sitemaps).toContain('https://example.com/sitemap2.xml');
      expect(sitemaps).toContain('https://example.com/sitemap3.xml');
    });

    it('should trim whitespace from sitemap URLs in robots.txt', async () => {
      const robotsContent = `Sitemap:   https://example.com/sitemap.xml   
Sitemap: https://example.com/other.xml  `;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain('https://example.com/sitemap.xml');
      expect(sitemaps).toContain('https://example.com/other.xml');
    });

    it('should fall back to standard paths when robots.txt has no sitemaps', async () => {
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

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(1);
      expect(sitemaps).toContain('https://example.com/sitemap_index.xml');
    });

    it('should fall back to standard paths when robots.txt returns 404', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap.xml
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain('https://example.com/sitemap.xml');
      expect(sitemaps).toContain('https://example.com/sitemap_index.xml');
    });

    it('should check all standard paths', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 200 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(2);
      expect(sitemaps).toContain('https://example.com/sitemap.php');
      expect(sitemaps).toContain('https://example.com/sitemap.xml.gz');
    });

    it('should return empty array when no sitemaps are found', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap_index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(0);
    });

    it('should handle robots.txt fetch errors gracefully', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error')) // robots.txt error
        .mockResolvedValueOnce({ status: 200 } as any); // /sitemap.xml

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(1);
      expect(sitemaps).toContain('https://example.com/sitemap.xml');
    });

    it('should handle standard path fetch errors gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 404 } as any) // robots.txt
        .mockRejectedValueOnce(new Error('Network error')) // /sitemap.xml
        .mockResolvedValueOnce({ status: 200 } as any) // /sitemap_index.xml
        .mockRejectedValueOnce(new Error('Timeout')) // /sitemap-index.xml
        .mockResolvedValueOnce({ status: 404 } as any) // /sitemap.php
        .mockResolvedValueOnce({ status: 404 } as any); // /sitemap.xml.gz

      const sitemaps = await discovery.findSitemaps('https://example.com');

      expect(sitemaps).toHaveLength(1);
      expect(sitemaps).toContain('https://example.com/sitemap_index.xml');
    });

    it('should preserve origin from base URL with path', async () => {
      const robotsContent = 'Sitemap: https://example.com/sitemap.xml';

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps('https://example.com/some/page');

      expect(fetch).toHaveBeenCalledWith('https://example.com/robots.txt');
      expect(sitemaps).toContain('https://example.com/sitemap.xml');
    });

    it('should handle base URL with www subdomain', async () => {
      const robotsContent = 'Sitemap: https://www.example.com/sitemap.xml';

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => robotsContent,
      } as any);

      const sitemaps = await discovery.findSitemaps('https://www.example.com');

      expect(fetch).toHaveBeenCalledWith('https://www.example.com/robots.txt');
      expect(sitemaps).toContain('https://www.example.com/sitemap.xml');
    });
  });

  describe('discover', () => {
    it('should yield leaf sitemap URL when urlset is found', async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
</urlset>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => sitemapXml,
      } as any);

      const results: string[] = [];
      for await (const url of discovery.discover('https://example.com/sitemap.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('https://example.com/sitemap.xml');
    });

    it('should recursively discover sitemaps from sitemap index', async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page2</loc></url>
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
      for await (const url of discovery.discover('https://example.com/sitemap-index.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(2);
      expect(results).toContain('https://example.com/sitemap1.xml');
      expect(results).toContain('https://example.com/sitemap2.xml');
    });

    it('should handle nested sitemap indexes', async () => {
      const rootIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/nested-index.xml</loc>
  </sitemap>
</sitemapindex>`;

      const nestedIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/leaf-sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;

      const leafSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
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
      for await (const url of discovery.discover('https://example.com/root-index.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('https://example.com/leaf-sitemap.xml');
    });

    it('should handle single sitemap in index (not array)', async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
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
      for await (const url of discovery.discover('https://example.com/index.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('https://example.com/sitemap.xml');
    });

    it('should skip already visited URLs to prevent infinite loops', async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
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
      for await (const url of discovery.discover('https://example.com/index.xml')) {
        results.push(url);
      }

      // Should only yield once even though the sitemap appears twice
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('https://example.com/sitemap.xml');
      
      // Fetch should be called only twice (once for index, once for leaf)
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 404,
      } as any);

      const results: string[] = [];
      for await (const url of discovery.discover('https://example.com/missing.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(0);
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const results: string[] = [];
      for await (const url of discovery.discover('https://example.com/error.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(0);
    });

    it('should handle malformed XML gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => 'This is not valid XML',
      } as any);

      const results: string[] = [];
      for await (const url of discovery.discover('https://example.com/malformed.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(0);
    });

    it('should skip sitemap entries without loc element', async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <lastmod>2025-01-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;

      const sitemap1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
</urlset>`;

      const sitemap2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page2</loc></url>
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
      for await (const url of discovery.discover('https://example.com/index.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(2);
      expect(results).toContain('https://example.com/sitemap1.xml');
      expect(results).toContain('https://example.com/sitemap2.xml');
    });

    it('should handle empty sitemap index', async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</sitemapindex>`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        text: async () => indexXml,
      } as any);

      const results: string[] = [];
      for await (const url of discovery.discover('https://example.com/empty-index.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(0);
    });

    it('should handle HTTP 500 errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
      } as any);

      const results: string[] = [];
      for await (const url of discovery.discover('https://example.com/error.xml')) {
        results.push(url);
      }

      expect(results).toHaveLength(0);
    });
  });
});
