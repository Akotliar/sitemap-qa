import { UrlEntry } from '@/core/parser';
import { Config } from '@/types/config';
import { RISK_PATTERNS } from '@/core/patterns/risk-patterns';
import { ENVIRONMENT_PATTERNS, createDomainMismatchPattern } from '@/core/patterns/domain-patterns';
import { ADMIN_PATH_PATTERNS, SENSITIVE_PARAM_PATTERNS, INTERNAL_CONTENT_PATTERNS } from '@/core/patterns/admin-patterns';
import { sanitizeUrl } from '@/utils/sanitizer';
import { groupRiskFindings, RiskGroup } from '@/core/risk-grouper';
import { chunkArray, processInBatches } from '@/utils/batch-processor';
import os from 'os';

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

interface BatchResult {
  findings: RiskFinding[];
  urlsProcessed: number;
}

/**
 * Compile accepted patterns from config
 */
function compileAcceptedPatterns(config: Config): RegExp[] {
  const patterns: RegExp[] = [];
  
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
        
        patterns.push(new RegExp(regexPattern, 'i'));
      } catch (error) {
        if (config.verbose) {
          console.warn(`Invalid accepted pattern: ${pattern}`);
        }
      }
    }
  }
  
  return patterns;
}

/**
 * Process a single batch of URLs for risk detection
 * (Called in parallel for multiple batches)
 */
async function detectRisksInBatch(
  urls: UrlEntry[],
  allPatterns: RiskPattern[],
  acceptedPatterns: RegExp[],
  expectedProtocol: string,
  verbose: boolean
): Promise<BatchResult> {
  const findings: RiskFinding[] = [];
  
  for (const urlEntry of urls) {
    const url = urlEntry.loc;
    
    // Check if URL matches accepted patterns (early exit)
    let isAccepted = false;
    for (const acceptedPattern of acceptedPatterns) {
      if (acceptedPattern.test(url)) {
        isAccepted = true;
        break;
      }
    }
    if (isAccepted) continue;
    
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
          if (verbose) {
            console.error(`Pattern matching failed for ${pattern.name}: ${error instanceof Error ? error.message : String(error)}`);
          }
          continue;
        }
      }
    }
  }
  
  return { findings, urlsProcessed: urls.length };
}

export async function detectRisks(
  urls: UrlEntry[],
  baseUrl: string,
  config: Config
): Promise<RiskDetectionResult> {
  const startTime = Date.now();
  
  // Pre-compile ALL patterns ONCE (not per batch)
  const domainPattern = createDomainMismatchPattern(baseUrl);
  const allPatterns = [
    ...RISK_PATTERNS,
    ...ENVIRONMENT_PATTERNS,
    ...ADMIN_PATH_PATTERNS,
    ...SENSITIVE_PARAM_PATTERNS,
    ...INTERNAL_CONTENT_PATTERNS,
    domainPattern
  ];
  
  // Compile accepted patterns once
  const acceptedPatterns = compileAcceptedPatterns(config);
  
  // Extract protocol once
  let expectedProtocol: string;
  try {
    expectedProtocol = new URL(baseUrl).protocol;
  } catch (error) {
    if (config.verbose) {
      console.warn(`Invalid base URL: ${baseUrl}, defaulting to https:`);
    }
    expectedProtocol = 'https:';
  }
  
  // Configure batch processing
  const BATCH_SIZE = config.riskDetectionBatchSize || 10000;
  const CONCURRENCY = config.riskDetectionConcurrency || Math.max(2, os.cpus().length - 1);
  const batches = chunkArray(urls, BATCH_SIZE);
  
  if (config.verbose) {
    console.log(`\nRisk Detection Configuration:`);
    console.log(`  - Total URLs: ${urls.length.toLocaleString()}`);
    console.log(`  - Batch size: ${BATCH_SIZE.toLocaleString()}`);
    console.log(`  - Concurrency: ${CONCURRENCY}`);
    console.log(`  - Total batches: ${batches.length}`);
    try {
      console.log(`  - Base domain: ${new URL(baseUrl).hostname}`);
    } catch (error) {
      console.log(`  - Base URL: ${baseUrl}`);
    }
    if (acceptedPatterns.length > 0) {
      console.log(`  - Accepted patterns: ${acceptedPatterns.length}`);
    }
  }
  
  // Progress tracking
  let completedBatches = 0;
  const totalBatches = batches.length;
  const batchStartTime = Date.now();
  
  // Process batches in parallel with concurrency limit
  const batchResults = await processInBatches(
    batches,
    CONCURRENCY,
    (batch) => detectRisksInBatch(batch, allPatterns, acceptedPatterns, expectedProtocol, config.verbose),
    (completed) => {
      completedBatches = completed;
      const pct = ((completed / totalBatches) * 100).toFixed(1);
      const elapsed = (Date.now() - batchStartTime) / 1000;
      const urlsProcessed = completed * BATCH_SIZE;
      const speed = Math.round(urlsProcessed / elapsed);
      const remaining = totalBatches - completed;
      const eta = Math.round((remaining * BATCH_SIZE) / speed);
      
      process.stdout.write(
        `\r\x1b[K  Analyzing batch ${completed}/${totalBatches} (${pct}%) | ETA: ~${eta}s | ${speed.toLocaleString()} URLs/sec`
      );
    }
  );
  
  // Clear progress line
  process.stdout.write('\r\x1b[K');
  
  // Merge results from all batches
  const allFindings = batchResults.flatMap(r => r.findings);
  
  // Group findings
  const groupingResult = groupRiskFindings(allFindings);
  
  const processingTimeMs = Date.now() - startTime;
  
  if (config.verbose) {
    console.log(`\nRisk Detection Summary:`);
    console.log(`  - Total URLs analyzed: ${urls.length.toLocaleString()}`);
    console.log(`  - Risk URLs found: ${groupingResult.totalRiskUrls.toLocaleString()}`);
    console.log(`  - HIGH severity: ${groupingResult.highSeverityCount}`);
    console.log(`  - MEDIUM severity: ${groupingResult.mediumSeverityCount}`);
    console.log(`  - LOW severity: ${groupingResult.lowSeverityCount}`);
    console.log(`  - Processing time: ${(processingTimeMs / 1000).toFixed(1)}s`);
    
    if (groupingResult.groups.length > 0) {
      console.log(`\nRisk Categories Found:`);
      for (const group of groupingResult.groups) {
        console.log(`  - ${group.category}: ${group.count} URLs (${group.severity.toUpperCase()})`);
      }
    }
  }
  
  return {
    findings: allFindings,
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
