# Sitemap-QA

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![npm version](https://img.shields.io/npm/v/@akotliar/sitemap-qa/alpha.svg)](https://www.npmjs.com/package/@akotliar/sitemap-qa)

> ⚠️ **Alpha Release** — This tool is currently in active development. Features and APIs may change. Feedback and contributions are welcome!

Sitemap-QA is a command-line tool that automatically discovers, parses, and analyzes website sitemaps to identify potential quality issues, security risks, and configuration problems. Built for QA teams to validate deployments, catch environment leakage, and identify URLs that shouldn't be publicly indexed.

---

## 🎯 Why Sitemap-QA?

Unlike SEO-focused sitemap validators, Sitemap-QA is designed specifically for **QA validation and risk detection**:

- ✅ **Detect environment leakage** — Find staging, dev, or test URLs that shouldn't be in production sitemaps
- ✅ **Identify exposed admin paths** — Catch `/admin`, `/dashboard`, and internal routes in public indexes
- ✅ **Flag sensitive parameters** — Detect API keys, tokens, or passwords in sitemap URLs
- ✅ **Validate domain consistency** — Find protocol mismatches and subdomain issues
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

# Increase verbosity for debugging
sitemap-qa analyze https://example.com --verbose
```

---

## 📋 Features

### Automatic Sitemap Discovery
- Checks `robots.txt` for sitemap declarations
- Tests standard paths (`/sitemap.xml`, `/sitemap_index.xml`, etc.)
- Recursively follows sitemap indexes
- Handles multiple sitemaps and formats
- Detects and processes malformed sitemap indexes (sitemaps listed in `<url>` blocks instead of `<sitemap>` blocks)

### Risk Detection Patterns

| Risk Category | Severity | Examples | Can Be Excluded |
|--------------|----------|----------|-----------------|
| **Environment Leakage** | High | `staging.example.com`, `/dev/`, `/test/` | ✅ Via patterns |
| **Admin Paths** | High | `/admin`, `/dashboard`, `/config`, `/console` | ✅ Via patterns |
| **Internal Content** | Medium | `/internal` paths | ✅ Via patterns |
| **Sensitive Parameters** | High | `?token=`, `?apikey=`, `?password=` | ✅ Via patterns |
| **Test Content** | Medium | `/test-`, `sample-`, `demo-` | ✅ Via patterns |
| **Protocol Inconsistency** | Medium | HTTP URLs in HTTPS sitemaps | ❌ Always detected |
| **Domain Mismatch** | Medium | Different domains in sitemap | ❌ Always detected |


### Output Formats

#### HTML Report (Interactive)
The HTML report provides an interactive, visually appealing view with:
- Expandable/collapsible sections by severity
- Download buttons to export all URLs per category
- Clean, modern design with hover effects
- Portable single-file format

#### JSON Report (Machine-Readable)
```json
{
  "analysis_metadata": {
    "base_url": "https://example.com",
    "tool_version": "1.0.0",
    "analysis_type": "rule-based analysis",
    "analysis_timestamp": "2025-12-11T00:00:00.000Z",
    "execution_time_ms": 4523
  },
  "sitemaps_discovered": [
    "https://example.com/sitemap.xml"
  ],
  "suspicious_groups": [
    {
      "category": "environment_leakage",
      "severity": "high",
      "count": 3,
      "rationale": "Production sitemap contains staging URLs",
      "sample_urls": ["..."],
      "recommended_action": "Verify sitemap generation excludes non-production environments"
    }
  ],
  "summary": {
    "high_severity_count": 2,
    "medium_severity_count": 1,
    "low_severity_count": 0,
    "total_risky_urls": 8,
    "overall_status": "issues_found"
  }
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
  --timeout <seconds>          HTTP request timeout in seconds (default: 30)
  --output <format>            Output format: html or json (default: "html")
  --output-dir <path>          Output directory for reports (default: "./sitemap-qa/report")
  --output-file <path>         Custom output filename
  --accepted-patterns <list>   Comma-separated patterns to exclude from risk detection
  --verbose                    Enable verbose logging
  -h, --help                   Display help for command
```

### Examples

```bash
# Basic analysis with HTML report (default)
sitemap-qa analyze https://example.com

# JSON output for CI/CD integration
sitemap-qa analyze https://example.com --output json

# Custom output directory
sitemap-qa analyze https://example.com --output-dir ./reports

# Exclude specific URL patterns from detection
sitemap-qa analyze https://example.com --accepted-patterns "internal-*,test-*"

# Increase timeout for slow servers
sitemap-qa analyze https://example.com --timeout 60

# Verbose mode for debugging
sitemap-qa analyze https://example.com --verbose
```

---

## 🔧 Configuration

Create a `sitemap-qa.yaml` file in your project root to define your monitoring policies and tool settings:

```yaml
# Tool Settings
outDir: "./sitemap-qa/report"

# Monitoring Policies
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
| `outDir` | string | `"./sitemap-qa/report"` | Directory for generated reports |
| `policies` | array | `[]` | List of monitoring policies with patterns |

### Policy Patterns

Define patterns to detect risks in your sitemaps:

```yaml
policies:
  - category: "Custom Rules"
    patterns:
      - type: "literal"
        value: "test"
        reason: "Test URL found"
      - type: "glob"
        value: "**/internal/*"
        reason: "Internal path exposed"
      - type: "regex"
        value: "api/v[0-9]/"
        reason: "API versioning detected"
```

**Rule Types:**
- `literal`: Exact string match
- `glob`: Wildcard patterns (e.g., `**/admin/**`)
- `regex`: Regular expression matching

**Priority:** CLI options > Project config (`sitemap-qa.yaml`) > Defaults

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Vitest](https://vitest.dev/) - Testing framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/akotliar/sitemap-qa/issues)-

---

**Made with ❤️ for QA teams everywhere**
