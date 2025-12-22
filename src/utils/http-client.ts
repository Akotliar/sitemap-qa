import { NetworkError, HttpError } from '@/errors/network-errors';
import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { gunzipSync } from 'zlib';

// Create persistent HTTP agents for connection pooling
const httpAgent = new HttpAgent({ 
  keepAlive: true, 
  maxSockets: 200,  // Allow many concurrent connections
  maxFreeSockets: 50,
  timeout: 15000
});

const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 200,
  maxFreeSockets: 50,
  timeout: 15000
});

// Create axios instance with connection pooling
const axiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  maxRedirects: 5,
  validateStatus: () => true // Don't throw on any status code
});


export interface FetchOptions {
  timeout?: number;        // Timeout in seconds
  maxRetries?: number;     // Maximum retry attempts (default: 3)
  retryDelay?: number;     // Initial retry delay in ms (default: 1000)
}

export interface FetchResult {
  content: string;         // Response body as text
  statusCode: number;      // HTTP status code
  url: string;             // Final URL after redirects
}

export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    timeout = 30,
    maxRetries = 3,
    retryDelay = 1000
  } = options;

  // Validate URL before starting retry loop
  new URL(url);  // Throws TypeError if invalid

  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use axios with connection pooling for better performance
      // For .xml.gz files, we need to get binary data and decompress manually
      const isGzipped = url.toLowerCase().endsWith('.xml.gz');
      
      const response = await axiosInstance.get(url, {
        timeout: timeout * 1000,
        responseType: isGzipped ? 'arraybuffer' : 'text',
        headers: {
          'User-Agent': 'sitemap-qa/1.0.0 (compatible; +https://github.com/Akotliar/sitemap-qa)',
          'Accept': 'text/xml,application/xml,text/plain,*/*',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      });
      
      const statusCode = response.status;
      let body = response.data;
      
      // Decompress .xml.gz files manually
      if (isGzipped && statusCode >= 200 && statusCode < 300) {
        try {
          const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
          body = gunzipSync(buffer).toString('utf-8');
        } catch (error) {
          throw new Error(`Failed to decompress gzipped content from ${url}: ${error}`);
        }
      }
      
      // Success - return result
      if (statusCode >= 200 && statusCode < 300) {
        return {
          content: typeof body === 'string' ? body : JSON.stringify(body),
          statusCode: statusCode,
          url: response.request?.res?.responseUrl || url  // Final URL after redirects
        };
      }
      
      // Non-retryable error - throw immediately
      if (!retryableStatuses.includes(statusCode)) {
        throw new HttpError(response.request?.res?.responseUrl || url, statusCode);
      }
      
      // Retryable error - continue to next attempt
      lastError = new HttpError(response.request?.res?.responseUrl || url, statusCode);
      
    } catch (error: any) {
      // Already formatted HttpError - rethrow if non-retryable
      if (error.code === 'HTTP_ERROR') {
        const httpError = error as HttpError;
        if (!retryableStatuses.includes(httpError.statusCode)) {
          throw error;
        }
        lastError = error;
      } else {
        // Network error (connection failed, timeout, DNS error, etc.)
        lastError = new NetworkError(url, error);
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) break;
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All retries exhausted - throw last error
  throw lastError!;
}
