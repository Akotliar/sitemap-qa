import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ConfigLoader } from '../config/loader';
import { ExtractorService } from '../core/extractor';
import { MatcherService } from '../core/matcher';
import { ConsoleReporter } from '../reporters/console-reporter';
import { JsonReporter } from '../reporters/json-reporter';
import { HtmlReporter } from '../reporters/html-reporter';
import { ReportData, Reporter } from '../reporters/base';
import { SitemapUrl } from '../types/sitemap';

export const analyzeCommand = new Command('analyze')
  .description('Analyze a sitemap for potential risks')
  .argument('<url>', 'Root sitemap URL')
  .option('-c, --config <path>', 'Path to sitemap-qa.yaml')
  .option('-o, --output <format>', 'Output format (json, html, all)')
  .option('-d, --out-dir <path>', 'Directory to save reports')
  .action(async (url: string, options: { config?: string; output?: string; outDir?: string }) => {
    const startTime = new Date();
    
    // 1. Load Config
    const config = ConfigLoader.load(options.config);
    const outDir = options.outDir || config.outDir || '.';
    const outputFormat = options.output || config.outputFormat || 'all';
    
    // 2. Initialize Services
    const extractor = new ExtractorService();
    const matcher = new MatcherService(config, url);
    
    const urlsWithRisks: SitemapUrl[] = [];
    const ignoredUrls: SitemapUrl[] = [];
    let totalUrls = 0;
    let totalRisks = 0;

    console.log(chalk.blue(`\n🚀 Starting analysis of ${url}...`));

    try {
      // 3. Pipeline: Extract -> Match
      for await (const urlObj of extractor.extract(url)) {
        totalUrls++;
        const risks = matcher.match(urlObj);
        
        if (urlObj.ignored) {
          ignoredUrls.push(urlObj);
        } else if (risks.length > 0) {
          urlObj.risks = risks;
          urlsWithRisks.push(urlObj);
          totalRisks += risks.length;
        }

        if (totalUrls % 100 === 0) {
          process.stdout.write(chalk.gray(`\rProcessed ${totalUrls} URLs...`));
        }
      }
      process.stdout.write('\n');

      const endTime = new Date();
      const reportData: ReportData = {
        rootUrl: url,
        discoveredSitemaps: extractor.getDiscoveredSitemaps(),
        totalUrls,
        totalRisks,
        urlsWithRisks,
        ignoredUrls,
        startTime,
        endTime,
      };

      // 4. Reporting
      const reporters: Reporter[] = [new ConsoleReporter()];
      
      await fs.mkdir(outDir, { recursive: true });

      if (outputFormat === 'json' || outputFormat === 'all') {
        const jsonPath = path.join(outDir, 'sitemap-qa-report.json');
        reporters.push(new JsonReporter(jsonPath));
      }
      if (outputFormat === 'html' || outputFormat === 'all') {
        const htmlPath = path.join(outDir, 'sitemap-qa-report.html');
        reporters.push(new HtmlReporter(htmlPath));
      }

      for (const reporter of reporters) {
        await reporter.generate(reportData);
      }

      // 5. Exit Code
      if (totalRisks > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }

    } catch (error) {
      console.error(chalk.red('\nAnalysis failed:'), error);
      process.exit(1);
    }
  });
