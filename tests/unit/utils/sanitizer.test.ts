import { describe, it, expect } from 'vitest';
import { sanitizeUrl, sanitizeUrls } from '@/utils/sanitizer';

describe('sanitizeUrl', () => {
  it('should redact token parameter', () => {
    const result = sanitizeUrl('https://example.com/api?token=abc123&page=1');
    expect(result).toContain('token=%5BREDACTED%5D');
    expect(result).toContain('page=1');
  });
  
  it('should redact auth_token parameter', () => {
    const result = sanitizeUrl('https://example.com/api?auth_token=xyz789');
    expect(result).toContain('auth_token=%5BREDACTED%5D');
  });
  
  it('should redact apikey parameter', () => {
    const result = sanitizeUrl('https://example.com/api?apikey=secret123');
    expect(result).toContain('apikey=%5BREDACTED%5D');
  });
  
  it('should redact password parameter', () => {
    const result = sanitizeUrl('https://example.com/login?password=mypass');
    expect(result).toContain('password=%5BREDACTED%5D');
  });
  
  it('should redact secret parameter', () => {
    const result = sanitizeUrl('https://example.com/api?secret=topsecret');
    expect(result).toContain('secret=%5BREDACTED%5D');
  });
  
  it('should redact session parameter', () => {
    const result = sanitizeUrl('https://example.com/page?session=12345');
    expect(result).toContain('session=%5BREDACTED%5D');
  });
  
  it('should redact multiple sensitive parameters', () => {
    const result = sanitizeUrl('https://example.com/api?token=abc&apikey=xyz&page=1');
    expect(result).toContain('token=%5BREDACTED%5D');
    expect(result).toContain('apikey=%5BREDACTED%5D');
    expect(result).toContain('page=1');
  });
  
  it('should not modify URLs without sensitive parameters', () => {
    const url = 'https://example.com/products?page=1&sort=price';
    const result = sanitizeUrl(url);
    expect(result).toBe(url);
  });
  
  it('should handle invalid URLs gracefully', () => {
    const invalidUrl = 'not-a-valid-url';
    const result = sanitizeUrl(invalidUrl);
    expect(result).toBe(invalidUrl);
  });
  
  it('should preserve URL structure after sanitization', () => {
    const result = sanitizeUrl('https://example.com/api/v1/data?token=secret&limit=10');
    expect(result).toContain('https://example.com/api/v1/data');
    expect(result).toContain('token=%5BREDACTED%5D');
    expect(result).toContain('limit=10');
  });
});

describe('sanitizeUrls', () => {
  it('should sanitize multiple URLs', () => {
    const urls = [
      'https://example.com/api?token=abc',
      'https://example.com/data?apikey=xyz',
      'https://example.com/products?page=1'
    ];
    
    const results = sanitizeUrls(urls);
    
    expect(results[0]).toContain('token=%5BREDACTED%5D');
    expect(results[1]).toContain('apikey=%5BREDACTED%5D');
    expect(results[2]).toBe('https://example.com/products?page=1');
  });
  
  it('should handle empty array', () => {
    const results = sanitizeUrls([]);
    expect(results).toEqual([]);
  });
});
