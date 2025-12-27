import { SitemapUrl } from '../types/sitemap';

export interface ReportData {
  rootUrl: string;
  discoveredSitemaps: string[];
  totalUrls: number;
  totalRisks: number;
  urlsWithRisks: SitemapUrl[];
  ignoredUrls: SitemapUrl[];
  startTime: Date;
  endTime: Date;
}

export interface Reporter {
  generate(data: ReportData): Promise<void>;
}
