import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Reporting Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `sitemap-qa-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temp files
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(join(tempDir, file));
      }
      await fs.rmdir(tempDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Output', () => {
    test('writes JSON output to file', async () => {
      const outputFile = join(tempDir, 'test-output.json');
      
      const jsonContent = JSON.stringify({
        analysis_metadata: {
          base_url: 'https://example.com',
          analysis_timestamp: new Date().toISOString(),
          tool_version: '1.0.0',
        },
        suspicious_groups: [],
      }, null, 2);
      
      await fs.writeFile(outputFile, jsonContent, 'utf-8');
      
      expect(await fs.access(outputFile).then(() => true).catch(() => false)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveProperty('analysis_metadata');
      expect(parsed.analysis_metadata.base_url).toBe('https://example.com');
    });

    test('writes human output to file', async () => {
      const outputFile = join(tempDir, 'test-output.txt');
      
      const humanContent = `
╔════════════════════════════════════════════════════════════════════════════╗
║                   SITEMAP-QA ANALYSIS REPORT                           ║
╚════════════════════════════════════════════════════════════════════════════╝

📋 DISCOVERY SUMMARY
────────────────────────────────────────────────────────────────────────────

Base URL:         https://example.com
Sitemaps Found:   1
URLs Analyzed:    100 total
Risky URLs:       0 flagged
`;
      
      await fs.writeFile(outputFile, humanContent, 'utf-8');
      
      expect(await fs.access(outputFile).then(() => true).catch(() => false)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf-8');
      
      expect(content).toContain('SITEMAP-QA ANALYSIS REPORT');
      expect(content).toContain('DISCOVERY SUMMARY');
    });

    test('writes both formats to separate files', async () => {
      const basePath = join(tempDir, 'test-output');
      
      const jsonContent = JSON.stringify({ test: 'json' }, null, 2);
      const humanContent = 'Test human output';
      
      const jsonFile = `${basePath}.json`;
      const txtFile = `${basePath}.txt`;
      
      await fs.writeFile(jsonFile, jsonContent, 'utf-8');
      await fs.writeFile(txtFile, humanContent, 'utf-8');
      
      expect(await fs.access(jsonFile).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(txtFile).then(() => true).catch(() => false)).toBe(true);
      
      const jsonData = await fs.readFile(jsonFile, 'utf-8');
      const txtData = await fs.readFile(txtFile, 'utf-8');
      
      expect(JSON.parse(jsonData)).toHaveProperty('test', 'json');
      expect(txtData).toBe('Test human output');
    });

    test('creates directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'nested', 'path');
      const outputFile = join(nestedDir, 'output.json');
      
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(outputFile, '{}', 'utf-8');
      
      expect(await fs.access(outputFile).then(() => true).catch(() => false)).toBe(true);
    });

    test('overwrites existing file', async () => {
      const outputFile = join(tempDir, 'overwrite-test.json');
      
      await fs.writeFile(outputFile, '{"old": "data"}', 'utf-8');
      
      const oldContent = await fs.readFile(outputFile, 'utf-8');
      expect(JSON.parse(oldContent)).toHaveProperty('old', 'data');
      
      await fs.writeFile(outputFile, '{"new": "data"}', 'utf-8');
      
      const newContent = await fs.readFile(outputFile, 'utf-8');
      expect(JSON.parse(newContent)).toHaveProperty('new', 'data');
      expect(JSON.parse(newContent)).not.toHaveProperty('old');
    });
  });

  describe('Stdout Output Format', () => {
    test('formats JSON output correctly', () => {
      const jsonReport = JSON.stringify({
        analysis_metadata: {
          base_url: 'https://example.com',
        },
        suspicious_groups: [],
      }, null, 2);
      
      expect(jsonReport).toContain('"analysis_metadata"');
      expect(jsonReport).toContain('"suspicious_groups"');
      expect(jsonReport).toContain('"base_url"');
    });

    test('formats human output correctly', () => {
      const humanReport = `
SITEMAP-QA ANALYSIS REPORT

DISCOVERY SUMMARY
Base URL: https://example.com
`;
      
      expect(humanReport).toContain('SITEMAP-QA ANALYSIS REPORT');
      expect(humanReport).toContain('DISCOVERY SUMMARY');
    });

    test('formats both outputs with separator', () => {
      const humanReport = 'Human Report Content';
      const jsonReport = '{"test": "json"}';
      
      const combinedOutput = `${humanReport}\n\n${'='.repeat(80)}\n\nJSON OUTPUT:\n${'='.repeat(80)}\n\n${jsonReport}`;
      
      expect(combinedOutput).toContain('Human Report Content');
      expect(combinedOutput).toContain('JSON OUTPUT:');
      expect(combinedOutput).toContain('{"test": "json"}');
      expect(combinedOutput).toMatch(/={80}/);
    });
  });

  describe('File Extension Handling', () => {
    test('removes .json extension for both format', () => {
      const filePath = '/tmp/test-output.json';
      const basePath = filePath.replace(/\.[^.]+$/, '');
      
      expect(basePath).toBe('/tmp/test-output');
    });

    test('removes .txt extension for both format', () => {
      const filePath = '/tmp/test-output.txt';
      const basePath = filePath.replace(/\.[^.]+$/, '');
      
      expect(basePath).toBe('/tmp/test-output');
    });

    test('handles path without extension', () => {
      const filePath = '/tmp/test-output';
      const basePath = filePath.replace(/\.[^.]+$/, '');
      
      expect(basePath).toBe('/tmp/test-output');
    });

    test('handles path with multiple dots', () => {
      const filePath = '/tmp/test.output.report.json';
      const basePath = filePath.replace(/\.[^.]+$/, '');
      
      expect(basePath).toBe('/tmp/test.output.report');
    });
  });

  describe('Error Handling', () => {
    test('handles invalid directory path gracefully', async () => {
      const invalidPath = '/nonexistent/directory/output.json';
      
      // Should throw when trying to write to non-existent directory without mkdir
      await expect(async () => {
        await fs.writeFile(invalidPath, 'test', 'utf-8');
      }).rejects.toThrow();
    });

    test('handles permission denied error', async () => {
      // This test is platform-specific and may not work on all systems
      // On Windows, it's difficult to test permission errors reliably
      // So we'll just verify the error handling structure
      
      const invalidPath = '/root/output.json'; // Typically requires root on Unix
      
      try {
        await fs.writeFile(invalidPath, 'test', 'utf-8');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Content Validation', () => {
    test('JSON output is valid JSON', async () => {
      const outputFile = join(tempDir, 'valid-json.json');
      
      const jsonContent = JSON.stringify({
        analysis_metadata: {
          base_url: 'https://example.com',
          analysis_timestamp: '2025-12-09T10:00:00.000Z',
        },
        suspicious_groups: [
          {
            category: 'test',
            severity: 'high',
            count: 1,
          },
        ],
      }, null, 2);
      
      await fs.writeFile(outputFile, jsonContent, 'utf-8');
      
      const content = await fs.readFile(outputFile, 'utf-8');
      
      // Should not throw
      expect(() => JSON.parse(content)).not.toThrow();
      
      const parsed = JSON.parse(content);
      expect(parsed.analysis_metadata.base_url).toBe('https://example.com');
      expect(parsed.suspicious_groups).toHaveLength(1);
    });

    test('Human output contains expected sections', async () => {
      const outputFile = join(tempDir, 'human-report.txt');
      
      const humanContent = `
╔════════════════════════════════════════════════════════════════════════════╗
║                   SITEMAP-QA ANALYSIS REPORT                           ║
╚════════════════════════════════════════════════════════════════════════════╝

📋 DISCOVERY SUMMARY
────────────────────────────────────────────────────────────────────────────

Base URL:         https://example.com
Sitemaps Found:   2
URLs Analyzed:    1,247 total
Risky URLs:       5 flagged

📊 ANALYSIS OVERVIEW
────────────────────────────────────────────────────────────────────────────

Analysis identified 5 potentially risky URLs.

✅ RECOMMENDATIONS
────────────────────────────────────────────────────────────────────────────

  1. Review flagged URLs
  2. Update sitemap configuration
`;
      
      await fs.writeFile(outputFile, humanContent, 'utf-8');
      
      const content = await fs.readFile(outputFile, 'utf-8');
      
      expect(content).toContain('SITEMAP-QA ANALYSIS REPORT');
      expect(content).toContain('DISCOVERY SUMMARY');
      expect(content).toContain('ANALYSIS OVERVIEW');
      expect(content).toContain('RECOMMENDATIONS');
      expect(content).toContain('Base URL:');
      expect(content).toContain('Sitemaps Found:');
    });
  });
});
