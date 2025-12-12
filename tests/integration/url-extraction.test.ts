import { describe, it, expect, vi } from 'vitest';
import { discoverSitemaps } from '@/core/discovery';
import { extractAllUrls } from '@/core/extractor';
import { consolidateUrls } from '@/core/consolidator';
import { DEFAULT_CONFIG } from '@/types/config';
import * as httpClient from '@/utils/http-client';

describe('End-to-end URL extraction', () => {
  it('should discover, extract, and consolidate URLs', async () => {
    // Mock HTTP responses
    vi.spyOn(httpClient, 'fetchUrl')
      // robots.txt check
      .mockResolvedValueOnce({
        content: 'Sitemap: https://example.com/sitemap.xml',
        statusCode: 200,
        url: 'https://example.com/robots.txt',
      })
      // Fetch sitemap.xml to check if it's an index
      .mockResolvedValueOnce({
        content: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/page1</loc>
              <priority>0.8</priority>
            </url>
            <url>
              <loc>https://example.com/page2</loc>
              <priority>0.6</priority>
            </url>
          </urlset>`,
        statusCode: 200,
        url: 'https://example.com/sitemap.xml',
      })
      // Fetch sitemap.xml again for extraction
      .mockResolvedValueOnce({
        content: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/page1</loc>
              <priority>0.8</priority>
            </url>
            <url>
              <loc>https://example.com/page2</loc>
              <priority>0.6</priority>
            </url>
          </urlset>`,
        statusCode: 200,
        url: 'https://example.com/sitemap.xml',
      });

    // 1. Discover sitemaps
    const discovered = await discoverSitemaps(
      'https://example.com',
      DEFAULT_CONFIG
    );

    expect(discovered.sitemaps).toHaveLength(1);
    expect(discovered.sitemaps[0]).toBe('https://example.com/sitemap.xml');

    // 2. Extract URLs
    const extracted = await extractAllUrls(discovered.sitemaps, DEFAULT_CONFIG);

    expect(extracted.allUrls).toHaveLength(2);
    expect(extracted.sitemapsProcessed).toBe(1);
    expect(extracted.totalUrls).toBe(2);

    // 3. Consolidate URLs
    const consolidated = consolidateUrls(extracted.allUrls);

    expect(consolidated.uniqueUrls.length).toBe(2);
    expect(consolidated.totalInputUrls).toBe(extracted.totalUrls);
    expect(consolidated.duplicatesRemoved).toBe(0);
  });

  it('should handle duplicate URLs across sitemaps', async () => {
    vi.spyOn(httpClient, 'fetchUrl')
      // robots.txt with multiple sitemaps
      .mockResolvedValueOnce({
        content: `Sitemap: https://example.com/sitemap1.xml
Sitemap: https://example.com/sitemap2.xml`,
        statusCode: 200,
        url: 'https://example.com/robots.txt',
      })
      // Check sitemap1.xml
      .mockResolvedValueOnce({
        content: `<urlset><url><loc>https://example.com/page1</loc></url></urlset>`,
        statusCode: 200,
        url: 'https://example.com/sitemap1.xml',
      })
      // Check sitemap2.xml
      .mockResolvedValueOnce({
        content: `<urlset><url><loc>https://example.com/page1</loc></url></urlset>`,
        statusCode: 200,
        url: 'https://example.com/sitemap2.xml',
      })
      // Extract from sitemap1.xml
      .mockResolvedValueOnce({
        content: `<urlset><url><loc>https://example.com/page1</loc></url></urlset>`,
        statusCode: 200,
        url: 'https://example.com/sitemap1.xml',
      })
      // Extract from sitemap2.xml
      .mockResolvedValueOnce({
        content: `<urlset><url><loc>https://example.com/page1</loc></url></urlset>`,
        statusCode: 200,
        url: 'https://example.com/sitemap2.xml',
      });

    // 1. Discover
    const discovered = await discoverSitemaps(
      'https://example.com',
      DEFAULT_CONFIG
    );
    expect(discovered.sitemaps).toHaveLength(2);

    // 2. Extract
    const extracted = await extractAllUrls(discovered.sitemaps, DEFAULT_CONFIG);
    expect(extracted.totalUrls).toBe(2); // Same URL from 2 sitemaps

    // 3. Consolidate
    const consolidated = consolidateUrls(extracted.allUrls);
    expect(consolidated.uniqueUrls).toHaveLength(1); // Deduplicated to 1
    expect(consolidated.duplicatesRemoved).toBe(1);
    expect(consolidated.uniqueUrls[0].source).toContain('sitemap1.xml');
    expect(consolidated.uniqueUrls[0].source).toContain('sitemap2.xml');
  });
});
