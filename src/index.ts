#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { analyzeCommand } from '@/commands/analyze';
import { initCommand } from '@/commands/init';

const program = new Command();

program
  .name('sitemap-qa')
  .version('1.0.0')
  .description('sitemap analysis for QA teams');

program.addCommand(analyzeCommand);
program.addCommand(initCommand);

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

program.parse();
