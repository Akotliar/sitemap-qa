import fs from 'node:fs/promises';
import { Reporter, ReportData } from './base';

export class JsonReporter implements Reporter {
  private readonly outputPath: string;

  constructor(outputPath: string = 'sitemap-qa-report.json') {
    this.outputPath = outputPath;
  }

  async generate(data: ReportData): Promise<void> {
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        durationMs: data.endTime.getTime() - data.startTime.getTime(),
      },
      summary: {
        totalUrls: data.totalUrls,
        totalRisks: data.totalRisks,
        urlsWithRisksCount: data.urlsWithRisks.length,
      },
      findings: data.urlsWithRisks,
    };

    await fs.writeFile(this.outputPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`JSON report generated at ${this.outputPath}`);
  }
}
