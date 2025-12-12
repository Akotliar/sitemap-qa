import { beforeEach, afterEach, vi } from 'vitest';

// Global setup to suppress console output during tests
let consoleLogSpy: any;
let consoleWarnSpy: any;
let consoleErrorSpy: any;
let stdoutWriteSpy: any;
let stderrWriteSpy: any;

beforeEach(() => {
  // Mock console methods to suppress output
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Mock process stdout/stderr to suppress progress indicators
  stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  // Restore console methods after each test
  consoleLogSpy?.mockRestore();
  consoleWarnSpy?.mockRestore();
  consoleErrorSpy?.mockRestore();
  stdoutWriteSpy?.mockRestore();
  stderrWriteSpy?.mockRestore();
});
