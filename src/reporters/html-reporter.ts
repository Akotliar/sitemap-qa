import { promises as fs } from 'fs';
import type { RiskSummary, CategoryInsight } from '@/summarizer';
import type { DiscoveryResult } from '@/core/discovery';
import type { Config } from '@/types/config';

// Version is injected at build time by tsup
declare const __PACKAGE_VERSION__: string;
const TOOL_VERSION = typeof __PACKAGE_VERSION__ !== 'undefined' ? __PACKAGE_VERSION__ : '1.0.0';

export interface HtmlReporterOptions {
  maxUrlsPerGroup?: number; // Max sample URLs to display (default: 10)
}

/**
 * Generate HTML report from analysis results
 */
export function generateHtmlReport(
  summary: RiskSummary,
  discoveryResult: DiscoveryResult,
  totalUrls: number,
  config: Config,
  errors: Error[],
  options: HtmlReporterOptions = {}
): string {
  const maxUrls = options.maxUrlsPerGroup ?? 10;
  const timestamp = new Date().toISOString();
  const riskyUrlCount = summary.categoryInsights.reduce((sum, g) => sum + g.count, 0);

  // Group by severity
  const highSeverity = summary.categoryInsights.filter((g) => g.severity === 'high');
  const mediumSeverity = summary.categoryInsights.filter((g) => g.severity === 'medium');
  const lowSeverity = summary.categoryInsights.filter((g) => g.severity === 'low');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitemap QA Report - ${config.baseUrl}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
      padding: 24px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .header {
      background: #0f172a;
      color: white;
      padding: 48px 40px;
      border-bottom: 3px solid #3b82f6;
    }
    .header h1 { 
      font-size: 1.875rem; 
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.025em;
    }
    .header .meta { 
      opacity: 0.75; 
      font-size: 0.875rem;
      font-weight: 400;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1px;
      background: #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
    }
    .summary-card {
      background: white;
      padding: 28px 32px;
      text-align: center;
    }
    .summary-card .label { 
      font-size: 0.75rem; 
      color: #6b7280;
      text-transform: uppercase; 
      letter-spacing: 0.05em;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .summary-card .value { 
      font-size: 2.25rem; 
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .content { padding: 40px; }
    .status-clean {
      text-align: center;
      padding: 80px 32px;
      background: #f0fdf4;
      border-radius: 8px;
      border: 1px solid #86efac;
    }
    .status-clean h2 { 
      font-size: 1.875rem;
      margin-bottom: 12px;
      color: #166534;
      font-weight: 700;
    }
    .status-clean p { 
      font-size: 1rem;
      color: #65a30d;
    }
    .severity-section { margin-bottom: 32px; }
    .severity-section h2 {
      font-size: 1.125rem;
      font-weight: 600;
      padding: 16px 20px;
      margin-bottom: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
    }
    .severity-section h2:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }
    .severity-section h2::after {
      content: '▼';
      margin-left: auto;
      font-size: 0.8em;
      transition: transform 0.3s ease;
      opacity: 0.7;
    }
    .severity-section h2.collapsed::after {
      transform: rotate(-90deg);
    }
    .severity-section h2.collapsed {
      margin-bottom: 0;
    }
    .severity-content {
      max-height: none;
      overflow: visible;
      transition: max-height 0.4s ease-out, opacity 0.3s ease-out;
      opacity: 1;
    }
    .severity-content.collapsed {
      max-height: 0;
      overflow: hidden;
      opacity: 0;
    }
    .severity-high { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .severity-medium { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .severity-low { background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; }
    .risk-group {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .risk-group h3 {
      font-size: 1rem;
      margin-bottom: 12px;
      color: #0f172a;
      font-weight: 600;
    }
    .risk-group .count {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-left: 8px;
    }
    .risk-group .impact {
      color: #64748b;
      margin-bottom: 16px;
      font-size: 0.875rem;
      line-height: 1.6;
    }
    .risk-group .urls {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
    }
    .risk-group .urls h4 {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    .risk-group .urls ul { list-style: none; }
    .risk-group .urls li {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.8125rem;
      color: #334155;
      background: white;
      margin-bottom: 4px;
      border-radius: 4px;
      word-break: break-all;
      line-height: 1.6;
    }
    .risk-group .urls li:last-child { border-bottom: none; margin-bottom: 0; }
    .risk-group .more {
      color: #3b82f6;
      font-style: italic;
      margin-top: 8px;
      font-size: 0.8125rem;
    }
    .download-btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 500;
      margin-top: 12px;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }
    .download-btn:hover {
      background: #2563eb;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .footer {
      background: #f8fafc;
      padding: 24px 40px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #64748b;
      font-size: 0.8125rem;
    }
    .sitemaps {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .sitemaps h3 {
      font-size: 1.125rem;
      font-weight: 600;
      padding: 16px 20px;
      margin: 0;
      color: #0f172a;
      background: #f8fafc;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sitemaps h3:hover {
      background: #f1f5f9;
    }
    .sitemaps h3::after {
      content: '▼';
      margin-left: auto;
      font-size: 0.8em;
      transition: transform 0.3s ease;
      opacity: 0.7;
    }
    .sitemaps h3.collapsed::after {
      transform: rotate(-90deg);
    }
    .sitemaps-content {
      max-height: none;
      overflow: visible;
      transition: max-height 0.4s ease-out, opacity 0.3s ease-out;
      opacity: 1;
      padding: 20px;
    }
    .sitemaps-content.collapsed {
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      padding: 0 20px;
    }
    .sitemaps ul { list-style: none; }
    .sitemaps li {
      padding: 10px 12px;
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.8125rem;
      color: #475569;
      word-break: break-all;
      line-height: 1.6;
      background: #f8fafc;
      margin-bottom: 4px;
      border-radius: 4px;
    }
    .sitemaps li:last-child { margin-bottom: 0; }
    .errors-section {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin-bottom: 24px;
      border-radius: 8px;
      border: 1px solid #fde68a;
    }
    .errors-section h3 {
      color: #92400e;
      margin-bottom: 16px;
      font-size: 1.125rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .errors-section ul {
      list-style: none;
      padding: 0;
    }
    .errors-section li {
      padding: 12px;
      background: white;
      margin-bottom: 8px;
      border-radius: 6px;
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.8125rem;
      color: #78350f;
      word-break: break-all;
      line-height: 1.6;
      border: 1px solid #fde68a;
    }
    .errors-section li:last-child {
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sitemap Analysis</h1>
      <div class="meta">
        <div>${config.baseUrl}</div>
        <div>${new Date(timestamp).toLocaleString()}</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="label">Sitemaps</div>
        <div class="value">${discoveryResult.sitemaps.length}</div>
      </div>
      <div class="summary-card">
        <div class="label">URLs Analyzed</div>
        <div class="value">${totalUrls.toLocaleString()}</div>
      </div>
      <div class="summary-card">
        <div class="label">Issues Found</div>
        <div class="value" style="color: ${riskyUrlCount > 0 ? '#dc2626' : '#059669'}">${riskyUrlCount}</div>
      </div>
      <div class="summary-card">
        <div class="label">Scan Time</div>
        <div class="value">${(summary.metadata.processingTime / 1000).toFixed(1)}s</div>
      </div>
    </div>

    <div class="content">
      ${errors.length > 0 ? `
      <div class="errors-section">
        <h3>Parsing Errors & Warnings (${errors.length})</h3>
        <ul>
          ${errors.map(err => `<li>${err.message}</li>`).join('\n          ')}
        </ul>
      </div>
      ` : ''}

      ${discoveryResult.sitemaps.length > 0 ? `
      <div class="sitemaps">
        <h3 class="collapsed" onclick="toggleSection(this)">Sitemaps Discovered (${discoveryResult.sitemaps.length})</h3>
        <div class="sitemaps-content collapsed">
          <ul>
            ${discoveryResult.sitemaps.map(s => `<li>• ${s}</li>`).join('\n            ')}
          </ul>
        </div>
      </div>
      ` : ''}

      ${riskyUrlCount === 0 ? `
      <div class="status-clean">
        <h2>No Issues Found</h2>
        <p>All URLs in the sitemap passed validation checks.</p>
      </div>
      ` : ''}

      ${highSeverity.length > 0 ? `
      <div class="severity-section">
        <h2 class="severity-high" onclick="toggleSection(this)">High Severity (${highSeverity.reduce((sum, g) => sum + g.count, 0)} URLs)</h2>
        <div class="severity-content">
          ${highSeverity.map(group => renderRiskGroup(group, maxUrls)).join('\n          ')}
        </div>
      </div>
      ` : ''}

      ${mediumSeverity.length > 0 ? `
      <div class="severity-section">
        <h2 class="severity-medium" onclick="toggleSection(this)">Medium Severity (${mediumSeverity.reduce((sum, g) => sum + g.count, 0)} URLs)</h2>
        <div class="severity-content">
          ${mediumSeverity.map(group => renderRiskGroup(group, maxUrls)).join('\n          ')}
        </div>
      </div>
      ` : ''}

      ${lowSeverity.length > 0 ? `
      <div class="severity-section">
        <h2 class="severity-low" onclick="toggleSection(this)">Low Severity (${lowSeverity.reduce((sum, g) => sum + g.count, 0)} URLs)</h2>
        <div class="severity-content">
          ${lowSeverity.map(group => renderRiskGroup(group, maxUrls)).join('\n          ')}
        </div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      Generated by <strong>sitemap-qa</strong> v${TOOL_VERSION}
    </div>
  </div>
  
  <script>
    function toggleSection(header) {
      header.classList.toggle('collapsed');
      const content = header.nextElementSibling;
      content.classList.toggle('collapsed');
    }
    
    function downloadUrls(categorySlug, encodedUrls) {
      // Decode HTML entities and parse JSON
      const textarea = document.createElement('textarea');
      textarea.innerHTML = encodedUrls;
      const urls = JSON.parse(textarea.value);
      
      // Create text content (one URL per line)
      const textContent = urls.join('\\n');
      
      // Create blob and download
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = categorySlug + '_urls.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;

  return html;
}

function renderRiskGroup(group: CategoryInsight, maxUrls: number): string {
  const categoryTitle = group.category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const urlsToShow = group.examples.slice(0, maxUrls);
  const remaining = group.count - urlsToShow.length;
  
  // Create sanitized filename for download
  const categorySlug = group.category.toLowerCase();
  
  // Encode all URLs as data for download functionality
  const allUrlsJson = JSON.stringify(group.allUrls);
  const encodedUrls = escapeHtml(allUrlsJson);

  return `<div class="risk-group">
        <h3>${categoryTitle} <span class="count">${group.count} URLs</span></h3>
        <div class="impact">${group.summary}</div>
        <div class="urls">
          <h4>Sample URLs</h4>
          <ul>
            ${urlsToShow.map(url => `<li>${escapeHtml(url)}</li>`).join('\n            ')}
          </ul>
          ${remaining > 0 ? `<div class="more">... and ${remaining} more</div>` : ''}
          <button class="download-btn" onclick="downloadUrls('${categorySlug}', '${encodedUrls}')">📥 Download All ${group.count} URLs</button>
        </div>
      </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Write HTML report to file
 */
export async function writeHtmlReport(
  summary: RiskSummary,
  discoveryResult: DiscoveryResult,
  totalUrls: number,
  config: Config,
  outputPath: string,
  errors: Error[],
  options: HtmlReporterOptions = {}
): Promise<void> {
  const htmlContent = generateHtmlReport(summary, discoveryResult, totalUrls, config, errors, options);
  await fs.writeFile(outputPath, htmlContent, 'utf-8');
}
