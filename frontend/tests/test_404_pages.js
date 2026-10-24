const { launchChromium } = require('./launchChromium');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost';
const NON_EXISTENT_ID = 999999;

const PAGES_TO_TEST = [
  `/dive-sites/${NON_EXISTENT_ID}`,
  `/diving-centers/${NON_EXISTENT_ID}`,
  `/dives/${NON_EXISTENT_ID}`,
  `/dive-trips/${NON_EXISTENT_ID}`
];

async function runTests() {
  console.log('🚀 Starting 404 Page Verification Tests...\n');

  const browser = await launchChromium();

  let failedTests = 0;

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });

    for (const url of PAGES_TO_TEST) {
      console.log(`Testing URL: ${BASE_URL}${url}`);
      
      try {
        await page.goto(`${BASE_URL}${url}`, {
          waitUntil: 'networkidle',
          timeout: 10000
        });

        // Wait a moment for any client-side rendering/redirects
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for specific content from the NotFound component
        const content = await page.content();
        const isNotFoundPage = content.includes('Page Not Found') && 
                               content.includes('The page you are looking for might have been removed');

        if (isNotFoundPage) {
          console.log(`  ✅ Successfully rendered NotFound page for ${url}`);
        } else {
          console.log(`  ❌ Failed to render NotFound page for ${url}`);
          console.log(`     Page title: ${await page.title()}`);
          failedTests++;
        }

      } catch (error) {
        console.log(`  ❌ Navigation failed for ${url}: ${error.message}`);
        failedTests++;
      }
    }

  } catch (error) {
    console.error('Fatal error during tests:', error);
    failedTests++;
  } finally {
    await browser.close();
  }

  if (failedTests > 0) {
    console.log(`\n❌ ${failedTests} tests failed!`);
    process.exit(1);
  } else {
    console.log('\n✅ All 404 tests passed!');
    process.exit(0);
  }
}

if (require.main === module) {
  runTests();
}
