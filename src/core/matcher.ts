import micromatch from 'micromatch';
import { type Config, type Pattern } from '../config/schema';
import { type SitemapUrl, type Risk } from '../types/sitemap';

export class MatcherService {
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Matches a URL against all policies and returns detected risks.
   */
  match(urlObj: SitemapUrl): Risk[] {
    const risks: Risk[] = [];

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
