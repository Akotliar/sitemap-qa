import { describe, it, expect } from 'vitest';
import { loadConfig } from '@/config/config-loader';
import { DEFAULT_CONFIG } from '@/types/config';

describe('loadConfig', () => {
  it('should return defaults when no config provided', async () => {
    const config = await loadConfig({});
    // Note: May include project config from .sitemap-qa.config.json if it exists
    expect(config.timeout).toBe(DEFAULT_CONFIG.timeout);
    expect(config.concurrency).toBe(DEFAULT_CONFIG.concurrency);
    expect(config.outputFormat).toBe(DEFAULT_CONFIG.outputFormat);
  });
  
  it('should parse timeout from CLI options', async () => {
    const config = await loadConfig({ timeout: '60' });
    expect(config.timeout).toBe(60);
  });
  
  it('should handle --verbose flag', async () => {
    const config = await loadConfig({ verbose: true });
    expect(config.verbose).toBe(true);
  });
  
  it('should handle --output flag', async () => {
    const config = await loadConfig({ output: 'json' });
    expect(config.outputFormat).toBe('json');
  });
  
  it('should not override with default CLI string values', async () => {
    // When CLI provides default values as strings, they should not override config
    const config = await loadConfig({ timeout: '30' });
    // Should use defaults since no config file exists and CLI values match defaults
    expect(config.timeout).toBe(30);
  });
  
  it('should validate timeout range - too high', async () => {
    await expect(loadConfig({ timeout: '500' })).rejects.toThrow('Timeout must be between 1 and 300 seconds');
  });
  
  it('should validate timeout range - too low', async () => {
    await expect(loadConfig({ timeout: '0' })).rejects.toThrow('Timeout must be between 1 and 300 seconds');
  });
  
  it('should validate output format', async () => {
    await expect(loadConfig({ output: 'invalid' })).rejects.toThrow('Output format must be json or html');
  });
  
  it('should accept valid timeout values', async () => {
    const config = await loadConfig({ timeout: '150' });
    expect(config.timeout).toBe(150);
  });
  
  it('should preserve other config values when overriding one', async () => {
    const config = await loadConfig({ timeout: '60' });
    expect(config.timeout).toBe(60);
    expect(config.concurrency).toBe(DEFAULT_CONFIG.concurrency);
  });
  
  it('should parse comma-separated accepted patterns from CLI', async () => {
    const config = await loadConfig({ acceptedPatterns: '/admin/allowed,staging\\.example\\.com,/internal/' });
    expect(config.acceptedPatterns).toEqual(['/admin/allowed', 'staging\\.example\\.com', '/internal/']);
  });
  
  it('should handle single accepted pattern', async () => {
    const config = await loadConfig({ acceptedPatterns: '/admin/dashboard' });
    expect(config.acceptedPatterns).toEqual(['/admin/dashboard']);
  });
  
  it('should trim whitespace from accepted patterns', async () => {
    const config = await loadConfig({ acceptedPatterns: ' /admin/allowed , staging\\.example\\.com , /internal/ ' });
    expect(config.acceptedPatterns).toEqual(['/admin/allowed', 'staging\\.example\\.com', '/internal/']);
  });
  
  it('should filter out empty accepted patterns', async () => {
    const config = await loadConfig({ acceptedPatterns: '/admin/allowed,,/internal/' });
    expect(config.acceptedPatterns).toEqual(['/admin/allowed', '/internal/']);
  });
});
