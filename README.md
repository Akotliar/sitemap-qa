# Sitemap-QA

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![npm version](https://img.shields.io/npm/v/@akotliar/sitemap-qa/alpha.svg)](https://www.npmjs.com/package/@akotliar/sitemap-qa)

> ⚠️ **Alpha Release** — This tool is currently in active development. Features and APIs may change. Feedback and contributions are welcome!

Sitemap-QA is a command-line tool that automatically discovers, parses, and analyzes website sitemaps to identify potential quality issues, security risks, and configuration problems. Built for QA teams to validate deployments, catch environment leakage, and identify URLs that shouldn't be publicly indexed.

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
# Analyze a website's sitemap
sitemap-qa analyze https://example.com

# Generate JSON output for CI/CD
sitemap-qa analyze https://example.com --output json > report.json
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

## 🛠️ CLI Options

```
Usage: sitemap-qa analyze <url> [options]

Analyze a website's sitemap for quality issues

Arguments:
  url                          Base URL of the website to analyze

Options:
  -c, --config <path>          Path to sitemap-qa.yaml
  -o, --output <format>        Output format: json, html, or all (default: "all")
  -d, --out-dir <path>         Output directory for reports (default: ".")
  -h, --help                   Display help for command
```

### Examples

```bash
# Basic analysis with both HTML and JSON reports (default)
sitemap-qa analyze https://example.com

# JSON output only
sitemap-qa analyze https://example.com --output json

# Custom output directory
sitemap-qa analyze https://example.com --out-dir ./reports

# Use a specific configuration file
sitemap-qa analyze https://example.com --config ./custom-config.yaml
```

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
| `enforceDomainConsistency` | boolean | `false` | If true, flags URLs that don't match the root sitemap domain (ignoring `www.`) |
| `acceptable_patterns` | array | `[]` | List of patterns to exclude from risk analysis |
| `policies` | array | `[]` | List of monitoring policies with patterns |


**Priority:** CLI options > Project config (`sitemap-qa.yaml`) > Defaults

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
