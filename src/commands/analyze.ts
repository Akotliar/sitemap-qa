import { Command } from 'commander';
import { promises as fs } from 'fs';
import ora from 'ora';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import os from 'os';
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

interface PhaseTiming {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
}

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
  parsingConcurrency?: string;
  silent?: boolean;
  benchmark?: boolean;
}

interface AnalysisPipelineResult {
  discoveryResult: DiscoveryResult;
  totalUrls: number;
  riskGroups: RiskGroup[];
  summary: RiskSummary;
  errors: Error[];
  executionTime: number;
  phaseTimings: PhaseTiming[];
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
  .option('--parsing-concurrency <number>', 'Number of concurrent sitemap parsers', '50')
  .option('--silent', 'Disable all progress output')
  .option('--benchmark', 'Save performance profile')
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
        parsingConcurrency: options.parsingConcurrency ? parseInt(options.parsingConcurrency) : undefined,
        silent: options.silent,
        benchmark: options.benchmark,
        progressBar: options.progress,
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
        
        // Prepare performance metrics
        const performanceMetrics = {
          totalExecutionTimeMs: result.executionTime,
          phaseTimings: result.phaseTimings.reduce((acc, p) => {
            acc[p.name.toLowerCase()] = p.duration;
            return acc;
          }, {} as Record<string, number>),
          throughput: {
            urlsPerSecond: Math.round((result.totalUrls / result.executionTime) * 1000),
            sitemapsPerSecond: parseFloat(((result.discoveryResult.sitemaps.length / result.executionTime) * 1000).toFixed(2))
          },
          resourceUsage: {
            cpuCoresUsed: config.riskDetectionConcurrency || os.cpus().length - 1
          }
        };
        
        const jsonReport = generateJsonReport(
          result.summary,
          result.discoveryResult,
          { totalCount: result.totalUrls, uniqueUrls: [], errors: [] },
          result.riskGroups,
          config,
          result.executionTime,
          { pretty: true, indent: 2, performanceMetrics }
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
 * Run complete analysis pipeline (5 phases) with timing and progress tracking
 */
async function runAnalysisPipeline(
  url: string,
  config: Config
): Promise<AnalysisPipelineResult> {
  const overallStartTime = Date.now();
  const phaseTimings: PhaseTiming[] = [];
  const errors: Error[] = [];
  
  const showProgress = !config.silent && config.progressBar !== false && process.stdout.isTTY;
  
  // Phase 1: Discovery
  let phaseStart = Date.now();
  if (!config.silent) {
    console.log(chalk.cyan('\n[Phase 1/5] Discovering Sitemaps'));
  }
  
  const discoveryResult = await discoverSitemaps(url, config);
  
  phaseTimings.push({
    name: 'Discovery',
    startTime: phaseStart,
    endTime: Date.now(),
    duration: Date.now() - phaseStart
  });
  
  if (!config.silent) {
    console.log(chalk.green(`✓ Found ${discoveryResult.sitemaps.length} sitemap(s) (${((Date.now() - phaseStart) / 1000).toFixed(1)}s)`));
  }
  
  // Check for access issues
  if (discoveryResult.accessIssues.length > 0) {
    if (!config.silent) {
      console.warn(chalk.yellow(`⚠️  Warning: ${discoveryResult.accessIssues.length} sitemap(s) are access-blocked`));
    }
    for (const issue of discoveryResult.accessIssues) {
      errors.push(new Error(`Access blocked: ${issue.url} (${issue.statusCode})`));
    }
  }
  
  if (discoveryResult.sitemaps.length === 0) {
    throw new Error(`No sitemaps found at ${url}. Tried: /sitemap.xml, /sitemap_index.xml, /robots.txt`);
  }
  
  // Phase 2: Parsing & Extraction
  phaseStart = Date.now();
  if (!config.silent) {
    console.log(chalk.cyan('\n[Phase 2/5] Parsing Sitemaps'));
  }
  
  let extractionResult;
  if (showProgress && discoveryResult.sitemaps.length > 10) {
    const parseBar = new cliProgress.SingleBar({
      format: '{bar} {percentage}% | {value}/{total} | ETA: {eta}s | {speed} sitemaps/sec',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    });
    
    parseBar.start(discoveryResult.sitemaps.length, 0, { speed: '0' });
    
    extractionResult = await extractAllUrls(
      discoveryResult.sitemaps,
      config,
      (completed, total) => {
        const elapsed = (Date.now() - phaseStart) / 1000;
        const speed = elapsed > 0 ? (completed / elapsed).toFixed(1) : '0';
        parseBar.update(completed, { speed });
      }
    );
    
    parseBar.stop();
  } else {
    extractionResult = await extractAllUrls(discoveryResult.sitemaps, config);
  }
  
  phaseTimings.push({
    name: 'Parsing',
    startTime: phaseStart,
    endTime: Date.now(),
    duration: Date.now() - phaseStart
  });
  
  if (!config.silent) {
    console.log(chalk.green(`✓ Extracted ${extractionResult.allUrls.length.toLocaleString()} URLs (${((Date.now() - phaseStart) / 1000).toFixed(1)}s)`));
  }
  
  // Collect errors
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
  phaseStart = Date.now();
  if (!config.silent) {
    console.log(chalk.cyan('\n[Phase 3/5] Deduplication'));
  }
  
  const consolidatedResult = consolidateUrls(extractionResult.allUrls);
  
  phaseTimings.push({
    name: 'Deduplication',
    startTime: phaseStart,
    endTime: Date.now(),
    duration: Date.now() - phaseStart
  });
  
  const duplicatesRemoved = extractionResult.allUrls.length - consolidatedResult.uniqueUrls.length;
  if (!config.silent) {
    if (duplicatesRemoved > 0) {
      console.log(chalk.green(`✓ ${consolidatedResult.uniqueUrls.length.toLocaleString()} unique URLs (removed ${duplicatesRemoved.toLocaleString()} duplicates) (${((Date.now() - phaseStart) / 1000).toFixed(1)}s)`));
    } else {
      console.log(chalk.green(`✓ ${consolidatedResult.uniqueUrls.length.toLocaleString()} unique URLs (${((Date.now() - phaseStart) / 1000).toFixed(1)}s)`));
    }
  }
  
  // Phase 4: Risk Detection
  phaseStart = Date.now();
  if (!config.silent) {
    console.log(chalk.cyan('\n[Phase 4/5] Risk Detection'));
  }
  
  const riskResult = await detectRisks(consolidatedResult.uniqueUrls, url, config);
  const riskGroups = groupRiskFindings(riskResult.findings);
  
  phaseTimings.push({
    name: 'Risk Detection',
    startTime: phaseStart,
    endTime: Date.now(),
    duration: Date.now() - phaseStart
  });
  
  const totalRiskyUrls = riskGroups.groups.reduce((sum, g) => sum + g.count, 0);
  if (!config.silent) {
    if (totalRiskyUrls > 0) {
      console.log(chalk.yellow(`⚠ Found ${totalRiskyUrls} risky URL(s) (${((Date.now() - phaseStart) / 1000).toFixed(1)}s)`));
    } else {
      console.log(chalk.green(`✓ No risks detected (${((Date.now() - phaseStart) / 1000).toFixed(1)}s)`));
    }
  }
  
  // Phase 5: Generate Summary
  phaseStart = Date.now();
  if (!config.silent) {
    console.log(chalk.cyan('\n[Phase 5/5] Generating Report'));
  }
  
  const executionTime = Date.now() - overallStartTime;
  const summary = summarizeRisks({
    riskGroups: riskGroups.groups,
    totalUrls: consolidatedResult.uniqueUrls.length,
    sitemapUrl: url,
    processingTime: executionTime,
  });
  
  phaseTimings.push({
    name: 'Summarization',
    startTime: phaseStart,
    endTime: Date.now(),
    duration: Date.now() - phaseStart
  });
  
  if (!config.silent) {
    console.log(chalk.green(`✓ Report generated (${((Date.now() - phaseStart) / 1000).toFixed(1)}s)`));
  }
  
  // Display phase summary
  if (!config.silent) {
    displayPhaseSummary(phaseTimings, executionTime);
  }
  
  // Save benchmark if requested
  if (config.benchmark) {
    await saveBenchmark(phaseTimings, url, executionTime, discoveryResult.sitemaps.length, consolidatedResult.uniqueUrls.length, config);
  }
  
  return {
    discoveryResult,
    totalUrls: consolidatedResult.uniqueUrls.length,
    riskGroups: riskGroups.groups,
    summary,
    errors,
    executionTime,
    phaseTimings,
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

/**
 * Display phase timing summary
 */
function displayPhaseSummary(timings: PhaseTiming[], totalTime: number): void {
  console.log(chalk.green(`\n✅ Analysis Complete (Total: ${(totalTime / 1000).toFixed(1)}s)\n`));
  console.log(chalk.cyan('Phase Breakdown:'));
  
  for (const timing of timings) {
    const seconds = (timing.duration / 1000).toFixed(1);
    const percentage = ((timing.duration / totalTime) * 100).toFixed(1);
    const bar = '•';
    
    console.log(`  ${bar} ${timing.name.padEnd(15)}: ${seconds.padStart(5)}s (${percentage.padStart(5)}%)`);
  }
  
  console.log('');
}

/**
 * Save performance benchmark to file
 */
async function saveBenchmark(
  timings: PhaseTiming[],
  url: string,
  totalTime: number,
  sitemapCount: number,
  urlCount: number,
  config: Config
): Promise<void> {
  const benchmark = {
    timestamp: new Date().toISOString(),
    url,
    total_duration_ms: totalTime,
    phases: timings.map(t => ({
      name: t.name.toLowerCase(),
      start_ms: t.startTime,
      end_ms: t.endTime,
      duration_ms: t.duration
    })),
    metrics: {
      sitemaps_processed: sitemapCount,
      urls_analyzed: urlCount,
      throughput: {
        urls_per_second: Math.round((urlCount / totalTime) * 1000),
        sitemaps_per_second: ((sitemapCount / totalTime) * 1000).toFixed(2)
      }
    },
    system_info: {
      cpu_count: os.cpus().length,
      node_version: process.version,
      platform: process.platform,
      memory_total_mb: Math.round(os.totalmem() / 1024 / 1024)
    },
    config: {
      parsing_concurrency: config.parsingConcurrency,
      risk_detection_concurrency: config.riskDetectionConcurrency,
      risk_detection_batch_size: config.riskDetectionBatchSize
    }
  };
  
  const filename = `performance-profile-${Date.now()}.json`;
  await fs.writeFile(filename, JSON.stringify(benchmark, null, 2));
  console.log(chalk.blue(`📊 Benchmark saved to: ${filename}`));
}
