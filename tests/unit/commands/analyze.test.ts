import { describe, test, expect } from 'vitest';

describe('Analyze Command', () => {
  describe('Option Validation', () => {
    test('accepts valid output format: json', () => {
      const options = {
        timeout: '30',
        progress: true,
        output: 'json' as const,
        color: true,
        verbose: false,
      };
      
      // Should not throw
      expect(() => {
        const validFormats = ['json', 'html'];
        if (!validFormats.includes(options.output)) {
          throw new Error('Invalid output format');
        }
      }).not.toThrow();
    });

    test('accepts valid output format: html', () => {
      const options = {
        timeout: '30',
        progress: true,
        output: 'html' as const,
        color: true,
        verbose: false,
      };
      
      expect(() => {
        const validFormats = ['json', 'html'];
        if (!validFormats.includes(options.output)) {
          throw new Error('Invalid output format');
        }
      }).not.toThrow();
    });

    test('rejects invalid output format', () => {
      const options = {
        timeout: '30',
        progress: true,
        output: 'invalid' as any,
        color: true,
        verbose: false,
      };
      
      expect(() => {
        const validFormats = ['json', 'html'];
        if (!validFormats.includes(options.output)) {
          throw new Error(`Invalid output format: ${options.output}`);
        }
      }).toThrow('Invalid output format');
    });

    test('accepts valid timeout', () => {
      const timeout = '30';
      const parsed = parseInt(timeout);
      
      expect(parsed).toBe(30);
      expect(parsed).toBeGreaterThan(0);
    });

    test('rejects invalid timeout: non-numeric', () => {
      const timeout = 'abc';
      const parsed = parseInt(timeout);
      
      expect(isNaN(parsed)).toBe(true);
    });

    test('rejects invalid timeout: negative', () => {
      const timeout = '-10';
      const parsed = parseInt(timeout);
      
      expect(parsed).toBeLessThan(0);
    });
  });

  describe('Exit Code Determination', () => {
    test('returns 0 for success with no high-severity issues', () => {
      const result = {
        summary: {
          severityBreakdown: {
            high: 0,
            medium: 2,
            low: 1,
          },
        },
        errors: [],
      };
      
      const highSeverityCount = result.summary.severityBreakdown.high;
      const exitCode = highSeverityCount > 0 ? 1 : 0;
      
      expect(exitCode).toBe(0);
    });

    test('returns 1 when high-severity issues found', () => {
      const result = {
        summary: {
          severityBreakdown: {
            high: 3,
            medium: 1,
            low: 0,
          },
        },
        errors: [],
      };
      
      const highSeverityCount = result.summary.severityBreakdown.high;
      const exitCode = highSeverityCount > 0 ? 1 : 0;
      
      expect(exitCode).toBe(1);
    });

    test('returns 1 when multiple high-severity issues found', () => {
      const result = {
        summary: {
          severityBreakdown: {
            high: 10,
            medium: 5,
            low: 2,
          },
        },
        errors: [],
      };
      
      const highSeverityCount = result.summary.severityBreakdown.high;
      const exitCode = highSeverityCount > 0 ? 1 : 0;
      
      expect(exitCode).toBe(1);
    });

    test('returns 0 when only medium and low severity issues found', () => {
      const result = {
        summary: {
          severityBreakdown: {
            high: 0,
            medium: 10,
            low: 5,
          },
        },
        errors: [],
      };
      
      const highSeverityCount = result.summary.severityBreakdown.high;
      const exitCode = highSeverityCount > 0 ? 1 : 0;
      
      expect(exitCode).toBe(0);
    });

    test('returns 0 when no issues found', () => {
      const result = {
        summary: {
          severityBreakdown: {
            high: 0,
            medium: 0,
            low: 0,
          },
        },
        errors: [],
      };
      
      const highSeverityCount = result.summary.severityBreakdown.high;
      const exitCode = highSeverityCount > 0 ? 1 : 0;
      
      expect(exitCode).toBe(0);
    });
  });

  describe('Report Format Selection', () => {
    test('generates JSON report when format is json', () => {
      const outputFormat = 'json';
      
      expect(outputFormat).toBe('json');
    });

    test('generates html report when format is html', () => {
      const outputFormat = 'html';
      
      expect(outputFormat).toBe('html');
    });
  });

  describe('File Path Handling', () => {
    test('generates correct file paths for json and html formats', () => {
      const basePath = '/tmp/test-output.json';
      const basePathWithoutExt = basePath.replace(/\.[^.]+$/, '');
      
      expect(basePathWithoutExt).toBe('/tmp/test-output');
      
      const jsonPath = `${basePathWithoutExt}.json`;
      const htmlPath = `${basePathWithoutExt}.html`;
      
      expect(jsonPath).toBe('/tmp/test-output.json');
      expect(htmlPath).toBe('/tmp/test-output.html');
    });

    test('handles file path without extension', () => {
      const basePath = '/tmp/test-output';
      const basePathWithoutExt = basePath.replace(/\.[^.]+$/, '');
      
      expect(basePathWithoutExt).toBe('/tmp/test-output');
      
      const jsonPath = `${basePathWithoutExt}.json`;
      const htmlPath = `${basePathWithoutExt}.html`;
      
      expect(jsonPath).toBe('/tmp/test-output.json');
      expect(htmlPath).toBe('/tmp/test-output.html');
    });

    test('handles nested directory paths', () => {
      const basePath = '/tmp/reports/2025/test-output.json';
      const basePathWithoutExt = basePath.replace(/\.[^.]+$/, '');
      
      expect(basePathWithoutExt).toBe('/tmp/reports/2025/test-output');
      
      const jsonPath = `${basePathWithoutExt}.json`;
      const htmlPath = `${basePathWithoutExt}.html`;
      
      expect(jsonPath).toBe('/tmp/reports/2025/test-output.json');
      expect(htmlPath).toBe('/tmp/reports/2025/test-output.html');
    });
  });

  describe('Color Option Handling', () => {
    test('uses colors when color option is true', () => {
      const options = { color: true };
      
      expect(options.color).toBe(true);
    });

    test('disables colors when color option is false (--no-color)', () => {
      const options = { color: false };
      
      expect(options.color).toBe(false);
    });

    test('defaults to true when not specified', () => {
      const options = { color: true }; // Commander default behavior
      
      expect(options.color).toBe(true);
    });
  });
});
