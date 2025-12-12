import type { RiskGroup } from '@/core/risk-grouper';

export interface RiskSummaryRequest {
  riskGroups: RiskGroup[];
  totalUrls: number;
  sitemapUrl: string;
  processingTime?: number;
}

export interface RiskSummary {
  overview: string;
  keyFindings: string[];
  categoryInsights: CategoryInsight[];
  severityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
  generatedBy: string;
  metadata: {
    tokensUsed: number;
    processingTime: number;
    model: string;
  };
}

export interface CategoryInsight {
  category: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  summary: string;
  examples: string[];
  allUrls: string[]; // Full list of all URLs in this category
}

export function summarizeRisks(request: RiskSummaryRequest): RiskSummary {
  const severityBreakdown = {
    high: 0,
    medium: 0,
    low: 0
  };
  
  const categoryInsights: CategoryInsight[] = request.riskGroups.map(group => {
    severityBreakdown[group.severity] += group.count;
    
    const urls = group.allUrls || group.sampleUrls;
    
    return {
      category: group.category,
      count: group.count,
      severity: group.severity,
      summary: group.rationale,
      examples: urls.slice(0, 3),
      allUrls: urls // Include all URLs for download functionality
    };
  });
  
  const totalRisks = request.riskGroups.reduce((sum, g) => sum + g.count, 0);
  const overview = totalRisks > 0
    ? `Found ${totalRisks} potentially risky URLs across ${request.riskGroups.length} categories in ${request.totalUrls} total URLs.`
    : `Analyzed ${request.totalUrls} URLs. No suspicious patterns detected.`;
  
  const keyFindings: string[] = [];
  if (severityBreakdown.high > 0) {
    keyFindings.push(`${severityBreakdown.high} high-severity issues require immediate attention`);
  }
  if (severityBreakdown.medium > 0) {
    keyFindings.push(`${severityBreakdown.medium} medium-severity issues should be reviewed`);
  }
  if (severityBreakdown.low > 0) {
    keyFindings.push(`${severityBreakdown.low} low-severity items flagged for awareness`);
  }
  
  return {
    overview,
    keyFindings,
    categoryInsights,
    severityBreakdown,
    recommendations: [],
    generatedBy: 'rule-based analysis',
    metadata: {
      tokensUsed: 0,
      processingTime: request.processingTime || 0,
      model: 'pattern-matching'
    }
  };
}
