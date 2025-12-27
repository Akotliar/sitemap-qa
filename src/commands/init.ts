import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

const DEFAULT_CONFIG = `# sitemap-qa configuration
# This file defines the risk categories and patterns to monitor.

# Risk Categories
# Each category contains a list of patterns to match against URLs found in sitemaps.
# Patterns can be:
# - literal: Exact string match
# - glob: Glob pattern (e.g., **/admin/**)
# - regex: Regular expression (e.g., /\\/v[0-9]+\\//)

# Acceptable Patterns
# URLs matching these patterns will be ignored and not flagged as risks.
acceptable_patterns:
  - type: "literal"
    value: "/acceptable-path"
    reason: "Example of an acceptable path that should not be flagged."
  - type: "glob"
    value: "**/public-docs/**"
    reason: "Public documentation is always acceptable."

policies:
  - category: "Security & Admin"
    patterns:
      - type: "glob"
        value: "**/admin/**"
        reason: "Administrative interfaces should not be publicly indexed."
      - type: "glob"
        value: "**/.env*"
        reason: "Environment files contain sensitive secrets."
      - type: "literal"
        value: "/wp-admin"
        reason: "WordPress admin paths are common attack vectors."

  - category: "Environment Leakage"
    patterns:
      - type: "glob"
        value: "**/staging.**"
        reason: "Staging environments should be restricted."
      - type: "glob"
        value: "**/dev.**"
        reason: "Development subdomains detected in production sitemap."

  - category: "Sensitive Files"
    patterns:
      - type: "glob"
        value: "**/*.{sql,bak,zip,tar.gz}"
        reason: "Archive or database backup files exposed."
`;

export const initCommand = new Command('init')
  .description('Initialize a default sitemap-qa.yaml configuration file')
  .action(() => {
    const configPath = path.join(process.cwd(), 'sitemap-qa.yaml');

    if (fs.existsSync(configPath)) {
      console.error(chalk.red(`Error: ${configPath} already exists.`));
      process.exit(1);
    }

    try {
      fs.writeFileSync(configPath, DEFAULT_CONFIG, 'utf8');
      console.log(chalk.green(`Successfully created ${configPath}`));
    } catch (error) {
      console.error(chalk.red('Failed to create configuration file:'), error);
      process.exit(1);
    }
  });
