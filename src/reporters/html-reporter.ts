import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { Reporter, ReportData } from './base';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HtmlReporter implements Reporter {
  private readonly outputPath: string;

  constructor(outputPath: string = 'sitemap-qa-report.html') {
    this.outputPath = outputPath;

    // Register helpers
    Handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context);
    });
  }

  async generate(data: ReportData): Promise<void> {
    // Register partials
    const partialsDir = path.join(__dirname, 'templates', 'partials');
    try {
      const partialFiles = await fs.readdir(partialsDir);
      for (const file of partialFiles) {
        if (file.endsWith('.hbs')) {
          const partialName = path.basename(file, '.hbs');
          const partialSource = await fs.readFile(path.join(partialsDir, file), 'utf8');
          Handlebars.registerPartial(partialName, partialSource);
        }
      }
    } catch (error) {
      console.warn('Could not load partials:', error);
    }

    const templatePath = path.join(__dirname, 'templates', 'report.hbs');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const templateData = this.prepareTemplateData(data);
    const html = template(templateData);

    await fs.writeFile(this.outputPath, html, 'utf8');
    console.log(`HTML report generated at ${this.outputPath}`);
  }

  private prepareTemplateData(data: ReportData) {
    const duration = ((data.endTime.getTime() - data.startTime.getTime()) / 1000).toFixed(1);
    const timestamp = data.endTime.toLocaleString();

    const categoriesMap: Record<string, Record<string, { reason: string, urls: string[] }>> = {};

    for (const urlObj of data.urlsWithRisks) {
      for (const risk of urlObj.risks) {
        if (!categoriesMap[risk.category]) {
          categoriesMap[risk.category] = {};
        }
        if (!categoriesMap[risk.category][risk.pattern]) {
          categoriesMap[risk.category][risk.pattern] = {
            reason: risk.reason,
            urls: []
          };
        }
        categoriesMap[risk.category][risk.pattern].urls.push(urlObj.loc);
      }
    }

    const categories = Object.entries(categoriesMap).map(([name, findingsMap]) => {
      const findings = Object.entries(findingsMap).map(([pattern, finding]) => ({
        pattern,
        urls: finding.urls,
        reason: finding.reason,
        displayUrls: finding.urls.slice(0, 3),
        moreCount: finding.urls.length > 3 ? finding.urls.length - 3 : 0
      }));

      const totalUrls = findings.reduce((acc, f) => acc + f.urls.length, 0);

      return {
        name,
        totalUrls,
        findings
      };
    });

    const ignoredUrls = data.ignoredUrls.map(u => {
      const suppressedCategories = u.risks.length > 0
        ? [...new Set(u.risks.map(r => r.category))].join(', ')
        : undefined;

      return {
        loc: u.loc,
        ignoredBy: u.ignoredBy ?? 'Unknown',
        suppressedCategories
      };
    });

    return {
      rootUrl: data.rootUrl,
      timestamp,
      discoveredSitemaps: data.discoveredSitemaps,
      totalUrls: data.totalUrls.toLocaleString(),
      totalRisks: data.totalRisks,
      ignoredUrls,
      duration,
      categories
    };
  }
}
