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

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove trailing slash
    let pathname = parsed.pathname;
    if (pathname.endsWith('/') && pathname !== '/') {
      pathname = pathname.slice(0, -1);
    }

    // Sort query parameters alphabetically
    const params = Array.from(parsed.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const sortedParams = new URLSearchParams(params);

    // Reconstruct URL
    return `${parsed.protocol}//${parsed.host}${pathname}${
      sortedParams.toString() ? '?' + sortedParams.toString() : ''
    }${parsed.hash}`;
  } catch {
    // If URL parsing fails, use original
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
  verbose: boolean = false
): ConsolidatedResult {
  const totalInputUrls = urls.length;

  if (verbose) {
    console.log(`\nConsolidating ${urls.length} URL(s)...`);
  }

  // Group by normalized URL
  const urlMap = new Map<string, UrlEntry[]>();

  for (const entry of urls) {
    const normalized = normalizeUrl(entry.loc);
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
    uniqueUrls.push(merged);

    if (entries.length > 1) {
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
    duplicateGroups,
  };
}
