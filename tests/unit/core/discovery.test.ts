import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverSitemaps } from '@/core/discovery';
import { DEFAULT_CONFIG } from '@/types/config';
import { HttpError, NetworkError } from '@/errors/network-errors';
import * as httpClient from '@/utils/http-client';

// Suppress console output during tests to avoid cluttering test output
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe('discoverSitemaps - standard paths', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should discover sitemap at /sitemap.xml', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: '<urlset></urlset>', statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
    expect(result.source).toBe('standard-path');
  });
  
  it('should try /sitemap_index.xml if /sitemap.xml returns 404', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap_index.xml') {
        return { content: '<urlset></urlset>', statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/sitemap_index.xml']);
    expect(result.source).toBe('standard-path');
  });
  
  it('should return empty result if all paths return 404', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockRejectedValue(
      new HttpError('https://example.com/sitemap.xml', 404)
    );
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([]);
    expect(result.source).toBe('none');
  });
  
  it('should normalize base URL by removing trailing slash', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: '<urlset></urlset>', statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com/', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });
  
  it('should normalize base URL by extracting origin from path', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: '<urlset></urlset>', statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com/some/page', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });
  
  it('should handle network errors gracefully', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockRejectedValue(
      new NetworkError('https://example.com/sitemap.xml', new Error('ECONNREFUSED'))
    );
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([]);
    expect(result.source).toBe('none');
  });
  
  it('should log attempts in verbose mode', async () => {
    // Restore console for this specific test
    consoleLogSpy.mockRestore();
    const consoleSpy = vi.spyOn(console, 'log');
    const verboseConfig = { ...DEFAULT_CONFIG, verbose: true };
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockRejectedValueOnce(new HttpError('https://example.com/robots.txt', 404))
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'https://example.com/sitemap.xml' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'https://example.com/sitemap.xml' });
    
    await discoverSitemaps('https://example.com', verboseConfig);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found sitemap at'));
    
    // Suppress again for remaining tests
    consoleSpy.mockImplementation(() => {});
  });
});

describe('discoverSitemaps - robots.txt parsing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract sitemap URLs from robots.txt', async () => {
    const robotsContent = `User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/news/sitemap.xml`;
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({ content: robotsContent, statusCode: 200, url: 'https://example.com/robots.txt' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'https://example.com/sitemap.xml' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'https://example.com/news/sitemap.xml' });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/news/sitemap.xml'
    ]);
    expect(result.source).toBe('robots-txt');
  });

  it('should handle missing robots.txt gracefully', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: '<urlset></urlset>', statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
    expect(result.source).toBe('standard-path');
  });

  it('should skip invalid URLs in robots.txt', async () => {
    const robotsContent = `Sitemap: https://example.com/valid.xml
Sitemap: not-a-valid-url
Sitemap: https://example.com/another-valid.xml`;
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({ content: robotsContent, statusCode: 200, url: 'robots.txt' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'valid.xml' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'another-valid.xml' });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([
      'https://example.com/valid.xml',
      'https://example.com/another-valid.xml'
    ]);
  });

  it('should be case-insensitive for "Sitemap:" directive', async () => {
    const robotsContent = `sitemap: https://example.com/lower.xml
SITEMAP: https://example.com/upper.xml
SiteMap: https://example.com/mixed.xml`;
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({ content: robotsContent, statusCode: 200, url: 'robots.txt' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'lower' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'upper' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'mixed' });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toHaveLength(3);
  });

  it('should prioritize robots.txt over standard paths', async () => {
    const robotsContent = 'Sitemap: https://example.com/custom-sitemap.xml';
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({ content: robotsContent, statusCode: 200, url: 'robots.txt' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'custom' });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.source).toBe('robots-txt');
    expect(result.sitemaps).toEqual(['https://example.com/custom-sitemap.xml']);
  });

  it('should fall back to standard paths if robots.txt has no sitemaps', async () => {
    const robotsContent = 'User-agent: *\nDisallow: /admin/';
    
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        return { content: robotsContent, statusCode: 200, url };
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: '<urlset></urlset>', statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.source).toBe('standard-path');
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });
});

describe('discoverSitemaps - recursive traversal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect sitemap index and extract child sitemaps', async () => {
    const indexContent = `<sitemapindex>
  <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
</sitemapindex>`;
    
    const regularContent = '<urlset><url><loc>https://example.com/page1</loc></url></urlset>';
    
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: indexContent, statusCode: 200, url };
      }
      if (url === 'https://example.com/sitemap1.xml' || url === 'https://example.com/sitemap2.xml') {
        return { content: regularContent, statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([
      'https://example.com/sitemap1.xml',
      'https://example.com/sitemap2.xml'
    ]);
  });

  it('should prevent circular references', async () => {
    const indexContent = `<sitemapindex>
  <sitemap><loc>https://example.com/sitemap_index.xml</loc></sitemap>
</sitemapindex>`;
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockRejectedValueOnce(new HttpError('robots.txt', 404))
      .mockResolvedValue({ content: indexContent, statusCode: 200, url: 'index' });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([]);
  });

  it('should handle multi-level sitemap indexes', async () => {
    const index1 = `<sitemapindex>
  <sitemap><loc>https://example.com/index2.xml</loc></sitemap>
</sitemapindex>`;
    
    const index2 = `<sitemapindex>
  <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
</sitemapindex>`;
    
    const regular = '<urlset><url><loc>https://example.com/page1</loc></url></urlset>';
    
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: index1, statusCode: 200, url };
      }
      if (url === 'https://example.com/index2.xml') {
        return { content: index2, statusCode: 200, url };
      }
      if (url === 'https://example.com/sitemap1.xml') {
        return { content: regular, statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/sitemap1.xml']);
  });

  it('should handle failed sitemap fetches gracefully', async () => {
    const robotsContent = `Sitemap: https://example.com/good.xml
Sitemap: https://example.com/bad.xml`;
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({ content: robotsContent, statusCode: 200, url: 'robots.txt' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'good' })
      .mockRejectedValueOnce(new NetworkError('https://example.com/bad.xml', new Error('ECONNREFUSED')));
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/good.xml']);
  });

  it('should handle malformed sitemap index (sitemaps in url blocks instead of sitemap blocks)', async () => {
    // Malformed: uses <urlset> with <url> blocks but contains sitemap URLs
    const malformedIndex = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/sitemap-products.xml</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/sitemap-categories.xml</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/sitemap-pages.xml</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
</urlset>`;

    const regularSitemap = '<urlset><url><loc>https://example.com/page1</loc></url></urlset>';
    
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: malformedIndex, statusCode: 200, url };
      }
      if (url === 'https://example.com/sitemap-products.xml' || 
          url === 'https://example.com/sitemap-categories.xml' ||
          url === 'https://example.com/sitemap-pages.xml') {
        return { content: regularSitemap, statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    // Should detect malformed index and extract all three child sitemaps
    expect(result.sitemaps).toEqual([
      'https://example.com/sitemap-products.xml',
      'https://example.com/sitemap-categories.xml',
      'https://example.com/sitemap-pages.xml',
    ]);
  });
});

describe('discoverSitemaps - gzipped sitemap support', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should discover gzipped sitemap at /sitemap.xml.gz', async () => {
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml.gz') {
        return { content: '<urlset></urlset>', statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml.gz']);
    expect(result.source).toBe('standard-path');
  });

  it('should extract .xml.gz URLs from robots.txt', async () => {
    const robotsContent = `User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml.gz
Sitemap: https://example.com/news/sitemap.xml.gz`;
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({ content: robotsContent, statusCode: 200, url: 'https://example.com/robots.txt' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'https://example.com/sitemap.xml.gz' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'https://example.com/news/sitemap.xml.gz' });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([
      'https://example.com/sitemap.xml.gz',
      'https://example.com/news/sitemap.xml.gz'
    ]);
    expect(result.source).toBe('robots-txt');
  });

  it('should detect .xml.gz files in sitemap index', async () => {
    const indexContent = `<sitemapindex>
  <sitemap><loc>https://example.com/sitemap1.xml.gz</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap2.xml.gz</loc></sitemap>
</sitemapindex>`;
    
    const regularContent = '<urlset><url><loc>https://example.com/page1</loc></url></urlset>';
    
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: indexContent, statusCode: 200, url };
      }
      if (url === 'https://example.com/sitemap1.xml.gz' || url === 'https://example.com/sitemap2.xml.gz') {
        return { content: regularContent, statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([
      'https://example.com/sitemap1.xml.gz',
      'https://example.com/sitemap2.xml.gz'
    ]);
  });

  it('should handle mixed .xml and .xml.gz sitemaps', async () => {
    const robotsContent = `Sitemap: https://example.com/regular.xml
Sitemap: https://example.com/compressed.xml.gz`;
    
    vi.spyOn(httpClient, 'fetchUrl')
      .mockResolvedValueOnce({ content: robotsContent, statusCode: 200, url: 'robots.txt' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'regular.xml' })
      .mockResolvedValueOnce({ content: '<urlset></urlset>', statusCode: 200, url: 'compressed.xml.gz' });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    expect(result.sitemaps).toEqual([
      'https://example.com/regular.xml',
      'https://example.com/compressed.xml.gz'
    ]);
  });

  it('should detect malformed index with .xml.gz URLs', async () => {
    const malformedIndex = `<urlset>
  <url><loc>https://example.com/sitemap-products.xml.gz</loc></url>
  <url><loc>https://example.com/sitemap-categories.xml.gz</loc></url>
</urlset>`;
    
    const regularSitemap = '<urlset><url><loc>https://example.com/product1</loc></url></urlset>';
    
    vi.spyOn(httpClient, 'fetchUrl').mockImplementation(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        throw new HttpError(url, 404);
      }
      if (url === 'https://example.com/sitemap.xml') {
        return { content: malformedIndex, statusCode: 200, url };
      }
      if (url === 'https://example.com/sitemap-products.xml.gz' || 
          url === 'https://example.com/sitemap-categories.xml.gz') {
        return { content: regularSitemap, statusCode: 200, url };
      }
      throw new HttpError(url, 404);
    });
    
    const result = await discoverSitemaps('https://example.com', DEFAULT_CONFIG);
    
    // Should detect malformed index and extract gzipped child sitemaps
    expect(result.sitemaps).toEqual([
      'https://example.com/sitemap-products.xml.gz',
      'https://example.com/sitemap-categories.xml.gz',
    ]);
  });
});
