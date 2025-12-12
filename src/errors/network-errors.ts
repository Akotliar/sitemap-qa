export class NetworkError extends Error {
  readonly code = 'NETWORK_ERROR';
  
  constructor(
    public readonly url: string,
    public readonly originalError: Error
  ) {
    super(`Network request failed for ${url}: ${originalError.message}`);
    this.name = 'NetworkError';
  }
}

export class HttpError extends Error {
  readonly code = 'HTTP_ERROR';
  
  constructor(
    public readonly url: string,
    public readonly statusCode: number,
    public readonly statusText?: string
  ) {
    let message = `HTTP ${statusCode} error for ${url}`;
    
    // Add helpful context for common blocking scenarios
    if (statusCode === 403) {
      message += '\n   Note: 403 Forbidden often indicates bot protection (Cloudflare, etc.) or access restrictions';
    }
    
    super(message);
    this.name = 'HttpError';
  }
}
