import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initCommand } from '../src/commands/init';
import { analyzeCommand } from '../src/commands/analyze';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { ConfigLoader } from '../src/config/loader';
import { ExtractorService } from '../src/core/extractor';
import { MatcherService } from '../src/core/matcher';

// Create mock generate function at module level
const mockGenerate = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('chalk', () => {
  const m = {
    red: vi.fn((s) => s),
    green: vi.fn((s) => s),
    blue: vi.fn((s) => s),
    cyan: vi.fn((s) => s),
    gray: vi.fn((s) => s),
    yellow: vi.fn((s) => s),
    bold: {
      blue: vi.fn((s) => s),
      yellow: vi.fn((s) => s),
    },
  };
  return {
    default: m,
    ...m,
  };
});
vi.mock('../src/config/loader');
vi.mock('../src/core/extractor');
vi.mock('../src/core/matcher');
vi.mock('../src/reporters/console-reporter', () => ({
  ConsoleReporter: vi.fn(function() {
    return {
      generate: mockGenerate,
    };
  }),
}));
vi.mock('../src/reporters/json-reporter', () => ({
  JsonReporter: vi.fn(function() {
    return {
      generate: mockGenerate,
    };
  }),
}));
vi.mock('../src/reporters/html-reporter', () => ({
  HtmlReporter: vi.fn(function() {
    return {
      generate: mockGenerate,
    };
  }),
}));

describe('CLI Commands', () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const logSpy = vi.fn();
  const errorSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockGenerate after clearAllMocks
    mockGenerate.mockResolvedValue(undefined);
    vi.stubGlobal('console', {
      log: logSpy,
      error: errorSpy,
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('init command', () => {
    it('should create a sitemap-qa.yaml if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('sitemap-qa.yaml'),
        expect.stringContaining('outDir: "./sitemap-qa/report"'),
        'utf8'
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully created'));
    });

    it('should exit with 1 if sitemap-qa.yaml already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit with 1 if writing fails', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write failed');
      });

      await initCommand.parseAsync(['node', 'test', 'init']);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create'), expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('analyze command', () => {
    const mockConfig = {
      policies: [],
      acceptable_patterns: [],
      outputFormat: 'all',
      enforceDomainConsistency: true,
      outDir: './test-reports'
    };

    beforeEach(() => {
      vi.mocked(ConfigLoader.load).mockReturnValue(mockConfig as any);
      vi.mocked(ExtractorService.prototype.extract).mockImplementation(async function* () {
        yield { loc: 'https://cli-test1.local/page1', risks: [], source: 'sitemap.xml' };
      });
      vi.mocked(MatcherService.prototype.match).mockReturnValue([]);
      vi.mocked(ExtractorService.prototype.getDiscoveredSitemaps).mockReturnValue(['sitemap.xml']);
      
      // Mock fs/promises.mkdir to return a resolved promise
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
    });

    it('should run analysis successfully when no risks are found', async () => {
      await analyzeCommand.parseAsync(['node', 'test', 'analyze', 'https://cli-test1.local/sitemap.xml']);

      expect(ConfigLoader.load).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      
      // Verify that reporters were called with the expected data structure
      expect(mockGenerate).toHaveBeenCalled();
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          totalUrls: 1,
          totalRisks: 0,
          urlsWithRisks: [],
          discoveredSitemaps: ['sitemap.xml'],
          ignoredUrls: [],
        })
      );
      
      // Verify reporter was called 3 times (console, json, html since outputFormat is 'all')
      expect(mockGenerate).toHaveBeenCalledTimes(3);
      
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Starting analysis'));
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle ignored URLs and progress reporting', async () => {
      vi.mocked(ExtractorService.prototype.extract).mockImplementation(async function* () {
        for (let i = 1; i <= 100; i++) {
          yield { 
            loc: `https://cli-test2.local/page${i}`, 
            risks: [], 
            source: 'sitemap.xml',
            ignored: i === 1,
            ignoredBy: i === 1 ? 'Test' : undefined
          };
        }
      });

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await analyzeCommand.parseAsync(['node', 'test', 'analyze', 'https://cli-test2.local/sitemap.xml']);

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Processed 100 URLs'));
      expect(exitSpy).toHaveBeenCalledWith(0);
      
      stdoutSpy.mockRestore();
    });

    it('should exit with 1 when risks are found', async () => {
      vi.mocked(MatcherService.prototype.match).mockReturnValue([
        { category: 'Security', pattern: '**/admin/**', reason: 'Sensitive', type: "glob" }
      ]);

      await analyzeCommand.parseAsync(['node', 'test', 'analyze', 'https://cli-test3.local/sitemap.xml']);

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle analysis failure', async () => {
      vi.mocked(ExtractorService.prototype.extract).mockImplementation(async function* () {
        throw new Error('Extraction failed');
      });

      await analyzeCommand.parseAsync(['node', 'test', 'analyze', 'https://cli-test4.local/sitemap.xml']);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Analysis failed:'), expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should respect CLI options', async () => {
      await analyzeCommand.parseAsync([
        'node', 'test', 'analyze', 'https://cli-test5.local/sitemap.xml',
        '--config', 'custom-config.yaml',
        '--output', 'json',
        '--out-dir', './custom-out'
      ]);

      expect(ConfigLoader.load).toHaveBeenCalledWith('custom-config.yaml');
    });
  });
});
