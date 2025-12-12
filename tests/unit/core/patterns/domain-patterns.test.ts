import { describe, it, expect } from 'vitest';
import { createDomainMismatchPattern, ENVIRONMENT_PATTERNS, extractRootDomain } from '@/core/patterns/domain-patterns';

describe('extractRootDomain', () => {
  it('should extract root domain from hostname', () => {
    expect(extractRootDomain('www.example.com')).toBe('example.com');
    expect(extractRootDomain('blog.example.com')).toBe('example.com');
    expect(extractRootDomain('example.com')).toBe('example.com');
  });
  
  it('should handle single-part hostnames', () => {
    expect(extractRootDomain('localhost')).toBe('localhost');
  });
});

describe('createDomainMismatchPattern', () => {
  it('should create pattern that matches only base domain', () => {
    const pattern = createDomainMismatchPattern('https://example.com');
    
    expect('https://example.com/page'.match(pattern.regex)).toBeNull();
    expect('https://other.com/page'.match(pattern.regex)).toBeTruthy();
  });
  
  it('should allow www variant by default but flag other subdomains', () => {
    const pattern = createDomainMismatchPattern('https://example.com');
    
    // www variant should be allowed automatically
    expect('https://www.example.com/page'.match(pattern.regex)).toBeNull();
    // Other subdomains should still be flagged
    expect('https://blog.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://shop.example.com/page'.match(pattern.regex)).toBeTruthy();
  });
  
  it('should allow specified subdomains', () => {
    const pattern = createDomainMismatchPattern('https://example.com', {
      allowedSubdomains: ['www', 'blog']
    });
    
    expect('https://www.example.com/page'.match(pattern.regex)).toBeNull();
    expect('https://blog.example.com/page'.match(pattern.regex)).toBeNull();
    expect('https://example.com/page'.match(pattern.regex)).toBeNull();
    expect('https://shop.example.com/page'.match(pattern.regex)).toBeTruthy();
  });
  
  it('should handle baseUrl with www subdomain', () => {
    const pattern = createDomainMismatchPattern('https://www.example.com');
    
    // Both www and non-www should be allowed
    expect('https://www.example.com/page'.match(pattern.regex)).toBeNull();
    expect('https://example.com/page'.match(pattern.regex)).toBeNull();
    // Other subdomains should still be flagged
    expect('https://blog.example.com/page'.match(pattern.regex)).toBeTruthy();
  });
  
  it('should escape special regex characters in domain', () => {
    const pattern = createDomainMismatchPattern('https://my-site.example.com');
    
    // Should allow both the subdomain and the root domain with www variant
    expect('https://my-site.example.com/page'.match(pattern.regex)).toBeTruthy(); // Different subdomain from root
    expect('https://example.com/page'.match(pattern.regex)).toBeNull(); // Root domain
    expect('https://www.example.com/page'.match(pattern.regex)).toBeNull(); // www variant of root
    expect('https://myXsite.example.com/page'.match(pattern.regex)).toBeTruthy(); // Invalid
  });
});

describe('ENVIRONMENT_PATTERNS', () => {
  it('should detect staging subdomain', () => {
    const pattern = ENVIRONMENT_PATTERNS.find(p => p.name === 'Staging Subdomain')!;
    
    expect('https://staging.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://stg.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect dev subdomain', () => {
    const pattern = ENVIRONMENT_PATTERNS.find(p => p.name === 'Development Subdomain')!;
    
    expect('https://dev.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://development.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect QA/test subdomains', () => {
    const pattern = ENVIRONMENT_PATTERNS.find(p => p.name === 'QA/Test Subdomain')!;
    
    expect('https://qa.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://test.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://uat.example.com/page'.match(pattern.regex)).toBeTruthy();
    expect('https://preprod.example.com/page'.match(pattern.regex)).toBeTruthy();
  });
  
  it('should detect localhost', () => {
    const pattern = ENVIRONMENT_PATTERNS.find(p => p.name === 'Localhost URL')!;
    
    expect('http://localhost:3000/page'.match(pattern.regex)).toBeTruthy();
    expect('http://127.0.0.1/page'.match(pattern.regex)).toBeTruthy();
    expect('http://0.0.0.0:8080/page'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect environment in path', () => {
    const pattern = ENVIRONMENT_PATTERNS.find(p => p.name === 'Environment in Path')!;
    
    // Should match environment keywords at root level
    expect('https://example.com/staging/api'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/dev/page'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/qa/test'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/uat/login'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/preprod/dashboard'.match(pattern.regex)).toBeTruthy();
    
    // Should NOT match environment keywords deep in content paths
    expect('https://example.com/news/test'.match(pattern.regex)).toBeNull();
    expect('https://example.com/articles/qa'.match(pattern.regex)).toBeNull();
    expect('https://example.com/videos/test'.match(pattern.regex)).toBeNull();
    expect('https://example.com/products/widget'.match(pattern.regex)).toBeNull();
    
    // Should NOT match "test" as a word boundary in content (removed from pattern)
    expect('https://example.com/celtics/news/test'.match(pattern.regex)).toBeNull();
    expect('https://example.com/mavs/fat-gallery/test'.match(pattern.regex)).toBeNull();
  });
  
  it('should have correct severity and category', () => {
    ENVIRONMENT_PATTERNS.forEach(pattern => {
      expect(pattern.category).toBe('environment_leakage');
      expect(pattern.severity).toBe('high');
    });
  });
});
