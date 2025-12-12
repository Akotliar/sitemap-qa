import { RiskPattern } from '@/core/risk-detector';

export interface DomainValidationOptions {
  allowedSubdomains?: string[];  // e.g., ['www', 'blog', 'shop']
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

export function createDomainMismatchPattern(
  baseUrl: string,
  options?: DomainValidationOptions
): RiskPattern {
  const baseDomain = new URL(baseUrl).hostname;
  const rootDomain = extractRootDomain(baseDomain);
  
  // If allowed subdomains specified, create more lenient pattern
  if (options?.allowedSubdomains && options.allowedSubdomains.length > 0) {
    const escapedRoot = escapeRegex(rootDomain);
    const escapedSubdomains = options.allowedSubdomains.map(escapeRegex).join('|');
    
    // Match URLs that DON'T start with: (allowed-subdomain OR no-subdomain) + root domain
    // Pattern: NOT (www.example.com OR blog.example.com OR example.com)
    const pattern = `^https?://(?!(?:(?:${escapedSubdomains})\\.)?${escapedRoot}(?:/|$))`;
    
    return {
      name: 'Domain Mismatch',
      category: 'domain_mismatch',
      severity: 'high',
      regex: new RegExp(pattern),
      description: `URL does not match expected domain or allowed subdomains`
    };
  }
  
  // Default: Allow both www and non-www variants of the same root domain
  const escapedRoot = escapeRegex(rootDomain);
  
  // Match URLs that DON'T belong to the root domain (with or without www)
  // Pattern: NOT (example.com OR www.example.com)
  const pattern = `^https?://(?!(?:www\\.)?${escapedRoot}(?:/|$))`;
  
  return {
    name: 'Domain Mismatch',
    category: 'domain_mismatch',
    severity: 'high',
    regex: new RegExp(pattern),
    description: `URL does not match expected domain: ${rootDomain} (including www variant)`
  };
}

export const ENVIRONMENT_PATTERNS: RiskPattern[] = [
  {
    name: 'Staging Subdomain',
    category: 'environment_leakage',
    severity: 'high',
    regex: /^https?:\/\/(staging|stg)\./i,
    description: 'URL uses staging subdomain'
  },
  {
    name: 'Development Subdomain',
    category: 'environment_leakage',
    severity: 'high',
    regex: /^https?:\/\/(dev|development)\./i,
    description: 'URL uses development subdomain'
  },
  {
    name: 'QA/Test Subdomain',
    category: 'environment_leakage',
    severity: 'high',
    regex: /^https?:\/\/(qa|test|uat|preprod)\./i,
    description: 'URL uses test environment subdomain'
  },
  {
    name: 'Localhost URL',
    category: 'environment_leakage',
    severity: 'high',
    regex: /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/,
    description: 'URL points to localhost (development environment)'
  },
  {
    name: 'Environment in Path',
    category: 'environment_leakage',
    severity: 'high',
    regex: /^https?:\/\/[^/]+\/(staging|dev|qa|uat|preprod)\//i,
    description: 'URL path contains environment identifier at root level'
  }
];
