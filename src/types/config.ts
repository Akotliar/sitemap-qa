export interface Config {
  // Network settings
  timeout: number;              // HTTP timeout in seconds
  concurrency: number;          // Concurrent sitemap fetches
  parsingConcurrency?: number;  // Concurrent sitemap parsing (default: 25)
  
  // Output settings
  outputFormat: 'json' | 'html';
  outputDir: string;            // Output directory for reports
  verbose: boolean;             // Verbose logging
  
  // Base URL for analysis
  baseUrl: string;
  
  // Risk detection settings
  acceptedPatterns?: string[];  // URL patterns to exclude from risk detection (regex strings)
  riskDetectionBatchSize?: number;      // URLs per batch for risk detection (default: 10000)
  riskDetectionConcurrency?: number;    // Number of concurrent batches for risk detection (default: auto-detect cores)
}

export const DEFAULT_CONFIG: Config = {
  timeout: 30,
  concurrency: 10,
  parsingConcurrency: 25,  // Optimized for modern multi-core CPUs
  outputFormat: 'html',
  outputDir: './sitemap-qa/report',
  verbose: false,
  baseUrl: 'https://example.com',  // Default for tests
  acceptedPatterns: [],
  riskDetectionBatchSize: 10000,
  riskDetectionConcurrency: undefined, // Auto-detect in risk-detector.ts
};
