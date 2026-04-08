const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.PERF_TEST_BASE_URL || 'http://localhost';

const URLS = [
  `${BASE_URL}/`,
  `${BASE_URL}/dive-sites`,
  `${BASE_URL}/dive-sites/154/agios-onoufrios-seal-cave`,
  `${BASE_URL}/dive-sites/38/avantis-iii?tab=media`,
  `${BASE_URL}/diving-centers`,
  `${BASE_URL}/diving-centers/56/achilleon-diving-center`,
  `${BASE_URL}/dives`,
  `${BASE_URL}/dives/39/antonios-reef-2026-03-15`,
  `${BASE_URL}/dive-trips`,
  `${BASE_URL}/dive-trips/332/achilleon-diving-center-8-apr-2026`,
  `${BASE_URL}/dive-routes?sort_by=name&sort_order=asc`,
  `${BASE_URL}/dive-sites/11/route/16/kaki-thalassa-islet-east`,
  `${BASE_URL}/map?lat=37.709533&lng=23.907795&zoom=13.0&wind=true`,
  `${BASE_URL}/map?lat=37.984200&lng=23.735300&zoom=10.0&type=diving-centers`,
  `${BASE_URL}/map?lat=37.984200&lng=23.735300&zoom=10.0&type=dives`,
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function authenticate(browser) {
  const username = process.env.PERF_TEST_USERNAME;
  const password = process.env.PERF_TEST_PASSWORD;

  if (!username || !password) {
    console.warn('\x1b[33m⚠️  Authentication credentials missing (PERF_TEST_USERNAME and PERF_TEST_PASSWORD not set). Running measurements as ANONYMOUS user.\x1b[0m');
    return null;
  }

  // Mask username for security in logs
  const maskedUsername = username.length > 2 
    ? `${username.charAt(0)}***${username.charAt(username.length - 1)}` 
    : '***';

  console.log(`Authenticating user (${maskedUsername})...`);
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);

  // Fill login form
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Cloudflare Turnstile (even in testing mode with the 1x... key) takes a moment to mount and auto-resolve.
  // We'll wait a bit before submitting to allow the token to be set in the React state.
  console.log('  Waiting for Turnstile to resolve...');
  await page.waitForTimeout(2000); // 2 second delay to ensure the widget loads and calls onVerify

  await page.click('button[type="submit"]');

  // Wait for navigation to complete (should redirect to / if successful)
  try {
    await page.waitForNavigation({ url: `${BASE_URL}/`, waitUntil: 'networkidle', timeout: 10000 });
  } catch (e) {
    console.error('  Login navigation timeout. The credentials might be wrong, or Turnstile failed.');
    // Try to see if there's a toast error
    const toast = await page.locator('.go3958317564, .go2072408551').textContent().catch(() => null); // Hot-toast classes
    if (toast) console.error(`  Toast Error: ${toast}`);

    // Check if turnstile error is visible
    const turnstileErr = await page.locator('text=Please complete the verification to continue').isVisible();
    if (turnstileErr) console.error('  Turnstile verification failed (token not generated).');

    throw new Error('Authentication failed.');
  }

  // Extract storage state (cookies, localStorage, etc.)
  const state = await context.storageState();

  // Double check that we actually have the access_token in localStorage
  const hasToken = state.origins.some(o =>
    o.origin === BASE_URL && o.localStorage.some(item => item.name === 'access_token')
  );

  if (!hasToken) {
    throw new Error('Authentication failed: No access_token found in localStorage after login.');
  }

  console.log('✅ Login successful.');
  await context.close();
  return state;
}

async function measurePage(browser, url, authState, collectLogs = false) {
  const context = await browser.newContext({
    storageState: authState,
    // Isolate context completely
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block' // Prevent service workers from caching API requests
  });
  const page = await context.newPage();

  // Force cache clearing
  await page.route('**', route => {
    // We don't block anything, just ensure we don't use cache if we can help it from the client side
    route.continue();
  });

  let totalApiRequests = 0;
  let totalApiBytes = 0;
  let hasErrors = false;
  const apiLogs = [];

  // Track all /api/v1/ requests
  page.on('response', async (response) => {
    const reqUrl = response.url();
    if (reqUrl.includes('/api/v1/')) {
      const status = response.status();

      if (collectLogs) {
        try {
          const parsedUrl = new URL(reqUrl);
          apiLogs.push(`${response.request().method()} ${parsedUrl.pathname}${parsedUrl.search} [${status}]`);
        } catch(e) {
          apiLogs.push(`${response.request().method()} ${reqUrl} [${status}]`);
        }
      }

      if (status >= 400) {
        console.warn(`\n    [WARN] API Error ${status} on ${reqUrl}`);
        hasErrors = true;
      }

      if (status === 200) {
        totalApiRequests++;
        try {
          const body = await response.body();
          totalApiBytes += body.length;
        } catch (e) {
          // Response body might be unavailable if it was aborted
        }
      }
    }
  });

  const startTime = Date.now();
  // Wait until there are no network connections for at least 500 ms
  try {
    // Increased timeout to 45s for parallel runs which can be heavy
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    if (response && response.status() >= 400) {
        console.warn(`\n    [WARN] Page Error ${response.status()} on ${url}`);
        hasErrors = true;
    }
  } catch (e) {
    // Silent catch, loadTime will reflect the timeout
    console.warn(`\n    [WARN] Timeout or navigation error on ${url}`);
    hasErrors = true;
  }
  const loadTime = Date.now() - startTime;

  await context.close();

  return {
    loadTime,
    apiRequests: totalApiRequests,
    apiBytes: totalApiBytes,
    hasErrors,
    apiLogs
  };
}
const calcAvg = (arr, key) => arr.length ? Math.round(arr.reduce((acc, val) => acc + val[key], 0) / arr.length) : 0;
const calcAvgFloat = (arr, key) => arr.length ? Number((arr.reduce((acc, val) => acc + val[key], 0) / arr.length).toFixed(1)) : 0;
const calcMin = (arr, key) => arr.length ? Math.min(...arr.map(m => m[key])) : 0;
const calcMax = (arr, key) => arr.length ? Math.max(...arr.map(m => m[key])) : 0;
const calcP95 = (arr, key) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a[key] - b[key]);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[index][key];
};

async function runMeasurements(outputName) {
  console.log(`Starting performance measurements for ${outputName}.`);
  const browser = await chromium.launch();
  
  // Get authenticated state (returns null if credentials missing)
  const authState = await authenticate(browser);
  
  const results = {};

  for (const url of URLS) {
    console.log(`\nMeasuring: ${url}`);

    // 1. Sequential iterations (5)
    console.log(`  Running 5 sequential iterations (with 1s sleep)...`);
    const seqMetrics = [];
    for (let i = 0; i < 5; i++) {
      if (i > 0) await sleep(1000);
      process.stdout.write(`    Seq ${i + 1}/5... `);
      const m = await measurePage(browser, url, authState, i === 0); // Pass true on first iteration
      seqMetrics.push(m);
      const errorMarker = m.hasErrors ? '\x1b[31m[HAS ERRORS]\x1b[0m ' : '';
      console.log(`${errorMarker}${m.loadTime}ms, ${m.apiRequests} API reqs, ${(m.apiBytes / 1024).toFixed(1)} KB`);

      // Print API logs from the first run
      if (i === 0 && m.apiLogs && m.apiLogs.length > 0) {
        console.log(`      \x1b[90mAPI Calls during this load:\x1b[0m`);
        m.apiLogs.forEach(log => console.log(`        \x1b[90m- ${log}\x1b[0m`));
      }
    }

    // 2. Parallel iterations (10 in 2 batches of 5)
    console.log(`  Running 10 parallel iterations (2 batches of 5)...`);
    const parMetrics = [];
    for (let batch = 0; batch < 2; batch++) {
      process.stdout.write(`    Batch ${batch + 1}/2... `);
      const startBatch = Date.now();

      // Execute 5 in parallel
      const batchPromises = Array(5).fill().map(() => measurePage(browser, url, authState));
      const batchResults = await Promise.all(batchPromises);

      parMetrics.push(...batchResults);
      const batchErrors = batchResults.some(m => m.hasErrors) ? '\x1b[31m[HAS ERRORS]\x1b[0m ' : '';
      console.log(`${batchErrors}done in ${Date.now() - startBatch}ms`);

      if (batch === 0) await sleep(1000); // 1s sleep between batches
    }

    results[url] = {
      seq: seqMetrics,
      par: parMetrics
    };
  }

  await browser.close();

  const outputPath = path.join(__dirname, `../${outputName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to ${outputPath}`);
}

function processMetrics(data) {
  // If data is in legacy format (already averaged), convert it to our new structure
  if (data.seq && data.seq.avgLoadTimeMs !== undefined) {
      return {
          seq: {
              avgTime: data.seq.avgLoadTimeMs,
              minTime: data.seq.avgLoadTimeMs,
              maxTime: data.seq.avgLoadTimeMs,
              p95Time: data.seq.avgLoadTimeMs,
              avgReqs: data.seq.avgApiRequests,
              avgKb: data.seq.avgApiKBytes
          },
          par: {
              avgTime: data.par.avgLoadTimeMs,
              minTime: data.par.avgLoadTimeMs,
              maxTime: data.par.avgLoadTimeMs,
              p95Time: data.par.avgLoadTimeMs,
              avgReqs: data.par.avgApiRequests,
              avgKb: data.par.avgApiKBytes
          }
      };
  } else if (data.avgLoadTimeMs !== undefined) {
      // Very old format
      return {
        seq: {
            avgTime: data.avgLoadTimeMs,
            minTime: data.avgLoadTimeMs,
            maxTime: data.avgLoadTimeMs,
            p95Time: data.avgLoadTimeMs,
            avgReqs: data.avgApiRequests,
            avgKb: data.avgApiKBytes
        },
        par: {
            avgTime: data.avgLoadTimeMs,
            minTime: data.avgLoadTimeMs,
            maxTime: data.avgLoadTimeMs,
            p95Time: data.avgLoadTimeMs,
            avgReqs: data.avgApiRequests,
            avgKb: data.avgApiKBytes
        }
    };
  }

  // New format: calculate stats on the fly
  return {
    seq: {
      avgTime: calcAvg(data.seq, 'loadTime'),
      minTime: calcMin(data.seq, 'loadTime'),
      maxTime: calcMax(data.seq, 'loadTime'),
      p95Time: calcP95(data.seq, 'loadTime'),
      avgReqs: calcAvg(data.seq, 'apiRequests'),
      avgKb: calcAvgFloat(data.seq.map(m => ({ kb: m.apiBytes / 1024 })), 'kb')
    },
    par: {
      avgTime: calcAvg(data.par, 'loadTime'),
      minTime: calcMin(data.par, 'loadTime'),
      maxTime: calcMax(data.par, 'loadTime'),
      p95Time: calcP95(data.par, 'loadTime'),
      avgReqs: calcAvg(data.par, 'apiRequests'),
      avgKb: calcAvgFloat(data.par.map(m => ({ kb: m.apiBytes / 1024 })), 'kb')
    }
  };
}

function compareResults(file1, file2) {
  const p1 = path.join(__dirname, `../${file1}`);
  const p2 = path.join(__dirname, `../${file2}`);

  if (!fs.existsSync(p1) || !fs.existsSync(p2)) {
    console.error(`Error: Cannot find one of the files (${p1} or ${p2})`);
    process.exit(1);
  }

  const raw1 = JSON.parse(fs.readFileSync(p1, 'utf8'));
  const raw2 = JSON.parse(fs.readFileSync(p2, 'utf8'));

  console.log(`\n=== Performance Comparison ===`);
  console.log(`Base (Main): ${file1}`);
  console.log(`Target (Branch): ${file2}\n`);

  console.log(`| URL Path | Seq Avg (Diff) | Seq P95 (Diff) | Par Avg (Diff) | API Reqs | API Size |`);
  console.log(`|---|---|---|---|---|---|`);

  for (const url of URLS) {
    if (!raw1[url] || !raw2[url]) continue;

    const m1 = processMetrics(raw1[url]);
    const m2 = processMetrics(raw2[url]);

    const seqAvgDiff = m2.seq.avgTime - m1.seq.avgTime;
    const seqAvgPct = m1.seq.avgTime ? ((seqAvgDiff / m1.seq.avgTime) * 100).toFixed(1) : 0;

    const seqP95Diff = m2.seq.p95Time - m1.seq.p95Time;
    const seqP95Pct = m1.seq.p95Time ? ((seqP95Diff / m1.seq.p95Time) * 100).toFixed(1) : 0;

    const parAvgDiff = m2.par.avgTime - m1.par.avgTime;
    const parAvgPct = m1.par.avgTime ? ((parAvgDiff / m1.par.avgTime) * 100).toFixed(1) : 0;

    // API size and request count should be generally identical between seq and par, we use seq for comparison
    const reqDiff = m2.seq.avgReqs - m1.seq.avgReqs;

    const sizeDiff = m2.seq.avgKb - m1.seq.avgKb;
    const sizePct = m1.seq.avgKb ? ((sizeDiff / m1.seq.avgKb) * 100).toFixed(1) : 0;

    const formatDiff = (val, diff, pct, unit) => {
      const sign = diff > 0 ? '+' : '';
      const color = diff > 0 ? '\x1b[31m' : (diff < 0 ? '\x1b[32m' : ''); // Red if worse, Green if better

      if (diff === 0) return `${val}${unit}`;
      return `${val}${unit} (${color}${sign}${pct}%\x1b[0m)`;
    };

    const seqAvgStr = formatDiff(m2.seq.avgTime, seqAvgDiff, seqAvgPct, 'ms');
    const seqP95Str = formatDiff(m2.seq.p95Time, seqP95Diff, seqP95Pct, 'ms');
    const parAvgStr = formatDiff(m2.par.avgTime, parAvgDiff, parAvgPct, 'ms');

    let reqColor = '';
    let reqSign = '';
    if (reqDiff > 0) { reqColor = '\x1b[31m'; reqSign = '+'; }
    else if (reqDiff < 0) { reqColor = '\x1b[32m'; reqSign = ''; }

    const reqStr = reqDiff !== 0 ?
      `${m2.seq.avgReqs} (${reqColor}${reqSign}${reqDiff}\x1b[0m)` :
      `${m2.seq.avgReqs}`;

    const sizeStr = formatDiff(m2.seq.avgKb.toFixed(1), sizeDiff, sizePct, 'KB');

    const shortUrl = url.replace(BASE_URL, '');
    console.log(`| \`${shortUrl}\` | ${seqAvgStr} | ${seqP95Str} | ${parAvgStr} | ${reqStr} | ${sizeStr} |`);
  }
  console.log();
  console.log('Note: Negative percentages (Green) mean the Target is FASTER / SMALLER than Base (Improvement!).');
}
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Divemap Performance Measurement Tool (Extended)
=============================================
Uses Playwright to navigate to key pages and measure Load Time (Network Idle), API request counts, and API response sizes.
Performs 15 iterations: 5 sequentially (with 1s sleep), then 10 in parallel (2 batches of 5).

Usage:
  1. Record metrics for a target:
     $ node scripts/measure_performance.js record <name>
     Example: PERF_TEST_USERNAME=user PERF_TEST_PASSWORD=pass node scripts/measure_performance.js record record_branch

     Optional ENV vars:
     PERF_TEST_BASE_URL (default: 'http://localhost')
     PERF_TEST_USERNAME (skips login if missing)
     PERF_TEST_PASSWORD (skips login if missing)

  2. Compare two recordings:     $ node scripts/measure_performance.js compare <base_file.json> <target_file.json>
     Example: node scripts/measure_performance.js compare record_main.json record_branch.json
    `);
    process.exit(0);
  }

  const command = args[0];

  if (command === 'record') {
    if (!args[1]) {
      console.error('Error: Please provide a name for the recording (e.g., "record_main").');
      process.exit(1);
    }
    await runMeasurements(args[1]);
  } else if (command === 'compare') {
    if (!args[1] || !args[2]) {
      console.error('Error: Please provide two files to compare.');
      process.exit(1);
    }
    compareResults(args[1], args[2]);
  } else {
    console.error('Unknown command. Run without arguments for help.');
  }
}

main().catch(console.error);
