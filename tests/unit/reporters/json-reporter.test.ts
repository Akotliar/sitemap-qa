import { describe, test, expect } from 'vitest';
import { generateJsonReport } from '@/reporters/json-reporter';
import type { RiskSummary } from '@/summarizer';
import type { DiscoveryResult } from '@/core/discovery';
import type { RiskGroup } from '@/core/risk-grouper';
import type { Config } from '@/types/config';

describe('JSON Reporter', () => {
  const mockConfig: Config = {
    baseUrl: 'https://example.com',
    timeout: 30,
    concurrency: 10,
    outputFormat: 'json',
    outputDir: './sitemap-qa/report',
    verbose: false,
  };

  const mockRiskSummary: RiskSummary = {
    overview: 'Analysis identified 8 potentially risky URLs across 2 high-severity categories.',
    keyFindings: [
      '3 staging environment URLs found',
      '5 administrative paths exposed'
    ],
    categoryInsights: [
      {
        category: 'staging_urls',
        count: 3,
        severity: 'high',
        summary: 'Staging URLs in production sitemap',
        examples: ['https://staging.example.com/page1'],
        allUrls: [
          'https://staging.example.com/page1',
          'https://staging.example.com/page2',
          'https://staging.example.com/page3'
        ]
      }
    ],
    severityBreakdown: {
      high: 2,
      medium: 1,
      low: 0
    },
    recommendations: [
      'Review sitemap generation configuration',
      'Add robots.txt exclusion for admin paths'
    ],
    generatedBy: 'rule-based analysis',
    metadata: {
      tokensUsed: 0,
      processingTime: 0,
      model: 'rule-based'
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
      rationale: 'Production sitemap contains staging URLs',
      sampleUrls: [
        'https://staging.example.com/page1',
        'https://staging.example.com/page2',
        'https://staging.example.com/page3'
      ],
      recommendedAction: 'Verify sitemap generation excludes non-production environments'
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
      recommendedAction: 'Confirm if admin paths should be publicly indexed'
    }
  ];

  test('transforms camelCase to snake_case', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    
    // Check snake_case fields exist
    expect(parsed).toHaveProperty('analysis_metadata');
    expect(parsed).toHaveProperty('total_url_count');
    expect(parsed).toHaveProperty('urls_analyzed');
    expect(parsed).toHaveProperty('suspicious_groups');
    expect(parsed).toHaveProperty('risk_summary');
    
    // Check camelCase fields don't exist
    expect(parsed).not.toHaveProperty('analysisMetadata');
    expect(parsed).not.toHaveProperty('totalUrlCount');
    expect(parsed).not.toHaveProperty('urlsAnalyzed');
    expect(parsed).not.toHaveProperty('suspiciousGroups');
    expect(parsed).not.toHaveProperty('riskSummary');
  });

  test('includes all required schema fields', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    
    expect(parsed).toHaveProperty('analysis_metadata');
    expect(parsed).toHaveProperty('sitemaps_discovered');
    expect(parsed).toHaveProperty('total_url_count');
    expect(parsed).toHaveProperty('urls_analyzed');
    expect(parsed).toHaveProperty('suspicious_groups');
    expect(parsed).toHaveProperty('risk_summary');
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('errors');
  });

  test('analysis_metadata contains all required fields', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const metadata = parsed.analysis_metadata;
    
    expect(metadata).toHaveProperty('base_url', 'https://example.com');
    expect(metadata).toHaveProperty('analysis_timestamp');
    expect(metadata).toHaveProperty('tool_version');
    expect(metadata).toHaveProperty('execution_time_ms');
    expect(metadata).toHaveProperty('analysis_type', 'rule-based analysis');
  });

  test('limits sample URLs to maximum of 5', () => {
    const groupWithManyUrls: RiskGroup = {
      category: 'admin_paths',
      severity: 'medium',
      count: 100,
      rationale: 'Test rationale',
      sampleUrls: Array(100).fill('https://example.com/test'),
      recommendedAction: 'Test action'
    };
    
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      [groupWithManyUrls],
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const firstGroup = parsed.suspicious_groups[0];
    
    expect(firstGroup.sample_urls.length).toBeLessThanOrEqual(5);
    expect(firstGroup.sample_urls.length).toBe(5);
  });

  test('generates ISO 8601 timestamp', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const timestamp = parsed.analysis_metadata.analysis_timestamp;
    
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('calculates execution time correctly', () => {
    const startTime = Date.now() - 5000; // 5 seconds ago
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const executionTime = parsed.analysis_metadata.execution_time_ms;
    
    expect(executionTime).toBeGreaterThanOrEqual(4900);
    expect(executionTime).toBeLessThanOrEqual(5100);
  });

  test('suspicious_groups have correct structure', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const groups = parsed.suspicious_groups;
    
    expect(groups).toHaveLength(2);
    
    const firstGroup = groups[0];
    expect(firstGroup).toHaveProperty('category');
    expect(firstGroup).toHaveProperty('severity');
    expect(firstGroup).toHaveProperty('count');
    expect(firstGroup).toHaveProperty('pattern');
    expect(firstGroup).toHaveProperty('rationale');
    expect(firstGroup).toHaveProperty('sample_urls');
    expect(firstGroup).toHaveProperty('recommended_action');
  });

  test('risk_summary has correct structure', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const riskSummary = parsed.risk_summary;
    
    expect(riskSummary).toHaveProperty('overview');
    expect(riskSummary).toHaveProperty('key_findings');
    expect(riskSummary).toHaveProperty('recommendations');
    expect(Array.isArray(riskSummary.key_findings)).toBe(true);
    expect(Array.isArray(riskSummary.recommendations)).toBe(true);
  });

  test('summary has correct structure', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const summary = parsed.summary;
    
    expect(summary).toHaveProperty('high_severity_count');
    expect(summary).toHaveProperty('medium_severity_count');
    expect(summary).toHaveProperty('low_severity_count');
    expect(summary).toHaveProperty('total_risky_urls');
    expect(summary).toHaveProperty('overall_status');
  });

  test('overall_status is "issues_found" when risks exist', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    expect(parsed.summary.overall_status).toBe('issues_found');
  });

  test('overall_status is "clean" when no risks exist', () => {
    const cleanSummary: RiskSummary = {
      ...mockRiskSummary,
      severityBreakdown: { high: 0, medium: 0, low: 0 }
    };
    
    const startTime = Date.now();
    const json = generateJsonReport(
      cleanSummary,
      mockDiscoveryResult,
      mockParseResult,
      [],
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    expect(parsed.summary.overall_status).toBe('clean');
  });

  test('overall_status is "errors" when errors exist', () => {
    const parseResultWithErrors = {
      ...mockParseResult,
      errors: [new Error('Test error')]
    };
    
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      parseResultWithErrors,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    expect(parsed.summary.overall_status).toBe('errors');
  });

  test('formats errors correctly', () => {
    const testError = new Error('Test error message');
    (testError as any).code = 'TEST_ERROR';
    (testError as any).url = 'https://example.com/fail';
    
    const parseResultWithErrors = {
      ...mockParseResult,
      errors: [testError]
    };
    
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      parseResultWithErrors,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    expect(parsed.errors).toHaveLength(1);
    
    const error = parsed.errors[0];
    expect(error).toHaveProperty('code', 'TEST_ERROR');
    expect(error).toHaveProperty('message', 'Test error message');
    expect(error).toHaveProperty('context');
    expect(error.context).toHaveProperty('url', 'https://example.com/fail');
  });

  test('pretty printing works with default indentation', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime,
      { pretty: true }
    );
    
    // Should contain newlines and indentation
    expect(json).toContain('\n');
    expect(json).toContain('  '); // Default 2-space indent
  });

  test('compact output works without pretty printing', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime,
      { pretty: false }
    );
    
    // Should not contain unnecessary whitespace
    expect(json).not.toContain('\n  ');
    
    // But should still be valid JSON
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('analysis_metadata');
  });

  test('custom indentation works', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime,
      { pretty: true, indent: 4 }
    );
    
    // Should contain 4-space indentation
    expect(json).toContain('    '); // 4 spaces
  });

  test('total_risky_urls matches sum of all groups', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    const expectedTotal = mockRiskGroups.reduce((sum, g) => sum + g.count, 0);
    
    expect(parsed.summary.total_risky_urls).toBe(expectedTotal);
  });

  test('sitemaps_discovered matches input', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    expect(parsed.sitemaps_discovered).toEqual(mockDiscoveryResult.sitemaps);
  });

  test('total_url_count and urls_analyzed match', () => {
    const startTime = Date.now();
    const json = generateJsonReport(
      mockRiskSummary,
      mockDiscoveryResult,
      mockParseResult,
      mockRiskGroups,
      mockConfig,
      startTime
    );
    
    const parsed = JSON.parse(json);
    expect(parsed.total_url_count).toBe(mockParseResult.totalCount);
    expect(parsed.urls_analyzed).toBe(mockParseResult.totalCount);
  });
});
