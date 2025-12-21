import { describe, it, expect } from 'vitest';
import { consolidateUrls, normalizeUrl } from '@/core/consolidator';
import { UrlEntry } from '@/core/parser';

describe('normalizeUrl', () => {
  it('should remove trailing slash', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe(
      'https://example.com/page'
    );
  });

  it('should preserve root trailing slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('should sort query parameters', () => {
    expect(normalizeUrl('https://example.com/page?b=2&a=1')).toBe(
      'https://example.com/page?a=1&b=2'
    );
  });

  it('should remove fragment identifiers by default', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe(
      'https://example.com/page'
    );
  });

  it('should preserve fragment identifiers when configured', () => {
    expect(normalizeUrl('https://example.com/page#section', { removeHash: false })).toBe(
      'https://example.com/page#section'
    );
  });

  it('should handle invalid URLs gracefully', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('consolidateUrls', () => {
  it('should remove exact duplicates', () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/page', source: 'sitemap1.xml' },
      { loc: 'https://example.com/page', source: 'sitemap2.xml' },
    ];

    const result = consolidateUrls(urls);

    expect(result.uniqueUrls).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.uniqueUrls[0].source).toBe('sitemap1.xml, sitemap2.xml');
  });

  it('should normalize trailing slashes', () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/page', source: 'sitemap1.xml' },
      { loc: 'https://example.com/page/', source: 'sitemap2.xml' },
    ];

    const result = consolidateUrls(urls);

    expect(result.uniqueUrls).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it('should use highest priority', () => {
    const urls: UrlEntry[] = [
      {
        loc: 'https://example.com/page',
        priority: 0.5,
        source: 'sitemap1.xml',
      },
      {
        loc: 'https://example.com/page',
        priority: 0.8,
        source: 'sitemap2.xml',
      },
    ];

    const result = consolidateUrls(urls);

    expect(result.uniqueUrls[0].priority).toBe(0.8);
  });

  it('should use most recent lastmod', () => {
    const urls: UrlEntry[] = [
      {
        loc: 'https://example.com/page',
        lastmod: '2024-01-01T00:00:00Z',
        source: 'sitemap1.xml',
      },
      {
        loc: 'https://example.com/page',
        lastmod: '2024-06-01T00:00:00Z',
        source: 'sitemap2.xml',
      },
    ];

    const result = consolidateUrls(urls);

    expect(result.uniqueUrls[0].lastmod).toBe('2024-06-01T00:00:00.000Z');
  });

  it('should track duplicate groups', () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/page', source: 'sitemap1.xml' },
      { loc: 'https://example.com/page', source: 'sitemap2.xml' },
      { loc: 'https://example.com/page', source: 'sitemap3.xml' },
    ];

    const result = consolidateUrls(urls);

    expect(result.duplicateGroups).toHaveLength(1);
    expect(result.duplicateGroups![0].count).toBe(3);
    expect(result.duplicateGroups![0].sources).toEqual([
      'sitemap1.xml',
      'sitemap2.xml',
      'sitemap3.xml',
    ]);
  });

  it('should handle empty input', () => {
    const result = consolidateUrls([]);

    expect(result.uniqueUrls).toEqual([]);
    expect(result.totalInputUrls).toBe(0);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('should preserve URLs with no duplicates', () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/page1', source: 'sitemap.xml' },
      { loc: 'https://example.com/page2', source: 'sitemap.xml' },
    ];

    const result = consolidateUrls(urls);

    expect(result.uniqueUrls).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('should handle mixed case URLs distinctly in path', () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/Page', source: 'sitemap1.xml' },
      { loc: 'https://example.com/page', source: 'sitemap2.xml' },
    ];

    const result = consolidateUrls(urls);

    // URL paths are case-sensitive by default
    expect(result.uniqueUrls).toHaveLength(2);
  });

  it('should use most frequent changefreq', () => {
    const urls: UrlEntry[] = [
      {
        loc: 'https://example.com/page',
        changefreq: 'daily',
        source: 'sitemap1.xml',
      },
      {
        loc: 'https://example.com/page',
        changefreq: 'weekly',
        source: 'sitemap2.xml',
      },
      {
        loc: 'https://example.com/page',
        changefreq: 'daily',
        source: 'sitemap3.xml',
      },
    ];

    const result = consolidateUrls(urls);

    expect(result.uniqueUrls[0].changefreq).toBe('daily');
  });
});

describe('consolidateUrls - performance', () => {
  it('should consolidate 10,000 URLs in < 500ms', () => {
    const urls: UrlEntry[] = [];
    for (let i = 0; i < 10000; i++) {
      urls.push({
        loc: `https://example.com/page${i % 5000}`, // 50% duplicates
        source: 'sitemap.xml',
      });
    }

    const start = Date.now();
    const result = consolidateUrls(urls);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
    expect(result.uniqueUrls).toHaveLength(5000);
    expect(result.duplicatesRemoved).toBe(5000);
  });
});
