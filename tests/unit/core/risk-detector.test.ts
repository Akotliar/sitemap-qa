import { describe, it, expect } from 'vitest';
import { detectRisks } from '@/core/risk-detector';
import { UrlEntry } from '@/core/parser';
import { DEFAULT_CONFIG } from '@/types/config';

describe('detectRisks', () => {
  it('should detect staging environment URLs', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://staging.example.com/page1', source: 'sitemap.xml' },
      { loc: 'https://example.com/page2', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.findings.length).toBeGreaterThan(0);
    const stagingFinding = result.findings.find(f => f.category === 'environment_leakage');
    expect(stagingFinding).toBeDefined();
    expect(stagingFinding?.severity).toBe('high');
    expect(stagingFinding?.url).toBe('https://staging.example.com/page1');
  });
  
  it('should detect admin paths', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/dashboard', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.findings.length).toBeGreaterThan(0);
    const adminFinding = result.findings.find(f => f.category === 'admin_paths');
    expect(adminFinding).toBeDefined();
    expect(adminFinding?.severity).toBe('high');
  });
  
  it('should detect sensitive query parameters', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/page?token=abc123', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.findings.length).toBeGreaterThan(0);
    const paramFinding = result.findings.find(f => f.category === 'sensitive_params');
    expect(paramFinding).toBeDefined();
    expect(paramFinding?.severity).toBe('high');
    expect(paramFinding?.matchedValue).toContain('token=');
  });
  
  it('should detect protocol inconsistencies', async () => {
    const urls: UrlEntry[] = [
      { loc: 'http://example.com/page1', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.findings.length).toBeGreaterThan(0);
    const protocolFinding = result.findings.find(f => f.category === 'protocol_inconsistency');
    expect(protocolFinding).toBeDefined();
    expect(protocolFinding?.severity).toBe('medium');
    expect(protocolFinding?.matchedValue).toBe('http://');
  });
  
  it('should handle multiple findings for single URL', async () => {
    const urls: UrlEntry[] = [
      { loc: 'http://staging.example.com/dashboard?token=abc', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.findings.length).toBeGreaterThan(1);
    
    // riskUrlCount counts unique sanitized URLs, so if URL is sanitized, 
    // it may create different unique URLs
    expect(result.riskUrlCount).toBeGreaterThan(0);
    
    // Should find environment, admin, sensitive param, and protocol issues
    const categories = new Set(result.findings.map(f => f.category));
    expect(categories.has('environment_leakage')).toBe(true);
    expect(categories.has('admin_paths')).toBe(true);
    expect(categories.has('sensitive_params')).toBe(true);
    expect(categories.has('protocol_inconsistency')).toBe(true);
  });
  
  it('should return empty findings for clean URLs', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/products/widget', source: 'sitemap.xml' },
      { loc: 'https://example.com/about', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.findings).toEqual([]);
    expect(result.riskUrlCount).toBe(0);
    expect(result.cleanUrlCount).toBe(2);
  });
  
  it('should handle empty input', async () => {
    const result = await detectRisks([], 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.findings).toEqual([]);
    expect(result.totalUrlsAnalyzed).toBe(0);
    expect(result.riskUrlCount).toBe(0);
    expect(result.cleanUrlCount).toBe(0);
  });
  
  it('should detect development environment patterns', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://dev.example.com/page', source: 'sitemap.xml' },
      { loc: 'https://example.com/development/test', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    const devFindings = result.findings.filter(f => f.category === 'environment_leakage');
    expect(devFindings.length).toBeGreaterThan(0);
    expect(devFindings.every(f => f.severity === 'high')).toBe(true);
  });
  
  it('should detect domain mismatch', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/page1', source: 'sitemap.xml' },
      { loc: 'https://other-domain.com/page2', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    const domainFinding = result.findings.find(f => f.category === 'domain_mismatch');
    expect(domainFinding).toBeDefined();
    expect(domainFinding?.url).toBe('https://other-domain.com/page2');
    expect(domainFinding?.severity).toBe('high');
  });
  
  it('should detect localhost URLs', async () => {
    const urls: UrlEntry[] = [
      { loc: 'http://localhost:3000/page', source: 'sitemap.xml' },
      { loc: 'http://127.0.0.1/page', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    const localhostFindings = result.findings.filter(f => f.category === 'environment_leakage');
    expect(localhostFindings.length).toBeGreaterThan(0);
  });
  
  it('should detect environment in path', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/staging/api/endpoint', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    const pathFinding = result.findings.find(
      f => f.category === 'environment_leakage' && f.pattern === 'Environment in Path'
    );
    expect(pathFinding).toBeDefined();
  });
  
  it('should detect admin paths', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/users', source: 'sitemap.xml' },
      { loc: 'https://example.com/dashboard/analytics', source: 'sitemap.xml' },
      { loc: 'https://example.com/internal/reports', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    const adminFindings = result.findings.filter(f => f.category === 'admin_paths');
    const internalFindings = result.findings.filter(f => f.category === 'internal_content');
    
    // Admin paths should find /admin and /dashboard (2 URLs)
    expect(adminFindings.length).toBe(2);
    expect(adminFindings.every(f => f.severity === 'high')).toBe(true);
    
    // Internal content should find /internal (1 URL)
    expect(internalFindings.length).toBe(1);
    expect(internalFindings.every(f => f.severity === 'medium')).toBe(true);
  });
  it('should detect sensitive parameters and sanitize URLs', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/api?token=secret123', source: 'sitemap.xml' },
      { loc: 'https://example.com/data?apikey=xyz789', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    const paramFindings = result.findings.filter(f => f.category === 'sensitive_params');
    expect(paramFindings.length).toBeGreaterThan(0);
    
    // URLs should be sanitized in findings (URL-encoded [REDACTED])
    paramFindings.forEach(finding => {
      expect(finding.url).toMatch(/%5BREDACTED%5D|REDACTED/);
    });
  });
  
  it('should detect debug parameters with MEDIUM severity', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/page?debug=true', source: 'sitemap.xml' }
    ];
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    const debugFinding = result.findings.find(
      f => f.category === 'sensitive_params' && f.pattern === 'Debug Parameter'
    );
    expect(debugFinding).toBeDefined();
    expect(debugFinding?.severity).toBe('medium');
  });
  
  it('should exclude accepted URLs from risk detection', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/dashboard', source: 'sitemap.xml' },
      { loc: 'https://staging.example.com/page', source: 'sitemap.xml' },
      { loc: 'https://example.com/admin/allowed', source: 'sitemap.xml' }
    ];
    
    const configWithAcceptedPatterns = {
      ...DEFAULT_CONFIG,
      acceptedPatterns: ['/admin/allowed', 'staging.example.com']
    };
    
    const result = await detectRisks(urls, 'https://example.com', configWithAcceptedPatterns);
    
    // Should only find /admin/dashboard (which will match both Admin and Dashboard patterns)
    // Check unique risk URLs, not individual findings
    expect(result.riskUrlCount).toBe(1);
    
    // Should have admin_paths findings
    const adminFindings = result.findings.filter(f => f.category === 'admin_paths');
    expect(adminFindings.length).toBeGreaterThan(0);
    expect(adminFindings.every(f => f.url === 'https://example.com/admin/dashboard')).toBe(true);
    
    // Should not find staging URL
    const envFindings = result.findings.filter(f => f.category === 'environment_leakage');
    expect(envFindings.length).toBe(0);
  });
  
  it('should handle invalid accepted patterns gracefully', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/dashboard', source: 'sitemap.xml' }
    ];
    
    const configWithInvalidPatterns = {
      ...DEFAULT_CONFIG,
      acceptedPatterns: ['[invalid(regex'],
      verbose: false
    };
    
    // Should not throw error, just ignore invalid pattern
    const result = await detectRisks(urls, 'https://example.com', configWithInvalidPatterns);
    
    // Should still detect admin path since invalid pattern is ignored
    const adminFindings = result.findings.filter(f => f.category === 'admin_paths');
    expect(adminFindings.length).toBeGreaterThan(0);
  });
  
  it('should support multiple accepted patterns', async () => {
    const urls: UrlEntry[] = [
      { loc: 'https://example.com/admin/login', source: 'sitemap.xml' },
      { loc: 'https://example.com/admin/dashboard', source: 'sitemap.xml' },
      { loc: 'https://example.com/config/settings', source: 'sitemap.xml' },
      { loc: 'https://dev.example.com/page', source: 'sitemap.xml' }
    ];
    
    const configWithMultiplePatterns = {
      ...DEFAULT_CONFIG,
      acceptedPatterns: ['/admin/login', '/config/*', 'dev.example.com']
    };
    
    const result = await detectRisks(urls, 'https://example.com', configWithMultiplePatterns);
    
    // Should only find /admin/dashboard (unique URL count)
    expect(result.riskUrlCount).toBe(1);
    
    const findings = result.findings.filter(f => 
      f.category === 'admin_paths' || f.category === 'environment_leakage'
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every(f => f.url === 'https://example.com/admin/dashboard')).toBe(true);
  });
});

describe('detectRisks - performance', () => {
  it('should analyze 5000 URLs in < 5 seconds', async () => {
    const urls: UrlEntry[] = [];
    for (let i = 0; i < 5000; i++) {
      urls.push({
        loc: `https://example.com/page${i}`,
        source: 'sitemap.xml'
      });
    }
    
    const result = await detectRisks(urls, 'https://example.com', DEFAULT_CONFIG);
    
    expect(result.processingTimeMs).toBeLessThan(5000);
    expect(result.totalUrlsAnalyzed).toBe(5000);
  });
});
