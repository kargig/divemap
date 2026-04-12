/**
 * Backend API Performance Testing Tool
 *
 * This script isolates and benchmarks pure backend API performance by eliminating
 * frontend rendering, Puppeteer, DOM parsing, and CSS overhead. It groups related
 * API calls into realistic "Scenarios" as they would be requested by frontend pages.
 *
 * Modes of Execution:
 * 1. Single (Sequential): Fires API calls one by one. Measures absolute baseline database speed.
 * 2. Browser (Parallel Calls): Fires all API calls for a scenario at the exact same time,
 *    simulating a single user loading a page.
 * 3. Concurrent (Load Test): Simulates Z users (default: 10) visiting the page simultaneously.
 *    Each user fires all scenario API calls in parallel. Exposes connection pool limits and race conditions.
 *
 * Usage Instructions:
 *
 * 1. Fully Authenticated Benchmark (Recommended):
 *    Retrieve a valid `access_token` from your browser's localStorage or the API.
 *    export PERF_TEST_API_TOKEN="eyJh..."
 *    node backend/scripts/measure_api_performance.js record backend_auth_baseline.json
 *
 * 2. Anonymous Benchmark (Public Endpoints Only):
 *    node backend/scripts/measure_api_performance.js record backend_anon_baseline.json
 *
 * 3. Compare Results:
 *    After applying code changes, record a target file and run the comparison:
 *    node backend/scripts/measure_api_performance.js record backend_target.json
 *    node backend/scripts/measure_api_performance.js compare backend_baseline.json backend_target.json
 */

const fs = require('fs');

const BASE_URL = process.env.PERF_TEST_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.PERF_TEST_API_TOKEN || '';
const ITERATIONS = parseInt(process.env.PERF_TEST_ITERATIONS || '20', 10);
const CONCURRENCY = parseInt(process.env.PERF_TEST_CONCURRENCY || '5', 10);

// Scenarios grouping API calls as they would be made by the frontend pages
const SCENARIOS = [
  {
    name: 'Home Page',
    requests: [
      '/api/v1/stats',
    ]
  },
  {
    name: 'Dive Sites List',
    requests: [
      '/api/v1/dive-sites/?page=1&page_size=25',
      '/api/v1/tags/'
    ]
  },
  {
    name: 'Dive Site Detail',
    requests: [
      '/api/v1/dive-sites/154',
      '/api/v1/dive-sites/154/media',
      '/api/v1/dive-sites/154/routes',
      '/api/v1/dive-sites/154/comments',
      '/api/v1/dive-sites/154/diving-centers',
      '/api/v1/dive-sites/154/dives?limit=10'
    ]
  },
  {
    name: 'Diving Centers List',
    requests: [
      '/api/v1/settings/disable_diving_center_reviews',
      '/api/v1/diving-centers/?page=1&page_size=25'
    ]
  },
  {
    name: 'Diving Center Detail',
    requests: [
      '/api/v1/diving-centers/56',
      '/api/v1/diving-centers/56/follow-status',
      '/api/v1/diving-centers/56/organizations',
      '/api/v1/diving-centers/56/comments',
      '/api/v1/newsletters/trips?diving_center_id=56&start_date=2026-04-11&end_date=2026-07-11&limit=100&sort_by=trip_date&sort_order=desc'
    ]
  },
  {
    name: 'Dives List',
    requests: [
      '/api/v1/dives/?page=1&page_size=25'
    ]
  },
  {
    name: 'Dive Detail',
    requests: [
      '/api/v1/dives/40',
      '/api/v1/dives/40/media',
      '/api/v1/dives/40/profile'
    ]
  },
  {
    name: 'Dive Trips List',
    requests: [
      '/api/v1/newsletters/trips?page=1&page_size=25'
    ]
  },
  {
    name: 'Dive Trip Detail',
    requests: [
      '/api/v1/newsletters/trips/332',
      '/api/v1/dive-sites/44',
      '/api/v1/dive-sites/27',
      '/api/v1/diving-centers/91'
    ]
  },
  {
    name: 'Dive Routes List',
    requests: [
      '/api/v1/dive-routes/?sort_by=name&sort_order=asc'
    ]
  },
  {
    name: 'Dive Route Detail',
    requests: [
      '/api/v1/dive-routes/13',
      '/api/v1/dive-sites/154',
      '/api/v1/dive-routes/13/community-stats',
      '/api/v1/dive-routes/export-formats',
      '/api/v1/dive-routes/export-formats'
    ]
  },
  {
    name: 'Map - Dive Sites (Bounds + Prefetch)',
    requests: [
      '/api/v1/dive-sites/?page_size=1000&page=1&north=38.0&south=37.9&east=23.8&west=23.6&detail_level=full',
      '/api/v1/dive-sites/?page_size=1000&page=1&north=38.1&south=38.0&east=23.8&west=23.6&detail_level=full',
      '/api/v1/dive-sites/?page_size=1000&page=1&north=37.9&south=37.8&east=23.8&west=23.6&detail_level=full',
      '/api/v1/dive-sites/?page_size=1000&page=1&north=38.0&south=37.9&east=24.0&west=23.8&detail_level=full',
      '/api/v1/dive-sites/?page_size=1000&page=1&north=38.0&south=37.9&east=23.6&west=23.4&detail_level=full',
    ]
  },
  {
    name: 'Map - Diving Centers (Bounds + Prefetch)',
    requests: [
      '/api/v1/diving-centers/?page_size=1000&page=1&north=38.0&south=37.9&east=23.8&west=23.6&detail_level=full',
      '/api/v1/diving-centers/?page_size=1000&page=1&north=38.1&south=38.0&east=23.8&west=23.6&detail_level=full',
      '/api/v1/diving-centers/?page_size=1000&page=1&north=37.9&south=37.8&east=23.8&west=23.6&detail_level=full',
      '/api/v1/diving-centers/?page_size=1000&page=1&north=38.0&south=37.9&east=24.0&west=23.8&detail_level=full',
      '/api/v1/diving-centers/?page_size=1000&page=1&north=38.0&south=37.9&east=23.6&west=23.4&detail_level=full',
    ]
  },
  {
    name: 'Map - Dives (Bounds + Prefetch)',
    requests: [
      '/api/v1/dives/?page_size=1000&page=1&north=38.0&south=37.9&east=23.8&west=23.6&detail_level=full',
      '/api/v1/dives/?page_size=1000&page=1&north=38.1&south=38.0&east=23.8&west=23.6&detail_level=full',
      '/api/v1/dives/?page_size=1000&page=1&north=37.9&south=37.8&east=23.8&west=23.6&detail_level=full',
      '/api/v1/dives/?page_size=1000&page=1&north=38.0&south=37.9&east=24.0&west=23.8&detail_level=full',
      '/api/v1/dives/?page_size=1000&page=1&north=38.0&south=37.9&east=23.6&west=23.4&detail_level=full',
    ]
  },
  {
    name: 'Map - Dive Trips (Global)',
    requests: [
      '/api/v1/newsletters/trips?page_size=1000&page=1&start_date=2026-04-03&end_date=2027-04-10'
    ]
  }
];

const headers = API_TOKEN ? { 'Authorization': `Bearer ${API_TOKEN}` } : {};

async function measureRequest(url) {
  const start = performance.now();
  let status = 0;
  let success = false;
  let size = 0;

  try {
    // Note: Node 18+ native fetch automatically uses connection pooling (keep-alive)
    const res = await fetch(`${BASE_URL}${url}`, { headers });
    status = res.status;
    const text = await res.text();
    size = Buffer.byteLength(text, 'utf8');

    if (!res.ok) {
      console.warn(`\x1b[33m[WARN] ${status} Error on ${url}: ${text.substring(0, 100)}\x1b[0m`);
    } else {
      success = true;
    }
  } catch (err) {
    console.error(`\x1b[31m[ERROR] Failed to fetch ${url}: ${err.message}\x1b[0m`);
  }

  return {
    duration: performance.now() - start,
    success,
    status,
    size
  };
}

async function recordScenario(scenario, iterations, concurrency) {
  const results = {
    single: { total_durations: [], requests: {} },
    browser: { total_durations: [], requests: {} },
    concurrent: { total_durations: [], requests: {} }
  };

  for (const req of scenario.requests) {
    results.single.requests[req] = [];
    results.browser.requests[req] = [];
    results.concurrent.requests[req] = [];
  }

  console.log(`  Warming up connections for ${scenario.name}...`);
  for (const req of scenario.requests) {
    await measureRequest(req);
  }

  // --- Mode 1: Single Execution ---
  // Fires requests sequentially one by one. Measures baseline database/logic speed.
  console.log(`  Running Mode 1: Single Query (Sequential)...`);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    let allSuccess = true;
    for (const req of scenario.requests) {
      const res = await measureRequest(req);
      results.single.requests[req].push(res);
      if (!res.success) allSuccess = false;
    }
    results.single.total_durations.push({ duration: performance.now() - start, success: allSuccess });
  }

  // --- Mode 2: Browser Execution ---
  // Simulates 1 user opening the page. All requests for the scenario fire concurrently.
  console.log(`  Running Mode 2: Single Browser (Parallel calls)...`);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    let allSuccess = true;
    const reqPromises = scenario.requests.map(async req => {
      const res = await measureRequest(req);
      results.browser.requests[req].push(res);
      if (!res.success) allSuccess = false;
    });
    await Promise.all(reqPromises);
    results.browser.total_durations.push({ duration: performance.now() - start, success: allSuccess });
  }

  // --- Mode 3: Concurrent Execution ---
  // Simulates Z users opening the page at the exact same millisecond.
  console.log(`  Running Mode 3: Concurrent Load (${concurrency} users)...`);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    let allSuccess = true;
    const userPromises = Array.from({ length: concurrency }).map(async () => {
      // One user firing all scenario requests in parallel
      const reqPromises = scenario.requests.map(async req => {
        const res = await measureRequest(req);
        results.concurrent.requests[req].push(res);
        if (!res.success) allSuccess = false;
      });
      await Promise.all(reqPromises);
    });
    await Promise.all(userPromises);
    results.concurrent.total_durations.push({ duration: performance.now() - start, success: allSuccess });
  }
  return results;
}

async function runRecord(filename) {
  console.log(`Starting API performance measurements (Saving to ${filename})...`);
  if (!API_TOKEN) {
    console.warn(`\x1b[33m⚠️ No PERF_TEST_API_TOKEN provided. Protected endpoints will return 401/403 errors and won't be benchmarked properly.\x1b[0m`);
  }
  console.log(`Executing ${ITERATIONS} iterations per scenario.`);
  console.log(`Simulating ${CONCURRENCY} concurrent users for load tests.\n`);

  const allResults = { scenarios: {}, settings: { iterations: ITERATIONS, concurrency: CONCURRENCY } };
  for (const scenario of SCENARIOS) {
    console.log(`Measuring Scenario: ${scenario.name}`);
    allResults.scenarios[scenario.name] = await recordScenario(scenario, ITERATIONS, CONCURRENCY);
  }
  fs.writeFileSync(filename, JSON.stringify(allResults, null, 2));
  console.log(`\n✅ Saved raw timing metrics to ${filename}`);
}

function calculateMetrics(arr) {
  if (!arr || arr.length === 0) return { avg: 0, min: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0, size: 0, count: 0, total: 0 };

  const successes = arr.filter(a => typeof a === 'number' || a.success !== false);
  const durations = successes.map(a => typeof a === 'number' ? a : a.duration).sort((a, b) => a - b);
  const size = successes[0]?.size || 0;

  if (durations.length === 0) return { avg: 0, min: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0, size: 0, count: 0, total: arr.length };

  const sum = durations.reduce((a, b) => a + b, 0);
  return {
    avg: sum / durations.length,
    min: durations[0],
    max: durations[durations.length - 1],
    p50: durations[Math.floor(durations.length * 0.50)],
    p90: durations[Math.floor(durations.length * 0.90)],
    p95: durations[Math.floor(durations.length * 0.95)],
    p99: durations[Math.floor(durations.length * 0.99)],
    size: size,
    count: durations.length,
    total: arr.length
  };
}

function formatDiff(base, target, unit = 'ms') {
  const diff = target - base;
  const pct = base > 0 ? (diff / base) * 100 : 0;
  const sign = pct > 0 ? '+' : '';
  const color = pct > 0 ? '\x1b[31m' : '\x1b[32m';
  return `${target.toFixed(1)}${unit} (${color}${sign}${pct.toFixed(2)}%\x1b[0m)`;
}

function runCompare(file1, file2) {
  const baseRaw = fs.readFileSync(file1, 'utf8');
  const targetRaw = fs.readFileSync(file2, 'utf8');

  const base = JSON.parse(baseRaw);
  const target = JSON.parse(targetRaw);

  console.log(`\n=== Detailed Backend API Performance Comparison ===`);
  console.log(`Base:   ${file1}`);
  console.log(`Target: ${file2}\n`);

  for (const [name, baseData] of Object.entries(base.scenarios)) {
    const targetData = target.scenarios[name];
    if (!targetData) continue;

    console.log(`===========================================================`);
    console.log(`SCENARIO: ${name}`);
    console.log(`===========================================================`);

    // Overall execution time
    console.log(`\n1. Overall Execution Time (Total time to resolve all requests for the scenario)`);
    console.log(`| Mode | Trimmed Avg | Target Avg | Base P50 (Median) | Target P50 | Base P95 | Target P95 |`);
    console.log(`|---|---|---|---|---|---|---|`);

    for (const mode of ['single', 'browser', 'concurrent']) {
      const bMetrics = calculateMetrics(baseData[mode].total_durations);
      const tMetrics = calculateMetrics(targetData[mode].total_durations);

      console.log(`| ${mode.toUpperCase()} | ${bMetrics.avg.toFixed(2)}ms | ${formatDiff(bMetrics.avg, tMetrics.avg, 'ms')} | ${bMetrics.p50.toFixed(2)}ms | ${formatDiff(bMetrics.p50, tMetrics.p50, 'ms')} | ${bMetrics.p95.toFixed(2)}ms | ${formatDiff(bMetrics.p95, tMetrics.p95, 'ms')} |`);
    }

    // Individual Requests Breakdown (Measured during CONCURRENT load)
    console.log(`\n2. Individual Endpoint Breakdown (Measured during CONCURRENT load)`);
    console.log(`| API Endpoint | Trimmed Avg | Target Avg | Base P50 | Target P50 | Size (Tgt) | Success (Base->Tgt) |`);
    console.log(`|---|---|---|---|---|---|---|`);

    for (const req of Object.keys(baseData.concurrent.requests)) {
      if (!targetData.concurrent.requests[req]) continue;

      const bReq = calculateMetrics(baseData.concurrent.requests[req]);
      const tReq = calculateMetrics(targetData.concurrent.requests[req]);

      let reqDisplay = req.split('?')[0];
      if (req.includes('?')) reqDisplay += '?…';
      if (reqDisplay.length > 30) reqDisplay = reqDisplay.substring(0, 27) + '...';

      let sizeDisplay = '0.0KB';
      if (tReq.size || bReq.size) {
         sizeDisplay = formatDiff(bReq.size / 1024, tReq.size / 1024, 'KB');
      }

      const baseSuccessStr = `${bReq.count}/${bReq.total || bReq.count}`;
      const targetSuccessStr = `${tReq.count}/${tReq.total || tReq.count}`;

      // Highlight success drops in red
      let successDisplay = `${baseSuccessStr} -> ${targetSuccessStr}`;
      if (tReq.count < bReq.count) {
        successDisplay = `\x1b[31m${successDisplay}\x1b[0m`;
      }

      console.log(`| \`${reqDisplay}\` | ${bReq.avg.toFixed(2)}ms | ${formatDiff(bReq.avg, tReq.avg, 'ms')} | ${bReq.p50.toFixed(2)}ms | ${formatDiff(bReq.p50, tReq.p50, 'ms')} | ${sizeDisplay} | ${successDisplay} |`);
    }    console.log(`\n`);
  }
}

const args = process.argv.slice(2);
if (args[0] === 'record') {
  if (!args[1]) return console.error('Please provide a filename to save the metrics to.');
  runRecord(args[1]);
} else if (args[0] === 'compare') {
  if (!args[1] || !args[2]) return console.error('Please provide both the base and target filenames to compare.');
  runCompare(args[1], args[2]);
} else {
  console.log('Usage: node backend/scripts/measure_api_performance.js record <filename>');
  console.log('       node backend/scripts/measure_api_performance.js compare <base.json> <target.json>');
}
