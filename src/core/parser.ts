import { XMLParser, XMLValidator } from 'fast-xml-parser';

export interface UrlEntry {
  loc: string; // Required: URL location
  lastmod?: string; // Optional: Last modification date
  changefreq?: string; // Optional: Change frequency
  priority?: number; // Optional: Priority (0.0-1.0)
  source: string; // Which sitemap this came from
  extractedAt?: string; // ISO timestamp of extraction
}

export interface ParseResult {
  urls: UrlEntry[]; // Successfully parsed URLs
  errors: string[]; // Parsing errors/warnings
  totalCount: number; // Total URLs parsed
  sitemapUrl: string; // Source sitemap URL
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '_text',
  parseAttributeValue: true,
  trimValues: true,
  allowBooleanAttributes: true,
  parseTagValue: false, // Keep values as strings for validation
});

function extractUrls(parsedXml: any, sitemapUrl: string): UrlEntry[] {
  const urls: UrlEntry[] = [];

  // Handle urlset format
  if (parsedXml.urlset) {
    // Normalize to array (single <url> vs multiple)
    const urlNodes = Array.isArray(parsedXml.urlset.url)
      ? parsedXml.urlset.url
      : [parsedXml.urlset.url];

    for (const node of urlNodes) {
      // Skip entries without loc field
      if (!node || !node.loc) {
        continue;
      }

      urls.push({
        loc: node.loc,
        lastmod: node.lastmod,
        changefreq: node.changefreq,
        priority: node.priority ? parseFloat(node.priority) : undefined,
        source: sitemapUrl,
      });
    }
  }

  return urls;
}

export async function parseSitemap(
  xml: string,
  sitemapUrl: string
): Promise<ParseResult> {
  const errors: string[] = [];

  try {
    // Validate XML first
    const validationResult = XMLValidator.validate(xml);
    if (validationResult !== true) {
      const validationError = typeof validationResult === 'object'
        ? validationResult.err.msg
        : 'Invalid XML';
      return {
        urls: [],
        errors: [
          `[${sitemapUrl}] XML parsing failed: ${validationError}`,
        ],
        totalCount: 0,
        sitemapUrl,
      };
    }

    // Parse XML
    const parsed = parser.parse(xml);

    // Extract URLs
    const urls = extractUrls(parsed, sitemapUrl);

    // Validate extracted URLs
    const validUrls: UrlEntry[] = [];
    for (const entry of urls) {
      try {
        // Validate URL format
        new URL(entry.loc);

        // Validate priority range
        if (entry.priority !== undefined) {
          if (entry.priority < 0 || entry.priority > 1) {
            errors.push(
              `Invalid priority ${entry.priority} for ${entry.loc} - clamping to 0-1`
            );
            entry.priority = Math.max(0, Math.min(1, entry.priority));
          }
        }

        // Validate changefreq
        if (entry.changefreq) {
          const validFreqs = [
            'always',
            'hourly',
            'daily',
            'weekly',
            'monthly',
            'yearly',
            'never',
          ];
          if (!validFreqs.includes(entry.changefreq.toLowerCase())) {
            errors.push(
              `Invalid changefreq "${entry.changefreq}" for ${entry.loc}`
            );
            entry.changefreq = undefined;
          }
        }

        validUrls.push(entry);
      } catch (urlError) {
        errors.push(`Invalid URL format: ${entry.loc}`);
      }
    }

    return {
      urls: validUrls,
      errors,
      totalCount: validUrls.length,
      sitemapUrl,
    };
  } catch (parseError) {
    // XML parsing failed completely
    const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
    return {
      urls: [],
      errors: [
        `[${sitemapUrl}] XML parsing failed: ${errorMsg}`,
      ],
      totalCount: 0,
      sitemapUrl,
    };
  }
}
