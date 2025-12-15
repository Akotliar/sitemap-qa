import { describe, it, expect } from 'vitest';
import { detectRisks } from '@/core/risk-detector';
import { DEFAULT_CONFIG } from '@/types/config';
import type { UrlEntry } from '@/core/parser';

/**
 * Unit tests for parallel risk detection functionality
 * These tests verify correctness, not performance
 */
describe('Risk Detector - Parallel Processing', () => {
  const mockUrls: UrlEntry[] = [
    { loc: 'https://example.com/page1.html', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
    { loc: 'https://example.com/admin/dashboard', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
    { loc: 'http://example.com/insecure.html', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
    { loc: 'https://example.com/staging/test', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
  ];

  it('should produce identical results with sequential and parallel processing', async () => {
    const baseUrl = 'https://example.com';
    
    // Sequential (concurrency: 1)
    const seqConfig = { ...DEFAULT_CONFIG, verbose: false, riskDetectionConcurrency: 1 };
    const seqResult = await detectRisks(mockUrls, baseUrl, seqConfig);
    
    // Parallel (concurrency: 4)
    const parConfig = { ...DEFAULT_CONFIG, verbose: false, riskDetectionConcurrency: 4 };
    const parResult = await detectRisks(mockUrls, baseUrl, parConfig);
    
    // Verify identical results
    expect(parResult.findings.length).toBe(seqResult.findings.length);
    expect(parResult.riskUrlCount).toBe(seqResult.riskUrlCount);
    expect(parResult.highSeverityCount).toBe(seqResult.highSeverityCount);
    expect(parResult.mediumSeverityCount).toBe(seqResult.mediumSeverityCount);
    expect(parResult.lowSeverityCount).toBe(seqResult.lowSeverityCount);
  });

  it('should respect custom batch size configuration', async () => {
    const urls = Array.from({ length: 1000 }, (_, i) => ({
      loc: `https://example.com/page${i}.html`,
      source: 'sitemap.xml',
      lastmod: '2024-01-01',
      changefreq: 'weekly' as const,
      priority: 0.5
    }));
    
    const config = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionBatchSize: 100 // Small batches
    };
    
    const result = await detectRisks(urls, 'https://example.com', config);
    
    expect(result.totalUrlsAnalyzed).toBe(1000);
  });

  it('should respect custom concurrency configuration', async () => {
    const urls = Array.from({ length: 100 }, (_, i) => ({
      loc: `https://example.com/page${i}.html`,
      source: 'sitemap.xml',
      lastmod: '2024-01-01',
      changefreq: 'weekly' as const,
      priority: 0.5
    }));
    
    // Test with different concurrency levels
    const config1 = { ...DEFAULT_CONFIG, verbose: false, riskDetectionConcurrency: 1 };
    const config2 = { ...DEFAULT_CONFIG, verbose: false, riskDetectionConcurrency: 10 };
    
    const result1 = await detectRisks(urls, 'https://example.com', config1);
    const result2 = await detectRisks(urls, 'https://example.com', config2);
    
    // Results should be identical regardless of concurrency
    expect(result1.totalUrlsAnalyzed).toBe(result2.totalUrlsAnalyzed);
    expect(result1.riskUrlCount).toBe(result2.riskUrlCount);
  });

  it('should handle empty URL list', async () => {
    const config = { ...DEFAULT_CONFIG, verbose: false };
    const result = await detectRisks([], 'https://example.com', config);
    
    expect(result.totalUrlsAnalyzed).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.riskUrlCount).toBe(0);
  });

  it('should handle single URL', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/login', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 }
    ];
    
    const config = { ...DEFAULT_CONFIG, verbose: false };
    const result = await detectRisks(urls, 'https://example.com', config);
    
    expect(result.totalUrlsAnalyzed).toBe(1);
    expect(result.riskUrlCount).toBeGreaterThan(0); // Admin path should be flagged
  });

  it('should use default concurrency when not specified', async () => {
    const urls = Array.from({ length: 50 }, (_, i) => ({
      loc: `https://example.com/page${i}.html`,
      source: 'sitemap.xml',
      lastmod: '2024-01-01',
      changefreq: 'weekly' as const,
      priority: 0.5
    }));
    
    const config = { ...DEFAULT_CONFIG, verbose: false };
    // riskDetectionConcurrency should auto-detect from CPU cores
    
    const result = await detectRisks(urls, 'https://example.com', config);
    
    expect(result.totalUrlsAnalyzed).toBe(50);
  });

  it('should maintain finding order consistency', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/users', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
      { loc: 'https://example.com/staging/test', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
      { loc: 'http://example.com/insecure', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
    ];
    
    const config = { ...DEFAULT_CONFIG, verbose: false, riskDetectionConcurrency: 3 };
    
    // Run multiple times to check for consistency
    const result1 = await detectRisks(urls, 'https://example.com', config);
    const result2 = await detectRisks(urls, 'https://example.com', config);
    
    // Findings count should be consistent
    expect(result2.findings.length).toBe(result1.findings.length);
    expect(result2.riskUrlCount).toBe(result1.riskUrlCount);
  });

  it('should handle large batches correctly', async () => {
    const urls = Array.from({ length: 5000 }, (_, i) => ({
      loc: `https://example.com/page${i}.html`,
      source: 'sitemap.xml',
      lastmod: '2024-01-01',
      changefreq: 'weekly' as const,
      priority: 0.5
    }));
    
    const config = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionBatchSize: 1000,
      riskDetectionConcurrency: 5
    };
    
    const result = await detectRisks(urls, 'https://example.com', config);
    
    expect(result.totalUrlsAnalyzed).toBe(5000);
    // Should complete without errors
  });

  it('should respect accepted patterns in parallel processing', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/users', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
      { loc: 'https://example.com/admin/settings', source: 'sitemap.xml', lastmod: '2024-01-01', changefreq: 'weekly', priority: 0.5 },
    ];
    
    const config = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionConcurrency: 2,
      acceptedPatterns: ['/admin/*'] // Accept admin paths
    };
    
    const result = await detectRisks(urls, 'https://example.com', config);
    
    // Admin URLs should be excluded from risk findings
    expect(result.riskUrlCount).toBe(0);
  });
});
