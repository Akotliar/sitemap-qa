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

  it('should handle parsing errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Invalid XML that will cause fast-xml-parser to throw or return something unexpected
    // Actually fast-xml-parser is quite lenient, but we can force an error by making fetch throw
    vi.mocked(fetch).mockRejectedValue(new Error('Fetch failed'));

    const urls = [];
    for await (const url of parser.parse('https://example.com/sitemap.xml')) {
      urls.push(url);
    }

    expect(urls).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse sitemap'), expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});
