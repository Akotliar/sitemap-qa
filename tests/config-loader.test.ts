import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../src/config/loader';
import fs from 'node:fs';
import yaml from 'js-yaml';

vi.mock('node:fs');

// Mock DEFAULT_POLICIES to have some initial patterns for testing merge logic
vi.mock('../src/config/defaults', () => ({
  DEFAULT_POLICIES: {
    acceptable_patterns: [
      {
        type: 'literal',
        value: '/default-safe',
        reason: 'Default safe path'
      }
    ],
    policies: [
      {
        category: 'Security',
        patterns: [
          { type: 'literal', value: '/admin', reason: 'Admin' }
        ]
      }
    ],
    outputFormat: 'all',
    enforceDomainConsistency: true
  }
}));

describe('ConfigLoader', () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const errorSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('console', {
      error: errorSpy,
      log: vi.fn(),
      warn: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should merge acceptable_patterns from user config with defaults', () => {
    const mockUserConfig = {
      acceptable_patterns: [
        {
          type: 'literal',
          value: '/user-safe',
          reason: 'User safe path'
        }
      ],
      policies: []
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockUserConfig));

    const config = ConfigLoader.load('sitemap-qa.yaml');

    // Should have 2 patterns: 1 from default, 1 from user
    expect(config.acceptable_patterns).toHaveLength(2);
    expect(config.acceptable_patterns[0].value).toBe('/default-safe');
    expect(config.acceptable_patterns[1].value).toBe('/user-safe');
  });

  it('should merge policies correctly (user overrides default category)', () => {
    const mockUserConfig = {
      policies: [
        {
          category: 'Security',
          patterns: [
            { type: 'literal', value: '/new-admin', reason: 'New Admin' }
          ]
        }
      ]
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockUserConfig));

    const config = ConfigLoader.load('sitemap-qa.yaml');

    expect(config.policies).toHaveLength(1);
    expect(config.policies[0].patterns[0].value).toBe('/new-admin');
  });

  it('should merge enforceDomainConsistency from user config', () => {
    const mockUserConfig = {
      enforceDomainConsistency: true,
      policies: []
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockUserConfig));

    const config = ConfigLoader.load('sitemap-qa.yaml');

    expect(config.enforceDomainConsistency).toBe(true);
  });

  it('should merge outputFormat from user config', () => {
    const mockUserConfig = {
      outputFormat: 'json',
      policies: []
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockUserConfig));

    const config = ConfigLoader.load('sitemap-qa.yaml');

    expect(config.outputFormat).toBe('json');
  });

  it('should handle validation errors', () => {
    const invalidConfig = {
      policies: [
        {
          category: 'Security',
          patterns: [
            { type: 'invalid-type', value: '/admin' } // Missing reason and invalid type
          ]
        }
      ]
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(invalidConfig));

    ConfigLoader.load('sitemap-qa.yaml');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration Validation Error:'));
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('should handle file not found when path is provided', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    ConfigLoader.load('non-existent.yaml');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration file not found'));
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('should handle read errors', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('Read error');
    });

    ConfigLoader.load('sitemap-qa.yaml');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load configuration:'), expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('should add new user categories during merge', () => {
    const mockUserConfig = {
      policies: [
        {
          category: 'New Category',
          patterns: [{ type: 'literal', value: '/new', reason: 'r' }]
        }
      ]
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockUserConfig));

    const config = ConfigLoader.load('sitemap-qa.yaml');

    expect(config.policies).toHaveLength(2); // Default Security + New Category
    expect(config.policies.find(p => p.category === 'New Category')).toBeDefined();
  });

  it('should merge outDir from user config', () => {
    const mockUserConfig = {
      outDir: './custom-out',
      policies: []
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockUserConfig));

    const config = ConfigLoader.load('sitemap-qa.yaml');

    expect(config.outDir).toBe('./custom-out');
  });
});
