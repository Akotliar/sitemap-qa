import { Command } from 'commander';
import chalk from 'chalk';
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
  .option('-o, --output <format>', 'Output format (json, html, all)', 'all')
  .action(async (url: string, options: { config?: string; output: string }) => {
    const startTime = new Date();
    
    // 1. Load Config
    const config = ConfigLoader.load(options.config);
    
    // 2. Initialize Services
    const extractor = new ExtractorService();
    const matcher = new MatcherService(config);
    
    const urlsWithRisks: SitemapUrl[] = [];
    let totalUrls = 0;
    let totalRisks = 0;

    console.log(chalk.blue(`\n��� Starting analysis of ${url}...`));

    try {
      // 3. Pipeline: Extract -> Match
      for await (const urlObj of extractor.extract(url)) {
        totalUrls++;
        const risks = matcher.match(urlObj);
        
        if (risks.length > 0) {
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
        startTime,
        endTime,
      };

      // 4. Reporting
      const reporters: Reporter[] = [new ConsoleReporter()];
      
      if (options.output === 'json' || options.output === 'all') {
        reporters.push(new JsonReporter());
      }
      if (options.output === 'html' || options.output === 'all') {
        reporters.push(new HtmlReporter());
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
