import { describe, it, expect } from 'vitest';
import { parseSitemap } from '@/core/parser';

describe('parseSitemap', () => {
  it('should parse valid sitemap XML with all metadata', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/page1</loc>
          <lastmod>2025-01-15</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>
      </urlset>`;

    const result = await parseSitemap(xml, 'https://example.com/sitemap.xml');

    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toEqual({
      loc: 'https://example.com/page1',
      lastmod: '2025-01-15',
      changefreq: 'weekly',
      priority: 0.8,
      source: 'https://example.com/sitemap.xml',
    });
    expect(result.errors).toEqual([]);
  });

  it('should parse sitemap with missing optional fields', async () => {
    const xml = `<urlset>
      <url><loc>https://example.com/page1</loc></url>
    </urlset>`;

    const result = await parseSitemap(xml, 'test.xml');

    expect(result.urls[0]).toEqual({
      loc: 'https://example.com/page1',
      source: 'test.xml',
    });
  });

  it('should skip entries without loc field', async () => {
    const xml = `<urlset>
      <url><lastmod>2025-01-15</lastmod></url>
      <url><loc>https://example.com/page1</loc></url>
    </urlset>`;

    const result = await parseSitemap(xml, 'test.xml');

    expect(result.urls).toHaveLength(1);
    expect(result.urls[0].loc).toBe('https://example.com/page1');
  });

  it('should skip entries with invalid URLs', async () => {
    const xml = `<urlset>
      <url><loc>not-a-valid-url</loc></url>
      <url><loc>https://example.com/valid</loc></url>
    </urlset>`;

    const result = await parseSitemap(xml, 'test.xml');

    expect(result.urls).toHaveLength(1);
    expect(result.errors).toContain('Invalid URL format: not-a-valid-url');
  });

  it('should clamp priority values outside 0-1 range', async () => {
    const xml = `<urlset>
      <url>
        <loc>https://example.com/page1</loc>
        <priority>1.5</priority>
      </url>
      <url>
        <loc>https://example.com/page2</loc>
        <priority>-0.5</priority>
      </url>
    </urlset>`;

    const result = await parseSitemap(xml, 'test.xml');

    expect(result.urls[0].priority).toBe(1.0);
    expect(result.urls[1].priority).toBe(0);
    expect(result.errors).toHaveLength(2);
  });

  it('should validate changefreq values', async () => {
    const xml = `<urlset>
      <url>
        <loc>https://example.com/page1</loc>
        <changefreq>invalid</changefreq>
      </url>
    </urlset>`;

    const result = await parseSitemap(xml, 'test.xml');

    expect(result.urls[0].changefreq).toBeUndefined();
    expect(result.errors).toContain(
      'Invalid changefreq "invalid" for https://example.com/page1'
    );
  });

  it('should handle completely malformed XML', async () => {
    const xml = 'This is not XML at all!';

    const result = await parseSitemap(xml, 'test.xml');

    expect(result.urls).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('XML parsing failed');
  });

  it('should handle multiple URLs', async () => {
    const xml = `<urlset>
      <url><loc>https://example.com/page1</loc></url>
      <url><loc>https://example.com/page2</loc></url>
      <url><loc>https://example.com/page3</loc></url>
    </urlset>`;

    const result = await parseSitemap(xml, 'test.xml');

    expect(result.urls).toHaveLength(3);
    expect(result.totalCount).toBe(3);
  });
});
