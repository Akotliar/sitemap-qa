import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SitemapParser } from '../src/core/parser';
import { fetch } from 'undici';

vi.mock('undici', () => ({
  fetch: vi.fn(),
}));

describe('SitemapParser', () => {
  let parser: SitemapParser;

  beforeEach(() => {
    parser = new SitemapParser();
    vi.clearAllMocks();
  });

  it('should fetch and parse sitemap when URL string is provided (legacy path)', async () => {
    const mockXml = `
      <urlset>
        <url><loc>https://example.com/1</loc></url>
      </urlset>
    `;
    vi.mocked(fetch).mockResolvedValue({
      text: async () => mockXml,
    } as any);

    const urls = [];
    for await (const url of parser.parse('https://example.com/sitemap.xml')) {
      urls.push(url);
    }

    expect(urls).toHaveLength(1);
    expect(urls[0].loc).toBe('https://example.com/1');
    expect(fetch).toHaveBeenCalledWith('https://example.com/sitemap.xml');
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Simulate a fetch error to test error handling in the legacy path
    vi.mocked(fetch).mockRejectedValue(new Error('Fetch failed'));

    const urls = [];
    for await (const url of parser.parse('https://example.com/sitemap.xml')) {
      urls.push(url);
    }

    expect(urls).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse sitemap'), expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle unexpected XML structure gracefully', async () => {
    // fast-xml-parser is quite lenient, so we test that the parser
    // handles XML without the expected urlset structure gracefully
    const unexpectedXml = '<root><item>Not a sitemap</item></root>';
    
    const urls = [];
    for await (const url of parser.parse({ 
      url: 'https://example.com/sitemap.xml',
      xmlData: unexpectedXml 
    })) {
      urls.push(url);
    }

    // Should yield no URLs when the XML doesn't have urlset structure
    expect(urls).toHaveLength(0);
  });
});
