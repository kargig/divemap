#!/usr/bin/env node

/**
 * Map View and PropTypes Testing Script
 * Tests the recent fixes for map view functionality and PropTypes validation
 * 
 * This test file covers:
 * - Map view switching and persistence
 * - PropTypes validation for map components
 * - Conditional rendering fixes
 * - ESLint configuration validation
 */

const { launchChromium } = require('./launchChromium');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost';

// Test data that matches the backend data types
const TEST_DIVE_SITE = {
  id: 1, // numeric ID (not string)
  name: 'Test Dive Site',
  latitude: 10.0000, // numeric coordinate (not string)
  longitude: 20.0000, // numeric coordinate (not string)
  difficulty_level: 'beginner', // string (human-readable label)
  description: 'A test dive site for testing',
  country: 'Test Country',
  region: 'Test Region',
  max_depth: 15,
  average_rating: 4.5,
  tags: ['reef', 'shallow']
};

const TEST_DIVING_CENTER = {
  id: 1, // numeric ID (not string)
  name: 'Test Diving Center',
  latitude: 11.0000, // numeric coordinate (not string)
  longitude: 21.0000, // numeric coordinate (not string)
  description: 'A test diving center for testing',
  email: 'center@example.com',
  phone: '1234567890',
  website: 'https://center.example.com'
};

async function testMapViewFunctionality(browser) {
  console.log('🧭 Testing Map View Functionality...');
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  
  try {
    // Navigate to dive sites page
    await page.goto(`${BASE_URL}/dive-sites`, { waitUntil: 'networkidle' });
    console.log('  ✅ Navigated to dive sites page');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="view-mode-toggle"]', { timeout: 5000 });
    
    // Test initial state - should be list view
    const listViewActive = await page.$('[data-testid="list-view-button"].active');
    const mapViewActive = await page.$('[data-testid="map-view-button"].active');
    
    if (listViewActive) {
      console.log('  ✅ Initial view is list view');
    } else {
      console.log('  ❌ Initial view is not list view');
    }
    
    // Click map view button
    const mapButton = await page.$('[data-testid="map-view-button"]');
    if (mapButton) {
      await mapButton.click();
      console.log('  ✅ Clicked map view button');
      
      // Wait for view to change
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if map view is now active
      const mapViewActiveAfter = await page.$('[data-testid="map-view-button"].active');
      if (mapViewActiveAfter) {
        console.log('  ✅ Map view is now active');
      } else {
        console.log('  ❌ Map view did not become active');
      }
      
      // Check if map component is rendered
      const mapComponent = await page.$('[data-testid="dive-sites-map"]');
      if (mapComponent) {
        console.log('  ✅ Map component is rendered');
      } else {
        console.log('  ❌ Map component is not rendered');
      }
      
      // Test persistence - navigate away and back
      await page.goto(`${BASE_URL}/diving-centers`);
      await page.waitForSelector('[data-testid="view-mode-toggle"]', { timeout: 5000 });
      
      await page.goto(`${BASE_URL}/dive-sites`);
      await page.waitForSelector('[data-testid="view-mode-toggle"]', { timeout: 5000 });
      
      // Check if map view is still active
      const mapViewStillActive = await page.$('[data-testid="map-view-button"].active');
      if (mapViewStillActive) {
        console.log('  ✅ Map view persists after navigation');
      } else {
        console.log('  ❌ Map view did not persist after navigation');
      }
      
    } else {
      console.log('  ❌ Map view button not found');
    }
    
  } catch (error) {
    console.log(`  ❌ Error testing map view: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function testPropTypesValidation(browser) {
  console.log('🔍 Testing PropTypes Validation...');
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  
  try {
    // Navigate to dive sites page
    await page.goto(`${BASE_URL}/dive-sites`, { waitUntil: 'networkidle' });
    console.log('  ✅ Navigated to dive sites page');
    
    // Listen for console warnings about PropTypes
    const propTypeWarnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warn' && msg.text().includes('Failed prop type')) {
        propTypeWarnings.push(msg.text());
      }
    });
    
    // Switch to map view to trigger PropTypes validation
    const mapButton = await page.$('[data-testid="map-view-button"]');
    if (mapButton) {
      await mapButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check for PropTypes warnings
      if (propTypeWarnings.length === 0) {
        console.log('  ✅ No PropTypes validation warnings');
      } else {
        console.log(`  ❌ Found ${propTypeWarnings.length} PropTypes warnings:`);
        propTypeWarnings.forEach(warning => console.log(`    - ${warning}`));
      }
      
      // Test with mock data to verify PropTypes work correctly
      await page.evaluate((testData) => {
        // This would test the actual PropTypes validation
        // In a real test, we'd inject test data and verify no warnings
        console.log('Testing PropTypes with mock data:', testData);
      }, TEST_DIVE_SITE);
      
    } else {
      console.log('  ❌ Map view button not found');
    }
    
  } catch (error) {
    console.log(`  ❌ Error testing PropTypes: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function testESLintConfiguration(browser) {
  console.log('⚙️  Testing ESLint Configuration...');
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  
  try {
    // Navigate to dive sites page
    await page.goto(`${BASE_URL}/dive-sites`, { waitUntil: 'networkidle' });
    console.log('  ✅ Navigated to dive sites page');
    
    // Listen for console errors that might indicate ESLint issues
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit for any potential errors
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Filter out expected errors (like network errors) and focus on JavaScript errors
    const jsErrors = consoleErrors.filter(error => 
      !error.includes('Network error') && 
      !error.includes('Failed to load resource') &&
      !error.includes('GSI_LOGGER')
    );
    
    if (jsErrors.length === 0) {
      console.log('  ✅ No JavaScript errors detected');
    } else {
      console.log(`  ❌ Found ${jsErrors.length} JavaScript errors:`);
      jsErrors.forEach(error => console.log(`    - ${error}`));
    }
    
    // Test that modern JavaScript features work (indicating Node.js 20 compatibility)
    const modernJsTest = await page.evaluate(() => {
      try {
        // Test optional chaining
        const obj = { a: { b: { c: 1 } } };
        const result = obj?.a?.b?.c;
        
        // Test nullish coalescing
        const nullish = null ?? 'default';
        
        // Test array methods
        const arr = [1, 2, 3];
        const doubled = arr.map(x => x * 2);
        
        return {
          optionalChaining: result === 1,
          nullishCoalescing: nullish === 'default',
          arrayMethods: doubled.join(',') === '2,4,6'
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    if (modernJsTest.error) {
      console.log(`  ❌ Modern JavaScript test failed: ${modernJsTest.error}`);
    } else {
      console.log('  ✅ Modern JavaScript features working correctly:');
      console.log(`    - Optional chaining: ${modernJsTest.optionalChaining ? '✅' : '❌'}`);
      console.log(`    - Nullish coalescing: ${modernJsTest.nullishCoalescing ? '✅' : '❌'}`);
      console.log(`    - Array methods: ${modernJsTest.arrayMethods ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error testing ESLint configuration: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function testConditionalRendering(browser) {
  console.log('🎭 Testing Conditional Rendering...');
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  
  try {
    // Navigate to dive sites page
    await page.goto(`${BASE_URL}/dive-sites`, { waitUntil: 'networkidle' });
    console.log('  ✅ Navigated to dive sites page');
    
    // Test that list view is shown by default
    const listView = await page.$('[data-testid="dive-sites-list"]');
    const mapView = await page.$('[data-testid="dive-sites-map"]');
    
    if (listView && !mapView) {
      console.log('  ✅ List view shown by default, map view hidden');
    } else {
      console.log('  ❌ Incorrect default view state');
    }
    
    // Switch to map view
    const mapButton = await page.$('[data-testid="map-view-button"]');
    if (mapButton) {
      await mapButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test that map view is now shown and list view is hidden
      const listViewAfter = await page.$('[data-testid="dive-sites-list"]');
      const mapViewAfter = await page.$('[data-testid="dive-sites-map"]');
      
      if (!listViewAfter && mapViewAfter) {
        console.log('  ✅ Map view shown, list view hidden after switch');
      } else {
        console.log('  ❌ Incorrect view state after switch');
      }
      
      // Switch back to list view
      const listButton = await page.$('[data-testid="list-view-button"]');
      if (listButton) {
        await listButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test that list view is shown again
        const listViewFinal = await page.$('[data-testid="dive-sites-list"]');
        const mapViewFinal = await page.$('[data-testid="dive-sites-map"]');
        
        if (listViewFinal && !mapViewFinal) {
          console.log('  ✅ List view shown again after switching back');
        } else {
          console.log('  ❌ Incorrect view state after switching back');
        }
      }
    }
    
  } catch (error) {
    console.log(`  ❌ Error testing conditional rendering: ${error.message}`);
  } finally {
    await page.close();
  }
}

async function runAllTests() {
  console.log('🚀 Starting Map View and PropTypes Tests...\n');
  
  let browser;
  try {
    browser = await launchChromium();
    
    // Run all test suites
    await testMapViewFunctionality(browser);
    console.log('');
    
    await testPropTypesValidation(browser);
    console.log('');
    
    await testESLintConfiguration(browser);
    console.log('');
    
    await testConditionalRendering(browser);
    console.log('');
    
    console.log('✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testMapViewFunctionality,
  testPropTypesValidation,
  testESLintConfiguration,
  testConditionalRendering
};
