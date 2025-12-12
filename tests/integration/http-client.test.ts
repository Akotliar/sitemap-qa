import { describe, it, expect } from 'vitest';
import { fetchUrl } from '@/utils/http-client';

describe('fetchUrl integration', () => {
  it('should fetch real URL from example.com', async () => {
    const result = await fetchUrl('https://example.com');
    expect(result.statusCode).toBe(200);
    expect(result.content).toContain('Example Domain');
  }, 30000); // 30 second timeout for real network request
  
  it('should handle redirects transparently', async () => {
    // Many sites redirect http to https
    const result = await fetchUrl('http://example.com');
    expect(result.statusCode).toBe(200);
    expect(result.content).toContain('Example Domain');
  }, 30000);
  
  it('should respect custom timeout', async () => {
    const result = await fetchUrl('https://example.com', { timeout: 10 });
    expect(result.statusCode).toBe(200);
  }, 30000);
});
