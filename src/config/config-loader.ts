import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { DEFAULT_CONFIG, type Config } from '@/types/config';

export async function loadConfig(cliOptions: Record<string, any>): Promise<Config> {
  // Start with defaults
  let config: Partial<Config> = { ...DEFAULT_CONFIG };
  
  // Layer 4: Global config (~/.sitemap-qa/config.json)
  const globalConfigPath = join(homedir(), '.sitemap-qa', 'config.json');
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(await readFile(globalConfigPath, 'utf-8'));
      config = { ...config, ...globalConfig };
    } catch (error) {
      console.warn(`Warning: Failed to load global config: ${error}`);
    }
  }
  
  // Layer 3: Project config (.sitemap-qa.config.json)
  const projectConfigPath = join(process.cwd(), '.sitemap-qa.config.json');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(await readFile(projectConfigPath, 'utf-8'));
      config = { ...config, ...projectConfig };
    } catch (error) {
      console.warn(`Warning: Failed to load project config: ${error}`);
    }
  }
  
  // Layer 2: Environment variables
  const envConfig = loadFromEnv();
  config = { ...config, ...envConfig };
  
  // Layer 1: CLI options (highest priority)
  config = mergeCliOptions(config, cliOptions);
  
  // Add baseUrl from cliOptions
  if (cliOptions.baseUrl) {
    config.baseUrl = cliOptions.baseUrl;
  }
  
  // Validate final config
  validateConfig(config as Config);
  
  return config as Config;
}

function loadFromEnv(): Partial<Config> {
  const env: Partial<Config> = {};
  
  if (process.env.SITEMAP_VERIFY_TIMEOUT) {
    env.timeout = parseInt(process.env.SITEMAP_VERIFY_TIMEOUT, 10);
  }
  
  return env;
}

function mergeCliOptions(config: Partial<Config>, cliOptions: Record<string, any>): Partial<Config> {
  const merged = { ...config };
  
  // Only override if explicitly set (not default string values)
  if (cliOptions.timeout && cliOptions.timeout !== '30') {
    merged.timeout = parseInt(cliOptions.timeout, 10);
  }
  
  if (cliOptions.output) {
    merged.outputFormat = cliOptions.output as 'json' | 'html';
  }
  
  if (cliOptions.outputDir) {
    merged.outputDir = cliOptions.outputDir;
  }
  
  if (cliOptions.verbose === true) {
    merged.verbose = true;
  }
  
  if (cliOptions.acceptedPatterns) {
    // Parse comma-separated patterns
    merged.acceptedPatterns = cliOptions.acceptedPatterns.split(',').map((p: string) => p.trim()).filter(Boolean);
  }
  
  // Performance and concurrency options
  if (cliOptions.riskDetectionConcurrency !== undefined) {
    merged.riskDetectionConcurrency = cliOptions.riskDetectionConcurrency;
  }
  
  if (cliOptions.riskDetectionBatchSize !== undefined) {
    merged.riskDetectionBatchSize = cliOptions.riskDetectionBatchSize;
  }
  
  if (cliOptions.parsingConcurrency !== undefined) {
    merged.parsingConcurrency = cliOptions.parsingConcurrency;
  }
  
  if (cliOptions.discoveryConcurrency !== undefined) {
    merged.discoveryConcurrency = cliOptions.discoveryConcurrency;
  }
  
  if (cliOptions.maxSitemaps !== undefined) {
    merged.maxSitemaps = cliOptions.maxSitemaps;
  }
  
  // Progress and output options
  if (cliOptions.progressBar !== undefined) {
    merged.progressBar = cliOptions.progressBar;
  }
  
  if (cliOptions.silent !== undefined) {
    merged.silent = cliOptions.silent;
  }
  
  if (cliOptions.benchmark !== undefined) {
    merged.benchmark = cliOptions.benchmark;
  }
  
  return merged;
}

function validateConfig(config: Config): void {
  if (config.timeout < 1 || config.timeout > 300) {
    throw new Error('Timeout must be between 1 and 300 seconds');
  }
  
  if (!['json', 'html'].includes(config.outputFormat)) {
    throw new Error('Output format must be json or html');
  }
}
