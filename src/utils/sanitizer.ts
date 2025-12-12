export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const sensitiveParams = [
      'token', 'auth', 'auth_token', 'access_token', 'api_token',
      'apikey', 'api_key', 'key',
      'password', 'passwd', 'pwd',
      'secret', 'client_secret',
      'session', 'sessionid', 'sid',
      'credentials'
    ];
    
    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    
    return parsed.toString();
  } catch {
    // Invalid URL - return as-is
    return url;
  }
}

export function sanitizeUrls(urls: string[]): string[] {
  return urls.map(url => sanitizeUrl(url));
}
