import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
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
});
