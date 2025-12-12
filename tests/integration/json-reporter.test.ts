import { describe, test, expect } from 'vitest';
import { generateJsonReport } from '@/reporters/json-reporter';
import type { RiskSummary } from '@/summarizer';
import type { DiscoveryResult } from '@/core/discovery';
import type { RiskGroup } from '@/core/risk-grouper';
import type { Config } from '@/types/config';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('JSON Reporter Integration', () => {
  test('generates complete JSON report matching PRD schema', () => {
    // Read package.json for version (use process.cwd() to get project root)
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    );

    const mockConfig: Config = {
      baseUrl: 'https://example.com',
      timeout: 30,
      concurrency: 10,
      outputFormat: 'json',
      outputDir: './sitemap-qa/report',
      verbose: false,
    };

    const mockRiskSummary: RiskSummary = {
        overview: 'Analysis identified 8 potentially risky URLs across 2 high-severity categories requiring immediate attention.',
        keyFindings: [
            '3 staging environment URLs found in production sitemap',
            '5 administrative paths exposed in public sitemap',
            'All flagged URLs require immediate review'
        ],
        categoryInsights: [
            {
                category: 'environment_leakage',
                count: 3,
                severity: 'high',
                summary: 'Staging URLs detected',
                examples: ['https://staging.example.com/page1'],
                allUrls: ['https://staging.example.com/page1', 'https://staging.example.com/page2', 'https://staging.example.com/page3']
            },
            {
                category: 'admin_paths',
                count: 5,
                severity: 'high',
                summary: 'Admin paths detected',
                examples: ['https://example.com/admin/dashboard'],
                allUrls: ['https://example.com/admin/dashboard', 'https://example.com/admin/users', 'https://example.com/admin/settings', 'https://example.com/admin/config', 'https://example.com/admin/logs']
            }
        ],
        severityBreakdown: {
            high: 2,
            medium: 0,
            low: 0
        },
        recommendations: [
            'Review sitemap generation configuration to exclude staging URLs',
            'Add robots.txt exclusion for admin paths or remove from sitemap',
            'Verify deployment process separates production/staging content'
        ],
        generatedBy: 'rule-based analysis',
        metadata: {
            tokensUsed: 0,
            processingTime: 0,
            model: ''
        }
    };

    const mockDiscoveryResult: DiscoveryResult = {
      sitemaps: [
        'https://example.com/sitemap.xml',
        'https://example.com/sitemap_index.xml'
      ],
      source: 'standard-path',
      accessIssues: []
    };

    const mockParseResult = {
      totalCount: 1247,
      uniqueUrls: Array(1247).fill('https://example.com/page'),
      errors: []
    };

    const mockRiskGroups: RiskGroup[] = [
      {
        category: 'environment_leakage',
        severity: 'high',
        count: 3,
        rationale: 'Production sitemap contains staging environment URLs',
        sampleUrls: [
          'https://staging.example.com/products/widget-1',
          'https://staging.example.com/about',
          'https://staging.example.com/contact'
        ],
        recommendedAction: 'Verify sitemap generation excludes non-production environments. Review deployment configuration.'
      },
      {
        category: 'admin_paths',
        severity: 'high',
        count: 5,
        rationale: 'Administrative paths detected in public sitemap',
        sampleUrls: [
          'https://example.com/admin/dashboard',
          'https://example.com/admin/users',
          'https://example.com/internal/config'
        ],
        recommendedAction: 'Confirm if admin paths should be publicly indexed. Consider robots.txt exclusion.'
      }
    ];

    const startTime = Date.now() - 4523; // Mock execution time of 4523ms

    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );

    const parsed = JSON.parse(json);

    // Validate top-level structure
    expect(parsed).toHaveProperty('analysis_metadata');
    expect(parsed).toHaveProperty('sitemaps_discovered');
    expect(parsed).toHaveProperty('total_url_count');
    expect(parsed).toHaveProperty('urls_analyzed');
    expect(parsed).toHaveProperty('suspicious_groups');
    expect(parsed).toHaveProperty('risk_summary');
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('errors');

    // Validate analysis_metadata
    expect(parsed.analysis_metadata.base_url).toBe('https://example.com');
    expect(parsed.analysis_metadata.tool_version).toBe('0.0.0-test'); // Mocked version in tests
    expect(parsed.analysis_metadata.analysis_type).toBe('rule-based analysis');
    expect(parsed.analysis_metadata.analysis_timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(parsed.analysis_metadata.execution_time_ms).toBeGreaterThan(4000);

    // Validate sitemaps_discovered
    expect(parsed.sitemaps_discovered).toHaveLength(2);
    expect(parsed.sitemaps_discovered[0]).toBe('https://example.com/sitemap.xml');

    // Validate counts
    expect(parsed.total_url_count).toBe(1247);
    expect(parsed.urls_analyzed).toBe(1247);

    // Validate suspicious_groups structure
    expect(parsed.suspicious_groups).toHaveLength(2);
    
    const firstGroup = parsed.suspicious_groups[0];
    expect(firstGroup.category).toBe('environment_leakage');
    expect(firstGroup.severity).toBe('high');
    expect(firstGroup.count).toBe(3);
    expect(firstGroup.rationale).toBe('Production sitemap contains staging environment URLs');
    expect(firstGroup.sample_urls).toHaveLength(3);
    expect(firstGroup.recommended_action).toBeTruthy();

    // Validate risk_summary
    expect(parsed.risk_summary.overview).toBeTruthy();
    expect(parsed.risk_summary.key_findings).toHaveLength(3);
    expect(parsed.risk_summary.recommendations).toHaveLength(3);

    // Validate summary
    expect(parsed.summary.high_severity_count).toBe(2);
    expect(parsed.summary.medium_severity_count).toBe(0);
    expect(parsed.summary.low_severity_count).toBe(0);
    expect(parsed.summary.total_risky_urls).toBe(8);
    expect(parsed.summary.overall_status).toBe('issues_found');

    // Validate errors array (should be empty in this case)
    expect(parsed.errors).toHaveLength(0);

    // Verify no camelCase fields leak through
    const jsonString = JSON.stringify(parsed);
    expect(jsonString).not.toContain('analysisMetadata');
    expect(jsonString).not.toContain('totalUrlCount');
    expect(jsonString).not.toContain('urlsAnalyzed');
    expect(jsonString).not.toContain('suspiciousGroups');
    expect(jsonString).not.toContain('aiSummary');
    expect(jsonString).not.toContain('severityBreakdown');
  });

  test('generates valid JSON that can be re-parsed', () => {
    const mockConfig: Config = {
      baseUrl: 'https://clean-site.com',
      timeout: 30,
      concurrency: 10,
      outputFormat: 'json',
      outputDir: './sitemap-qa/report',
      verbose: false,
    };

    const mockRiskSummary: RiskSummary = {
      overview: 'No issues found',
      keyFindings: [],
      categoryInsights: [],
      severityBreakdown: { high: 0, medium: 0, low: 0 },
      recommendations: [],
      generatedBy: 'rule-based analysis',
      metadata: { tokensUsed: 0, processingTime: 0, model: 'pattern-matching' }
    };

    const mockDiscoveryResult: DiscoveryResult = {
      sitemaps: ['https://test.com/sitemap.xml'],
      source: 'standard-path',
      accessIssues: []
    };

    const mockParseResult = {
      totalCount: 100,
      uniqueUrls: Array(100).fill('https://test.com/page'),
      errors: []
    };

    const startTime = Date.now();

    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      [],
      mockConfig,
      startTime
    );

    // Should be valid JSON
    expect(() => JSON.parse(json)).not.toThrow();

    // Re-parse and verify
    const parsed = JSON.parse(json);
    const reParsed = JSON.parse(JSON.stringify(parsed));
    
    expect(reParsed).toEqual(parsed);
  });
});
