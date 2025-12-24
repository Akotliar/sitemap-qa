import chalk from 'chalk';
import { Reporter, ReportData } from './base';

export class ConsoleReporter implements Reporter {
  async generate(data: ReportData): Promise<void> {
    console.log('\n' + chalk.bold.blue('=== sitemap-qa Analysis Summary ==='));
    console.log(`Total URLs Scanned: ${data.totalUrls}`);
    console.log(`Total Risks Found:  ${data.totalRisks > 0 ? chalk.red(data.totalRisks) : chalk.green(0)}`);
    console.log(`URLs with Risks:    ${data.urlsWithRisks.length}`);
    console.log(`Duration:           ${((data.endTime.getTime() - data.startTime.getTime()) / 1000).toFixed(2)}s`);

    if (data.urlsWithRisks.length > 0) {
      console.log('\n' + chalk.bold.yellow('Top Findings:'));
      data.urlsWithRisks.slice(0, 10).forEach((url) => {
        console.log(`\n${chalk.cyan(url.loc)}`);
        url.risks.forEach((risk) => {
          console.log(`  - [${chalk.red(risk.category)}] ${risk.reason} (${chalk.gray(risk.pattern)})`);
        });
      });

      if (data.urlsWithRisks.length > 10) {
        console.log(`\n... and ${data.urlsWithRisks.length - 10} more. See JSON/HTML report for full details.`);
      }
    }

    console.log('\n' + chalk.bold.blue('==================================='));
  }
}
