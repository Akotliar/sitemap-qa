import { Config } from '@/types/config';
import { fetchUrl } from '@/utils/http-client';
import { HttpError, NetworkError } from '@/errors/network-errors';

export interface SitemapAccessIssue {
  url: string;
  statusCode: number;
  error: string;
}

export interface DiscoveryResult {
  sitemaps: string[];
  source: 'standard-path' | 'robots-txt' | 'none';
  accessIssues: SitemapAccessIssue[];  // Track sitemaps that exist but are inaccessible
  canonicalDomain?: string;  
}

function normalizeBaseUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.origin;
}

/**
 * Detect the canonical domain by checking which version (www vs non-www) is final.
 * Makes a HEAD request and follows redirects to determine the canonical version.
 */
async function detectCanonicalDomain(baseUrl: string, config: Config): Promise<string> {
  const urlObj = new URL(baseUrl);
  const hasWww = urlObj.hostname.startsWith('www.');
  
  // Try the opposite version to see which one works
  const alternateHostname = hasWww 
    ? urlObj.hostname.substring(4)  // Remove 'www.'
    : `www.${urlObj.hostname}`;      // Add 'www.'
  
  const alternateUrl = `${urlObj.protocol}//${alternateHostname}/robots.txt`;
  
  try {
    // Try to fetch robots.txt from the alternate version
    const result = await fetchUrl(alternateUrl, {
      timeout: config.timeout,
      maxRetries: 1
    });
    
    // If alternate version succeeds (200 or 404), it's accessible - use it as canonical
    if (result.statusCode === 200 || result.statusCode === 404) {
      return alternateHostname;
    }
    
    // Otherwise, current version is probably canonical
    return urlObj.hostname;
    
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 301) {
      // Alternate redirects back, current version is canonical
      return urlObj.hostname;
    }
    
    // If alternate fails, current version is canonical
    return urlObj.hostname;
  }
}

async function tryStandardPaths(
  baseUrl: string,
  config: Config
): Promise<{ sitemaps: string[]; issues: SitemapAccessIssue[]; redirectedToCanonical?: string }> {
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
  config: Config,
  baseUrl: string,
  canonicalDomain?: string,  // Optional - will be detected on first 301 if needed
  _maxDepth: number = 10
): Promise<{ sitemaps: string[]; canonicalDomain?: string }> {
  const finalSitemaps: string[] = [];
  const toProcess = [...initialSitemaps];
  const processed = new Set<string>();
  const failed = new Set<string>();
  const redirected = new Set<string>();
  let detectedCanonical = canonicalDomain;
  const BATCH_SIZE = config.discoveryConcurrency || 50; // Configurable concurrent processing
  
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
        // Track failures
        if (error instanceof HttpError && error.statusCode === 301) {
          redirected.add(sitemapUrl);
          
          if (config.verbose) {
            if (!detectedCanonical) {
              detectedCanonical = await detectCanonicalDomain(baseUrl, config);
              if (config.verbose) {
                console.log(`Canonical domain detected: ${detectedCanonical}`);
              }
            }
            
            try {
              const sitemapUrlObj = new URL(sitemapUrl);
              
              if (sitemapUrlObj.hostname !== detectedCanonical) {
                console.warn(`⚠️  Sitemap URL redirects (301): ${sitemapUrl}`);
                console.warn(`   Problem: The sitemap index contains a URL that redirects.`);
                console.warn(`   Likely issue: Domain mismatch - expected "${detectedCanonical}" but got "${sitemapUrlObj.hostname}"`);
                console.warn(`   Fix: Update sitemap index to use "https://${detectedCanonical}${sitemapUrlObj.pathname}"`);
              } else {
                console.warn(`⚠️  Sitemap URL redirects (301): ${sitemapUrl}`);
                console.warn(`   Fix: Update the sitemap index to reference the final URL after redirect.`);
              }
            } catch {
              const message = error instanceof Error ? error.message : String(error);
              console.warn(`Failed to fetch sitemap ${sitemapUrl}: ${message}`);
            }
          }
          
          return { type: 'redirect' as const };
        } else {
          failed.add(sitemapUrl);
          
          if (config.verbose) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to fetch sitemap ${sitemapUrl}: ${message}`);
          }
          
          return { type: 'failed' as const };
        }
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
  
  // Provide helpful feedback about sitemap discovery results
  const totalProcessed = processed.size;
  const totalFailed = failed.size;
  const totalRedirected = redirected.size;
  const sitemapIndexCount = totalProcessed - finalSitemaps.length - totalFailed - totalRedirected;
  
  if (finalSitemaps.length === 0 && totalProcessed > 0) {
    console.warn(`\n⚠️  SITEMAP DISCOVERY ISSUE`);
    
    if (sitemapIndexCount > 0 && (totalFailed > 0 || totalRedirected > 0)) {
      console.warn(`Found ${sitemapIndexCount} sitemap index(es) containing ${totalFailed + totalRedirected} child sitemap(s):`);
      if (totalRedirected > 0) {
        console.warn(`  - ${totalRedirected} sitemap(s) return 301 redirects (content not accessible without following redirect)`);
      }
      if (totalFailed > 0) {
        console.warn(`  - ${totalFailed} sitemap(s) returned errors (404, 403, 500, or network issues)`);
      }
    } else if (totalRedirected > 0) {
      console.warn(`All ${totalRedirected} sitemap(s) return 301 redirects.`);
    } else if (totalFailed > 0) {
      console.warn(`All ${totalFailed} sitemap(s) returned errors.`);
      console.warn(`\nCommon causes:`);
      console.warn(`  - 403 Forbidden: Bot protection (Cloudflare, etc.) or IP blocking`);
      console.warn(`  - 404 Not Found: Sitemaps don't exist at these URLs`);
      console.warn(`  - 500/502/503: Server errors or maintenance`);
      console.warn(`\nIf sitemaps work in your browser but not here, the site likely has bot protection.`);
      console.warn(`Try: Check if sitemaps load without JavaScript, or contact site administrator.`);
    } else {
      console.warn(`Processed ${totalProcessed} URL(s) but found no accessible sitemaps.`);
    }
    
    console.warn(`\nNote: This tool does not follow redirects for sitemap URLs.`);
    if (totalRedirected > 0) {
      console.warn(`\nPossible causes of redirects:`);
      console.warn(`  - Sitemap index uses non-canonical domain (e.g., missing 'www' or vice versa)`);
      console.warn(`  - Sitemap URLs redirect from HTTP to HTTPS`);
      console.warn(`  - Intentional redirects in your site configuration`);
      console.warn(`\nRecommendation: Update sitemap index URLs to match the final destination (no redirects).`);
    }
    console.warn(``);
  }
  
  return { sitemaps: finalSitemaps, canonicalDomain: detectedCanonical };
}

export async function discoverSitemaps(
  baseUrl: string,
  config: Config
): Promise<DiscoveryResult> {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  let allAccessIssues: SitemapAccessIssue[] = [];
  
  // Canonical domain will be detected lazily if we encounter redirects
  let canonicalDomain: string | undefined;
  
  // Strategy 1: Try robots.txt first
  if (config.verbose) {
    console.log('Strategy 1: Checking robots.txt for sitemap directives...');
  }
  
  const robotsSitemaps = await parseRobotsTxt(normalizedUrl, config);
  if (robotsSitemaps.length > 0) {
    const { sitemaps: allSitemaps, canonicalDomain: detected } = await discoverAllSitemaps(robotsSitemaps, config, normalizedUrl, canonicalDomain);
    canonicalDomain = detected;  // Update if it was detected during traversal
    
    // If we successfully found sitemaps via robots.txt, don't report
    // standard path access issues as critical (they're just alternatives)
    return {
      sitemaps: allSitemaps,
      source: 'robots-txt',
      accessIssues: [],  // Clear access issues since we found working sitemaps
      canonicalDomain
    };
  }
  
  // Strategy 2: Try standard paths as fallback
  if (config.verbose) {
    console.log('Strategy 2: Trying standard sitemap paths...');
  }
  
  const { sitemaps: standardSitemaps, issues, redirectedToCanonical } = await tryStandardPaths(normalizedUrl, config);
  allAccessIssues = issues;
  
  if (standardSitemaps.length > 0) {
    const { sitemaps: allSitemaps, canonicalDomain: detected } = await discoverAllSitemaps(standardSitemaps, config, normalizedUrl, canonicalDomain);
    canonicalDomain = detected;  // Update if it was detected during traversal
    return {
      sitemaps: allSitemaps,
      source: 'standard-path',
      accessIssues: [],  // Clear access issues since we found working sitemaps
      canonicalDomain
    };
  }
  
  // Strategy 3: If all requests redirected, try the canonical domain
  if (redirectedToCanonical) {
    const canonicalUrl = `https://${redirectedToCanonical}`;
    console.log(`\n💡 All requests redirected. Retrying with canonical domain: ${redirectedToCanonical}\n`);
    
    // Try robots.txt on canonical domain
    const canonicalRobotsSitemaps = await parseRobotsTxt(canonicalUrl, config);
    if (canonicalRobotsSitemaps.length > 0) {
      const { sitemaps: allSitemaps, canonicalDomain: detected } = await discoverAllSitemaps(canonicalRobotsSitemaps, config, canonicalUrl, redirectedToCanonical);
      return {
        sitemaps: allSitemaps,
        source: 'robots-txt',
        accessIssues: [],
        canonicalDomain: detected || redirectedToCanonical
      };
    }
    
    // Try standard paths on canonical domain
    const { sitemaps: canonicalStandardSitemaps } = await tryStandardPaths(canonicalUrl, config);
    if (canonicalStandardSitemaps.length > 0) {
      const { sitemaps: allSitemaps, canonicalDomain: detected } = await discoverAllSitemaps(canonicalStandardSitemaps, config, canonicalUrl, redirectedToCanonical);
      return {
        sitemaps: allSitemaps,
        source: 'standard-path',
        accessIssues: [],
        canonicalDomain: detected || redirectedToCanonical
      };
    }
  }
  
  // Strategy 4: No sitemaps found - NOW report access issues as critical
  // because they prevented us from finding any accessible sitemap
  return {
    sitemaps: [],
    source: 'none',
    accessIssues: allAccessIssues,
    canonicalDomain
  };
}
