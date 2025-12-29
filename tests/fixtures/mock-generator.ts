/**
 * Utility to generate mock sitemaps for performance testing
 */

import type { SitemapUrl } from '@/types/sitemap';

export interface MockSitemapData {
  url: string;
  content: string;
}

/**
 * Generate mock sitemap XML content
 */
export function generateMockSitemapXml(urlCount: number, sitemapIndex: number): string {
  const urls: string[] = [];
  
  for (let i = 0; i < urlCount; i++) {
    urls.push(`    <url>
      <loc>https://example.com/sitemap-${sitemapIndex}/page-${i}.html</loc>
      <lastmod>2025-12-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}</lastmod>
      <changefreq>daily</changefreq>
      <priority>${(Math.random()).toFixed(1)}</priority>
    </url>`);
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Generate array of mock sitemap URLs
 */
export function generateMockSitemapUrls(count: number): string[] {
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    urls.push(`https://example.com/sitemap-${i}.xml`);
  }
  return urls;
}

/**
 * Generate array of mock sitemaps with content
 */
export function generateMockSitemaps(sitemapCount: number, urlsPerSitemap: number): MockSitemapData[] {
  const sitemaps: MockSitemapData[] = [];
  
  for (let i = 0; i < sitemapCount; i++) {
    sitemaps.push({
      url: `https://example.com/sitemap-${i}.xml`,
      content: generateMockSitemapXml(urlsPerSitemap, i),
    });
  }
  
  return sitemaps;
}

/**
 * Generate array of mock URL entries for testing
 * Useful for risk detection and other URL processing tests
 */
export function generateMockUrls(count: number): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  
  for (let i = 0; i < count; i++) {
    const urlIndex = i % 10; // Create some variety in URLs
    
    // Mix of different URL patterns
    let loc: string;
    if (urlIndex === 0) {
      loc = `https://example.com/admin/page-${i}.html`;
    } else if (urlIndex === 1) {
      loc = `https://example.com/staging/page-${i}.html`;
    } else if (urlIndex === 2) {
      loc = `http://example.com/page-${i}.html`; // HTTP (protocol issue)
    } else if (urlIndex === 3) {
      loc = `https://example.com/api/users/${i}?token=secret123`;
    } else {
      loc = `https://example.com/page-${i}.html`;
    }
    
    urls.push({
      loc,
      lastmod: '2025-12-12',
      changefreq: 'weekly',
      priority: '0.5',
      source: 'https://example.com/sitemap.xml',
      risks: []
    });
  }
  
  return urls;
}
