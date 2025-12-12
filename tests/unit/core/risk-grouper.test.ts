import { describe, it, expect } from 'vitest';
import { groupRiskFindings } from '@/core/risk-grouper';
import { RiskFinding } from '@/core/risk-detector';

describe('groupRiskFindings', () => {
  it('should group findings by category', () => {
    const findings: RiskFinding[] = [
      {
        url: 'https://staging.example.com/page1',
        category: 'environment_leakage',
        severity: 'high',
        pattern: 'Staging Environment',
        rationale: 'URL contains staging environment'
      },
      {
        url: 'https://dev.example.com/page2',
        category: 'environment_leakage',
        severity: 'high',
        pattern: 'Development Environment',
        rationale: 'URL contains dev environment'
      },
      {
        url: 'https://example.com/admin/users',
        category: 'admin_paths',
        severity: 'high',
        pattern: 'Admin Path',
        rationale: 'URL contains admin path'
      }
    ];
    
    const result = groupRiskFindings(findings);
    
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].category).toBe('environment_leakage');
    expect(result.groups[0].count).toBe(2);
    expect(result.groups[1].category).toBe('admin_paths');
    expect(result.groups[1].count).toBe(1);
  });
  
  it('should sort groups by severity (HIGH first)', () => {
    const findings: RiskFinding[] = [
      {
        url: 'https://example.com/page?debug=true',
        category: 'sensitive_params',
        severity: 'medium',
        pattern: 'Debug Parameter',
        rationale: 'Debug param'
      },
      {
        url: 'https://staging.example.com/page',
        category: 'environment_leakage',
        severity: 'high',
        pattern: 'Staging',
        rationale: 'Staging URL'
      }
    ];
    
    const result = groupRiskFindings(findings);
    
    expect(result.groups[0].severity).toBe('high');
    expect(result.groups[1].severity).toBe('medium');
  });
  
  it('should limit sample URLs to max count', () => {
    const findings: RiskFinding[] = [];
    for (let i = 0; i < 20; i++) {
      findings.push({
        url: `https://staging.example.com/page${i}`,
        category: 'environment_leakage',
        severity: 'high',
        pattern: 'Staging',
        rationale: 'Staging URL'
      });
    }
    
    const result = groupRiskFindings(findings, 5);
    
    expect(result.groups[0].sampleUrls).toHaveLength(5);
    expect(result.groups[0].allUrls).toHaveLength(20);
  });
  
  it('should calculate severity counts correctly', () => {
    const findings: RiskFinding[] = [
      { url: 'url1', category: 'environment_leakage', severity: 'high', pattern: 'p', rationale: 'r' },
      { url: 'url2', category: 'environment_leakage', severity: 'high', pattern: 'p', rationale: 'r' },
      { url: 'url3', category: 'sensitive_params', severity: 'medium', pattern: 'p', rationale: 'r' },
      { url: 'url4', category: 'protocol_inconsistency', severity: 'low', pattern: 'p', rationale: 'r' }
    ];
    
    const result = groupRiskFindings(findings);
    
    expect(result.highSeverityCount).toBe(2);
    expect(result.mediumSeverityCount).toBe(1);
    expect(result.lowSeverityCount).toBe(1);
  });
  
  it('should generate category-specific recommendations', () => {
    const findings: RiskFinding[] = [
      {
        url: 'https://staging.example.com/page',
        category: 'environment_leakage',
        severity: 'high',
        pattern: 'Staging',
        rationale: 'Staging URL'
      }
    ];
    
    const result = groupRiskFindings(findings);
    
    expect(result.groups[0].rationale).toContain('non-production');
    expect(result.groups[0].recommendedAction).toContain('deployment configuration');
  });
  
  it('should handle empty findings', () => {
    const result = groupRiskFindings([]);
    
    expect(result.groups).toEqual([]);
    expect(result.totalRiskUrls).toBe(0);
  });
  
  it('should deduplicate URLs within category', () => {
    const findings: RiskFinding[] = [
      {
        url: 'https://staging.example.com/page',
        category: 'environment_leakage',
        severity: 'high',
        pattern: 'Staging Subdomain',
        rationale: 'Staging subdomain'
      },
      {
        url: 'https://staging.example.com/page',
        category: 'environment_leakage',
        severity: 'high',
        pattern: 'Staging Environment',
        rationale: 'Staging environment'
      }
    ];
    
    const result = groupRiskFindings(findings);
    
    expect(result.groups[0].count).toBe(1);
    expect(result.totalRiskUrls).toBe(1);
  });
  
  it('should use highest severity in category', () => {
    const findings: RiskFinding[] = [
      {
        url: 'https://example.com/page?debug=true',
        category: 'sensitive_params',
        severity: 'medium',
        pattern: 'Debug Parameter',
        rationale: 'Debug'
      },
      {
        url: 'https://example.com/page?token=abc',
        category: 'sensitive_params',
        severity: 'high',
        pattern: 'Auth Token',
        rationale: 'Token'
      }
    ];
    
    const result = groupRiskFindings(findings);
    
    expect(result.groups[0].severity).toBe('high');
  });
  
  it('should generate recommendations for all risk categories', () => {
    const categories: Array<{ category: any; url: string }> = [
      { category: 'environment_leakage', url: 'https://staging.example.com/page' },
      { category: 'admin_paths', url: 'https://example.com/admin' },
      { category: 'sensitive_params', url: 'https://example.com/page?token=abc' },
      { category: 'protocol_inconsistency', url: 'http://example.com/page' },
      { category: 'domain_mismatch', url: 'https://other.com/page' }
    ];
    
    for (const { category, url } of categories) {
      const findings: RiskFinding[] = [
        { url, category, severity: 'high', pattern: 'Test', rationale: 'Test' }
      ];
      
      const result = groupRiskFindings(findings);
      
      expect(result.groups[0].rationale).toBeTruthy();
      expect(result.groups[0].recommendedAction).toBeTruthy();
    }
  });
  
  it('should calculate total risk URLs correctly', () => {
    const findings: RiskFinding[] = [
      { url: 'url1', category: 'environment_leakage', severity: 'high', pattern: 'p', rationale: 'r' },
      { url: 'url2', category: 'admin_paths', severity: 'high', pattern: 'p', rationale: 'r' },
      { url: 'url1', category: 'admin_paths', severity: 'high', pattern: 'p', rationale: 'r' } // duplicate URL
    ];
    
    const result = groupRiskFindings(findings);
    
    expect(result.totalRiskUrls).toBe(2); // Only 2 unique URLs
  });
});
