import { describe, it, expect } from 'vitest';
import { StreamingXmlParser, SitemapUrlEntry } from '../src/core/xml-parser';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';

describe('StreamingXmlParser', () => {
  it('should parse a sitemap index', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-test1.local';
    const xml = `
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://${testDomain}/sitemap1.xml.gz</loc>
          <lastmod>2004-10-01T18:23:17+00:00</lastmod>
        </sitemap>
        <sitemap>
          <loc>https://${testDomain}/sitemap2.xml.gz</loc>
          <lastmod>2005-01-01</lastmod>
        </sitemap>
      </sitemapindex>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      type: 'sitemap',
      loc: `https://${testDomain}/sitemap1.xml.gz`,
    });
    expect(entries[1]).toEqual({
      type: 'sitemap',
      loc: `https://${testDomain}/sitemap2.xml.gz`,
    });
  });

  it('should parse a leaf sitemap', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-test2.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/</loc>
          <lastmod>2005-01-01</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.8</priority>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: 'url',
      loc: `https://${testDomain}/`,
      lastmod: '2005-01-01',
      changefreq: 'monthly',
      priority: 0.8,
    });
  });

  it('should handle streams', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-test3.local';
    const xml = `<urlset><url><loc>https://${testDomain}</loc></url></urlset>`;
    const stream = Readable.from([xml]);

    const entries = [];
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: 'url',
      loc: `https://${testDomain}`,
      lastmod: undefined,
      changefreq: undefined,
      priority: undefined,
    });
  });

  it('should handle malformed XML gracefully', async () => {
    const parser = new StreamingXmlParser();
    const xml = '<invalid-xml>';
    
    // fast-xml-parser is lenient and may not throw on simple malformed XML
    // It will just return an empty object, resulting in no entries yielded
    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }
    
    // Should yield no entries for malformed XML
    expect(entries).toHaveLength(0);
  });

  it('should decompress gzipped XML content', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-gzip.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/page1</loc>
        </url>
        <url>
          <loc>https://${testDomain}/page2</loc>
        </url>
      </urlset>
    `;
    
    // Gzip the XML content
    const gzipped = gzipSync(Buffer.from(xml));
    const stream = Readable.from([gzipped]);

    const entries = [];
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      type: 'url',
      loc: `https://${testDomain}/page1`,
      lastmod: undefined,
      changefreq: undefined,
      priority: undefined,
    });
    expect(entries[1]).toEqual({
      type: 'url',
      loc: `https://${testDomain}/page2`,
      lastmod: undefined,
      changefreq: undefined,
      priority: undefined,
    });
  });

  it('should cache decompressed XML via getLastParsedXml', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-cache.local';
    const xml = `<urlset><url><loc>https://${testDomain}</loc></url></urlset>`;
    
    // Parse gzipped content
    const gzipped = gzipSync(Buffer.from(xml));
    const stream = Readable.from([gzipped]);

    const entries = [];
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    // Cached XML should be decompressed
    const cachedXml = parser.getLastParsedXml();
    expect(cachedXml).toBeDefined();
    expect(cachedXml).toContain(testDomain);
    expect(cachedXml).toContain('<urlset>');
    
    // Verify it's not the gzipped version
    expect(cachedXml).not.toContain(String.fromCharCode(0x1f, 0x8b));
  });

  it('should handle empty urlset', async () => {
    const parser = new StreamingXmlParser();
    const xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(0);
  });

  it('should handle empty sitemapindex', async () => {
    const parser = new StreamingXmlParser();
    const xml = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>';

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(0);
  });

  it('should parse multiple URL entries efficiently', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-multi.local';
    
    // Generate a larger sitemap with 100 URLs
    const urlEntries = Array.from({ length: 100 }, (_, i) => 
      `<url><loc>https://${testDomain}/page${i}</loc></url>`
    ).join('');
    const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}</urlset>`;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(100);
    expect(entries[0].loc).toBe(`https://${testDomain}/page0`);
    expect(entries[99].loc).toBe(`https://${testDomain}/page99`);
  });

  it('should handle URLs with partial metadata', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-partial.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/page1</loc>
          <lastmod>2024-01-01</lastmod>
        </url>
        <url>
          <loc>https://${testDomain}/page2</loc>
          <priority>0.5</priority>
        </url>
        <url>
          <loc>https://${testDomain}/page3</loc>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      type: 'url',
      loc: `https://${testDomain}/page1`,
      lastmod: '2024-01-01',
      changefreq: undefined,
      priority: undefined,
    });
    expect(entries[1]).toEqual({
      type: 'url',
      loc: `https://${testDomain}/page2`,
      lastmod: undefined,
      changefreq: undefined,
      priority: 0.5,
    });
    expect(entries[2]).toEqual({
      type: 'url',
      loc: `https://${testDomain}/page3`,
      lastmod: undefined,
      changefreq: undefined,
      priority: undefined,
    });
  });

  it('should support early termination of iteration', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-early.local';
    
    const urlEntries = Array.from({ length: 100 }, (_, i) => 
      `<url><loc>https://${testDomain}/page${i}</loc></url>`
    ).join('');
    const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}</urlset>`;

    const entries = [];
    let count = 0;
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
      count++;
      if (count === 5) break; // Stop early
    }

    expect(entries).toHaveLength(5);
    expect(entries[4].loc).toBe(`https://${testDomain}/page4`);
  });

  it('should handle chunked stream delivery', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-chunked.local';
    const xml = `<urlset><url><loc>https://${testDomain}/test</loc></url></urlset>`;
    
    // Split into small chunks
    const chunk1 = xml.slice(0, 20);
    const chunk2 = xml.slice(20, 40);
    const chunk3 = xml.slice(40);
    
    const stream = Readable.from([chunk1, chunk2, chunk3]);

    const entries = [];
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe(`https://${testDomain}/test`);
  });

  it('should handle XML without namespace prefix', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-noprefix.local';
    const xml = `
      <urlset>
        <url>
          <loc>https://${testDomain}/page</loc>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe(`https://${testDomain}/page`);
  });

  it('should handle XML with different namespace prefixes', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-ns.local';
    const xml = `
      <sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sm:url>
          <sm:loc>https://${testDomain}/page</sm:loc>
          <sm:lastmod>2024-01-01</sm:lastmod>
        </sm:url>
      </sm:urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: 'url',
      loc: `https://${testDomain}/page`,
      lastmod: '2024-01-01',
      changefreq: undefined,
      priority: undefined,
    });
  });

  it('should throw error on corrupted gzip data', async () => {
    const parser = new StreamingXmlParser();
    
    // Create invalid gzip: gzip magic bytes but corrupted payload
    const fakeGzip = Buffer.from([0x1f, 0x8b, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff]);
    const stream = Readable.from([fakeGzip]);

    await expect(async () => {
      const entries = [];
      for await (const entry of parser.parse(stream)) {
        entries.push(entry);
      }
    }).rejects.toThrow('Failed to decompress gzipped content');
  });

  it('should reuse parser and update lastParsedXml correctly', async () => {
    const parser = new StreamingXmlParser();
    const testDomain1 = 'xml-parser-reuse1.local';
    const testDomain2 = 'xml-parser-reuse2.local';
    
    // First parse
    const xml1 = `<urlset><url><loc>https://${testDomain1}</loc></url></urlset>`;
    const entries1 = [];
    for await (const entry of parser.parse(xml1)) {
      entries1.push(entry);
    }
    
    const cached1 = parser.getLastParsedXml();
    expect(cached1).toContain(testDomain1);
    expect(cached1).not.toContain(testDomain2);

    // Second parse - should replace cache
    const xml2 = `<urlset><url><loc>https://${testDomain2}</loc></url></urlset>`;
    const entries2 = [];
    for await (const entry of parser.parse(xml2)) {
      entries2.push(entry);
    }
    
    const cached2 = parser.getLastParsedXml();
    expect(cached2).toContain(testDomain2);
    expect(cached2).not.toContain(testDomain1);
    
    expect(entries1).toHaveLength(1);
    expect(entries2).toHaveLength(1);
  });

  it('should skip entries with missing or empty loc tags', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-missing-loc.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/valid1</loc>
        </url>
        <url>
          <loc></loc>
        </url>
        <url>
          <lastmod>2024-01-01</lastmod>
        </url>
        <url>
          <loc>https://${testDomain}/valid2</loc>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    // Should only yield the 2 valid entries
    expect(entries).toHaveLength(2);
    expect(entries[0].loc).toBe(`https://${testDomain}/valid1`);
    expect(entries[1].loc).toBe(`https://${testDomain}/valid2`);
  });

  it('should handle special characters in URLs', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-special.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/path%20with%20spaces</loc>
        </url>
        <url>
          <loc>https://${testDomain}/path?query=value&amp;foo=bar</loc>
        </url>
        <url>
          <loc>https://${testDomain}/café</loc>
        </url>
        <url>
          <loc>https://${testDomain}/path/to/file#anchor</loc>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(4);
    expect(entries[0].loc).toBe(`https://${testDomain}/path%20with%20spaces`);
    expect(entries[1].loc).toBe(`https://${testDomain}/path?query=value&foo=bar`);
    expect(entries[2].loc).toBe(`https://${testDomain}/café`);
    expect(entries[3].loc).toBe(`https://${testDomain}/path/to/file#anchor`);
  });

  it('should handle binary non-gzip content gracefully', async () => {
    const parser = new StreamingXmlParser();
    
    // Binary data that's not gzip (no magic bytes)
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    const stream = Readable.from([binaryData]);

    const entries = [];
    // Should parse as text (likely malformed), resulting in no entries
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(0);
  });

  it('should handle very small buffers', async () => {
    const parser = new StreamingXmlParser();
    
    // Single byte (less than gzip magic number check) - not valid XML
    const tinyBuffer = Buffer.from([0x3c]); // '<'
    const stream = Readable.from([tinyBuffer]);

    // Parser will throw on invalid XML this small
    await expect(async () => {
      const entries = [];
      for await (const entry of parser.parse(stream)) {
        entries.push(entry);
      }
    }).rejects.toThrow();
  });

  it('should handle UTF-8 BOM at start of file', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-bom.local';
    
    // UTF-8 BOM followed by valid XML
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const xml = `<urlset><url><loc>https://${testDomain}/test</loc></url></urlset>`;
    const xmlBuffer = Buffer.from(xml);
    const withBom = Buffer.concat([bom, xmlBuffer]);
    
    const stream = Readable.from([withBom]);

    const entries = [];
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe(`https://${testDomain}/test`);
  });

  it('should handle large gzipped sitemap efficiently', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-large-gzip.local';
    
    // Generate a large sitemap (1000 URLs)
    const urlEntries = Array.from({ length: 1000 }, (_, i) => 
      `<url><loc>https://${testDomain}/page${i}</loc><lastmod>2024-01-01</lastmod></url>`
    ).join('');
    const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}</urlset>`;
    
    // Gzip the large content
    const gzipped = gzipSync(Buffer.from(xml));
    const stream = Readable.from([gzipped]);

    const entries = [];
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1000);
    expect(entries[0].loc).toBe(`https://${testDomain}/page0`);
    expect(entries[999].loc).toBe(`https://${testDomain}/page999`);
    
    // Verify decompressed XML is cached
    const cachedXml = parser.getLastParsedXml();
    expect(cachedXml).toBeDefined();
    expect(cachedXml?.length).toBeGreaterThan(gzipped.length);
  });

  it('should handle mixed sitemap and urlset gracefully', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-mixed.local';
    
    // Invalid XML with both sitemapindex and urlset (shouldn't happen in practice)
    const xml = `
      <root>
        <sitemapindex>
          <sitemap><loc>https://${testDomain}/sitemap1.xml</loc></sitemap>
        </sitemapindex>
        <urlset>
          <url><loc>https://${testDomain}/page1</loc></url>
        </urlset>
      </root>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    // Parser should handle gracefully, yielding no entries from malformed structure
    expect(entries).toHaveLength(0);
  });

  it('should skip sitemap index entries without loc', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-sitemap-no-loc.local';
    const xml = `
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://${testDomain}/sitemap1.xml</loc>
        </sitemap>
        <sitemap>
          <lastmod>2024-01-01</lastmod>
        </sitemap>
        <sitemap>
          <loc></loc>
        </sitemap>
        <sitemap>
          <loc>https://${testDomain}/sitemap2.xml</loc>
        </sitemap>
      </sitemapindex>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    // Should only yield the 2 valid sitemap entries
    expect(entries).toHaveLength(2);
    expect(entries[0].loc).toBe(`https://${testDomain}/sitemap1.xml`);
    expect(entries[1].loc).toBe(`https://${testDomain}/sitemap2.xml`);
  });

  it('should handle completely empty stream', async () => {
    const parser = new StreamingXmlParser();
    const stream = Readable.from(['']);

    const entries = [];
    for await (const entry of parser.parse(stream)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(0);
  });

  it('should handle whitespace-only content', async () => {
    const parser = new StreamingXmlParser();
    const xml = '   \n\n\t  \r\n   ';

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(0);
  });

  it('should return undefined for getLastParsedXml before parse', () => {
    const parser = new StreamingXmlParser();
    expect(parser.getLastParsedXml()).toBeUndefined();
  });

  it('should return same cached value on multiple getLastParsedXml calls', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-cache-multi.local';
    const xml = `<urlset><url><loc>https://${testDomain}</loc></url></urlset>`;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    const cached1 = parser.getLastParsedXml();
    const cached2 = parser.getLastParsedXml();
    const cached3 = parser.getLastParsedXml();

    expect(cached1).toBeDefined();
    expect(cached1).toBe(cached2);
    expect(cached2).toBe(cached3);
    expect(cached1).toContain(testDomain);
  });

  it('should handle CDATA sections in URLs', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-cdata.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc><![CDATA[https://${testDomain}/page?param=value&other=test]]></loc>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe(`https://${testDomain}/page?param=value&other=test`);
  });

  it('should handle various lastmod date formats', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-dates.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/page1</loc>
          <lastmod>2024-01-15</lastmod>
        </url>
        <url>
          <loc>https://${testDomain}/page2</loc>
          <lastmod>2024-01-15T10:30:00+00:00</lastmod>
        </url>
        <url>
          <loc>https://${testDomain}/page3</loc>
          <lastmod>2024-01-15T10:30:00Z</lastmod>
        </url>
        <url>
          <loc>https://${testDomain}/page4</loc>
          <lastmod>2024-01-15T10:30:00.000Z</lastmod>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(4);
    expect((entries[0] as SitemapUrlEntry).lastmod).toBe('2024-01-15');
    expect((entries[1] as SitemapUrlEntry).lastmod).toBe('2024-01-15T10:30:00+00:00');
    expect((entries[2] as SitemapUrlEntry).lastmod).toBe('2024-01-15T10:30:00Z');
    expect((entries[3] as SitemapUrlEntry).lastmod).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should handle priority as number', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-priority.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/page1</loc>
          <priority>0.8</priority>
        </url>
        <url>
          <loc>https://${testDomain}/page2</loc>
          <priority>1.0</priority>
        </url>
        <url>
          <loc>https://${testDomain}/page3</loc>
          <priority>0</priority>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(3);
    expect((entries[0] as SitemapUrlEntry).priority).toBe(0.8);
    expect((entries[1] as SitemapUrlEntry).priority).toBe(1.0);
    expect((entries[2] as SitemapUrlEntry).priority).toBe(0);
  });

  it('should handle single sitemap entry as array', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-single-sitemap.local';
    const xml = `
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://${testDomain}/sitemap.xml</loc>
        </sitemap>
      </sitemapindex>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    // Should work with single entry thanks to isArray config
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('sitemap');
    expect(entries[0].loc).toBe(`https://${testDomain}/sitemap.xml`);
  });

  it('should handle single URL entry as array', async () => {
    const parser = new StreamingXmlParser();
    const testDomain = 'xml-parser-single-url.local';
    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${testDomain}/page</loc>
        </url>
      </urlset>
    `;

    const entries = [];
    for await (const entry of parser.parse(xml)) {
      entries.push(entry);
    }

    // Should work with single entry thanks to isArray config
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('url');
    expect(entries[0].loc).toBe(`https://${testDomain}/page`);
  });
});
