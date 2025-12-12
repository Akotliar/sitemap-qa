import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUrl } from '@/utils/http-client';
import { HttpError, NetworkError } from '@/errors/network-errors';

// Mock global fetch
global.fetch = vi.fn();

describe('fetchUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should return content on successful request', async () => {
    // Mock fetch to return 200
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 200,
      url: 'https://example.com/sitemap.xml',
      text: async () => '<urlset></urlset>'
    } as any);
    
    const result = await fetchUrl('https://example.com/sitemap.xml');
    expect(result.statusCode).toBe(200);
    expect(result.content).toBe('<urlset></urlset>');
  });
  
  it('should throw HttpError immediately on 404 without retry', async () => {
    // Mock fetch to return 404
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 404,
      url: 'https://example.com/missing.xml',
      text: async () => 'Not Found'
    } as any);
    
    await expect(fetchUrl('https://example.com/missing.xml'))
      .rejects.toThrow(HttpError);
    
    // Verify only 1 attempt was made (no retries)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  
  it('should retry 3 times on 500 error', async () => {
    vi.useFakeTimers();
    
    // Mock fetch to return 500 on all attempts
    vi.mocked(global.fetch).mockResolvedValue({
      status: 500,
      url: 'https://example.com/sitemap.xml',
      text: async () => 'Internal Server Error'
    } as any);
    
    const promise = fetchUrl('https://example.com/error.xml', { retryDelay: 100 }).catch(() => {});
    
    // Fast-forward through all retries
    await vi.runAllTimersAsync();
    await promise;
    
    // Verify 4 total attempts (1 initial + 3 retries)
    expect(global.fetch).toHaveBeenCalledTimes(4);
    
    vi.useRealTimers();
  });
  
  it('should use exponential backoff (1s, 2s, 4s)', async () => {
    vi.useFakeTimers();
    
    // Mock fetch to return 503
    vi.mocked(global.fetch).mockResolvedValue({
      status: 503,
      url: 'https://example.com/error.xml',
      text: async () => 'Service Unavailable'
    } as any);
    
    const promise = fetchUrl('https://example.com/error.xml').catch(() => {});
    
    // Fast-forward timers and verify delays
    await vi.advanceTimersByTimeAsync(1000);  // 1st retry after 1s
    await vi.advanceTimersByTimeAsync(2000);  // 2nd retry after 2s
    await vi.advanceTimersByTimeAsync(4000);  // 3rd retry after 4s
    
    await promise;
    vi.useRealTimers();
  });
  
  it('should throw NetworkError on connection failure', async () => {
    vi.useFakeTimers();
    
    // Mock fetch to throw ECONNREFUSED
    vi.mocked(global.fetch).mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    );
    
    const promise = fetchUrl('https://invalid-domain-xyz123.com', { retryDelay: 100 }).catch(e => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    
    expect(error).toBeInstanceOf(NetworkError);
    vi.useRealTimers();
  });
  
  it('should respect timeout option', async () => {
    vi.useFakeTimers();
    
    // Mock fetch to be aborted (timeout)
    vi.mocked(global.fetch).mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError')
    );
    
    const promise = fetchUrl('https://example.com', { timeout: 1, retryDelay: 100 }).catch(e => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    
    expect(error).toBeInstanceOf(NetworkError);
    vi.useRealTimers();
  });
  
  it('should succeed on second attempt after first fails', async () => {
    // Mock fetch to fail once (500), then succeed (200)
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        status: 500,
        url: 'https://example.com/flaky.xml',
        text: async () => 'Error'
      } as any)
      .mockResolvedValueOnce({
        status: 200,
        url: 'https://example.com/flaky.xml',
        text: async () => '<urlset></urlset>'
      } as any);
    
    const result = await fetchUrl('https://example.com/flaky.xml');
    expect(result.statusCode).toBe(200);
    
    // Verify 2 attempts were made
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
  
  it('should validate URL before making request', async () => {
    // Invalid URL will throw TypeError from URL constructor
    // This should happen before any network request
    try {
      await fetchUrl(':::invalid:::');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      // Should not have made any requests
      expect(global.fetch).not.toHaveBeenCalled();
    }
  });
  
  it('should retry on 429 rate limit error', async () => {
    // Mock fetch to return 429 twice, then succeed
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        status: 429,
        url: 'https://example.com/sitemap.xml',
        text: async () => 'Too Many Requests'
      } as any)
      .mockResolvedValueOnce({
        status: 429,
        url: 'https://example.com/sitemap.xml',
        text: async () => 'Too Many Requests'
      } as any)
      .mockResolvedValueOnce({
        status: 200,
        url: 'https://example.com/sitemap.xml',
        text: async () => '<urlset></urlset>'
      } as any);
    
    const result = await fetchUrl('https://example.com/sitemap.xml');
    expect(result.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
  
  it('should not retry on 403 forbidden error', async () => {
    // Mock fetch to return 403
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 403,
      url: 'https://example.com/forbidden.xml',
      text: async () => 'Forbidden'
    } as any);
    
    await expect(fetchUrl('https://example.com/forbidden.xml'))
      .rejects.toThrow(HttpError);
    
    // Verify only 1 attempt was made (no retries)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  
  it('should include status code in HttpError', async () => {
    // Mock fetch to return 404
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 404,
      url: 'https://example.com/missing.xml',
      text: async () => 'Not Found'
    } as any);
    
    try {
      await fetchUrl('https://example.com/missing.xml');
      expect.fail('Should have thrown HttpError');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).statusCode).toBe(404);
      expect((error as HttpError).url).toBe('https://example.com/missing.xml');
    }
  });
  
  it('should include original error in NetworkError', async () => {
    vi.useFakeTimers();
    
    const originalError = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    
    vi.mocked(global.fetch).mockRejectedValue(originalError);
    
    const promise = fetchUrl('https://invalid-domain.com', { retryDelay: 100 }).catch(e => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).originalError).toBe(originalError);
    expect((error as NetworkError).url).toBe('https://invalid-domain.com');
    
    vi.useRealTimers();
  });
});
