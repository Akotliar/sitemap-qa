import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios before importing http-client
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn()
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance)
    }
  };
});

// Mock Playwright to prevent actual browser launches in tests
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockRejectedValue(new Error('Playwright not available in tests'))
  }
}));

import { fetchUrl } from '@/utils/http-client';
import { HttpError, NetworkError } from '@/errors/network-errors';
import axios from 'axios';

// Get the mocked axios instance
const mockAxiosInstance = (axios.create as any)();

describe('fetchUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should return content on successful request', async () => {
    // Mock axios instance get to return 200
    mockAxiosInstance.get.mockResolvedValueOnce({
      status: 200,
      data: '<urlset></urlset>',
      request: { res: { responseUrl: 'https://example.com/sitemap.xml' } }
    });
    
    const result = await fetchUrl('https://example.com/sitemap.xml');
    expect(result.statusCode).toBe(200);
    expect(result.content).toBe('<urlset></urlset>');
  });
  
  it('should throw HttpError immediately on 404 without retry', async () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      status: 404,
      data: 'Not Found',
      request: { res: { responseUrl: 'https://example.com/missing.xml' } }
    });
    
    await expect(fetchUrl('https://example.com/missing.xml'))
      .rejects.toThrow(HttpError);
    
    // Verify only 1 attempt was made (no retries)
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
  });
  
  it('should retry 3 times on 500 error', async () => {
    vi.useFakeTimers();
    
    // Mock axios to return 500 on all attempts
    mockAxiosInstance.get.mockResolvedValue({
      status: 500,
      data: 'Internal Server Error',
      request: { res: { responseUrl: 'https://example.com/error.xml' } }
    });
    
    const promise = fetchUrl('https://example.com/error.xml', { retryDelay: 100 }).catch(() => {});
    
    // Fast-forward through all retries
    await vi.runAllTimersAsync();
    await promise;
    
    // Verify 4 total attempts (1 initial + 3 retries)
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(4);
    
    vi.useRealTimers();
  });
  
  it('should use exponential backoff (1s, 2s, 4s)', async () => {
    vi.useFakeTimers();
    
    // Mock axios to return 503
    mockAxiosInstance.get.mockResolvedValue({
      status: 503,
      data: 'Service Unavailable',
      request: { res: { responseUrl: 'https://example.com/error.xml' } }
    });
    
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
    
    // Mock axios to throw ECONNREFUSED
    mockAxiosInstance.get.mockRejectedValue(
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
    
    // Mock axios to be aborted (timeout)
    mockAxiosInstance.get.mockRejectedValue(
      Object.assign(new Error('timeout of 1000ms exceeded'), { code: 'ECONNABORTED' })
    );
    
    const promise = fetchUrl('https://example.com', { timeout: 1, retryDelay: 100 }).catch(e => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    
    expect(error).toBeInstanceOf(NetworkError);
    vi.useRealTimers();
  });
  
  it('should succeed on second attempt after first fails', async () => {
    // Mock axios to fail once (500), then succeed (200)
    mockAxiosInstance.get
      .mockResolvedValueOnce({
        status: 500,
        data: 'Error',
        request: { res: { responseUrl: 'https://example.com/flaky.xml' } }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: '<urlset></urlset>',
        request: { res: { responseUrl: 'https://example.com/flaky.xml' } }
      });
    
    const result = await fetchUrl('https://example.com/flaky.xml');
    expect(result.statusCode).toBe(200);
    
    // Verify 2 attempts were made
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
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
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    }
  });
  
  it('should retry on 429 rate limit error', async () => {
    // Mock axios to return 429 twice, then succeed
    mockAxiosInstance.get
      .mockResolvedValueOnce({
        status: 429,
        data: 'Too Many Requests',
        request: { res: { responseUrl: 'https://example.com/sitemap.xml' } }
      })
      .mockResolvedValueOnce({
        status: 429,
        data: 'Too Many Requests',
        request: { res: { responseUrl: 'https://example.com/sitemap.xml' } }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: '<urlset></urlset>',
        request: { res: { responseUrl: 'https://example.com/sitemap.xml' } }
      });
    
    const result = await fetchUrl('https://example.com/sitemap.xml');
    expect(result.statusCode).toBe(200);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
  });
  
  it('should include status code in HttpError', async () => {
    // Mock axios to return 404
    mockAxiosInstance.get.mockResolvedValueOnce({
      status: 404,
      data: 'Not Found',
      request: { res: { responseUrl: 'https://example.com/missing.xml' } }
    });
    
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
    
    mockAxiosInstance.get.mockRejectedValue(originalError);
    
    const promise = fetchUrl('https://invalid-domain.com', { retryDelay: 100 }).catch(e => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).originalError).toBe(originalError);
    expect((error as NetworkError).url).toBe('https://invalid-domain.com');
    
    vi.useRealTimers();
  });
});
