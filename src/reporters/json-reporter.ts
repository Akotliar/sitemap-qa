import { promises as fs } from 'fs';
import type { RiskSummary } from '@/summarizer';
import type { DiscoveryResult } from '@/core/discovery';
import type { RiskGroup } from '@/core/risk-grouper';
import type { Config } from '@/types/config';

// Version is injected at build time by tsup
declare const __PACKAGE_VERSION__: string;
const TOOL_VERSION = __PACKAGE_VERSION__;

export interface JsonReporterOptions {
  pretty?: boolean;           // Pretty-print with indentation (default: true)
  indent?: number;            // Indentation spaces (default: 2)
  includeMetadata?: boolean;  // Include generation metadata (default: true)
}

export interface ParseResult {
  totalCount: number;
  uniqueUrls: string[];
  errors: Error[];
}

interface AnalysisMetadata {
  baseUrl: string;
  analysisTimestamp: string;
  toolVersion: string;
  executionTimeMs: number;
  analysisType: string;
}

interface SuspiciousGroup {
  category: string;
  severity: string;
  count: number;
  pattern: string;
  rationale: string;
  sampleUrls: string[];
  recommendedAction: string;
}

interface SummaryStats {
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  totalRiskyUrls: number;
  overallStatus: 'clean' | 'issues_found' | 'errors';
}

interface RiskSummaryData {
  overview: string;
  keyFindings: string[];
  recommendations: string[];
}

interface ErrorDetail {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

interface AnalysisResult {
  analysisMetadata: AnalysisMetadata;
  sitemapsDiscovered: string[];
  totalUrlCount: number;
  urlsAnalyzed: number;
  suspiciousGroups: SuspiciousGroup[];
  riskSummary: RiskSummaryData;
  summary: SummaryStats;
  errors: ErrorDetail[];
}

/**
 * Generate JSON report from analysis results
 */
export function generateJsonReport(
  summary: RiskSummary,
  discoveryResult: DiscoveryResult,
  parseResult: ParseResult,
  riskGroups: RiskGroup[],
  config: Config,
  startTime: number,
  options: JsonReporterOptions = {}
): string {
  const {
    pretty = true,
    indent = 2,
  } = options;
  
  const result = buildAnalysisResult(
    summary,
    discoveryResult,
    parseResult,
    riskGroups,
    config,
    startTime
  );
  
  const jsonOutput = transformToJsonOutput(result);
  
  if (pretty) {
    return JSON.stringify(jsonOutput, null, indent);
  } else {
    return JSON.stringify(jsonOutput);
  }
}

/**
 * Write JSON report to file
 */
export async function writeJsonReport(
  summary: RiskSummary,
  discoveryResult: DiscoveryResult,
  parseResult: ParseResult,
  riskGroups: RiskGroup[],
  config: Config,
  startTime: number,
  outputPath: string
): Promise<void> {
  const jsonContent = generateJsonReport(
    summary,
    discoveryResult,
    parseResult,
    riskGroups,
    config,
    startTime
  );
  
  await fs.writeFile(outputPath, jsonContent, 'utf-8');
}

/**
 * Build internal analysis result structure
 */
function buildAnalysisResult(
  summary: RiskSummary,
  discoveryResult: DiscoveryResult,
  parseResult: ParseResult,
  riskGroups: RiskGroup[],
  config: Config,
  startTime: number
): AnalysisResult {
  const metadata = buildAnalysisMetadata(
    config.baseUrl || 'unknown',
    startTime,
    summary
  );
  
  const suspiciousGroups = riskGroups.map(group => ({
    category: group.category,
    severity: group.severity,
    count: group.count,
    pattern: group.category, // Use category as pattern identifier
    rationale: group.rationale,
    sampleUrls: group.sampleUrls.slice(0, 5), // Limit to 5 samples
    recommendedAction: group.recommendedAction
  }));
  
  const summaryStats: SummaryStats = {
    highSeverityCount: summary.severityBreakdown.high,
    mediumSeverityCount: summary.severityBreakdown.medium,
    lowSeverityCount: summary.severityBreakdown.low,
    totalRiskyUrls: riskGroups.reduce((sum, g) => sum + g.count, 0),
    overallStatus: determineOverallStatus(
      summary.severityBreakdown,
      parseResult.errors
    )
  };
  
  const riskSummary: RiskSummaryData = {
    overview: summary.overview,
    keyFindings: summary.keyFindings,
    recommendations: summary.recommendations
  };
  
  const errors = parseResult.errors.map(transformError);
  
  return {
    analysisMetadata: metadata,
    sitemapsDiscovered: discoveryResult.sitemaps,
    totalUrlCount: parseResult.totalCount,
    urlsAnalyzed: parseResult.totalCount,
    suspiciousGroups,
    riskSummary,
    summary: summaryStats,
    errors
  };
}

/**
 * Build analysis metadata
 */
function buildAnalysisMetadata(
  baseUrl: string,
  startTime: number,
  summary: RiskSummary
): AnalysisMetadata {
  return {
    baseUrl,
    analysisTimestamp: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    executionTimeMs: Date.now() - startTime,
    analysisType: summary.generatedBy
  };
}

/**
 * Determine overall status based on severity and errors
 */
function determineOverallStatus(
  severityBreakdown: { high: number; medium: number; low: number },
  errors: Error[]
): 'clean' | 'issues_found' | 'errors' {
  if (errors.length > 0) {
    return 'errors';
  }
  
  const totalIssues = severityBreakdown.high + severityBreakdown.medium + severityBreakdown.low;
  
  return totalIssues > 0 ? 'issues_found' : 'clean';
}

/**
 * Transform internal camelCase structure to external snake_case JSON
 */
function transformToJsonOutput(result: AnalysisResult): object {
  return {
    analysis_metadata: transformMetadata(result.analysisMetadata),
    sitemaps_discovered: result.sitemapsDiscovered,
    total_url_count: result.totalUrlCount,
    urls_analyzed: result.urlsAnalyzed,
    suspicious_groups: result.suspiciousGroups.map(transformGroup),
    risk_summary: transformRiskSummary(result.riskSummary),
    summary: transformSummary(result.summary),
    errors: result.errors
  };
}

/**
 * Transform metadata to snake_case
 */
function transformMetadata(meta: AnalysisMetadata): object {
  return {
    base_url: meta.baseUrl,
    analysis_timestamp: meta.analysisTimestamp,
    tool_version: meta.toolVersion,
    execution_time_ms: meta.executionTimeMs,
    analysis_type: meta.analysisType
  };
}

/**
 * Transform suspicious group to snake_case
 */
function transformGroup(group: SuspiciousGroup): object {
  return {
    category: group.category,
    severity: group.severity,
    count: group.count,
    pattern: group.pattern,
    rationale: group.rationale,
    sample_urls: group.sampleUrls,
    recommended_action: group.recommendedAction
  };
}

/**
 * Transform risk summary to snake_case
 */
function transformRiskSummary(summary: RiskSummaryData): object {
  return {
    overview: summary.overview,
    key_findings: summary.keyFindings,
    recommendations: summary.recommendations
  };
}

/**
 * Transform summary stats to snake_case
 */
function transformSummary(summary: SummaryStats): object {
  return {
    high_severity_count: summary.highSeverityCount,
    medium_severity_count: summary.mediumSeverityCount,
    low_severity_count: summary.lowSeverityCount,
    total_risky_urls: summary.totalRiskyUrls,
    overall_status: summary.overallStatus
  };
}

/**
 * Transform error to structured format
 */
function transformError(error: Error): ErrorDetail {
  // Handle custom error types
  if ('code' in error) {
    const customError = error as any;
    const errorDetail: ErrorDetail = {
      code: customError.code || 'UNKNOWN_ERROR',
      message: error.message
    };
    
    // Add context for specific error types
    if ('attemptedPaths' in customError) {
      errorDetail.context = {
        attempted_paths: customError.attemptedPaths
      };
    } else if ('sitemapUrl' in customError && 'lineNumber' in customError) {
      errorDetail.context = {
        sitemap_url: customError.sitemapUrl,
        line_number: customError.lineNumber
      };
    } else if ('url' in customError) {
      errorDetail.context = {
        url: customError.url
      };
    }
    
    return errorDetail;
  }
  
  // Generic error
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message
  };
}
