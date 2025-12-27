import fs from 'node:fs/promises';
import { Reporter, ReportData } from './base';

export class HtmlReporter implements Reporter {
  private readonly outputPath: string;

  constructor(outputPath: string = 'sitemap-qa-report.html') {
    this.outputPath = outputPath;
  }

  async generate(data: ReportData): Promise<void> {
    const categories = this.groupRisks(data);
    const html = this.generateHtml(data, categories);

    await fs.writeFile(this.outputPath, html, 'utf8');
    console.log(`HTML report generated at ${this.outputPath}`);
  }

  private groupRisks(data: ReportData) {
    const categories: Record<string, Record<string, { reason: string, urls: string[] }>> = {};

    for (const urlObj of data.urlsWithRisks) {
      for (const risk of urlObj.risks) {
        if (!categories[risk.category]) {
          categories[risk.category] = {};
        }
        if (!categories[risk.category][risk.pattern]) {
          categories[risk.category][risk.pattern] = {
            reason: risk.reason,
            urls: []
          };
        }
        categories[risk.category][risk.pattern].urls.push(urlObj.loc);
      }
    }

    return categories;
  }

  private generateHtml(data: ReportData, categories: any): string {
    const duration = ((data.endTime.getTime() - data.startTime.getTime()) / 1000).toFixed(1);
    const timestamp = data.endTime.toLocaleString();
    const esc = this.escapeHtml.bind(this);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sitemap Analysis - ${esc(data.rootUrl)}</title>
    <style>
        :root {
            --bg-dark: #0f172a;
            --bg-light: #f8fafc;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --primary: #3b82f6;
            --danger: #ef4444;
            --warning: #f59e0b;
            --border: #e2e8f0;
        }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: var(--text-main);
            background-color: #fff;
            margin: 0;
            padding: 0;
        }
        header {
            background-color: var(--bg-dark);
            color: white;
            padding: 40px 20px;
            text-align: left;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        header h1 { margin: 0; font-size: 24px; }
        header .meta { margin-top: 10px; color: #94a3b8; font-size: 14px; }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            border-bottom: 1px solid var(--border);
            margin-bottom: 40px;
        }
        .summary-card {
            padding: 30px 20px;
            text-align: center;
            border-right: 1px solid var(--border);
        }
        .summary-card:last-child { border-right: none; }
        .summary-card h3 { 
            margin: 0; 
            font-size: 12px; 
            text-transform: uppercase; 
            color: var(--text-muted);
            letter-spacing: 0.05em;
        }
        .summary-card p { 
            margin: 10px 0 0; 
            font-size: 32px; 
            font-weight: 700; 
            color: var(--text-main);
        }
        .summary-card.highlight p { color: var(--danger); }

        details {
            margin-bottom: 20px;
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
        }
        summary {
            padding: 15px 20px;
            background-color: #fff;
            cursor: pointer;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            list-style: none;
        }
        summary::-webkit-details-marker { display: none; }
        summary::after {
            content: '▶';
            font-size: 12px;
            color: var(--text-muted);
            transition: transform 0.2s;
        }
        details[open] summary::after { transform: rotate(90deg); }
        
        .category-section {
            border: 1px solid var(--warning);
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .category-header {
            padding: 15px 20px;
            background-color: #fffbeb;
            color: var(--warning);
            font-weight: 600;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .category-content {
            padding: 20px;
            background-color: #fff;
        }

        .finding-group {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .finding-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .finding-header h4 { margin: 0; font-size: 16px; }
        .badge {
            background-color: var(--primary);
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
        }
        .finding-description {
            color: var(--text-muted);
            font-size: 14px;
            margin-bottom: 20px;
        }
        
        .url-list {
            background-color: var(--bg-light);
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .url-item {
            font-family: monospace;
            font-size: 13px;
            padding: 8px 12px;
            background: white;
            border: 1px solid var(--border);
            border-radius: 4px;
            margin-bottom: 8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .url-item:last-child { margin-bottom: 0; }
        
        .more-count {
            font-size: 12px;
            color: var(--text-muted);
            font-style: italic;
            margin-bottom: 15px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background-color: var(--primary);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
        }
        .btn:hover { opacity: 0.9; }

        footer {
            text-align: center;
            padding: 40px;
            color: var(--text-muted);
            font-size: 12px;
            border-top: 1px solid var(--border);
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>Sitemap Analysis</h1>
            <div class="meta">
                <div>${esc(data.rootUrl)}</div>
                <div>${esc(timestamp)}</div>
            </div>
        </div>
    </header>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>Sitemaps</h3>
            <p>${data.discoveredSitemaps.length}</p>
        </div>
        <div class="summary-card">
            <h3>URLs Analyzed</h3>
            <p>${data.totalUrls.toLocaleString()}</p>
        </div>
        <div class="summary-card highlight">
            <h3>Issues Found</h3>
            <p>${data.totalRisks}</p>
        </div>
        <div class="summary-card">
            <h3>URLs Ignored</h3>
            <p>${data.ignoredUrls.length}</p>
        </div>
        <div class="summary-card">
            <h3>Scan Time</h3>
            <p>${duration}s</p>
        </div>
    </div>

    <div class="container">
        <details>
            <summary>Sitemaps Discovered (${data.discoveredSitemaps.length})</summary>
            <div style="padding: 20px; background: var(--bg-light);">
                ${data.discoveredSitemaps.map(s => `<div class="url-item">${esc(s)}</div>`).join('')}
            </div>
        </details>

        ${data.ignoredUrls.length > 0 ? `
        <details>
            <summary>Ignored URLs (${data.ignoredUrls.length})</summary>
            <div style="padding: 20px; background: var(--bg-light);">
                ${data.ignoredUrls.map(u => {
                    const suppressedRisks = u.risks.length > 0 
                        ? ` <span style="color: var(--danger); font-size: 11px; font-weight: bold;">[Suppressed Risks: ${[...new Set(u.risks.map(r => r.category))].map(esc).join(', ')}]</span>`
                        : '';

                    const ignoredBy = u.ignoredBy ?? 'Unknown';
                    return `<div class="url-item" title="Ignored by: ${esc(ignoredBy)}">${esc(u.loc)} <span style="color: var(--text-muted); font-size: 11px;">(by ${esc(ignoredBy)})</span>${suppressedRisks}</div>`;
                }).join('')}
            </div>
        </details>
        ` : ''}

        ${Object.entries(categories).map(([category, findings]: [string, any]) => {
            const totalCategoryUrls = Object.values(findings).reduce((acc: number, f: any) => acc + f.urls.length, 0);
            return `
            <div class="category-section">
                <div class="category-header">
                    <span>${esc(category)} (${totalCategoryUrls} URLs)</span>
                    <span>▼</span>
                </div>
                <div class="category-content">
                    ${Object.entries(findings).map(([pattern, finding]: [string, any]) => `
                        <div class="finding-group">
                            <div class="finding-header">
                                <h4>${esc(pattern)}</h4>
                                <span class="badge">${finding.urls.length} URLs</span>
                            </div>
                            <div class="finding-description">
                                ${esc(finding.reason)}
                            </div>
                            <div class="url-list">
                                ${finding.urls.slice(0, 3).map((url: string) => `
                                    <div class="url-item">${esc(url)}</div>
                                `).join('')}
                            </div>
                            ${finding.urls.length > 3 ? `
                                <div class="more-count">... and ${finding.urls.length - 3} more</div>
                            ` : ''}
                            <a href="#" class="btn" onclick="downloadUrls(${JSON.stringify(pattern).replace(/"/g, '&quot;')}, ${JSON.stringify(finding.urls).replace(/"/g, '&quot;')})">
                                📥 Download All ${finding.urls.length} URLs
                            </a>
                        </div>
                    `).join('')}
                </div>
            </div>
            `;
        }).join('')}
    </div>

    <footer>
        Generated by sitemap-qa v1.0.0
    </footer>

    <script>
        function downloadUrls(name, urls) {
            const blob = new Blob([urls.join('\\n')], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`\${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_urls.txt\`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    </script>
</body>
</html>
`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
