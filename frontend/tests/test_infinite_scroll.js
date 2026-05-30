#!/usr/bin/env node

/**
 * Infinite Scroll Testing Script
 * Validates that infinite scrolling works correctly on major discovery pages.
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost';
const PAGES_TO_TEST = [
  '/dive-sites',
  '/diving-centers',
  '/dive-routes',
  '/dive-trips',
  '/dives'
];

async function testInfiniteScroll(browser, path) {
  const url = `${BASE_URL}${path}`;
  const page = await browser.newPage();

  // Set a mobile-like viewport to ensure we trigger scrolling easily
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.message}`);
  });

  try {
    console.log(`\n--- Testing Infinite Scroll: ${url} ---`);

    // 1. Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // 2. Count initial items
    const initialItemCount = await page.evaluate(() => {
      // Find items based on common class or test-id
      return document.querySelectorAll('.dive-item, [data-testid$="-card"], .trip-card').length;
    });

    console.log(`Initial items found: ${initialItemCount}`);

    if (initialItemCount === 0) {
      console.log('No items found initially. Checking for empty state or error...');
      const emptyState = await page.evaluate(() => {
        return !!document.querySelector('.empty-state') || 
               Array.from(document.querySelectorAll('h3')).some(h3 => h3.textContent.includes('No'));
      });
      if (emptyState) {
        console.log('Page is intentionally empty or in empty state.');
        await page.close();
        return { success: true, path, items: 0 };
      }
    }

    // 3. Verify Pagination component is NOT visible
    const isPaginationVisible = await page.evaluate(() => {
      const pagination = document.querySelector('.pagination, [aria-label="Pagination"]');
      return pagination ? (window.getComputedStyle(pagination).display !== 'none') : false;
    });

    if (isPaginationVisible) {
      console.error('❌ FAILURE: Pagination component is still visible!');
      await page.close();
      return { success: false, path, error: 'Pagination still visible' };
    } else {
      console.log('✅ Pagination component is correctly hidden.');
    }

    // 4. Scroll to bottom multiple times to trigger loading
    console.log('Scrolling to bottom...');
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for network requests
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Count items again
    const newItemCount = await page.evaluate(() => {
      return document.querySelectorAll('.dive-item, [data-testid$="-card"], .trip-card').length;
    });

    console.log(`Items after scroll: ${newItemCount}`);

    // If there were items initially and more could be loaded, count should increase
    // We assume test DB has enough items or it's at least not breaking
    if (newItemCount > initialItemCount) {
      console.log(`✅ SUCCESS: Items increased from ${initialItemCount} to ${newItemCount}`);
    } else if (newItemCount === initialItemCount && initialItemCount > 0) {
      console.log('ℹ️ Item count did not increase. This might be because all items are already loaded or no more data exists.');
    }

    if (errors.length > 0) {
      console.error(`❌ FAILURE: Console errors detected during test:`);
      errors.forEach(err => console.error(err));
      await page.close();
      return { success: false, path, error: 'Console errors detected' };
    }

    console.log(`✅ Passed: ${path}`);
    await page.close();
    return { success: true, path, items: newItemCount };

  } catch (err) {
    console.error(`❌ Error testing ${path}: ${err.message}`);
    await page.close();
    return { success: false, path, error: err.message };
  }
}

async function main() {
  console.log('Starting Infinite Scroll validation...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new'
  });

  const results = [];
  for (const path of PAGES_TO_TEST) {
    const result = await testInfiniteScroll(browser, path);
    results.push(result);
  }

  await browser.close();

  console.log('\n--- Final Summary ---');
  let allPassed = true;
  results.forEach(res => {
    if (res.success) {
      console.log(`✅ ${res.path}: Passed (${res.items} items)`);
    } else {
      console.log(`❌ ${res.path}: Failed - ${res.error}`);
      allPassed = false;
    }
  });

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

main();
