import { UrlEntry } from '@/core/parser';

export interface ConsolidatedResult {
  uniqueUrls: UrlEntry[]; // Deduplicated URLs
  totalInputUrls: number; // Original count before deduplication
  duplicatesRemoved: number; // Number of duplicates removed
  duplicateGroups?: DuplicateGroup[]; // Optional: groups of duplicates for debugging
}

export interface DuplicateGroup {
  url: string; // The canonical URL
  count: number; // How many times it appeared
  sources: string[]; // Which sitemaps contained it
}

export interface NormalizationOptions {
  /**
   * Remove 'www.' prefix from domains
   * @default true
   */
  removeWww?: boolean;

  /**
   * Normalize to HTTPS when both HTTP and HTTPS exist
   * @default false (preserve original protocol)
   */
  preferHttps?: boolean;

  /**
   * Remove hash/fragment from URLs
   * @default true (fragments rarely matter for sitemaps)
   */
  removeHash?: boolean;

  /**
   * Convert domain to lowercase
   * @default true (domains are case-insensitive)
   */
  lowercaseDomain?: boolean;

  /**
   * Convert path to lowercase
   * @default false (paths are case-sensitive)
   */
  lowercasePath?: boolean;

  /**
   * Remove default ports (80 for HTTP, 443 for HTTPS)
   * @default true
   */
  removeDefaultPorts?: boolean;

  /**
   * Decode percent-encoded characters when safe
   * @default true
   */
  decodePercents?: boolean;

  /**
   * Convert IDN domains to ASCII (Punycode)
   * @default true
   */
  normalizeIDN?: boolean;

  /**
   * Sort query parameters alphabetically
   * @default true
   */
  sortQueryParams?: boolean;

  /**
   * Remove trailing slash (except for root path)
   * @default true
   */
  removeTrailingSlash?: boolean;

  /**
   * Remove empty query parameters (e.g., ?key=)
   * @default true
   */
  removeEmptyQueryParams?: boolean;

  /**
   * Remove query parameters matching these names
   * @default [] (common examples: ['utm_source', 'utm_medium', 'fbclid'])
   */
  removeQueryParams?: string[];

  /**
   * Custom normalization function to apply after built-in rules
   */
  customNormalizer?: (url: URL) => URL;
}

export const DEFAULT_NORMALIZATION_OPTIONS: Required<NormalizationOptions> = {
  removeWww: true,
  preferHttps: false,
  removeHash: true,
  lowercaseDomain: true,
  lowercasePath: false,
  removeDefaultPorts: true,
  decodePercents: true,
  normalizeIDN: true,
  sortQueryParams: true,
  removeTrailingSlash: true,
  removeEmptyQueryParams: true,
  removeQueryParams: [],
  customNormalizer: undefined as any,
};

/**
 * Safely decode URI component, avoiding reserved characters
 */
function safeDecodeURIComponent(str: string): string {
  try {
    // Decode unreserved characters only
    // Reserved: : / ? # [ ] @ ! $ & ' ( ) * + , ; =
    return str.replace(
      /%([0-9A-Fa-f]{2})/g,
      (match, hex) => {
        const char = String.fromCharCode(parseInt(hex, 16));
        // Only decode if it's an unreserved character
        if (/[A-Za-z0-9\-_.~]/.test(char)) {
          return char;
        }
        return match; // Keep encoded
      }
    );
  } catch {
    return str;
  }
}

export function normalizeUrl(
  url: string,
  options: NormalizationOptions = {}
): string {
  // Merge with defaults
  const opts = { ...DEFAULT_NORMALIZATION_OPTIONS, ...options };

  try {
    // Step 1: Parse URL
    const parsed = new URL(url);

    // Step 2: Normalize domain
    let hostname = parsed.hostname;
    
    if (opts.removeWww && hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    if (opts.lowercaseDomain) {
      hostname = hostname.toLowerCase();
    }

    if (opts.normalizeIDN) {
      // Convert IDN to ASCII (Punycode)
      // Note: URL API already does this, but explicit for clarity
      hostname = new URL(`http://${hostname}`).hostname;
    }

    // Step 3: Normalize protocol
    let protocol = parsed.protocol;
    if (opts.preferHttps && protocol === 'http:') {
      protocol = 'https:';
    }

    // Step 4: Normalize port
    let port = parsed.port;
    if (opts.removeDefaultPorts) {
      if ((protocol === 'http:' && port === '80') ||
          (protocol === 'https:' && port === '443')) {
        port = '';
      }
    }

    // Step 5: Normalize pathname
    let pathname = parsed.pathname;
    
    if (opts.decodePercents) {
      // Decode percent-encoded characters (except reserved characters)
      pathname = safeDecodeURIComponent(pathname);
    }
    
    if (opts.lowercasePath) {
      pathname = pathname.toLowerCase();
    }
    
    if (opts.removeTrailingSlash && pathname.endsWith('/') && pathname !== '/') {
      pathname = pathname.slice(0, -1);
    }

    // Step 6: Normalize query parameters
    let searchParams = new URLSearchParams(parsed.search);
    
    if (opts.removeEmptyQueryParams) {
      for (const [key, value] of Array.from(searchParams.entries())) {
        if (value === '') {
          searchParams.delete(key);
        }
      }
    }
    
    if (opts.removeQueryParams && opts.removeQueryParams.length > 0) {
      for (const param of opts.removeQueryParams) {
        searchParams.delete(param);
      }
    }

    let queryString = '';
    if (opts.sortQueryParams) {
      const sortedParams = Array.from(searchParams.entries()).sort(
        ([a], [b]) => a.localeCompare(b)
      );
      if (sortedParams.length > 0) {
        queryString = '?' + new URLSearchParams(sortedParams).toString();
      }
    } else if (searchParams.toString()) {
      queryString = '?' + searchParams.toString();
    }

    // Step 7: Handle hash/fragment
    const hash = opts.removeHash ? '' : parsed.hash;

    // Step 8: Reconstruct URL
    const portPart = port ? `:${port}` : '';
    let normalized = `${protocol}//${hostname}${portPart}${pathname}${queryString}${hash}`;

    // Step 9: Apply custom normalizer if provided
    if (opts.customNormalizer) {
      const customParsed = new URL(normalized);
      const customNormalized = opts.customNormalizer(customParsed);
      normalized = customNormalized.toString();
    }

    return normalized;
  } catch (error) {
    // If parsing fails, return original URL
    // Could also throw error based on configuration
    console.warn(`Failed to normalize URL: ${url}`, error);
    return url;
  }
}

function mergeUrlEntries(entries: UrlEntry[]): UrlEntry {
  if (entries.length === 1) return entries[0];

  // Use the first entry as base
  const merged: UrlEntry = { ...entries[0] };

  // Merge sources
  const sources = entries.map((e) => e.source);
  merged.source = sources.join(', ');

  // Use most recent lastmod
  const lastmods = entries
    .map((e) => e.lastmod)
    .filter((lm): lm is string => !!lm)
    .map((lm) => new Date(lm).getTime())
    .sort((a, b) => b - a);

  if (lastmods.length > 0) {
    merged.lastmod = new Date(lastmods[0]).toISOString();
  }

  // Use highest priority
  const priorities = entries
    .map((e) => e.priority)
    .filter((p): p is number => p !== undefined);

  if (priorities.length > 0) {
    merged.priority = Math.max(...priorities);
  }

  // Use most frequent changefreq (or first if tie)
  const changefreqs = entries
    .map((e) => e.changefreq)
    .filter((cf): cf is string => !!cf);

  if (changefreqs.length > 0) {
    const counts = new Map<string, number>();
    for (const cf of changefreqs) {
      counts.set(cf, (counts.get(cf) || 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    merged.changefreq = sorted[0][0];
  }

  // Use most recent extractedAt
  const extractedAts = entries
    .map((e) => e.extractedAt)
    .filter((ea): ea is string => !!ea)
    .map((ea) => new Date(ea).getTime())
    .sort((a, b) => b - a);

  if (extractedAts.length > 0) {
    merged.extractedAt = new Date(extractedAts[0]).toISOString();
  }

  return merged;
}

export function consolidateUrls(
  urls: UrlEntry[],
  options: {
    verbose?: boolean;
    trackDuplicates?: boolean;
    normalization?: NormalizationOptions;
  } = {}
): ConsolidatedResult {
  const { verbose = false, trackDuplicates = true, normalization } = options;
  const totalInputUrls = urls.length;

  if (verbose) {
    console.log(`\nConsolidating ${urls.length} URL(s)...`);
  }

  // Group by normalized URL
  const urlMap = new Map<string, UrlEntry[]>();

  for (const entry of urls) {
    const normalized = normalizeUrl(entry.loc, normalization);
    if (!urlMap.has(normalized)) {
      urlMap.set(normalized, []);
    }
    urlMap.get(normalized)!.push(entry);
  }

  // Merge duplicates
  const uniqueUrls: UrlEntry[] = [];
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [normalized, entries] of urlMap.entries()) {
    const merged = mergeUrlEntries(entries);
    // Update the loc to use the normalized URL
    merged.loc = normalized;
    uniqueUrls.push(merged);

    if (trackDuplicates && entries.length > 1) {
      duplicateGroups.push({
        url: normalized,
        count: entries.length,
        sources: entries.map((e) => e.source),
      });
    }
  }

  if (verbose) {
    console.log(`Consolidation complete:`);
    console.log(`  - Input URLs: ${totalInputUrls}`);
    console.log(`  - Unique URLs: ${uniqueUrls.length}`);
    console.log(`  - Duplicates removed: ${totalInputUrls - uniqueUrls.length}`);

    if (duplicateGroups.length > 0) {
      console.log(`\nTop duplicates:`);
      const top5 = duplicateGroups
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      for (const group of top5) {
        console.log(`  - ${group.url} (${group.count} times)`);
      }
    }
  }

  return {
    uniqueUrls,
    totalInputUrls,
    duplicatesRemoved: totalInputUrls - uniqueUrls.length,
    duplicateGroups: trackDuplicates ? duplicateGroups : undefined,
  };
}
