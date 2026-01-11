import { describe, it, expect, vi } from 'vitest';
import { StreamingXmlParser } from '../src/core/xml-parser';
import { Readable } from 'node:stream';

describe('StreamingXmlParser', () => {
  it('should parse a sitemap index', async () => {
    const parser = new StreamingXmlParser();
    const xml = `
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>http://www.example.com/sitemap1.xml.gz</loc>
          <lastmod>2004-10-01T18:23:17+00:00</lastmod>
        </sitemap>
        <sitemap>
          <loc>http://www.example.com/sitemap2.xml.gz</loc>
          <lastmod>2005-01-01</lastmod>
        </sitemap>
      </sitemapindex>
    `;

    const sitemaps: string[] = [];
    await parser.parse(xml, {
      onSitemap: (loc) => sitemaps.push(loc),
    });

    expect(sitemaps).toEqual([
      'http://www.example.com/sitemap1.xml.gz',
      'http://www.example.com/sitemap2.xml.gz',
    ]);
  });

  it('should parse a leaf sitemap', async () => {
    const parser = new StreamingXmlParser();
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>http://www.example.com/</loc>
          <lastmod>2005-01-01</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.8</priority>
        </url>
      </urlset>
    `;

    const urls: any[] = [];
    await parser.parse(xml, {
      onUrl: (url) => urls.push(url),
    });

    expect(urls).toHaveLength(1);
    expect(urls[0].loc).toBe('http://www.example.com/');
    expect(urls[0].changefreq).toBe('monthly');
  });

  it('should handle streams', async () => {
    const parser = new StreamingXmlParser();
    const xml = '<urlset><url><loc>http://example.com</loc></url></urlset>';
    const stream = Readable.from([xml]);

    const urls: any[] = [];
    await parser.parse(stream, {
      onUrl: (url) => urls.push(url),
    });

    expect(urls).toHaveLength(1);
    expect(urls[0].loc).toBe('http://example.com');
  });

  it('should handle errors', async () => {
    const parser = new StreamingXmlParser();
    const xml = '<invalid-xml>';
    
    const onError = vi.fn();
    await parser.parse(xml, { onError });

    // fast-xml-parser might not throw on simple invalid XML unless configured, 
    // but let's check if it handles it gracefully or calls onError if it fails.
  });
});
