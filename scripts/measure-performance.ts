import http from 'http';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { discoverSitemaps } from '../src/core/discovery';
import { extractAllUrls } from '../src/core/extractor';
import { consolidateUrls } from '../src/core/consolidator';
import { detectRisks } from '../src/core/risk-detector';
import { DEFAULT_CONFIG } from '../src/types/config';

const PORT = 8080;
const SITEMAP_URL_COUNT = 100000;
const TEMP_DIR = join(process.cwd(), 'temp-perf-test');

// 1. Setup Mock Server
function startMockServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
      for (let i = 0; i < SITEMAP_URL_COUNT; i++) {
        res.write(`  <url><loc>https://example.com/page-${i}</loc></url>\n`);
        if (i % 1000 === 0) {
            res.write(`  <url><loc>https://example.com/admin/dashboard-${i}</loc></url>\n`);
        }
      }
      res.write('</urlset>');
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  return new Promise<http.Server>((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

// 2. Performance Measurement Helper
function getMetrics() {
  const mem = process.memoryUsage();
  return {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
  };
}

async function runBenchmark() {
  console.log(`\n🚀 Starting Performance Analysis (${SITEMAP_URL_COUNT.toLocaleString()} URLs)`);
  console.log(`--------------------------------------------------`);

  const server = await startMockServer();
  const baseUrl = `http://localhost:${PORT}/sitemap.xml`;
  const config = { ...DEFAULT_CONFIG, silent: true, verbose: false };

  const results: any[] = [];
  const startTime = Date.now();

  try {
    // Phase 1: Discovery (Bypassed for benchmark stability)
    const sitemaps = [baseUrl];
    results.push({ phase: 'Discovery (Bypassed)', duration: 0, ...getMetrics() });

    // Phase 2: Extraction
    let phaseStart = Date.now();
    const extractionResult = await extractAllUrls(sitemaps, config);
    results.push({ phase: 'Extraction', duration: Date.now() - phaseStart, ...getMetrics() });

    if (extractionResult.allUrls.length === 0) {
        throw new Error('No URLs extracted. Check mock server.');
    }

    // Phase 3: Consolidation
    phaseStart = Date.now();
    const consolidatedResult = consolidateUrls(extractionResult.allUrls);
    results.push({ phase: 'Consolidation', duration: Date.now() - phaseStart, ...getMetrics() });

    // Phase 4: Risk Detection
    phaseStart = Date.now();
    const riskResult = await detectRisks(consolidatedResult.uniqueUrls, baseUrl, config);
    results.push({ phase: 'Risk Detection', duration: Date.now() - phaseStart, ...getMetrics() });

    const totalTime = Date.now() - startTime;

    // 3. Analysis & Reporting
    console.log('\n📊 Performance Results:');
    console.table(results.map(r => ({
      'Phase': r.phase,
      'Duration (ms)': r.duration,
      'Memory RSS (MB)': r.rss,
      'Heap Used (MB)': r.heapUsed
    })));

    console.log(`\n📈 Summary:`);
    console.log(`  - Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  - Peak RSS: ${Math.max(...results.map(r => r.rss))} MB`);
    console.log(`  - Throughput: ${Math.round(SITEMAP_URL_COUNT / (totalTime / 1000)).toLocaleString()} URLs/sec`);

    if (totalTime > 5000) {
      console.log(`\n⚠️  Analysis: Execution time is above 5s. Consider optimizing the slowest phase.`);
    } else {
      console.log(`\n✅ Analysis: Performance is within acceptable limits for this scale.`);
    }

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
  } finally {
    server.close();
  }
}

runBenchmark();
