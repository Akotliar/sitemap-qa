import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleReporter } from '../src/reporters/console-reporter';
import { JsonReporter } from '../src/reporters/json-reporter';
import { HtmlReporter } from '../src/reporters/html-reporter';
import { ReportData } from '../src/reporters/base';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');
vi.mock('chalk', () => {
  const m = {
    red: vi.fn((s) => s),
    green: vi.fn((s) => s),
    blue: vi.fn((s) => s),
    gray: vi.fn((s) => s),
    yellow: vi.fn((s) => s),
    cyan: vi.fn((s) => s),
    bold: {
      blue: vi.fn((s) => s),
      yellow: vi.fn((s) => s),
    }
  };
  return {
    default: m,
    ...m,
  };
});

describe('Reporters', () => {
  const logSpy = vi.fn();
  const mockData: ReportData = {
    rootUrl: 'https://example.com/sitemap.xml',
    discoveredSitemaps: ['https://example.com/sitemap.xml'],
    totalUrls: 100,
    totalRisks: 2,
    urlsWithRisks: [
      {
        loc: 'https://example.com/admin',
        risks: [{ category: 'Security', pattern: '**/admin/**', reason: 'Sensitive', type: "glob"  }],
        source: 'sitemap.xml'
      }
    ],
    ignoredUrls: [
      {
        loc: 'https://example.com/ignored',
        risks: [],
        source: 'sitemap.xml',
        ignored: true
      }
    ],
    startTime: new Date('2025-01-01T10:00:00Z'),
    endTime: new Date('2025-01-01T10:00:05Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('console', { log: logSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('ConsoleReporter', () => {
    it('should log summary to console', async () => {
      const reporter = new ConsoleReporter();
      await reporter.generate(mockData);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Analysis Summary'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Total URLs Scanned: 100'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Total Risks Found:'));
    });

    it('should handle zero risks and zero ignored URLs', async () => {
      const zeroData: ReportData = {
        ...mockData,
        totalRisks: 0,
        urlsWithRisks: [],
        ignoredUrls: []
      };
      const reporter = new ConsoleReporter();
      await reporter.generate(zeroData);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Total Risks Found:  0'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('URLs Ignored:       0'));
    });

    it('should handle more than 10 findings', async () => {
      const manyRisksData = {
        ...mockData,
        urlsWithRisks: Array(15).fill(mockData.urlsWithRisks[0])
      };
      const reporter = new ConsoleReporter();
      await reporter.generate(manyRisksData);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('... and 5 more'));
    });
  });

  describe('JsonReporter', () => {
    it('should write JSON report to file', async () => {
      const reporter = new JsonReporter('report.json');
      await reporter.generate(mockData);

      expect(fs.writeFile).toHaveBeenCalledWith(
        'report.json',
        expect.stringContaining('"totalUrls": 100'),
        'utf8'
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('JSON report generated'));
    });
  });

  describe('HtmlReporter', () => {
    it('should write HTML report to file', async () => {
      const reporter = new HtmlReporter('report.html');
      await reporter.generate(mockData);

      expect(fs.writeFile).toHaveBeenCalledWith(
        'report.html',
        expect.stringContaining('<!DOCTYPE html>'),
        'utf8'
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('HTML report generated'));
    });

    it('should correctly group risks by category', async () => {
      const complexData: ReportData = {
        ...mockData,
        urlsWithRisks: [
          {
            loc: 'url1',
            risks: [{ category: 'Cat1', pattern: 'p1', reason: 'r1',type: "literal" }],
            source: 's'
          },
          {
            loc: 'url2',
            risks: [{ category: 'Cat1', pattern: 'p1', reason: 'r1', type: "literal" }],
            source: 's'
          },
          {
            loc: 'url3',
            risks: [{ category: 'Cat2', pattern: 'p2', reason: 'r2', type: "literal" }],
            source: 's'
          }
        ]
      };
      const reporter = new HtmlReporter('report.html');
      await reporter.generate(complexData);

      const call = vi.mocked(fs.writeFile).mock.calls.find(c => c[0] === 'report.html');
      expect(call).toBeDefined();
      const html = call[1] as string;
      expect(html).toContain('Cat1');
      expect(html).toContain('Cat2');
      expect(html).toContain('url1');
      expect(html).toContain('url2');
      expect(html).toContain('url3');
    });

    it('should handle ignored URLs with suppressed risks', async () => {
      const dataWithSuppressed: ReportData = {
        ...mockData,
        ignoredUrls: [
          {
            loc: 'https://example.com/ignored',
            risks: [{ category: 'SuppressedCat', pattern: 'p', reason: 'r', type: "literal" }],
            source: 's',
            ignored: true,
            ignoredBy: 'Policy1'
          }
        ]
      };
      const reporter = new HtmlReporter('report.html');
      await reporter.generate(dataWithSuppressed);

      const call = vi.mocked(fs.writeFile).mock.calls.find(c => c[0] === 'report.html');
      expect(call).toBeDefined();
      const html = call[1] as string;
      expect(html).toContain('Suppressed Risks: SuppressedCat');
      expect(html).toContain('by Policy1');
    });
  });
});
