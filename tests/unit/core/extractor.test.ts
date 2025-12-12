import { describe, it, expect, vi } from 'vitest';
import { extractAllUrls } from '@/core/extractor';
import { DEFAULT_CONFIG } from '@/types/config';
import * as httpClient from '@/utils/http-client';

describe('extractAllUrls', () => {
  it('should extract URLs from multiple sitemaps', async () => {
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({
        content:
          '<urlset><url><loc>https://example.com/1</loc></url></urlset>',
        statusCode: 200,
        url: 'sitemap1.xml',
      })
      .mockResolvedValueOnce({
        content:
          '<urlset><url><loc>https://example.com/2</loc></url></urlset>',
        statusCode: 200,
        url: 'sitemap2.xml',
      });

    const result = await extractAllUrls(
      ['https://example.com/sitemap1.xml', 'https://example.com/sitemap2.xml'],
      DEFAULT_CONFIG
    );

    expect(result.allUrls).toHaveLength(2);
    expect(result.sitemapsProcessed).toBe(2);
    expect(result.sitemapsFailed).toBe(0);
  });

  it('should handle single sitemap failure gracefully', async () => {
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({
        content:
          '<urlset><url><loc>https://example.com/1</loc></url></urlset>',
        statusCode: 200,
        url: 'sitemap1.xml',
      })
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await extractAllUrls(
      ['https://example.com/sitemap1.xml', 'https://example.com/sitemap2.xml'],
      DEFAULT_CONFIG
    );

    expect(result.allUrls).toHaveLength(1);
    expect(result.sitemapsProcessed).toBe(1);
    expect(result.sitemapsFailed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('should collect parsing errors from all sitemaps', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockResolvedValue({
      content: '<urlset><url><loc>invalid-url</loc></url></urlset>',
      statusCode: 200,
      url: 'sitemap.xml',
    });

    const result = await extractAllUrls(
      ['https://example.com/sitemap.xml'],
      DEFAULT_CONFIG
    );

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should add extraction timestamp to URLs', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockResolvedValue({
      content: '<urlset><url><loc>https://example.com/1</loc></url></urlset>',
      statusCode: 200,
      url: 'sitemap.xml',
    });

    const result = await extractAllUrls(
      ['https://example.com/sitemap.xml'],
      DEFAULT_CONFIG
    );

    expect(result.allUrls[0].extractedAt).toBeDefined();
    expect(new Date(result.allUrls[0].extractedAt!).getTime()).toBeCloseTo(
      Date.now(),
      -3
    );
  });

  it('should track source sitemap for each URL', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockResolvedValue({
      content: '<urlset><url><loc>https://example.com/1</loc></url></urlset>',
      statusCode: 200,
      url: 'sitemap.xml',
    });

    const result = await extractAllUrls(
      ['https://example.com/sitemap.xml'],
      DEFAULT_CONFIG
    );

    expect(result.allUrls[0].source).toBe('https://example.com/sitemap.xml');
  });

  it('should return empty result when all sitemaps fail', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockRejectedValue(
      new Error('Network error')
    );

    const result = await extractAllUrls(
      ['https://example.com/sitemap.xml'],
      DEFAULT_CONFIG
    );

    expect(result.allUrls).toEqual([]);
    expect(result.sitemapsFailed).toBe(1);
  });
});
