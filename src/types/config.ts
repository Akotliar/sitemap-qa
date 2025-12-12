export interface Config {
  // Network settings
  timeout: number;              // HTTP timeout in seconds
  concurrency: number;          // Concurrent sitemap fetches
  
  // Output settings
  outputFormat: 'json' | 'html';
  outputDir: string;            // Output directory for reports
  verbose: boolean;             // Verbose logging
  
  // Base URL for analysis
  baseUrl: string;
  
  // Risk detection settings
  acceptedPatterns?: string[];  // URL patterns to exclude from risk detection (regex strings)
}

export const DEFAULT_CONFIG: Config = {
  timeout: 30,
  concurrency: 10,
  outputFormat: 'html',
  outputDir: './sitemap-qa/report',
  verbose: false,
  baseUrl: 'https://example.com',  // Default for tests
  acceptedPatterns: [],
};
