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

async function tryStandardPaths(
  baseUrl: string,
  config: Config
): Promise<{ sitemaps: string[]; issues: SitemapAccessIssue[] }> {
  const baseDomain = new URL(baseUrl).origin;
  const accessIssues: SitemapAccessIssue[] = [];
  
  const standardPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml'
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
      if (url.includes('sitemap') || url.endsWith('.xml')) {
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
 * Handles both:
 * 1. Proper format: <sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>
 * 2. Malformed format: <urlset><url><loc>sitemap.xml</loc></url></urlset>
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
        
        // Check if this URL looks like a sitemap (ends with .xml or contains 'sitemap')
        if (url.toLowerCase().includes('sitemap') || url.toLowerCase().endsWith('.xml')) {
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

async function discoverAllSitemaps(
  initialSitemaps: string[],
  config: Config
): Promise<string[]> {
  const finalSitemaps: string[] = [];
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
        toProcess.push(...result.childUrls);
      } else if (result.type === 'sitemap') {
        finalSitemaps.push(result.url);
      }
    }
    
    // Safety check
    if (processed.size > 1000) {
      console.warn(`⚠️  Processed over 1000 sitemap URLs. Stopping to prevent excessive requests.`);
      break;
    }
  }
  
  if (finalSitemaps.length === 0 && inaccessible.size > 0) {
    console.warn(`\n⚠️  All ${inaccessible.size} sitemap(s) were inaccessible`);
    console.warn(`Common causes: 403/404 errors, network issues, or bot protection`);
  }
  
  return finalSitemaps;
}

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
    const sitemaps = await discoverAllSitemaps(robotsSitemaps, config);
    if (sitemaps.length > 0) {
      return {
        sitemaps,
        source: 'robots-txt',
        accessIssues: []
      };
    }
  }
  
  // Strategy 2: Try standard paths as fallback
  if (config.verbose) {
    console.log('Trying standard sitemap paths...');
  }
  
  const { sitemaps: standardSitemaps, issues } = await tryStandardPaths(normalizedUrl, config);
  if (standardSitemaps.length > 0) {
    const sitemaps = await discoverAllSitemaps(standardSitemaps, config);
    if (sitemaps.length > 0) {
      return {
        sitemaps,
        source: 'standard-path',
        accessIssues: []
      };
    }
  }
  
  // No sitemaps found
  return {
    sitemaps: [],
    source: 'none',
    accessIssues: issues
  };
}
