export interface RiskGroup {
  category: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  rationale: string;
  allUrls: string[];
  sampleUrls: string[];
}
