import { Config } from '@/types/config';
import { fetchUrl } from '@/utils/http-client';
import { HttpError } from '@/errors/network-errors';

export interface SitemapAccessIssue {
  url: string;
  statusCode: number;
  error: string;
}

export interface DiscoveryResult {
  sitemaps: string[];
  source: 'standard-path' | 'robots-txt' | 'none';
  accessIssues: SitemapAccessIssue[];
}

/**
 * Attempts to find sitemaps at standard paths, including both uncompressed and gzipped variants.
 * Checks: /sitemap.xml, /sitemap.xml.gz, /sitemap_index.xml, /sitemap_index.xml.gz, 
 * /sitemap-index.xml, /sitemap-index.xml.gz
 * 
 * Tries all paths concurrently for fast discovery.
 * 
 * @param baseUrl - The base URL of the website (origin only)
 * @param config - Configuration object containing timeout and verbose settings
 * @returns Object containing found sitemaps and any access issues (401/403 errors)
 */
async function tryStandardPaths(
  baseUrl: string,
  config: Config
): Promise<{ sitemaps: string[]; issues: SitemapAccessIssue[] }> {
  const baseDomain = new URL(baseUrl).origin;
  const accessIssues: SitemapAccessIssue[] = [];
  
  const standardPaths = [
    '/sitemap.xml',
    '/sitemap.xml.gz',
    '/sitemap_index.xml',
    '/sitemap_index.xml.gz',
    '/sitemap-index.xml',
    '/sitemap-index.xml.gz'
  ];
  
  // Try all standard paths concurrently
  const results = await Promise.allSettled(
    standardPaths.map(async (path) => {
      const sitemapUrl = `${baseDomain}${path}`;
      
      try {
        const result = await fetchUrl(sitemapUrl, { 
          timeout: config.timeout,
          maxRetries: 0  // Don't retry on standard paths - fail fast
        });
        
        if (result.statusCode === 200) {
          if (config.verbose) {
            console.log(`✓ Found sitemap at: ${sitemapUrl}`);
          }
          return { found: true, url: sitemapUrl };
        }
        return { found: false };
      } catch (error) {
        if (error instanceof HttpError) {
          // Track 401/403 as access issues
          if (error.statusCode === 401 || error.statusCode === 403) {
            accessIssues.push({
              url: sitemapUrl,
              statusCode: error.statusCode,
              error: error.statusCode === 401 ? 'Unauthorized' : 'Access Denied'
            });
            
            if (config.verbose) {
              console.log(`⚠ Access denied: ${sitemapUrl} (${error.statusCode})`);
            }
          } else if (config.verbose) {
            console.log(`✗ Not found: ${sitemapUrl} (${error.statusCode})`);
          }
        } else if (config.verbose) {
          console.log(`✗ Not found: ${sitemapUrl}`);
        }
        return { found: false };
      }
    })
  );
  
  // Find the first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.found) {
      return { sitemaps: [result.value.url!], issues: accessIssues };
    }
  }
  
  if (config.verbose) {
    console.log('No sitemap found at standard paths');
  }
  
  return { sitemaps: [], issues: accessIssues };
}

/**
 * Parses robots.txt file to extract sitemap URLs from 'Sitemap:' directives.
 * Validates that extracted URLs are valid before returning them.
 * 
 * @param baseUrl - The base URL of the website (origin only)
 * @param config - Configuration object containing timeout and verbose settings
 * @returns Array of sitemap URLs found in robots.txt, or empty array if none found
 */
async function parseRobotsTxt(
  baseUrl: string,
  config: Config
): Promise<string[]> {
  const robotsUrl = `${new URL(baseUrl).origin}/robots.txt`;
  
  try {
    const result = await fetchUrl(robotsUrl, {
      timeout: config.timeout,
      maxRetries: 1
    });
    
    const lines = result.content.split('\n');
    const sitemaps: string[] = [];
    
    for (const line of lines) {
      const match = line.match(/^Sitemap:\s*(.+)$/i);
      if (match) {
        const sitemapUrl = match[1].trim();
        
        try {
          new URL(sitemapUrl);
          sitemaps.push(sitemapUrl);
        } catch {
          if (config.verbose) {
            console.warn(`Invalid sitemap URL in robots.txt: ${sitemapUrl}`);
          }
        }
      }
    }
    
    if (config.verbose && sitemaps.length > 0) {
      console.log(`Found ${sitemaps.length} sitemap(s) in robots.txt`);
    }
    
    return sitemaps;
    
  } catch (error) {
    if (config.verbose) {
      console.log(`No robots.txt found at ${robotsUrl}`);
    }
    return [];
  }
}

/**
 * Determines if XML content is a sitemap index (contains references to other sitemaps).
 * Handles both standard <sitemapindex> format and malformed <urlset> format.
 * 
 * For malformed indices (using <urlset> instead of <sitemapindex>), uses a heuristic:
 * checks if the majority of the first 5 URLs end in .xml/.xml.gz or contain 'sitemap'.
 * 
 * @param xmlContent - Raw XML content of the sitemap
 * @returns true if content is a sitemap index, false if it's a regular sitemap
 */
function isSitemapIndex(xmlContent: string): boolean {
  // Check for proper sitemapindex format
  if (xmlContent.includes('<sitemapindex')) {
    return true;
  }
  
  // Check for malformed format: urlset containing sitemap URLs
  // This is a heuristic - if we see multiple URLs ending in .xml or containing 'sitemap'
  // within the first few URL entries, it's likely a malformed sitemap index
  if (xmlContent.includes('<urlset')) {
    const urlBlockRegex = /<url[^>]*>.*?<loc>([^<]+)<\/loc>.*?<\/url>/gs;
    const matches = Array.from(xmlContent.matchAll(urlBlockRegex));
    
    // Check first 5 URLs (or all if less than 5)
    const samplesToCheck = Math.min(5, matches.length);
    let sitemapLikeCount = 0;
    
    for (let i = 0; i < samplesToCheck; i++) {
      const url = matches[i][1].trim().toLowerCase();
      if (url.includes('sitemap') || url.endsWith('.xml') || url.endsWith('.xml.gz')) {
        sitemapLikeCount++;
      }
    }
    
    // If majority of sampled URLs look like sitemaps, treat as malformed index
    return sitemapLikeCount > samplesToCheck / 2;
  }
  
  return false;
}

/**
 * Extracts sitemap URLs from a sitemap index file.
 * Handles both standard and malformed formats:
 * 1. Standard: <sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>
 * 2. Malformed: <urlset><url><loc>sitemap.xml</loc></url></urlset>
 * 
 * For malformed indices, only extracts URLs that look like sitemaps 
 * (contain 'sitemap' or end in .xml/.xml.gz).
 * Validates all URLs before returning them.
 * 
 * @param xmlContent - Raw XML content of the sitemap index
 * @returns Array of valid sitemap URLs extracted from the index
 */
function extractSitemapIndexUrls(xmlContent: string): string[] {
  const urls: string[] = [];
  
  // For proper sitemapindex format: extract from <sitemap> blocks only
  if (xmlContent.includes('<sitemapindex')) {
    const sitemapBlockRegex = /<sitemap[^>]*>(.*?)<\/sitemap>/gs;
    let sitemapMatch;
    
    while ((sitemapMatch = sitemapBlockRegex.exec(xmlContent)) !== null) {
      const locMatch = /<loc>([^<]+)<\/loc>/i.exec(sitemapMatch[1]);
      if (locMatch) {
        const url = locMatch[1].trim();
        try {
          new URL(url);
          urls.push(url);
        } catch {
          // Invalid URL - skip
        }
      }
    }
  } else {
    // For malformed sitemap (urlset format but contains sitemap URLs)
    // Extract all <loc> tags from <url> blocks and check if they look like sitemaps
    const urlBlockRegex = /<url[^>]*>(.*?)<\/url>/gs;
    let urlMatch;
    
    while ((urlMatch = urlBlockRegex.exec(xmlContent)) !== null) {
      const locMatch = /<loc>([^<]+)<\/loc>/i.exec(urlMatch[1]);
      if (locMatch) {
        const url = locMatch[1].trim();
        
        // Check if this URL looks like a sitemap (ends with .xml, .xml.gz, or contains 'sitemap')
        if (url.toLowerCase().includes('sitemap') || 
            url.toLowerCase().endsWith('.xml') || 
            url.toLowerCase().endsWith('.xml.gz')) {
          try {
            new URL(url);
            urls.push(url);
          } catch {
            // Invalid URL - skip
          }
        }
      }
    }
  }
  
  return urls;
}

/**
 * Recursively discovers all sitemaps by following sitemap index references.
 * Processes sitemaps in batches for performance, avoiding duplicate processing.
 * 
 * Algorithm:
 * 1. Fetch each sitemap URL
 * 2. If it's a sitemap index, extract child URLs and add to processing queue
 * 3. If it's a regular sitemap, add to final results
 * 4. Repeat until all sitemaps are processed or limit reached (1000 max)
 * 
 * @param initialSitemaps - Array of sitemap URLs to start discovery from
 * @param config - Configuration object containing timeout, retry, and concurrency settings
 * @returns Array of all discovered regular sitemap URLs (excludes indices)
 */
async function discoverAllSitemaps(
  initialSitemaps: string[],
  config: Config
): Promise<{ sitemaps: string[]; issues: SitemapAccessIssue[] }> {
  const finalSitemaps: string[] = [];
  const accessIssues: SitemapAccessIssue[] = [];
  const toProcess = [...initialSitemaps];
  const processed = new Set<string>();
  const inaccessible = new Set<string>();
  const BATCH_SIZE = config.discoveryConcurrency || 50;
  
  while (toProcess.length > 0) {
    // Take a batch of URLs to process concurrently
    const batch = toProcess.splice(0, Math.min(BATCH_SIZE, toProcess.length));
    
    // Process batch and collect results atomically
    const batchResults = await Promise.all(batch.map(async (sitemapUrl) => {
      if (processed.has(sitemapUrl)) {
        if (config.verbose) {
          console.warn(`Skipping duplicate sitemap: ${sitemapUrl}`);
        }
        return { type: 'skip' as const };
      }
      
      processed.add(sitemapUrl);
      
      try {
        const result = await fetchUrl(sitemapUrl, {
          timeout: config.timeout,
          maxRetries: 2
        });
        
        if (isSitemapIndex(result.content)) {
          if (config.verbose) {
            console.log(`Found sitemap index: ${sitemapUrl}`);
          }
          
          const childUrls = extractSitemapIndexUrls(result.content);
          
          if (config.verbose) {
            console.log(`  └─ Contains ${childUrls.length} child sitemap(s)`);
          }
          
          return { type: 'index' as const, childUrls };
        } else {
          if (config.verbose) {
            console.log(`✓ Discovered sitemap: ${sitemapUrl}`);
          }
          
          return { type: 'sitemap' as const, url: sitemapUrl };
        }
        
      } catch (error) {
        inaccessible.add(sitemapUrl);
        
        if (error instanceof HttpError && (error.statusCode === 401 || error.statusCode === 403)) {
          accessIssues.push({
            url: sitemapUrl,
            statusCode: error.statusCode,
            error: error.statusCode === 401 ? 'Unauthorized' : 'Access Denied'
          });
        }
        
        if (config.verbose) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to fetch sitemap ${sitemapUrl}: ${message}`);
        }
        
        return { type: 'failed' as const };
      }
    }));
    
    // Process results atomically after all promises complete
    for (const result of batchResults) {
      if (result.type === 'index') {
        for (const url of result.childUrls) {
          toProcess.push(url);
        }
      } else if (result.type === 'sitemap') {
        finalSitemaps.push(result.url);
      }
    }
    
    // Safety check
    const maxSitemaps = config.maxSitemaps || 1000;
    if (processed.size > maxSitemaps) {
      console.warn(`⚠️  Processed over ${maxSitemaps} sitemap URLs. Stopping to prevent excessive requests.`);
      break;
    }
  }
  
  if (finalSitemaps.length === 0 && inaccessible.size > 0) {
    if (config.verbose) {
      console.warn(`\n⚠️  All ${inaccessible.size} sitemap(s) were inaccessible`);
      console.warn(`Common causes: 403/404 errors, network issues, or bot protection`);
    }
  }
  
  return { sitemaps: finalSitemaps, issues: accessIssues };
}

/**
 * Main sitemap discovery function. Uses multiple strategies to find sitemaps for a website.
 * 
 * Strategy 1: Check robots.txt for 'Sitemap:' directives (preferred method)
 * Strategy 2: Try standard paths (/sitemap.xml, /sitemap_index.xml, /sitemap-index.xml)
 * 
 * For each strategy, recursively follows sitemap indices to discover all sitemaps.
 * Returns immediately when sitemaps are found via any strategy.
 * 
 * Note: Axios automatically follows redirects (e.g., www vs non-www, HTTP to HTTPS),
 * so domain variants are handled transparently.
 * 
 * @param baseUrl - The base URL of the website to analyze (e.g., 'https://example.com')
 * @param config - Configuration object containing timeout, retry, verbosity, and concurrency settings
 * @returns DiscoveryResult containing found sitemaps, discovery source, and any access issues
 */
export async function discoverSitemaps(
  baseUrl: string,
  config: Config
): Promise<DiscoveryResult> {
  const normalizedUrl = new URL(baseUrl).origin;
  
  // Strategy 1: Try robots.txt first
  if (config.verbose) {
    console.log('Checking robots.txt for sitemap directives...');
  }
  
  const robotsSitemaps = await parseRobotsTxt(normalizedUrl, config);
  if (robotsSitemaps.length > 0) {
    const { sitemaps, issues } = await discoverAllSitemaps(robotsSitemaps, config);
    return {
      sitemaps,
      source: 'robots-txt',
      accessIssues: issues
    };
  }
  
  // Strategy 2: Try standard paths as fallback
  if (config.verbose) {
    console.log('Trying standard sitemap paths...');
  }
  
  const { sitemaps: standardSitemaps, issues: standardIssues } = await tryStandardPaths(normalizedUrl, config);
  if (standardSitemaps.length > 0) {
    const { sitemaps, issues } = await discoverAllSitemaps(standardSitemaps, config);
    if (sitemaps.length > 0) {
      return {
        sitemaps,
        source: 'standard-path',
        accessIssues: issues
      };
    }

    // Standard sitemap paths were found but all sitemaps were inaccessible
    return {
      sitemaps: [],
      source: 'standard-path',
      accessIssues: issues.length > 0 ? issues : standardIssues
    };
  }
  
  // No sitemaps found. If all standard paths were blocked, report it as a single issue
  // to avoid confusing the user with "6 sitemaps blocked" when we were just guessing.
  let finalIssues = standardIssues;
  if (standardIssues.length === 6 && standardIssues.every(i => i.statusCode === 403)) {
    finalIssues = [{
      url: `${normalizedUrl}/sitemap.xml (and others)`,
      statusCode: 403,
      error: 'Access Denied (Site likely blocking bots)'
    }];
  }

  return {
    sitemaps: [],
    source: 'none',
    accessIssues: finalIssues
  };
}
