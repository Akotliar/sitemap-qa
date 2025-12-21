import { describe, it, expect } from 'vitest';
import { consolidateUrls } from '@/core/consolidator';
import { UrlEntry } from '@/core/parser';

describe('Integration: URL Normalization in Real-World Scenarios', () => {
  describe('E-commerce Site Scenario', () => {
    it('should consolidate product URLs with different www prefixes and tracking params', () => {
      const urls: UrlEntry[] = [
        { 
          loc: 'https://www.shop.com/product/123',
          priority: 0.8,
          lastmod: '2024-01-01T00:00:00Z',
          source: 'sitemap1.xml' 
        },
        { 
          loc: 'https://shop.com/product/123',
          priority: 0.7,
          lastmod: '2024-02-01T00:00:00Z',
          source: 'sitemap2.xml' 
        },
        { 
          loc: 'https://shop.com/product/123?utm_source=email',
          changefreq: 'daily',
          source: 'sitemap3.xml' 
        },
        { 
          loc: 'https://shop.com/product/123?utm_source=facebook',
          source: 'sitemap4.xml' 
        },
      ];

      const result = consolidateUrls(urls, {
        normalization: {
          removeQueryParams: ['utm_source', 'utm_medium'],
        },
      });

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(3);
      expect(result.uniqueUrls[0].priority).toBe(0.8); // Highest priority
      expect(result.uniqueUrls[0].lastmod).toBe('2024-02-01T00:00:00.000Z'); // Most recent
      expect(result.uniqueUrls[0].source).toContain('sitemap1.xml');
      expect(result.uniqueUrls[0].source).toContain('sitemap2.xml');
      expect(result.uniqueUrls[0].source).toContain('sitemap3.xml');
      expect(result.uniqueUrls[0].source).toContain('sitemap4.xml');
    });
  });

  describe('Content Site with Fragments Scenario', () => {
    it('should consolidate article URLs with different hash fragments', () => {
      const urls: UrlEntry[] = [
        { 
          loc: 'https://blog.com/article#introduction',
          source: 'sitemap1.xml' 
        },
        { 
          loc: 'https://blog.com/article#conclusion',
          source: 'sitemap2.xml' 
        },
        { 
          loc: 'https://blog.com/article',
          source: 'sitemap3.xml' 
        },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(2);
    });

    it('should keep fragments separate when configured', () => {
      const urls: UrlEntry[] = [
        { 
          loc: 'https://blog.com/article#introduction',
          source: 'sitemap1.xml' 
        },
        { 
          loc: 'https://blog.com/article#conclusion',
          source: 'sitemap2.xml' 
        },
      ];

      const result = consolidateUrls(urls, {
        normalization: { removeHash: false },
      });

      expect(result.uniqueUrls).toHaveLength(2);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('International Site Scenario', () => {
    it('should consolidate IDN variations', () => {
      const urls: UrlEntry[] = [
        { 
          loc: 'https://münchen.de/page',
          source: 'sitemap1.xml' 
        },
        { 
          loc: 'https://xn--mnchen-3ya.de/page',
          source: 'sitemap2.xml' 
        },
        { 
          loc: 'https://MÜNCHEN.de/page',
          source: 'sitemap3.xml' 
        },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(2);
      // Result should be in Punycode form
      expect(result.uniqueUrls[0].loc).toContain('xn--mnchen-3ya.de');
    });
  });

  describe('Multi-Protocol Scenario', () => {
    it('should consolidate HTTP and HTTPS when preferHttps is enabled', () => {
      const urls: UrlEntry[] = [
        { 
          loc: 'http://example.com/page',
          source: 'sitemap1.xml' 
        },
        { 
          loc: 'https://example.com/page',
          source: 'sitemap2.xml' 
        },
      ];

      const result = consolidateUrls(urls, {
        normalization: { preferHttps: true },
      });

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(1);
      expect(result.uniqueUrls[0].loc).toContain('https://');
    });

    it('should NOT consolidate HTTP and HTTPS by default', () => {
      const urls: UrlEntry[] = [
        { 
          loc: 'http://example.com/page',
          source: 'sitemap1.xml' 
        },
        { 
          loc: 'https://example.com/page',
          source: 'sitemap2.xml' 
        },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(2);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('Complex Mixed Scenario', () => {
    it('should handle complex real-world URL variations', () => {
      const urls: UrlEntry[] = [
        { 
          loc: 'https://WWW.Example.COM:443/Products/Item-123/?sort=price&filter=new#reviews',
          priority: 0.9,
          lastmod: '2024-03-01T00:00:00Z',
          changefreq: 'weekly',
          source: 'sitemap1.xml' 
        },
        { 
          loc: 'https://example.com/Products/Item-123?filter=new&sort=price',
          priority: 0.7,
          lastmod: '2024-02-01T00:00:00Z',
          source: 'sitemap2.xml' 
        },
        { 
          loc: 'http://example.com:80/Products/Item-123/?filter=new&sort=price&utm_campaign=spring',
          changefreq: 'daily',
          source: 'sitemap3.xml' 
        },
        { 
          loc: 'https://www.example.com/Products/Item-123?utm_source=newsletter&filter=new&sort=price',
          source: 'sitemap4.xml' 
        },
      ];

      const result = consolidateUrls(urls, {
        normalization: {
          removeQueryParams: ['utm_source', 'utm_campaign'],
          preferHttps: true,
        },
      });

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(3);
      
      const consolidated = result.uniqueUrls[0];
      expect(consolidated.priority).toBe(0.9); // Highest priority
      expect(consolidated.lastmod).toBe('2024-03-01T00:00:00.000Z'); // Most recent
      expect(consolidated.changefreq).toBe('weekly'); // First one wins when tied (weekly appears first)
      expect(consolidated.loc).toContain('https://');
      expect(consolidated.loc).not.toContain('www.');
      expect(consolidated.loc).not.toContain(':443');
      expect(consolidated.loc).not.toContain('#');
    });
  });

  describe('Case Sensitivity Scenarios', () => {
    it('should consolidate different domain cases', () => {
      const urls: UrlEntry[] = [
        { loc: 'https://Example.COM/page', source: 'sitemap1.xml' },
        { loc: 'https://EXAMPLE.com/page', source: 'sitemap2.xml' },
        { loc: 'https://example.com/page', source: 'sitemap3.xml' },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(2);
    });

    it('should respect path case sensitivity by default', () => {
      const urls: UrlEntry[] = [
        { loc: 'https://example.com/Page', source: 'sitemap1.xml' },
        { loc: 'https://example.com/PAGE', source: 'sitemap2.xml' },
        { loc: 'https://example.com/page', source: 'sitemap3.xml' },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(3);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('should consolidate path cases when configured', () => {
      const urls: UrlEntry[] = [
        { loc: 'https://example.com/Page', source: 'sitemap1.xml' },
        { loc: 'https://example.com/PAGE', source: 'sitemap2.xml' },
        { loc: 'https://example.com/page', source: 'sitemap3.xml' },
      ];

      const result = consolidateUrls(urls, {
        normalization: { lowercasePath: true },
      });

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(2);
    });
  });

  describe('Port Number Scenarios', () => {
    it('should consolidate default ports across protocols', () => {
      const urls: UrlEntry[] = [
        { loc: 'http://example.com:80/page', source: 'sitemap1.xml' },
        { loc: 'http://example.com/page', source: 'sitemap2.xml' },
        { loc: 'https://example.com:443/page', source: 'sitemap3.xml' },
        { loc: 'https://example.com/page', source: 'sitemap4.xml' },
      ];

      const result = consolidateUrls(urls);

      // Should consolidate within same protocol but NOT across protocols
      expect(result.uniqueUrls).toHaveLength(2); // One HTTP, one HTTPS
      expect(result.duplicatesRemoved).toBe(2);
    });

    it('should preserve non-default ports', () => {
      const urls: UrlEntry[] = [
        { loc: 'https://example.com:8080/page', source: 'sitemap1.xml' },
        { loc: 'https://example.com:8443/page', source: 'sitemap2.xml' },
        { loc: 'https://example.com/page', source: 'sitemap3.xml' },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(3);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('Tracking Parameter Scenarios', () => {
    it('should handle common marketing tracking parameters', () => {
      const urls: UrlEntry[] = [
        { loc: 'https://example.com/page?id=123', source: 'sitemap1.xml' },
        { loc: 'https://example.com/page?id=123&utm_source=google', source: 'sitemap2.xml' },
        { loc: 'https://example.com/page?id=123&utm_medium=cpc', source: 'sitemap3.xml' },
        { loc: 'https://example.com/page?id=123&fbclid=abc123', source: 'sitemap4.xml' },
        { loc: 'https://example.com/page?id=123&gclid=xyz789', source: 'sitemap5.xml' },
      ];

      const result = consolidateUrls(urls, {
        normalization: {
          removeQueryParams: ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'],
        },
      });

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(4);
      expect(result.uniqueUrls[0].loc).toContain('id=123');
      expect(result.uniqueUrls[0].loc).not.toContain('utm_');
      expect(result.uniqueUrls[0].loc).not.toContain('fbclid');
      expect(result.uniqueUrls[0].loc).not.toContain('gclid');
    });
  });

  describe('Empty/Malformed URL Scenarios', () => {
    it('should handle empty query parameters gracefully', () => {
      const urls: UrlEntry[] = [
        { loc: 'https://example.com/page?key=value', source: 'sitemap1.xml' },
        { loc: 'https://example.com/page?key=value&empty=', source: 'sitemap2.xml' },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(1);
    });

    it('should handle URLs with only trailing slash differences', () => {
      const urls: UrlEntry[] = [
        { loc: 'https://example.com/page/', source: 'sitemap1.xml' },
        { loc: 'https://example.com/page', source: 'sitemap2.xml' },
      ];

      const result = consolidateUrls(urls);

      expect(result.uniqueUrls).toHaveLength(1);
      expect(result.duplicatesRemoved).toBe(1);
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle 1000 URLs with various normalizations efficiently', () => {
      const urls: UrlEntry[] = [];
      
      // Generate 1000 URLs with various patterns that will consolidate down
      // We'll create 200 unique pages, each with 5 variations
      for (let i = 0; i < 200; i++) {
        const variations = [
          `https://www.example.com/page${i}`,
          `https://example.com/page${i}`,
          `https://Example.COM/page${i}`,
          `https://example.com/page${i}/`,
          `https://example.com/page${i}#section`,
        ];
        
        // Add all variations for each page
        variations.forEach((variation, idx) => {
          urls.push({
            loc: variation,
            source: `sitemap${i}-${idx}.xml`,
          });
        });
      }

      const start = Date.now();
      const result = consolidateUrls(urls, {
        normalization: {
          removeQueryParams: ['utm_source'],
        },
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(urls.length).toBe(1000); // Verify we created 1000 URLs
      expect(result.uniqueUrls.length).toBe(200); // Should consolidate to 200 unique pages
      expect(result.duplicatesRemoved).toBe(800); // 800 duplicates removed (1000 - 200)
    });
  });
});
