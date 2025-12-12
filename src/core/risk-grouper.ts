import { RiskFinding, RiskCategory, Severity } from '@/core/risk-detector';

export interface RiskGroup {
  category: RiskCategory;
  severity: Severity;
  count: number;
  rationale: string;
  sampleUrls: string[];
  recommendedAction: string;
  allUrls?: string[];  // Optional: full list for detailed analysis
}

export interface RiskGroupingResult {
  groups: RiskGroup[];
  totalRiskUrls: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
}

function generateRecommendation(
  category: RiskCategory,
  _severity: Severity,
  count: number
): { rationale: string; recommendedAction: string } {
  switch (category) {
    case 'environment_leakage':
      return {
        rationale: `Production sitemap contains ${count} URL(s) from non-production environments (staging, dev, QA, test). This indicates configuration errors or environment leakage.`,
        recommendedAction: 'Verify sitemap generation excludes non-production environments. Review deployment configuration and environment filtering rules.'
      };
    
    case 'admin_paths':
      return {
        rationale: `${count} administrative path(s) detected in public sitemap (admin, dashboard, config). These paths may expose privileged access points.`,
        recommendedAction: 'Confirm if admin paths should be publicly indexed. Consider excluding via robots.txt or removing from sitemap. Verify access controls.'
      };
    
    case 'internal_content':
      return {
        rationale: `${count} URL(s) contain "internal" in the path. These may be internal-facing content not intended for public indexing.`,
        recommendedAction: 'Review URLs to determine if they should be publicly accessible. Consider excluding internal content from sitemap or adding noindex meta tags.'
      };
    
    case 'test_content':
      return {
        rationale: `${count} URL(s) contain test/demo/sample identifiers. These may be placeholder or unfinished content not intended for indexing.`,
        recommendedAction: 'Review and remove test content from production sitemaps. Verify content is production-ready before including in sitemap.'
      };
    
    case 'sensitive_params':
      return {
        rationale: `${count} URL(s) contain sensitive query parameters (token, auth, key, password, session). This may expose authentication credentials or debugging flags.`,
        recommendedAction: 'Review why sensitive parameters are in sitemap URLs. Remove authentication tokens from URLs. Consider POST requests for sensitive data.'
      };
    
    case 'protocol_inconsistency':
      return {
        rationale: `${count} URL(s) use HTTP protocol in HTTPS sitemap. This creates mixed content warnings and potential security issues.`,
        recommendedAction: 'Update URLs to use HTTPS consistently. Verify SSL certificate coverage. Check for hardcoded HTTP URLs in content.'
      };
    
    case 'domain_mismatch':
      return {
        rationale: `${count} URL(s) do not match expected base domain. This may indicate external links, CDN URLs, or configuration errors.`,
        recommendedAction: 'Verify if external domains are intentional. Review sitemap generation logic. Confirm CDN or subdomain configuration is correct.'
      };
    
    default:
      return {
        rationale: `${count} URL(s) flagged in category: ${category}`,
        recommendedAction: 'Review flagged URLs and determine appropriate action.'
      };
  }
}

export function groupRiskFindings(
  findings: RiskFinding[],
  maxSampleUrls: number = 5
): RiskGroupingResult {
  // Group by category
  const categoryMap = new Map<RiskCategory, RiskFinding[]>();
  
  for (const finding of findings) {
    if (!categoryMap.has(finding.category)) {
      categoryMap.set(finding.category, []);
    }
    categoryMap.get(finding.category)!.push(finding);
  }
  
  // Create groups
  const groups: RiskGroup[] = [];
  
  for (const [category, categoryFindings] of categoryMap.entries()) {
    // Get unique URLs for this category
    const uniqueUrls = Array.from(new Set(categoryFindings.map(f => f.url)));
    
    // Determine severity (highest severity in category)
    const severity = categoryFindings.reduce((highest, finding) => {
      const severityOrder: Severity[] = ['low', 'medium', 'high'];
      return severityOrder.indexOf(finding.severity) > severityOrder.indexOf(highest)
        ? finding.severity
        : highest;
    }, 'low' as Severity);
    
    // Select sample URLs
    const sampleUrls = uniqueUrls.slice(0, maxSampleUrls);
    
    // Generate rationale and recommendation
    const { rationale, recommendedAction } = generateRecommendation(category, severity, uniqueUrls.length);
    
    groups.push({
      category,
      severity,
      count: uniqueUrls.length,
      rationale,
      sampleUrls,
      recommendedAction,
      allUrls: uniqueUrls
    });
  }
  
  // Sort groups by severity (HIGH → MEDIUM → LOW)
  groups.sort((a, b) => {
    const severityOrder: Severity[] = ['high', 'medium', 'low'];
    return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
  });
  
  // Calculate summary counts
  const totalRiskUrls = new Set(findings.map(f => f.url)).size;
  const highSeverityCount = groups.filter(g => g.severity === 'high').reduce((sum, g) => sum + g.count, 0);
  const mediumSeverityCount = groups.filter(g => g.severity === 'medium').reduce((sum, g) => sum + g.count, 0);
  const lowSeverityCount = groups.filter(g => g.severity === 'low').reduce((sum, g) => sum + g.count, 0);
  
  return {
    groups,
    totalRiskUrls,
    highSeverityCount,
    mediumSeverityCount,
    lowSeverityCount
  };
}
