import { describe, it, expect } from 'vitest';
import { ADMIN_PATH_PATTERNS, SENSITIVE_PARAM_PATTERNS, INTERNAL_CONTENT_PATTERNS } from '@/core/patterns/admin-patterns';

describe('ADMIN_PATH_PATTERNS', () => {
  it('should detect /admin path', () => {
    const pattern = ADMIN_PATH_PATTERNS.find(p => p.name === 'Admin Path')!;
    
    expect('https://example.com/admin/users'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/administrator/dashboard'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/products'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect /dashboard path', () => {
    const pattern = ADMIN_PATH_PATTERNS.find(p => p.name === 'Dashboard Path')!;
    
    expect('https://example.com/dashboard/analytics'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/admin/dashboard'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/products'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect /config path', () => {
    const pattern = ADMIN_PATH_PATTERNS.find(p => p.name === 'Config Path')!;
    
    expect('https://example.com/config/settings'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/configuration/app'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/products'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect /console path', () => {
    const pattern = ADMIN_PATH_PATTERNS.find(p => p.name === 'Console Path')!;
    
    expect('https://example.com/console/logs'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/products'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect control panel paths', () => {
    const pattern = ADMIN_PATH_PATTERNS.find(p => p.name === 'Control Panel Path')!;
    
    expect('https://example.com/cpanel/settings'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/control-panel/admin'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/products'.match(pattern.regex)).toBeNull();
  });
  
  it('should have correct severity for all admin patterns', () => {
    ADMIN_PATH_PATTERNS.forEach(pattern => {
      expect(pattern.category).toBe('admin_paths');
      expect(pattern.severity).toBe('high');
    });
  });
});

describe('SENSITIVE_PARAM_PATTERNS', () => {
  it('should detect authentication token parameters', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'Authentication Token Parameter')!;
    
    expect('https://example.com/api?token=abc123'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?auth_token=xyz'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?access_token=456'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?page=1'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect API key parameters', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'API Key Parameter')!;
    
    expect('https://example.com/api?apikey=xyz789'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?api_key=abc'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?key=secret'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?page=1'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect password parameters', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'Password Parameter')!;
    
    expect('https://example.com/login?password=secret'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/login?passwd=abc'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/login?pwd=123'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/login?username=john'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect secret parameters', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'Secret Parameter')!;
    
    expect('https://example.com/api?secret=xyz'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?client_secret=abc'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?page=1'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect session parameters', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'Session Parameter')!;
    
    expect('https://example.com/page?session=12345'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page?sessionid=abc'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page?sid=xyz'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page?page=1'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect credentials parameters', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'Credentials Parameter')!;
    
    expect('https://example.com/api?credentials=user:pass'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/api?page=1'.match(pattern.regex)).toBeNull();
  });
  
  it('should detect debug parameters with MEDIUM severity', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'Debug Parameter')!;
    
    expect(pattern.severity).toBe('medium');
    expect('https://example.com/page?debug=true'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page?trace=1'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page?verbose=yes'.match(pattern.regex)).toBeTruthy();
  });
  
  it('should detect test mode parameters with MEDIUM severity', () => {
    const pattern = SENSITIVE_PARAM_PATTERNS.find(p => p.name === 'Test Mode Parameter')!;
    
    expect(pattern.severity).toBe('medium');
    expect('https://example.com/page?test_mode=1'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page?test=true'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/page?testing=yes'.match(pattern.regex)).toBeTruthy();
  });
  
  it('should have correct category for all sensitive param patterns', () => {
    SENSITIVE_PARAM_PATTERNS.forEach(pattern => {
      expect(pattern.category).toBe('sensitive_params');
    });
  });
  
  it('should classify auth params as HIGH severity', () => {
    const highSeverityPatterns = SENSITIVE_PARAM_PATTERNS.filter(p => 
      p.name.includes('Token') || p.name.includes('Key') || 
      p.name.includes('Password') || p.name.includes('Secret') || 
      p.name.includes('Session') || p.name.includes('Credentials')
    );
    
    highSeverityPatterns.forEach(pattern => {
      expect(pattern.severity).toBe('high');
    });
  });
});

describe('INTERNAL_CONTENT_PATTERNS', () => {
  it('should detect /internal path', () => {
    const pattern = INTERNAL_CONTENT_PATTERNS.find(p => p.name === 'Internal Content Path')!;
    
    expect('https://example.com/internal/reports'.match(pattern.regex)).toBeTruthy();
    expect('https://www.example.com/team/internal-ticket-requests'.match(pattern.regex)).toBeTruthy();
    expect('https://www.example.com/sport/internal-form-updated'.match(pattern.regex)).toBeTruthy();
    expect('https://example.com/products'.match(pattern.regex)).toBeNull();
  });
  
  it('should have MEDIUM severity', () => {
    INTERNAL_CONTENT_PATTERNS.forEach(pattern => {
      expect(pattern.category).toBe('internal_content');
      expect(pattern.severity).toBe('medium');
    });
  });
});
