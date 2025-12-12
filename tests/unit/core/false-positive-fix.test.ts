import { describe, it, expect } from 'vitest';
import { detectRisks } from '@/core/risk-detector';
import { UrlEntry } from '@/core/parser';
import { DEFAULT_CONFIG } from '@/types/config';

describe('False Positive Fix - Content URLs', () => {
  it('should NOT flag URLs with "development" in content context', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://www.example.com/insights/learn/what-does-app-development-teach-us-about-human-connection/', source: 'sitemap.xml' },
      { loc: 'https://www.example.com/web-development-services/', source: 'sitemap.xml' },
      { loc: 'https://www.example.com/software-development/', source: 'sitemap.xml' },
      { loc: 'https://www.example.com/career-development/', source: 'sitemap.xml' },
    ];
    
    const result = await detectRisks(urls, 'https://www.example.com', DEFAULT_CONFIG);
    
    expect(result.findings).toHaveLength(0);
    expect(result.riskUrlCount).toBe(0);
  });

  it('should STILL flag actual development environments', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://dev.example.com/insights/', source: 'sitemap.xml' },
      { loc: 'https://development.example.com/', source: 'sitemap.xml' },
      { loc: 'https://www.example.com/development/', source: 'sitemap.xml' },  // Standalone path segment
    ];
    
    const result = await detectRisks(urls, 'https://www.example.com', DEFAULT_CONFIG);
    
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.riskUrlCount).toBeGreaterThan(0);
  });
});
