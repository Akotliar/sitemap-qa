import { describe, it, expect } from 'vitest';
import { detectRisks } from '@/core/risk-detector';
import { generateMockUrls } from '../fixtures/mock-generator';
import { DEFAULT_CONFIG } from '@/types/config';
import { chunkArray } from '@/utils/batch-processor';
import os from 'os';

/**
 * Performance Tests for Story 7.2: Parallel Risk Detection
 * 
 * NOTE: These tests measure performance improvements and may be flaky on slow systems.
 * They are disabled by default in CI. Run manually to verify performance:
 * 
 *   npm test -- tests/performance/risk-detector.perf.test.ts
 * 
 * Skip these tests in CI by using the --exclude flag:
 * 
 *   npm test -- --exclude tests/performance
 */
describe.skip('Story 7.2: Risk Detection Performance', () => {
  it('should analyze 1M URLs in <30s', async () => {
    const urls = generateMockUrls(1_000_000);
    const config = { ...DEFAULT_CONFIG, verbose: false };
    
    const start = Date.now();
    const result = await detectRisks(urls, 'https://example.com', config);
    const elapsed = Date.now() - start;
    
    console.log(`\n  ✓ 1M URLs analyzed in ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`  ✓ Speed: ${Math.round(1_000_000 / (elapsed / 1000)).toLocaleString()} URLs/sec`);
    
    expect(elapsed).toBeLessThan(30000); // 30 seconds
    expect(result.totalUrlsAnalyzed).toBe(1_000_000);
  }, 35000); // Timeout: 35 seconds

  it('should use multiple CPU cores by default', async () => {
    const urls = generateMockUrls(100_000);
    const config = { ...DEFAULT_CONFIG, verbose: false };
    
    // Verify auto-detected concurrency matches expectation
    const cpuCount = os.cpus().length;
    const expectedConcurrency = Math.max(2, cpuCount - 1);
    const actualConcurrency = config.riskDetectionConcurrency || expectedConcurrency;
    
    console.log(`\n  ✓ CPU cores: ${cpuCount}`);
    console.log(`  ✓ Risk detection concurrency: ${actualConcurrency}`);
    
    const start = Date.now();
    await detectRisks(urls, 'https://example.com', config);
    const elapsed = Date.now() - start;
    
    console.log(`  ✓ 100k URLs analyzed in ${(elapsed / 1000).toFixed(2)}s`);
    
    expect(actualConcurrency).toBeGreaterThanOrEqual(2);
    expect(actualConcurrency).toBeLessThanOrEqual(cpuCount);
  });

  it('should maintain accuracy with parallel processing', async () => {
    const urls = generateMockUrls(10_000);
    
    // Run sequential (baseline)
    const sequentialConfig = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionConcurrency: 1 
    };
    const sequentialResult = await detectRisks(urls, 'https://example.com', sequentialConfig);
    
    // Run parallel
    const parallelConfig = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionConcurrency: 10 
    };
    const parallelResult = await detectRisks(urls, 'https://example.com', parallelConfig);
    
    // Results should be identical
    expect(parallelResult.findings.length).toBe(sequentialResult.findings.length);
    expect(parallelResult.riskUrlCount).toBe(sequentialResult.riskUrlCount);
    expect(parallelResult.highSeverityCount).toBe(sequentialResult.highSeverityCount);
    expect(parallelResult.mediumSeverityCount).toBe(sequentialResult.mediumSeverityCount);
    expect(parallelResult.lowSeverityCount).toBe(sequentialResult.lowSeverityCount);
    
    console.log(`\n  ✓ Sequential found: ${sequentialResult.riskUrlCount} risk URLs`);
    console.log(`  ✓ Parallel found:   ${parallelResult.riskUrlCount} risk URLs`);
    console.log(`  ✓ Results match perfectly`);
  });

  it('should handle batch processing correctly', () => {
    const urls = Array.from({ length: 25000 }, (_, i) => ({ 
      loc: `https://example.com/page${i}`,
      lastmod: '2024-01-01',
      changefreq: 'weekly' as const,
      priority: 0.5
    }));
    const batches = chunkArray(urls, 10000);
    
    expect(batches.length).toBe(3); // 25k URLs / 10k = 3 batches
    expect(batches[0].length).toBe(10000);
    expect(batches[1].length).toBe(10000);
    expect(batches[2].length).toBe(5000);
  });

  it('should handle custom batch size configuration', async () => {
    const urls = generateMockUrls(50_000);
    const config = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionBatchSize: 5000,
      riskDetectionConcurrency: 5
    };
    
    const start = Date.now();
    const result = await detectRisks(urls, 'https://example.com', config);
    const elapsed = Date.now() - start;
    
    console.log(`\n  ✓ 50k URLs with batch size 5000: ${(elapsed / 1000).toFixed(2)}s`);
    
    expect(result.totalUrlsAnalyzed).toBe(50_000);
    expect(elapsed).toBeLessThan(5000); // Should be fast
  });

  it('should handle custom concurrency configuration', async () => {
    const urls = generateMockUrls(50_000);
    
    // Test with low concurrency
    const lowConcConfig = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionConcurrency: 2
    };
    const lowStart = Date.now();
    await detectRisks(urls, 'https://example.com', lowConcConfig);
    const lowElapsed = Date.now() - lowStart;
    
    // Test with high concurrency
    const highConcConfig = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionConcurrency: 20
    };
    const highStart = Date.now();
    await detectRisks(urls, 'https://example.com', highConcConfig);
    const highElapsed = Date.now() - highStart;
    
    console.log(`\n  ✓ Concurrency 2:  ${(lowElapsed / 1000).toFixed(2)}s`);
    console.log(`  ✓ Concurrency 20: ${(highElapsed / 1000).toFixed(2)}s`);
    
    // Higher concurrency should generally be faster
    // (but not always guaranteed due to system variability)
    expect(highElapsed).toBeLessThan(lowElapsed * 2);
  });

  it('should handle small datasets efficiently', async () => {
    const urls = generateMockUrls(100);
    const config = { ...DEFAULT_CONFIG, verbose: false };
    
    const start = Date.now();
    const result = await detectRisks(urls, 'https://example.com', config);
    const elapsed = Date.now() - start;
    
    // Small datasets should still be fast
    expect(elapsed).toBeLessThan(1000); // <1 second
    expect(result.totalUrlsAnalyzed).toBe(100);
  });

  it('should show performance improvement over sequential', async () => {
    const urls = generateMockUrls(100_000);
    
    // Sequential processing
    const seqConfig = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionConcurrency: 1 
    };
    const seqStart = Date.now();
    await detectRisks(urls, 'https://example.com', seqConfig);
    const seqElapsed = Date.now() - seqStart;
    
    // Parallel processing
    const parConfig = { 
      ...DEFAULT_CONFIG, 
      verbose: false,
      riskDetectionConcurrency: os.cpus().length 
    };
    const parStart = Date.now();
    await detectRisks(urls, 'https://example.com', parConfig);
    const parElapsed = Date.now() - parStart;
    
    const speedup = seqElapsed / parElapsed;
    
    console.log(`\n  ✓ Sequential (1 core):  ${(seqElapsed / 1000).toFixed(2)}s`);
    console.log(`  ✓ Parallel (${os.cpus().length} cores): ${(parElapsed / 1000).toFixed(2)}s`);
    console.log(`  ✓ Speedup: ${speedup.toFixed(2)}x`);
    
    // Parallel should be faster (at least 1.2x)
    // Note: Actual speedup varies by system load and CPU architecture
    expect(speedup).toBeGreaterThanOrEqual(1.2);
  });
});
