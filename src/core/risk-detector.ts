import { UrlEntry } from '@/core/parser';
import { Config } from '@/types/config';
import { RISK_PATTERNS } from '@/core/patterns/risk-patterns';
import { ENVIRONMENT_PATTERNS, createDomainMismatchPattern } from '@/core/patterns/domain-patterns';
import { ADMIN_PATH_PATTERNS, SENSITIVE_PARAM_PATTERNS, INTERNAL_CONTENT_PATTERNS } from '@/core/patterns/admin-patterns';
import { sanitizeUrl } from '@/utils/sanitizer';
import { groupRiskFindings, RiskGroup } from '@/core/risk-grouper';

export type RiskCategory = 
  | 'environment_leakage'
  | 'admin_paths'
  | 'sensitive_params'
  | 'protocol_inconsistency'
  | 'domain_mismatch'
  | 'test_content'
  | 'internal_content';

export type Severity = 'high' | 'medium' | 'low';

export interface RiskPattern {
  name: string;
  category: RiskCategory;
  severity: Severity;
  regex: RegExp;
  description: string;
}

export interface RiskFinding {
  url: string;
  category: RiskCategory;
  severity: Severity;
  pattern: string;
  rationale: string;
  matchedValue?: string;  // Optional: the specific text that matched
}

export interface RiskDetectionResult {
  findings: RiskFinding[];
  groups: RiskGroup[];
  totalUrlsAnalyzed: number;
  riskUrlCount: number;
  cleanUrlCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  processingTimeMs: number;
}

export async function detectRisks(
  urls: UrlEntry[],
  baseUrl: string,
  config: Config
): Promise<RiskDetectionResult> {
  const startTime = Date.now();
  const findings: RiskFinding[] = [];
  
  // Add dynamic domain mismatch pattern and all other patterns
  const domainPattern = createDomainMismatchPattern(baseUrl);
  const allPatterns = [
    ...RISK_PATTERNS,
    ...ENVIRONMENT_PATTERNS,
    ...ADMIN_PATH_PATTERNS,
    ...SENSITIVE_PARAM_PATTERNS,
    ...INTERNAL_CONTENT_PATTERNS,
    domainPattern
  ];
  
  // Compile accepted patterns
  const acceptedPatterns: RegExp[] = [];
  if (config.acceptedPatterns && config.acceptedPatterns.length > 0) {
    for (const pattern of config.acceptedPatterns) {
      try {
        // Convert user-friendly pattern to regex:
        // 1. Escape special regex chars except * 
        // 2. Convert * to .* for wildcard matching
        // 3. Ensure pattern matches complete words/segments (not substrings)
        let regexPattern = pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars except *
          .replace(/\*/g, '[^/]*');                 // Convert * to [^/]* (anything except /)
        
        // Add word boundary at the end to ensure it matches complete path segments
        if (!regexPattern.endsWith('$') && !regexPattern.includes('(?:')) {
          regexPattern = regexPattern + '(?:/|$|\\?|#)';
        }
        
        acceptedPatterns.push(new RegExp(regexPattern, 'i'));
      } catch (error) {
        if (config.verbose) {
          console.warn(`Invalid accepted pattern: ${pattern}`);
        }
      }
    }
  }
  
  if (config.verbose) {
    console.log(`\nAnalyzing ${urls.length} URLs for risk patterns...`);
    try {
      console.log(`Base domain: ${new URL(baseUrl).hostname}`);
    } catch (error) {
      console.log(`Base URL: ${baseUrl}`);
    }
    if (acceptedPatterns.length > 0) {
      console.log(`Accepted patterns: ${acceptedPatterns.length}`);
    }
  }
  
  // Determine expected protocol from base URL
  let expectedProtocol: string;
  try {
    expectedProtocol = new URL(baseUrl).protocol;
  } catch (error) {
    if (config.verbose) {
      console.warn(`Invalid base URL: ${baseUrl}, defaulting to https:`);
    }
    expectedProtocol = 'https:';
  }
  
  let processed = 0;
  
  for (const urlEntry of urls) {
    const url = urlEntry.loc;
    processed++;
    
    // Progress tracking every 10k URLs with in-place update
    if (processed % 10000 === 0 || processed === urls.length) {
      process.stdout.write(`\r\x1b[K  Analyzing: ${processed.toLocaleString()}/${urls.length.toLocaleString()} URLs...`);
    }
    
    // Check if URL matches accepted patterns
    let isAccepted = false;
    for (const acceptedPattern of acceptedPatterns) {
      if (acceptedPattern.test(url)) {
        isAccepted = true;
        break;
      }
    }
    
    if (isAccepted) {
      continue; // Skip accepted URLs
    }
    
    // Test each pattern against the URL
    for (const pattern of allPatterns) {
      // Special handling for protocol inconsistency
      if (pattern.category === 'protocol_inconsistency') {
        try {
          const urlProtocol = new URL(url).protocol;
          if (expectedProtocol === 'https:' && urlProtocol === 'http:') {
            findings.push({
              url,
              category: pattern.category,
              severity: pattern.severity,
              pattern: pattern.name,
              rationale: pattern.description,
              matchedValue: 'http://'
            });
          }
        } catch (error) {
          // Invalid URL - skip
          if (config.verbose) {
            console.warn(`Skipping invalid URL: ${url}`);
          }
          continue;
        }
      } else {
        // Standard regex matching
        try {
          const match = url.match(pattern.regex);
          if (match) {
            findings.push({
              url: pattern.category === 'sensitive_params' ? sanitizeUrl(url) : url,
              category: pattern.category,
              severity: pattern.severity,
              pattern: pattern.name,
              rationale: pattern.description,
              matchedValue: match[0]
            });
          }
        } catch (error) {
          if (config.verbose) {
            console.error(`Pattern matching failed for ${pattern.name}: ${error instanceof Error ? error.message : String(error)}`);
          }
          continue;
        }
      }
    }
  }
  
  // Clear progress line
  if (urls.length >= 10000) {
    process.stdout.write('\r\x1b[K');
  }
  
  // Group findings
  const groupingResult = groupRiskFindings(findings);
  
  const processingTimeMs = Date.now() - startTime;
  
  if (config.verbose) {
    console.log(`\nRisk Summary:`);
    console.log(`  - Total URLs analyzed: ${urls.length}`);
    console.log(`  - Risk URLs found: ${groupingResult.totalRiskUrls}`);
    console.log(`  - HIGH severity: ${groupingResult.highSeverityCount}`);
    console.log(`  - MEDIUM severity: ${groupingResult.mediumSeverityCount}`);
    console.log(`  - LOW severity: ${groupingResult.lowSeverityCount}`);
    console.log(`  - Processing time: ${processingTimeMs}ms`);
    
    if (groupingResult.groups.length > 0) {
      console.log(`\nRisk Categories Found:`);
      for (const group of groupingResult.groups) {
        console.log(`  - ${group.category}: ${group.count} URLs (${group.severity.toUpperCase()})`);
      }
    }
  }
  
  return {
    findings,
    groups: groupingResult.groups,
    totalUrlsAnalyzed: urls.length,
    riskUrlCount: groupingResult.totalRiskUrls,
    cleanUrlCount: urls.length - groupingResult.totalRiskUrls,
    highSeverityCount: groupingResult.highSeverityCount,
    mediumSeverityCount: groupingResult.mediumSeverityCount,
    lowSeverityCount: groupingResult.lowSeverityCount,
    processingTimeMs
  };
}
