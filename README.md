# Sitemap-QA

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![npm version](https://img.shields.io/npm/v/@akotliar/sitemap-qa/alpha.svg)](https://www.npmjs.com/package/@akotliar/sitemap-qa)

> ⚠️ **Alpha Release** — This tool is currently in active development. Features and APIs may change. Feedback and contributions are welcome!

Sitemap-QA is a command-line tool that automatically discovers, parses, and analyzes website sitemaps to identify potential quality issues, security risks, and configuration problems. Built for QA teams to validate deployments, catch environment leakage, and identify URLs that shouldn't be publicly indexed.

---

## 📑 Table of Contents

- [Why Sitemap-QA?](#-why-sitemap-qa)
- [Quick Start](#-quick-start)
  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
- [Features](#-features)
  - [Automatic Sitemap Discovery](#automatic-sitemap-discovery)
  - [Risk Detection Patterns](#risk-detection-patterns)
  - [Customizing Risks](#customizing-risks)
  - [Output Formats](#output-formats)
- [CLI Commands](#-cli-commands)
  - [analyze](#analyze-command)
  - [init](#init-command)
- [Configuration](#-configuration)
  - [Configuration Options](#configuration-options)
- [CI/CD Integration](#-cicd-integration)
  - [Exit Codes](#exit-codes)
  - [Integration Examples](#integration-examples)
- [Development](#-development)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Running Tests](#running-tests)
  - [Building](#building)
- [Contributing](#-contributing)
- [FAQ & Troubleshooting](#-faq--troubleshooting)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Support](#-support)

---

## 🎯 Why Sitemap-QA?

Unlike SEO-focused sitemap validators, Sitemap-QA is designed specifically for **QA validation and risk detection** using a **Policy-as-Code** approach:

- ✅ **Detect environment leakage** — Find staging, dev, or test URLs that shouldn't be in production sitemaps
- ✅ **Identify exposed admin paths** — Catch `/admin`, `/dashboard`, and internal routes in public indexes
- ✅ **Flag sensitive files** — Detect database backups, environment files, and archives
- ✅ **Domain Consistency** — Automatically flag URLs that point to external or incorrect domains (handles `www.` normalization)
- ✅ **Acceptable Patterns (Allowlist)** — Exclude known safe URLs from being flagged as risks
- ✅ **Fully Customizable** — Define your own risk categories and patterns using Literal, Glob, or Regex matching
- ✅ **Fast and automated** — Analyze thousands of URLs in seconds with detailed reports

Perfect for CI/CD pipelines, pre-release validation, and security audits.

---

## 🚀 Quick Start

### Installation

```bash
# Install the alpha version globally
npm install -g @akotliar/sitemap-qa@alpha
```

### Basic Usage

```bash
# Step 1: Initialize a configuration file (optional but recommended)
sitemap-qa init

# Step 2: Analyze a website's sitemap
sitemap-qa analyze https://example.com

# Generate JSON output only for CI/CD
sitemap-qa analyze https://example.com --output json

# Use a custom configuration file
sitemap-qa analyze https://example.com --config ./custom-config.yaml
```

---

## 📋 Features

### Automatic Sitemap Discovery
- Checks `robots.txt` for sitemap declarations
- Tests standard paths (`/sitemap.xml`, `/sitemap_index.xml`, etc.)
- Recursively follows sitemap indexes
- Handles multiple sitemaps in supported formats (XML, compressed XML `.xml.gz`, and dynamically generated/PHP-based sitemaps)

### Risk Detection Patterns

The tool comes with a set of default policies, but you can fully customize them in your `sitemap-qa.yaml`.

| Risk Category | Description | Example Patterns |
|--------------|-------------|------------------|
| **Security & Admin** | Detects exposed administrative interfaces and sensitive configuration files. | `**/admin/**`, `**/.env*`, `/wp-admin` |
| **Environment Leakage** | Finds staging or development URLs that shouldn't be in production sitemaps. | `**/staging.**`, `**/dev.**` |
| **Sensitive Files** | Flags database backups, archives, and other sensitive file types. | `**/*.{sql,bak,zip,tar}`, `**/*.tar.gz` |
| **Domain Consistency** | Detects URLs that don't match the target domain (ignoring `www.` differences). | `example.com` vs `other.com` |

### Customizing Risks

You can add your own categories and patterns to the `sitemap-qa.yaml` file. Patterns support `literal`, `glob`, and `regex` matching. See the [Configuration](#-configuration) section for details.


### Output Formats

#### HTML Report (Interactive)
The HTML report provides an interactive, visually appealing view with:
- Expandable/collapsible sections by category
- Download buttons to export all URLs per finding
- Clean, modern design with hover effects
- Portable single-file format

#### JSON Report (Machine-Readable)
```json
{
  "metadata": {
    "generatedAt": "2025-12-24T12:00:00.000Z",
    "durationMs": 1240
  },
  "summary": {
    "totalUrls": 895,
    "totalRisks": 2,
    "urlsWithRisksCount": 1,
    "ignoredUrlsCount": 5
  },
  "findings": [
    {
      "loc": "https://example.com/admin/login",
      "risks": [
        {
          "category": "Security & Admin",
          "pattern": "**/admin/**",
          "type": "glob",
          "reason": "Administrative interfaces should not be publicly indexed."
        }
      ]
    }
  ]
}
```

---

## 🛠️ CLI Commands

Sitemap-QA provides two main commands: `analyze` and `init`.

### analyze Command

Analyze a website's sitemap for quality issues and security risks.

```
Usage: sitemap-qa analyze <url> [options]

Analyze a website's sitemap for quality issues

Arguments:
  url                          Base URL of the website to analyze

Options:
  -c, --config <path>          Path to sitemap-qa.yaml configuration file
  -o, --output <format>        Output format: json, html, or all (default: "all")
  -d, --out-dir <path>         Output directory for reports (default: ".")
  -h, --help                   Display help for command
```

#### Examples

```bash
# Basic analysis with both HTML and JSON reports (default)
sitemap-qa analyze https://example.com

# JSON output only
sitemap-qa analyze https://example.com --output json

# HTML output only
sitemap-qa analyze https://example.com --output html

# Custom output directory
sitemap-qa analyze https://example.com --out-dir ./reports

# Use a specific configuration file
sitemap-qa analyze https://example.com --config ./custom-config.yaml

# Combine options
sitemap-qa analyze https://example.com --config ./custom-config.yaml --output json --out-dir ./reports
```

### init Command

Initialize a default `sitemap-qa.yaml` configuration file in the current directory.

```
Usage: sitemap-qa init [options]

Initialize a default sitemap-qa.yaml configuration file

Options:
  -h, --help                   Display help for command
```

#### Example

```bash
# Create a default configuration file
sitemap-qa init

# This creates sitemap-qa.yaml with:
# - Default risk policies (Security & Admin, Environment Leakage, Sensitive Files)
# - Example acceptable patterns
# - Default output settings
```

**Note:** The `init` command will fail if `sitemap-qa.yaml` already exists in the current directory to prevent accidental overwrites.

---

## 🔧 Configuration

Create a `sitemap-qa.yaml` file in your project root to define your monitoring policies and tool settings:

```yaml
# Tool Settings
# Default outDir is "."; this example uses a custom reports directory
outDir: "./sitemap-qa/report" # custom output directory
outputFormat: "all" # Options: json, html, all
enforceDomainConsistency: true # Flag URLs from other domains

# Monitoring Policies
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
      - type: "literal"
        value: "/wp-admin"
        reason: "WordPress admin paths are common attack vectors."
      - type: "regex"
        value: ".*\\.php$"
        reason: "PHP file detected"
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outDir` | string | `"."` | Directory for generated reports (current working directory by default) |
| `outputFormat` | string | `"all"` | Report types to generate: `json`, `html`, or `all` |
| `enforceDomainConsistency` | boolean | `true` | If true, flags URLs that don't match the root sitemap domain (ignoring `www.`) |
| `acceptable_patterns` | array | `[]` | List of patterns to exclude from risk analysis |
| `policies` | array | `[]` | List of monitoring policies with patterns |


**Priority:** CLI options > Project config (`sitemap-qa.yaml`) > Defaults

---

## 🔄 CI/CD Integration

Sitemap-QA is designed to integrate seamlessly into your CI/CD pipeline for automated quality checks.

### Exit Codes

The tool uses standard exit codes to indicate the analysis result:

- **Exit Code 0**: No risks found — All URLs in the sitemap passed validation
- **Exit Code 1**: Risks detected — One or more URLs matched risk patterns, or an error occurred

This makes it easy to fail builds when quality issues are detected.

### Integration Examples

#### GitHub Actions

```yaml
name: Sitemap Quality Check

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  sitemap-qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Sitemap-QA
        run: npm install -g @akotliar/sitemap-qa@alpha
      
      - name: Run Sitemap Analysis
        run: sitemap-qa analyze https://example.com --output json --out-dir ./reports
      
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: sitemap-qa-report
          path: ./reports/
```

#### GitLab CI

```yaml
sitemap-qa:
  stage: test
  image: node:20-alpine
  before_script:
    - npm install -g @akotliar/sitemap-qa@alpha
  script:
    - sitemap-qa analyze https://example.com --output all --out-dir ./reports
  artifacts:
    when: always
    paths:
      - ./reports/
    expire_in: 30 days
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'
    - if: '$CI_COMMIT_BRANCH == "main"'
```

#### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('Sitemap QA') {
            steps {
                nodejs(nodeJSInstallationName: 'Node 20') {
                    sh 'npm install -g @akotliar/sitemap-qa@alpha'
                    sh 'sitemap-qa analyze https://example.com --output all --out-dir ./reports'
                }
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'reports/*', fingerprint: true
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'reports',
                reportFiles: 'sitemap-qa-report.html',
                reportName: 'Sitemap QA Report'
            ])
        }
    }
}
```

#### CircleCI

```yaml
version: 2.1

jobs:
  sitemap-qa:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install Sitemap-QA
          command: npm install -g @akotliar/sitemap-qa@alpha
      - run:
          name: Run Analysis
          command: sitemap-qa analyze https://example.com --output all --out-dir ./reports
      - store_artifacts:
          path: ./reports
          destination: sitemap-qa-reports

workflows:
  nightly:
    triggers:
      - schedule:
          cron: "0 2 * * *"
          filters:
            branches:
              only: main
    jobs:
      - sitemap-qa
```

#### Pre-deployment Script

```bash
#!/bin/bash
# pre-deploy-check.sh

set -e

echo "Running Sitemap QA check..."

# Install if not already installed
if ! command -v sitemap-qa &> /dev/null; then
    npm install -g @akotliar/sitemap-qa@alpha
fi

# Run analysis (will exit with code 1 if risks found)
sitemap-qa analyze https://staging.example.com --output all --out-dir ./qa-reports

echo "✅ Sitemap QA check passed!"
```

---

## 💻 Development

Want to contribute or run Sitemap-QA locally? Here's how to get started.

### Prerequisites

- **Node.js**: >= 20.0.0
- **npm**: >= 9.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/Akotliar/sitemap-qa.git
cd sitemap-qa

# Install dependencies
npm install

# Build the project
npm run build
```

### Running Tests

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck
```

### Building

```bash
# Build for production
npm run build

# Development mode with auto-rebuild
npm run dev
```

### Project Structure

```
sitemap-qa/
├── src/
│   ├── commands/      # CLI commands (analyze, init)
│   ├── config/        # Configuration loading and validation
│   ├── core/          # Core analysis logic (extractor, matcher)
│   ├── reporters/     # Output reporters (console, JSON, HTML)
│   └── types/         # TypeScript type definitions
├── tests/             # Test files
├── dist/              # Compiled output
└── package.json
```

---

## 🤝 Contributing

Contributions are welcome! Whether it's bug reports, feature requests, or code contributions, we appreciate your help.

### How to Contribute

1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** and ensure tests pass: `npm test`
4. **Commit your changes**: `git commit -m "Add your feature description"`
5. **Push to your fork**: `git push origin feature/your-feature-name`
6. **Open a Pull Request** on the main repository

### Guidelines

- Follow the existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting
- Keep commits focused and write clear commit messages

### Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/akotliar/sitemap-qa/issues) with:

- A clear description of the problem or suggestion
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Your environment (Node version, OS, etc.)

---

## ❓ FAQ & Troubleshooting

### General Questions

**Q: What's the difference between Sitemap-QA and traditional SEO sitemap validators?**

A: Sitemap-QA is focused on **security and quality assurance**, not SEO. It detects exposed admin panels, environment leakage (staging/dev URLs), sensitive files, and domain inconsistencies that could indicate security issues or misconfiguration.

**Q: Can I use this with sitemap indexes (multiple sitemaps)?**

A: Yes! Sitemap-QA automatically follows sitemap indexes recursively and analyzes all referenced sitemaps.

**Q: Does it work with compressed sitemaps (.xml.gz)?**

A: Yes, the tool automatically handles compressed sitemaps and dynamically generated sitemaps (including PHP-based sitemaps).

**Q: How do I customize the risk patterns?**

A: Run `sitemap-qa init` to create a `sitemap-qa.yaml` file, then modify the `policies` section to add your own patterns. Patterns support literal, glob, and regex matching.

**Q: Will the tool modify my website or sitemap?**

A: No, Sitemap-QA is read-only. It only fetches and analyzes sitemaps without making any modifications.

### Common Issues

**Issue: "Error: sitemap-qa.yaml already exists"**

**Solution:** The `init` command won't overwrite existing configuration files. If you want to regenerate it, either delete the existing file or rename it first.

```bash
# Rename existing config
mv sitemap-qa.yaml sitemap-qa.yaml.backup

# Create new config
sitemap-qa init
```

**Issue: "No sitemap found at URL"**

**Solution:** Ensure the website has a valid sitemap. Sitemap-QA checks:
- `robots.txt` for sitemap declarations
- Standard paths: `/sitemap.xml`, `/sitemap_index.xml`

If the sitemap is at a non-standard location, you can provide the direct sitemap URL:

```bash
sitemap-qa analyze https://example.com/custom-sitemap.xml
```

**Issue: "Command not found: sitemap-qa"**

**Solution:** Ensure the package is installed globally:

```bash
npm install -g @akotliar/sitemap-qa@alpha

# Verify installation
sitemap-qa --version
```

**Issue: Analysis is slow or times out**

**Solution:** For very large sitemaps (10,000+ URLs), the analysis may take a few minutes. The tool displays progress every 100 URLs. If it consistently times out, check your network connection or try analyzing a smaller subset.

**Issue: False positives in risk detection**

**Solution:** Use the `acceptable_patterns` section in your `sitemap-qa.yaml` to exclude known safe URLs:

```yaml
acceptable_patterns:
  - type: "glob"
    value: "**/admin/public/**"
    reason: "Public admin documentation is safe to index"
```

**Issue: Want to ignore domain consistency checks**

**Solution:** Set `enforceDomainConsistency: false` in your `sitemap-qa.yaml`:

```yaml
enforceDomainConsistency: false
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Undici](https://github.com/nodejs/undici) - High-performance HTTP client
- [Fast-XML-Parser](https://github.com/NaturalIntelligence/fast-xml-parser) - Fast XML parsing
- [Zod](https://zod.dev/) - Schema validation
- [Micromatch](https://github.com/micromatch/micromatch) - Glob pattern matching
- [Vitest](https://vitest.dev/) - Testing framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/akotliar/sitemap-qa/issues)

---

**Made with ❤️ for QA teams everywhere**
