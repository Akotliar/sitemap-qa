import { Config } from '@/types/config';
import { UrlEntry, parseSitemap } from '@/core/parser';
import { fetchUrl } from '@/utils/http-client';

export interface ExtractionResult {
  allUrls: UrlEntry[]; // All URLs from all sitemaps
  sitemapsProcessed: number; // Number of sitemaps successfully parsed
  sitemapsFailed: number; // Number of sitemaps that failed
  totalUrls: number; // Total URLs extracted
  errors: string[]; // All errors collected
}

export async function extractAllUrls(
  sitemapUrls: string[],
  config: Config,
  onProgress?: (completed: number, total: number) => void
): Promise<ExtractionResult> {
  const allUrls: UrlEntry[] = [];
  const allErrors: string[] = [];
  let sitemapsProcessed = 0;
  let sitemapsFailed = 0;

  if (config.verbose) {
    console.log(`\nExtracting URLs from ${sitemapUrls.length} sitemap(s)...`);
  }

  // Process sitemaps in parallel with configurable concurrency
  const CONCURRENCY = config.parsingConcurrency || 25;  // Optimized for modern CPUs
  const results = await processInBatches(sitemapUrls, CONCURRENCY, async (sitemapUrl, index) => {
    try {
      if (config.verbose) {
        console.log(`Extracting URLs from: ${sitemapUrl}`);
      }

      // Fetch sitemap content
      const response = await fetchUrl(sitemapUrl, {
        timeout: config.timeout,
        maxRetries: 2
      });

      // Parse sitemap XML
      const parseResult = await parseSitemap(response.content, sitemapUrl);

      // Add extraction timestamp to each URL (optimized: single timestamp for batch)
      const extractedAt = new Date().toISOString();
      parseResult.urls.forEach(url => {
        url.extractedAt = extractedAt;
      });

      if (config.verbose) {
        console.log(`  ✓ Extracted ${parseResult.urls.length} URLs from ${sitemapUrl}`);
      }

      // Report progress
      if (onProgress) {
        onProgress(index + 1, sitemapUrls.length);
      }

      return {
        success: true,
        urls: parseResult.urls,
        errors: parseResult.errors,
      };
    } catch (error) {
      const errorMsg = `Failed to process ${sitemapUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`;

      if (config.verbose) {
        console.error(`  ✗ ${errorMsg}`);
      }

      return {
        success: false,
        urls: [],
        errors: [errorMsg],
      };
    }
  });

  // Aggregate results
  for (const result of results) {
    if (result.success) {
      sitemapsProcessed++;
      allUrls.push(...result.urls);
    } else {
      sitemapsFailed++;
    }
    allErrors.push(...result.errors);
  }

  if (config.verbose) {
    console.log(`\nExtraction complete:`);
    console.log(`  - Sitemaps processed: ${sitemapsProcessed}`);
    console.log(`  - Sitemaps failed: ${sitemapsFailed}`);
    console.log(`  - Total URLs: ${allUrls.length}`);
    console.log(`  - Errors: ${allErrors.length}`);
  }

  return {
    allUrls,
    sitemapsProcessed,
    sitemapsFailed,
    totalUrls: allUrls.length,
    errors: allErrors,
  };
}

/**
 * Process items in batches with controlled concurrency
 */
async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => processor(item, i + batchIndex))
    );
    results.push(...batchResults);
  }
  
  return results;
}
