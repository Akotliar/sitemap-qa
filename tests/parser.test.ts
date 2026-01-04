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

  it('should fetch and parse sitemap when URL string is provided (streaming path)', async () => {
    const testDomain = 'parser-test.local';
    const testSitemapUrl = `https://${testDomain}/sitemap.xml`;
    const testPageUrl = `https://${testDomain}/1`;
    
    const mockXml = `
      <urlset>
        <url><loc>${testPageUrl}</loc></url>
      </urlset>
    `;
    
    // Create a proper ReadableStream mock to test the streaming code path
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(mockXml));
        controller.close();
      }
    });
    
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      body: mockBody,
      text: async () => mockXml,
    } as any);

    const urls = [];
    for await (const url of parser.parse(testSitemapUrl)) {
      urls.push(url);
    }

    expect(urls).toHaveLength(1);
    expect(urls[0].loc).toBe(testPageUrl);
    expect(fetch).toHaveBeenCalledWith(testSitemapUrl);
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testSitemapUrl = 'https://fetch-error-test.local/sitemap.xml';
    
    // Simulate a fetch error to test error handling in the legacy path
    vi.mocked(fetch).mockRejectedValue(new Error('Fetch failed'));

    const urls = [];
    for await (const url of parser.parse(testSitemapUrl)) {
      urls.push(url);
    }

    expect(urls).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse sitemap'), expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle unexpected XML structure gracefully', async () => {
    // fast-xml-parser is quite lenient, so we test that the parser
    // handles XML without the expected urlset structure gracefully
    const testSitemapUrl = 'https://unexpected-xml-test.local/sitemap.xml';
    const unexpectedXml = '<root><item>Not a sitemap</item></root>';
    
    const urls = [];
    for await (const url of parser.parse({ 
      type: 'xmlData',
      url: testSitemapUrl,
      xmlData: unexpectedXml 
    })) {
      urls.push(url);
    }

    // Should yield no URLs when the XML doesn't have urlset structure
    expect(urls).toHaveLength(0);
  });

  it('should parse sitemap from a ReadableStream using stream parameter', async () => {
    const testDomain = 'stream-test.local';
    const testSitemapUrl = `https://${testDomain}/sitemap.xml`;
    const testPageUrl = `https://${testDomain}/page1`;
    
    const mockXml = `
      <urlset>
        <url><loc>${testPageUrl}</loc></url>
      </urlset>
    `;
    
    // Create a ReadableStream to test the type: 'stream' code path
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(mockXml));
        controller.close();
      }
    });
    
    const urls = [];
    for await (const url of parser.parse({
      type: 'stream',
      url: testSitemapUrl,
      stream: mockStream
    })) {
      urls.push(url);
    }

    expect(urls).toHaveLength(1);
    expect(urls[0].loc).toBe(testPageUrl);
    expect(urls[0].source).toBe(testSitemapUrl);
    // Verify that fetch was NOT called since we're providing a stream directly
    expect(fetch).not.toHaveBeenCalled();
  });
});
