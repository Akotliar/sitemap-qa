import { NetworkError, HttpError } from '@/errors/network-errors';
import { chromium } from 'playwright';


export interface FetchOptions {
  timeout?: number;        // Timeout in seconds
  maxRetries?: number;     // Maximum retry attempts (default: 3)
  retryDelay?: number;     // Initial retry delay in ms (default: 1000)
  useBrowser?: boolean;    // Force use of headless browser (default: auto-detect on 403)
}

export interface FetchResult {
  content: string;         // Response body as text
  statusCode: number;      // HTTP status code
  url: string;             // Final URL after redirects
}

/**
 * Fetch URL using headless browser (Playwright) to bypass bot protection
 */
async function fetchUrlWithBrowser(
  url: string,
  timeout: number
): Promise<FetchResult> {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled', // Hide automation flags
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const page = await context.newPage();
    
    // Add script to mask automation
    await page.addInitScript(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Mock Chrome runtime
      (window as any).chrome = {
        runtime: {},
      };
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    });
    
    // Set timeout for page navigation
    page.setDefaultTimeout(timeout * 1000);
    
    // Navigate and wait for content to load
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Changed from networkidle - faster for simple XML
      timeout: timeout * 1000 
    });
    
    if (!response) {
      throw new Error('No response received from page');
    }
    
    const statusCode = response.status();
    
    // For XML sitemaps, get the raw content
    const content = await page.content();
    const finalUrl = page.url();
    
    await browser.close();
    
    if (statusCode >= 200 && statusCode < 300) {
      return {
        content,
        statusCode,
        url: finalUrl
      };
    }
    
    throw new HttpError(finalUrl, statusCode);
    
  } catch (error: any) {
    if (browser) {
      await browser.close();
    }
    
    if (error.code === 'HTTP_ERROR') {
      throw error;
    }
    
    throw new NetworkError(url, error);
  }
}

export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    timeout = 30,
    maxRetries = 3,
    retryDelay = 1000,
    useBrowser = false
  } = options;

  // Validate URL before starting retry loop
  new URL(url);  // Throws TypeError if invalid

  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  
  let lastError: Error | null = null;
  let attemptedBrowser = false;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If forced to use browser or if we previously got 403, use browser
      if (useBrowser || attemptedBrowser) {
        return await fetchUrlWithBrowser(url, timeout);
      }
      
      // Use fetch with automatic redirect following
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'sitemap-qa/1.0.0',
          'Accept': 'text/xml,application/xml,text/plain,*/*'
        },
        signal: controller.signal,
        redirect: 'follow'  // Follow redirects automatically (default behavior)
      });
      
      clearTimeout(timeoutId);
      
      const statusCode = response.status;
      const body = await response.text();
      
      // Success - return result
      if (statusCode >= 200 && statusCode < 300) {
        return {
          content: body,
          statusCode: statusCode,
          url: response.url  // Final URL after redirects
        };
      }
      
      // If we get 403, try with browser on next attempt
      if (statusCode === 403 && !attemptedBrowser) {
        attemptedBrowser = true;
        // Silently retry with headless browser
        continue; // Retry immediately with browser
      }
      
      // Non-retryable error - throw immediately
      if (!retryableStatuses.includes(statusCode)) {
        throw new HttpError(response.url, statusCode);
      }
      
      // Retryable error - continue to next attempt
      lastError = new HttpError(response.url, statusCode);
      
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
