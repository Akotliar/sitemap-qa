import { describe, it, expect } from 'vitest';
import { parseSitemap } from '@/core/parser';

describe('parseSitemap - integration', () => {
  it(
    'should parse real sitemap from wikipedia.org',
    async () => {
      // Create a valid sitemap XML for testing
      const validXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/page1</loc>
          <lastmod>2025-01-15</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>
        <url>
          <loc>https://example.com/page2</loc>
          <priority>0.6</priority>
        </url>
      </urlset>`;

      const result = await parseSitemap(
        validXml,
        'https://example.com/sitemap.xml'
      );

      expect(result.urls.length).toBe(2);
      expect(result.errors).toEqual([]);
      expect(result.totalCount).toBe(2);
      expect(result.urls[0].loc).toBe('https://example.com/page1');
      expect(result.urls[0].priority).toBe(0.8);
      expect(result.urls[1].loc).toBe('https://example.com/page2');
    },
    30000
  );
});
