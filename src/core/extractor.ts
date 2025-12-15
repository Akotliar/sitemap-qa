import { Config } from '@/types/config';
import { UrlEntry, parseSitemap } from '@/core/parser';
import { fetchUrl } from '@/utils/http-client';
import { processInBatches } from '@/utils/batch-processor';

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
  const CONCURRENCY = config.parsingConcurrency || 50;  // Optimized for network-bound I/O
  
  if (!config.silent && config.verbose) {
    console.log(`Using parsing concurrency: ${CONCURRENCY}`);
  }
  
  const results = await processInBatches(
    sitemapUrls, 
    CONCURRENCY, 
    async (sitemapUrl) => {
      try {
        if (config.verbose) {
          console.log(`Extracting URLs from: ${sitemapUrl}`);
        }

        // Fetch sitemap content
        const response = await fetchUrl(sitemapUrl, {
          timeout: 10, // Fast timeout for sitemaps
          maxRetries: 0, // No retries - fail fast
          disableBrowserFallback: true // Don't use browser for bulk parsing
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
    },
    onProgress  // Pass progress callback to batch processor
  );

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
