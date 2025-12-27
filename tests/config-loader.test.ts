import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../src/config/loader';
import fs from 'node:fs';
import yaml from 'js-yaml';

vi.mock('node:fs');

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

    expect(config.acceptable_patterns).toHaveLength(1);
    expect(config.acceptable_patterns[0].value).toBe('/user-safe');
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
});
