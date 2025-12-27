import micromatch from 'micromatch';
import { type Config, type Pattern } from '../config/schema';
import { type SitemapUrl, type Risk } from '../types/sitemap';

export class MatcherService {
  private readonly config: Config;
  private readonly rootDomain?: string;

  constructor(config: Config, rootUrl?: string) {
    this.config = config;
    if (rootUrl) {
      try {
        this.rootDomain = new URL(rootUrl).hostname.replace(/^www\./, '');
      } catch {
        // Invalid URL, ignore
      }
    }
  }

  /**
   * Matches a URL against all policies and returns detected risks.
   */
  match(urlObj: SitemapUrl): Risk[] {
    const risks: Risk[] = [];

    // 1. Domain Consistency Check
    if (this.config.enforceDomainConsistency && this.rootDomain) {
      try {
        const currentDomain = new URL(urlObj.loc).hostname.replace(/^www\./, '');
        if (currentDomain !== this.rootDomain) {
          risks.push({
            category: 'Domain Consistency',
            pattern: this.rootDomain,
            type: 'literal',
            reason: `URL domain mismatch: expected ${this.rootDomain} (or www.${this.rootDomain}), but found ${currentDomain}.`,
          });
        }
      } catch {
        // Invalid URL in sitemap
      }
    }

    // 2. Policy Checks
    for (const policy of this.config.policies) {
      for (const pattern of policy.patterns) {
        if (this.isMatch(urlObj.loc, pattern)) {
          risks.push({
            category: policy.category,
            pattern: pattern.value,
            type: pattern.type,
            reason: pattern.reason,
          });
        }
      }
    }

    // 3. Check acceptable patterns (Allowlist)
    // If a URL matches an acceptable pattern, it is marked as ignored.
    // We do this AFTER risk detection so that we can still see what risks were suppressed.
    for (const pattern of this.config.acceptable_patterns) {
      if (this.isMatch(urlObj.loc, pattern)) {
        urlObj.ignored = true;
        urlObj.ignoredBy = pattern.value;
        urlObj.risks = risks; // Store suppressed risks for reporting
        return []; // Return no active risks
      }
    }

    return risks;
  }

  private isMatch(url: string, pattern: Pattern): boolean {
    switch (pattern.type) {
      case 'literal':
        return url.includes(pattern.value);
      case 'glob':
        return micromatch.isMatch(url, pattern.value, { contains: true });
      case 'regex':
        try {
          const regex = new RegExp(pattern.value, 'i');
          return regex.test(url);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}
