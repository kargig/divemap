#!/usr/bin/env node

/**
 * Frontend Testing Script
 * Validates that all pages load without JavaScript errors
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const PAGES_TO_TEST = [
  '/',
  '/dive-sites',
  '/diving-centers',
  '/login',
  '/register',
  '/profile'
];

async function testPage(browser, url) {
  const page = await browser.newPage();
  
  // Listen for console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        url,
        message: msg.text(),
        location: msg.location()
      });
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    errors.push({
      url,
      message: error.message,
      stack: error.stack
    });
  });

  try {
    console.log(`Testing: ${BASE_URL}${url}`);
    
    // Navigate to the page
    await page.goto(`${BASE_URL}${url}`, { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);

    // Check if the page loaded successfully
    const title = await page.title();
    console.log(`  ✓ Loaded: ${title}`);

    // Test specific functionality based on the page
    if (url === '/dive-sites') {
      await testDiveSitesPage(page);
    } else if (url === '/diving-centers') {
      await testDivingCentersPage(page);
    }

    return { url, errors, success: true };
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}`);
    return { url, errors: [...errors, { url, message: error.message }], success: false };
  } finally {
    await page.close();
  }
}

async function testDiveSitesPage(page) {
  console.log('  Testing dive sites functionality...');
  
  // Check if dive sites are displayed
  const diveSiteCards = await page.$$('[data-testid="dive-site-card"]');
  console.log(`    Found ${diveSiteCards.length} dive site cards`);
  
  // Test search functionality
  const searchInput = await page.$('input[placeholder*="Search"]');
  if (searchInput) {
    await searchInput.type('test');
    await page.waitForTimeout(1000);
    console.log('    ✓ Search input working');
  }
}

async function testDivingCentersPage(page) {
  console.log('  Testing diving centers functionality...');
  
  // Check if diving centers are displayed
  const centerCards = await page.$$('[data-testid="diving-center-card"]');
  console.log(`    Found ${centerCards.length} diving center cards`);
  
  // Test search functionality
  const searchInput = await page.$('input[placeholder*="name"]');
  if (searchInput) {
    await searchInput.type('test');
    await page.waitForTimeout(1000);
    console.log('    ✓ Search input working');
  }
}

async function runTests() {
  console.log('🚀 Starting Frontend Tests...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];
  
  for (const page of PAGES_TO_TEST) {
    const result = await testPage(browser, page);
    results.push(result);
  }

  await browser.close();

  // Report results
  console.log('\n📊 Test Results:');
  console.log('================');
  
  let totalErrors = 0;
  let failedPages = 0;

  results.forEach(result => {
    if (result.success) {
      if (result.errors.length > 0) {
        console.log(`⚠️  ${result.url} - ${result.errors.length} console errors`);
        result.errors.forEach(error => {
          console.log(`   - ${error.message}`);
        });
        totalErrors += result.errors.length;
      } else {
        console.log(`✅ ${result.url} - No errors`);
      }
    } else {
      console.log(`❌ ${result.url} - Failed to load`);
      failedPages++;
    }
  });

  console.log('\n📈 Summary:');
  console.log(`   Pages tested: ${PAGES_TO_TEST.length}`);
  console.log(`   Pages failed: ${failedPages}`);
  console.log(`   Total errors: ${totalErrors}`);

  if (failedPages > 0 || totalErrors > 0) {
    console.log('\n❌ Tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests }; 