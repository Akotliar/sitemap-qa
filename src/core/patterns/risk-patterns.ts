import { RiskPattern } from '@/core/risk-detector';

export const RISK_PATTERNS: RiskPattern[] = [
  // Note: Environment leakage patterns moved to domain-patterns.ts
  // Note: Admin path patterns moved to admin-patterns.ts
  // to avoid duplication and improve maintainability
  
  // Sensitive Parameter Patterns (HIGH)
  {
    name: 'Authentication Parameter',
    category: 'sensitive_params',
    severity: 'high',
    regex: /[?&](token|auth|key|password|secret|apikey|session|credentials)=/i,
    description: 'Query parameter may contain sensitive authentication data'
  },
  {
    name: 'Debug Parameter',
    category: 'sensitive_params',
    severity: 'medium',
    regex: /[?&](debug|trace|verbose|test_mode)=/i,
    description: 'Query parameter may contain debug or diagnostic flag'
  },
  
  // Protocol Inconsistency Patterns (MEDIUM)
  {
    name: 'HTTP in HTTPS Site',
    category: 'protocol_inconsistency',
    severity: 'medium',
    regex: /^http:\/\//,
    description: 'HTTP URL in HTTPS sitemap (potential mixed content)'
  },
  
  // Test/Unfinished Content Patterns (MEDIUM)
  // Focuses on obvious test/placeholder patterns, avoiding false positives with legitimate content
  {
    name: 'Test Content Path',
    category: 'test_content',
    severity: 'medium',
    regex: /\/(?:test-|demo-|sample-|temp-|temporary-|placeholder-)|\/(test|demo|sample|temp|temporary|placeholder)(?:\/|$)/i,
    description: 'URL path suggests test, demo, or unfinished content that may not be intended for indexing'
  }
];
