import { describe, it, expect, afterEach } from 'vitest';
import { HtmlReporter } from '../src/reporters/html-reporter';
import { ReportData } from '../src/reporters/base';
import { SitemapUrl } from '../src/types/sitemap';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

describe('HtmlReporter', () => {
  const testOutputPath = '/tmp/test-html-report.html';

  afterEach(async () => {
    if (existsSync(testOutputPath)) {
      await fs.unlink(testOutputPath);
    }
  });

  it('should show risk categories instead of acceptable pattern reason for ignored URLs with suppressed risks', async () => {
    const ignoredUrlWithRisks: SitemapUrl = {
      loc: 'https://example.com/ignored-admin-path',
      source: 'sitemap.xml',
      risks: [
        {
          category: 'Security & Admin',
          pattern: '**/admin/**',
          type: 'glob',
          reason: 'Administrative interfaces should not be publicly indexed.'
        }
      ],
      ignored: true,
      ignoredBy: 'This path is in the allowlist'
    };

    const reportData: ReportData = {
      rootUrl: 'https://example.com',
      discoveredSitemaps: ['https://example.com/sitemap.xml'],
      totalUrls: 10,
      totalRisks: 0,
      urlsWithRisks: [],
      ignoredUrls: [ignoredUrlWithRisks],
      startTime: new Date(),
      endTime: new Date()
    };

    const reporter = new HtmlReporter(testOutputPath);
    await reporter.generate(reportData);

    const htmlContent = await fs.readFile(testOutputPath, 'utf8');

    // Should show the category ("Security & Admin") in the "(by ...)" part
    expect(htmlContent).toContain('(by Security &amp; Admin)');
    
    // Should NOT show the acceptable pattern reason in the "(by ...)" part
    expect(htmlContent).not.toContain('(by This path is in the allowlist)');
    
    // Should still show suppressed risks
    expect(htmlContent).toContain('[Suppressed Risks: Security &amp; Admin]');
  });

  it('should show acceptable pattern reason for ignored URLs without suppressed risks', async () => {
    const ignoredUrlWithoutRisks: SitemapUrl = {
      loc: 'https://example.com/safe-path',
      source: 'sitemap.xml',
      risks: [],
      ignored: true,
      ignoredBy: 'Safe public documentation path'
    };

    const reportData: ReportData = {
      rootUrl: 'https://example.com',
      discoveredSitemaps: ['https://example.com/sitemap.xml'],
      totalUrls: 10,
      totalRisks: 0,
      urlsWithRisks: [],
      ignoredUrls: [ignoredUrlWithoutRisks],
      startTime: new Date(),
      endTime: new Date()
    };

    const reporter = new HtmlReporter(testOutputPath);
    await reporter.generate(reportData);

    const htmlContent = await fs.readFile(testOutputPath, 'utf8');

    // Should show the acceptable pattern reason when there are no suppressed risks
    expect(htmlContent).toContain('(by Safe public documentation path)');
    
    // Should NOT show suppressed risks section
    expect(htmlContent).not.toContain('[Suppressed Risks:');
  });

  it('should handle multiple suppressed risk categories', async () => {
    const ignoredUrlWithMultipleRisks: SitemapUrl = {
      loc: 'https://example.com/multi-risk-path',
      source: 'sitemap.xml',
      risks: [
        {
          category: 'Security & Admin',
          pattern: '**/admin/**',
          type: 'glob',
          reason: 'Administrative interfaces should not be publicly indexed.'
        },
        {
          category: 'Environment Leakage',
          pattern: '**/staging.**',
          type: 'glob',
          reason: 'Staging environments should be restricted.'
        }
      ],
      ignored: true,
      ignoredBy: 'Allowlist pattern'
    };

    const reportData: ReportData = {
      rootUrl: 'https://example.com',
      discoveredSitemaps: ['https://example.com/sitemap.xml'],
      totalUrls: 10,
      totalRisks: 0,
      urlsWithRisks: [],
      ignoredUrls: [ignoredUrlWithMultipleRisks],
      startTime: new Date(),
      endTime: new Date()
    };

    const reporter = new HtmlReporter(testOutputPath);
    await reporter.generate(reportData);

    const htmlContent = await fs.readFile(testOutputPath, 'utf8');

    // Should show both categories in the "(by ...)" part
    expect(htmlContent).toMatch(/\(by Security &amp; Admin, Environment Leakage\)/);
    
    // Should show both categories in suppressed risks
    expect(htmlContent).toContain('[Suppressed Risks: Security &amp; Admin, Environment Leakage]');
  });
});
