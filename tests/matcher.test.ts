import { describe, it, expect } from 'vitest';
import { MatcherService } from '../src/core/matcher';
import { Config } from '../src/config/schema';
import { SitemapUrl } from '../src/types/sitemap';

describe('MatcherService', () => {
  const mockConfig: Config = {
    enforceDomainConsistency: true,
    acceptable_patterns: [
      {
        type: 'literal',
        value: '/acceptable-path',
        reason: 'This path is known to be safe.'
      },
      {
        type: 'glob',
        value: '**/safe/**',
        reason: 'All paths under safe/ are acceptable.'
      },
      {
        type: 'regex',
        value: '/regex-safe-.*$',
        reason: 'Regex safe paths.'
      }
    ],
    policies: [
      {
        category: 'Security',
        patterns: [
          {
            type: 'literal',
            value: '/admin',
            reason: 'Admin paths are risky.'
          },
          {
            type: 'glob',
            value: '**/risky/**',
            reason: 'Risky paths.'
          }
        ]
      }
    ],
    outputFormat: 'all'
  };

  const matcher = new MatcherService(mockConfig);

  it('should mark URL as ignored if it matches an acceptable literal pattern', () => {
    const urlObj: SitemapUrl = {
      loc: 'https://example.com/acceptable-path',
      source: 'sitemap.xml',
      risks: []
    };

    const risks = matcher.match(urlObj);

    expect(risks).toHaveLength(0);
    expect(urlObj.ignored).toBe(true);
    expect(urlObj.ignoredBy).toBe('This path is known to be safe.');
  });

  it('should mark URL as ignored if it matches an acceptable glob pattern', () => {
    const urlObj: SitemapUrl = {
      loc: 'https://example.com/some/safe/path',
      source: 'sitemap.xml',
      risks: []
    };

    const risks = matcher.match(urlObj);

    expect(risks).toHaveLength(0);
    expect(urlObj.ignored).toBe(true);
    expect(urlObj.ignoredBy).toBe('All paths under safe/ are acceptable.');
  });

  it('should mark URL as ignored if it matches an acceptable regex pattern', () => {
    const urlObj: SitemapUrl = {
      loc: 'https://example.com/regex-safe-123',
      source: 'sitemap.xml',
      risks: []
    };

    const risks = matcher.match(urlObj);

    expect(risks).toHaveLength(0);
    expect(urlObj.ignored).toBe(true);
    expect(urlObj.ignoredBy).toBe('Regex safe paths.');
  });

  it('should prioritize acceptable patterns over risk patterns', () => {
    // This URL matches both an acceptable pattern and a risk pattern
    const urlObj: SitemapUrl = {
      loc: 'https://example.com/safe/risky/path',
      source: 'sitemap.xml',
      risks: []
    };

    const risks = matcher.match(urlObj);

    expect(risks).toHaveLength(0);
    expect(urlObj.ignored).toBe(true);
    expect(urlObj.ignoredBy).toBe('All paths under safe/ are acceptable.');
    // Verify no risks are attached because we return early
    expect(urlObj.risks).toHaveLength(0);
  });

  it('should NOT suppress domain consistency risks even if URL matches an acceptable pattern', () => {
    const config: Config = {
      ...mockConfig,
      enforceDomainConsistency: true
    };
    const matcher = new MatcherService(config, 'https://example.com');
    const urlObj: SitemapUrl = {
      loc: 'https://other-domain.com/acceptable-path',
      source: 'sitemap.xml',
      risks: []
    };

    const risks = matcher.match(urlObj);

    // Domain consistency should still be flagged even if the path is "acceptable"
    // because domain mismatch is a higher-priority risk.
    expect(risks).toHaveLength(1);
    expect(risks[0].category).toBe('Domain Consistency');
    
    // The URL is still marked as ignored for policy checks, but the caller (analyze.ts)
    // must prioritize the returned risks.
    expect(urlObj.ignored).toBe(true);
    expect(urlObj.ignoredBy).toBe('This path is known to be safe.');
  });

  describe('Integration with Analyze Logic', () => {
    it('should prioritize risks over ignore status (simulating analyze.ts logic)', () => {
      const config: Config = {
        ...mockConfig,
        enforceDomainConsistency: true
      };
      const matcher = new MatcherService(config, 'https://example.com');
      const urlObj: SitemapUrl = {
        loc: 'https://other-domain.com/acceptable-path',
        source: 'sitemap.xml',
        risks: []
      };

      const risks = matcher.match(urlObj);
      
      const urlsWithRisks: SitemapUrl[] = [];
      const ignoredUrls: SitemapUrl[] = [];
      let totalRisks = 0;

      // The logic from analyze.ts
      if (risks.length > 0) {
        urlObj.risks = risks;
        urlsWithRisks.push(urlObj);
        totalRisks += risks.length;
      } else if (urlObj.ignored) {
        ignoredUrls.push(urlObj);
      }

      expect(totalRisks).toBe(1);
      expect(urlsWithRisks).toHaveLength(1);
      expect(ignoredUrls).toHaveLength(0);
      expect(urlsWithRisks[0].risks[0].category).toBe('Domain Consistency');
    });
  });

  it('should return risks if URL does not match any acceptable pattern', () => {
    const urlObj: SitemapUrl = {
      loc: 'https://example.com/admin/dashboard',
      source: 'sitemap.xml',
      risks: []
    };

    const risks = matcher.match(urlObj);

    expect(risks).toHaveLength(1);
    expect(risks[0].category).toBe('Security');
    expect(urlObj.ignored).toBeUndefined();
  });

  describe('Domain Consistency', () => {
    it('should flag domain mismatch when enforceDomainConsistency is true', () => {
      const config: Config = {
        acceptable_patterns: [],
        policies: [],
        outputFormat: 'all',
        enforceDomainConsistency: true
      };
      const matcher = new MatcherService(config, 'https://example.com');
      const urlObj: SitemapUrl = {
        loc: 'https://other-domain.com/page',
        source: 'sitemap.xml',
        risks: []
      };

      const risks = matcher.match(urlObj);

      expect(risks).toHaveLength(1);
      expect(risks[0].category).toBe('Domain Consistency');
      expect(risks[0].reason).toContain('expected example.com');
    });

    it('should NOT flag domain mismatch if domains match (ignoring www.)', () => {
      const config: Config = {
        acceptable_patterns: [],
        policies: [],
        outputFormat: 'all',
        enforceDomainConsistency: true
      };
      
      // Case 1: Root has www, URL doesn't
      const matcher1 = new MatcherService(config, 'https://www.example.com');
      const urlObj1: SitemapUrl = {
        loc: 'https://example.com/page',
        source: 'sitemap.xml',
        risks: []
      };
      expect(matcher1.match(urlObj1)).toHaveLength(0);

      // Case 2: Root doesn't have www, URL does
      const matcher2 = new MatcherService(config, 'https://example.com');
      const urlObj2: SitemapUrl = {
        loc: 'https://www.example.com/page',
        source: 'sitemap.xml',
        risks: []
      };
      expect(matcher2.match(urlObj2)).toHaveLength(0);
    });

    it('should NOT flag domain mismatch if enforceDomainConsistency is false', () => {
      const config: Config = {
        acceptable_patterns: [],
        policies: [],
        outputFormat: 'all',
        enforceDomainConsistency: false
      };
      const matcher = new MatcherService(config, 'https://example.com');
      const urlObj: SitemapUrl = {
        loc: 'https://other-domain.com/page',
        source: 'sitemap.xml',
        risks: []
      };

      const risks = matcher.match(urlObj);
      expect(risks).toHaveLength(0);
    });
  });
});
