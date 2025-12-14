import { Command } from 'commander';
import { promises as fs } from 'fs';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '@/config/config-loader';
import { discoverSitemaps } from '@/core/discovery';
import { extractAllUrls } from '@/core/extractor';
import { consolidateUrls } from '@/core/consolidator';
import { detectRisks } from '@/core/risk-detector';
import { groupRiskFindings } from '@/core/risk-grouper';
import { summarizeRisks } from '@/summarizer';
import { generateJsonReport } from '@/reporters/json-reporter';
import { writeHtmlReport } from '@/reporters/html-reporter';
import type { Config } from '@/types/config';
import type { DiscoveryResult } from '@/core/discovery';
import type { RiskSummary } from '@/summarizer';
import type { RiskGroup } from '@/core/risk-grouper';

interface AnalyzeOptions {
  timeout: string;
  progress: boolean;
  output: 'json' | 'html';
  outputDir?: string;
  outputFile?: string;
  color: boolean;
  verbose: boolean;
  acceptedPatterns?: string;
  concurrency?: string;
  batchSize?: string;
}

interface AnalysisPipelineResult {
  discoveryResult: DiscoveryResult;
  totalUrls: number;
  riskGroups: RiskGroup[];
  summary: RiskSummary;
  errors: Error[];
  executionTime: number;
}

export const analyzeCommand = new Command('analyze')
  .description('Analyze sitemap for QA issues')
  .argument('<url>', 'Base URL to analyze')
  .option('--timeout <seconds>', 'HTTP timeout in seconds', '30')
  .option('--no-progress', 'Disable progress bar')
  .option('--output <format>', 'Output format: html or json', 'html')
  .option('--output-dir <path>', 'Output directory for reports')
  .option('--output-file <path>', 'Custom output filename')
  .option('--accepted-patterns <patterns>', 'Comma-separated regex patterns to exclude from risk detection')
  .option('--concurrency <number>', 'Number of concurrent workers for risk detection')
  .option('--batch-size <number>', 'URLs per batch for risk detection', '10000')
  .option('--no-color', 'Disable ANSI color codes in CLI output')
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (url: string, options: AnalyzeOptions) => {
    let config: Config | undefined;
    
    try {
      // Validate options
      validateAnalyzeOptions(options);
      
      // Load configuration with hierarchy
      const loadedConfig = await loadConfig({
        ...options,
        baseUrl: url,
        outputFormat: options.output,
        riskDetectionConcurrency: options.concurrency ? parseInt(options.concurrency) : undefined,
        riskDetectionBatchSize: options.batchSize ? parseInt(options.batchSize) : undefined,
      });
      config = loadedConfig;
      
      console.log(`\n🔍 Analyzing ${url}...\n`);
      
      // Run analysis pipeline
      const result = await runAnalysisPipeline(url, config);
      
      // Show simple CLI summary
      showCliSummary(result);
      
      // Create output directory
      await fs.mkdir(config.outputDir, { recursive: true });
      
      // Always generate HTML report
      const htmlFileName = options.outputFile || `sitemap-qa-report-${Date.now()}.html`;
      const htmlFilePath = `${config.outputDir}/${htmlFileName}`;
      await writeHtmlReport(
        result.summary,
        result.discoveryResult,
        result.totalUrls,
        config,
        htmlFilePath,
        result.errors,
        { maxUrlsPerGroup: 10 }
      );
      console.log(`\n📄 Full report saved to: ${chalk.cyan(htmlFilePath)}`);
      
      // Generate JSON if requested
      if (options.output === 'json') {
        const jsonFileName = htmlFileName.replace(/\.html$/, '.json');
        const jsonFilePath = `${config.outputDir}/${jsonFileName}`;
        const jsonReport = generateJsonReport(
          result.summary,
          result.discoveryResult,
          { totalCount: result.totalUrls, uniqueUrls: [], errors: [] },
          result.riskGroups,
          config,
          result.executionTime,
          { pretty: true, indent: 2 }
        );
        await fs.writeFile(jsonFilePath, jsonReport, 'utf-8');
        console.log(`📄 JSON report saved to: ${chalk.cyan(jsonFilePath)}`);
      }
      
      // Exit with appropriate code
      const exitCode = determineExitCode(result);
      process.exit(exitCode);
      
    } catch (error) {
      handleAnalysisError(error, config!);
      process.exit(2);
    }
  });

/**
 * Validate analyze command options
 */
function validateAnalyzeOptions(options: AnalyzeOptions): void {
  // Validate output format
  const validFormats = ['json', 'html'];
  if (!validFormats.includes(options.output)) {
    throw new Error(
      `Invalid output format: ${options.output}. Must be one of: ${validFormats.join(', ')}`
    );
  }
  
  // Validate timeout
  const timeout = parseInt(options.timeout);
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error(`Invalid timeout: ${options.timeout}. Must be a positive number.`);
  }
}

/**
 * Show simple CLI summary
 */
function showCliSummary(result: AnalysisPipelineResult): void {
  console.log('');
  const riskyUrlCount = result.summary.categoryInsights.reduce((sum, g) => sum + g.count, 0);
  
  if (riskyUrlCount === 0) {
    console.log(chalk.green('✅ No issues found - sitemap looks clean!'));
  } else {
    console.log(chalk.yellow(`⚠️  Found ${riskyUrlCount} potentially risky URL(s)`));
    console.log('');
    
    // Show breakdown by severity
    const { high, medium, low } = result.summary.severityBreakdown;
    if (high > 0) {
      console.log(chalk.red(`   🚨 High severity:   ${high} URLs`));
    }
    if (medium > 0) {
      console.log(chalk.yellow(`   ⚠️  Medium severity: ${medium} URLs`));
    }
    if (low > 0) {
      console.log(chalk.blue(`   ℹ️  Low severity:    ${low} URLs`));
    }
  }
  console.log('');
}

/**
 * Run complete analysis pipeline (5 phases)
 */
async function runAnalysisPipeline(
  url: string,
  config: Config
): Promise<AnalysisPipelineResult> {
  const startTime = Date.now();
  const errors: Error[] = [];
  
  // Phase 1: Discovery
  const discoverySpinner = ora('Discovering sitemaps...').start();
  const discoveryResult = await discoverSitemaps(url, config);
  discoverySpinner.succeed(`Found ${discoveryResult.sitemaps.length} sitemap(s)`);
  
  // Check for access issues
  if (discoveryResult.accessIssues.length > 0) {
    console.warn(`⚠️  Warning: ${discoveryResult.accessIssues.length} sitemap(s) are access-blocked`);
    for (const issue of discoveryResult.accessIssues) {
      errors.push(new Error(`Access blocked: ${issue.url} (${issue.statusCode})`));
    }
  }
  
  if (discoveryResult.sitemaps.length === 0) {
    throw new Error(`No sitemaps found at ${url}. Tried: /sitemap.xml, /sitemap_index.xml, /robots.txt`);
  }
  
  // Phase 2: Parsing & Extraction
  const extractionSpinner = ora('Parsing sitemaps...').start();
  const extractionResult = await extractAllUrls(discoveryResult.sitemaps, config);
  extractionSpinner.succeed(`Extracted ${extractionResult.allUrls.length.toLocaleString()} URLs`);
  
  // Collect errors without displaying them (they'll be in the report)
  if (extractionResult.errors.length > 0) {
    for (const err of extractionResult.errors) {
      if (typeof err === 'string') {
        errors.push(new Error(err));
      } else {
        errors.push(err);
      }
    }
  }
  
  if (extractionResult.allUrls.length === 0) {
    throw new Error('No URLs extracted from sitemaps');
  }
  
  // Phase 3: Consolidation & Deduplication
  const consolidationSpinner = ora('Removing duplicates...').start();
  const consolidatedResult = consolidateUrls(extractionResult.allUrls);
  const duplicatesRemoved = extractionResult.allUrls.length - consolidatedResult.uniqueUrls.length;
  if (duplicatesRemoved > 0) {
    consolidationSpinner.succeed(`${consolidatedResult.uniqueUrls.length.toLocaleString()} unique URLs (removed ${duplicatesRemoved.toLocaleString()} duplicates)`);
  } else {
    consolidationSpinner.succeed(`${consolidatedResult.uniqueUrls.length.toLocaleString()} unique URLs`);
  }
  
  // Phase 4: Risk Detection
  const riskSpinner = ora('Analyzing for risks...').start();
  const riskResult = await detectRisks(consolidatedResult.uniqueUrls, url, config);
  const riskGroups = groupRiskFindings(riskResult.findings);
  
  const totalRiskyUrls = riskGroups.groups.reduce((sum, g) => sum + g.count, 0);
  if (totalRiskyUrls > 0) {
    riskSpinner.warn(`Found ${totalRiskyUrls} risky URL(s)`);
  } else {
    riskSpinner.succeed('No risks detected');
  }
  
  
  // Phase 5: Generate Summary
  const executionTime = Date.now() - startTime;
  const summarySpinner = ora('Generating report...').start();
  const summary = summarizeRisks({
    riskGroups: riskGroups.groups,
    totalUrls: consolidatedResult.uniqueUrls.length,
    sitemapUrl: url,
    processingTime: executionTime,
  });
  summarySpinner.succeed('Analysis complete');
  
  return {
    discoveryResult,
    totalUrls: consolidatedResult.uniqueUrls.length,
    riskGroups: riskGroups.groups,
    summary,
    errors,
    executionTime,
  };
}

/**
 * Determine exit code based on analysis results
 */
function determineExitCode(result: AnalysisPipelineResult): number {
  // Exit code 0: Success with no high-severity issues
  // Exit code 1: High-severity issues found
  // Exit code 2: Analysis failed with errors (handled in catch block)
  
  const highSeverityCount = result.summary.severityBreakdown.high;
  
  if (highSeverityCount > 0) {
    return 1; // High-severity issues found
  }
  
  return 0; // Success
}

/**
 * Handle analysis errors with user-friendly messages
 */
function handleAnalysisError(error: unknown, config?: Config): void {
  console.error('\n❌ Analysis failed\n');
  
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    
    if (config?.verbose && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    // Provide helpful suggestions based on error message
    if (error.message.includes('No sitemaps found')) {
      console.error('\nSuggestions:');
      console.error('  • Verify the base URL is correct');
      console.error('  • Check if the site has a sitemap');
      console.error('  • Ensure the sitemap is publicly accessible');
    } else if (error.message.includes('Network') || error.message.includes('timeout')) {
      console.error('\nSuggestions:');
      console.error('  • Check your internet connection');
      console.error('  • Verify the URL is accessible');
      console.error('  • Try increasing the timeout with --timeout option');
    }
  } else {
    console.error('Unknown error occurred');
    console.error(String(error));
  }
}
