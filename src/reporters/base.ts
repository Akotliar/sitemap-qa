import { SitemapUrl } from '../types/sitemap';

export interface ReportData {
  totalUrls: number;
  totalRisks: number;
  urlsWithRisks: SitemapUrl[];
  startTime: Date;
  endTime: Date;
}

export interface Reporter {
  generate(data: ReportData): Promise<void>;
}
