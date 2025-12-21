export interface Config {
  // Network settings
  timeout: number;              // HTTP timeout in seconds
  concurrency: number;          // Concurrent sitemap fetches
  parsingConcurrency?: number;  // Concurrent sitemap parsing (default: 50)
  discoveryConcurrency?: number; // Concurrent sitemap index discovery (default: 50)
  maxSitemaps?: number;         // Maximum number of sitemaps to process (default: 1000)
  
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
  
  // Progress & Metrics
  progressBar?: boolean;        // Show progress bars (default: auto-detect TTY)
  silent?: boolean;             // Disable all progress output
  benchmark?: boolean;          // Save performance profile
}

export const DEFAULT_CONFIG: Config = {
  timeout: 30,
  concurrency: 10,
  parsingConcurrency: 50,  // Optimized for network-bound parallel parsing
  discoveryConcurrency: 50,  // Optimized for recursive sitemap index discovery
  maxSitemaps: 1000,  // Prevent excessive sitemap discovery
  outputFormat: 'html',
  outputDir: './sitemap-qa/report',
  verbose: false,
  baseUrl: 'https://example.com',  // Default for tests
  acceptedPatterns: [],
  riskDetectionBatchSize: 10000,
  riskDetectionConcurrency: undefined, // Auto-detect in risk-detector.ts
  progressBar: undefined, // Auto-detect TTY
  silent: false,
  benchmark: false,
};
