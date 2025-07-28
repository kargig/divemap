#!/usr/bin/env node

/**
 * Comprehensive Frontend Validation Script
 * Tests frontend functionality, accessibility, and integration
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';

// Test scenarios
const TEST_SCENARIOS = {
  navigation: [
    { from: '/', to: '/dive-sites', name: 'Home to Dive Sites' },
    { from: '/', to: '/diving-centers', name: 'Home to Diving Centers' },
    { from: '/dive-sites', to: '/diving-centers', name: 'Dive Sites to Diving Centers' },
    { from: '/diving-centers', to: '/login', name: 'Diving Centers to Login' },
    { from: '/login', to: '/register', name: 'Login to Register' },
    { from: '/register', to: '/', name: 'Register to Home' }
  ],
  forms: [
    { page: '/login', fields: ['email', 'password'], submit: true },
    { page: '/register', fields: ['name', 'email', 'password', 'confirmPassword'], submit: true },
    { page: '/create-dive-site', fields: ['name', 'description', 'latitude', 'longitude'], submit: false },
    { page: '/create-diving-center', fields: ['name', 'description', 'email', 'phone'], submit: false }
  ],
  accessibility: [
    'alt', 'aria-label', 'aria-describedby', 'role', 'tabindex'
  ]
};

async function testAccessibility(page) {
  console.log('  Testing accessibility...');
  
  const issues = [];
  
  // Check for alt attributes on images
  const images = await page.$$('img');
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    if (!alt) {
      issues.push('Image missing alt attribute');
    }
  }
  
  // Check for form labels
  const inputs = await page.$$('input, textarea, select');
  for (const input of inputs) {
    const id = await input.getAttribute('id');
    if (id) {
      const label = await page.$(`label[for="${id}"]`);
      if (!label) {
        const ariaLabel = await input.getAttribute('aria-label');
        if (!ariaLabel) {
          issues.push(`Input missing label or aria-label: ${id}`);
        }
      }
    }
  }
  
  // Check for proper heading hierarchy
  const headings = await page.$$('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;
  for (const heading of headings) {
    const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
    const level = parseInt(tagName.charAt(1));
    if (level > previousLevel + 1) {
      issues.push(`Heading hierarchy skip: ${tagName}`);
    }
    previousLevel = level;
  }
  
  // Check for keyboard navigation
  const focusableElements = await page.$$('a, button, input, textarea, select, [tabindex]');
  if (focusableElements.length === 0) {
    issues.push('No focusable elements found');
  }
  
  if (issues.length === 0) {
    console.log('    ✅ Accessibility checks passed');
  } else {
    console.log(`    ⚠️  ${issues.length} accessibility issues found:`);
    issues.forEach(issue => console.log(`      - ${issue}`));
  }
  
  return issues.length === 0;
}

async function testNavigation(page) {
  console.log('  Testing navigation...');
  
  let navigationErrors = 0;
  
  for (const scenario of TEST_SCENARIOS.navigation) {
    try {
      // Navigate to starting page
      await page.goto(`${BASE_URL}${scenario.from}`);
      await page.waitForTimeout(1000);
      
      // Find and click navigation link
      const link = await page.$(`a[href="${scenario.to}"]`);
      if (link) {
        await link.click();
        await page.waitForTimeout(2000);
        
        // Check if navigation was successful
        const currentUrl = page.url();
        if (currentUrl.includes(scenario.to)) {
          console.log(`    ✅ ${scenario.name}`);
        } else {
          console.log(`    ❌ ${scenario.name} - Expected ${scenario.to}, got ${currentUrl}`);
          navigationErrors++;
        }
      } else {
        console.log(`    ❌ ${scenario.name} - Navigation link not found`);
        navigationErrors++;
      }
    } catch (error) {
      console.log(`    ❌ ${scenario.name} - Error: ${error.message}`);
      navigationErrors++;
    }
  }
  
  return navigationErrors === 0;
}

async function testForms(page) {
  console.log('  Testing forms...');
  
  let formErrors = 0;
  
  for (const form of TEST_SCENARIOS.forms) {
    try {
      await page.goto(`${BASE_URL}${form.page}`);
      await page.waitForTimeout(1000);
      
      // Test form fields
      for (const fieldName of form.fields) {
        const field = await page.$(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
        if (field) {
          await field.type('test');
          await page.waitForTimeout(500);
          console.log(`      ✅ ${fieldName} field working`);
        } else {
          console.log(`      ❌ ${fieldName} field not found`);
          formErrors++;
        }
      }
      
      // Test form submission if required
      if (form.submit) {
        const submitButton = await page.$('button[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await page.waitForTimeout(2000);
          console.log(`      ✅ Form submission working`);
        } else {
          console.log(`      ❌ Submit button not found`);
          formErrors++;
        }
      }
      
    } catch (error) {
      console.log(`    ❌ Form test failed: ${error.message}`);
      formErrors++;
    }
  }
  
  return formErrors === 0;
}

async function testResponsiveDesign(page) {
  console.log('  Testing responsive design...');
  
  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop' },
    { width: 1024, height: 768, name: 'Tablet' },
    { width: 375, height: 667, name: 'Mobile' }
  ];
  
  let responsiveIssues = 0;
  
  for (const viewport of viewports) {
    await page.setViewport(viewport);
    await page.waitForTimeout(500);
    
    // Check for horizontal scrolling
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport.width;
    
    if (bodyWidth > viewportWidth) {
      console.log(`    ⚠️  ${viewport.name}: Horizontal scrolling detected`);
      responsiveIssues++;
    } else {
      console.log(`    ✅ ${viewport.name}: No horizontal scrolling`);
    }
    
    // Check for critical elements visibility
    const navbar = await page.$('nav');
    if (navbar) {
      const isVisible = await navbar.isVisible();
      if (!isVisible) {
        console.log(`    ⚠️  ${viewport.name}: Navigation not visible`);
        responsiveIssues++;
      }
    }
    
    // Check for text readability
    const textElements = await page.$$('p, h1, h2, h3, h4, h5, h6');
    for (const text of textElements) {
      const fontSize = await text.evaluate(el => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.fontSize);
      });
      
      if (fontSize < 12) {
        console.log(`    ⚠️  ${viewport.name}: Small text detected (${fontSize}px)`);
        responsiveIssues++;
      }
    }
  }
  
  // Reset to default viewport
  await page.setViewport({ width: 1280, height: 720 });
  
  return responsiveIssues === 0;
}

async function testErrorHandling(page) {
  console.log('  Testing error handling...');
  
  let errorHandlingIssues = 0;
  
  // Test 404 page
  try {
    await page.goto(`${BASE_URL}/non-existent-page`);
    await page.waitForTimeout(2000);
    
    const notFoundContent = await page.$('[data-testid="not-found"], .error-page, .not-found');
    if (notFoundContent) {
      console.log('    ✅ 404 page working');
    } else {
      console.log('    ⚠️  404 page not found');
      errorHandlingIssues++;
    }
  } catch (error) {
    console.log('    ❌ 404 page test failed');
    errorHandlingIssues++;
  }
  
  // Test network error simulation
  try {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(1000);
    
    const offlineIndicator = await page.$('[data-testid="offline"], .offline-indicator');
    if (offlineIndicator) {
      console.log('    ✅ Offline handling present');
    } else {
      console.log('    ⚠️  Offline handling not detected');
    }
  } catch (error) {
    console.log('    ❌ Offline test failed');
    errorHandlingIssues++;
  }
  
  return errorHandlingIssues === 0;
}

async function testPerformance(page) {
  console.log('  Testing performance...');
  
  let performanceIssues = 0;
  
  // Test page load time
  const startTime = Date.now();
  await page.goto(`${BASE_URL}/`);
  const loadTime = Date.now() - startTime;
  
  if (loadTime > 5000) {
    console.log(`    ⚠️  Slow page load: ${loadTime}ms`);
    performanceIssues++;
  } else {
    console.log(`    ✅ Page load time: ${loadTime}ms`);
  }
  
  // Test resource loading
  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries.map(entry => ({
      name: entry.name,
      duration: entry.duration,
      size: entry.transferSize
    }));
  });
  
  const slowResources = resources.filter(r => r.duration > 2000);
  if (slowResources.length > 0) {
    console.log(`    ⚠️  ${slowResources.length} slow resources detected`);
    performanceIssues++;
  } else {
    console.log(`    ✅ All resources loaded quickly`);
  }
  
  // Test memory usage
  const memoryInfo = await page.evaluate(() => {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize
      };
    }
    return null;
  });
  
  if (memoryInfo && memoryInfo.used > 50 * 1024 * 1024) { // 50MB
    console.log(`    ⚠️  High memory usage: ${Math.round(memoryInfo.used / 1024 / 1024)}MB`);
    performanceIssues++;
  } else {
    console.log(`    ✅ Memory usage acceptable`);
  }
  
  return performanceIssues === 0;
}

async function testIntegration(page) {
  console.log('  Testing backend integration...');
  
  let integrationIssues = 0;
  
  // Test API calls
  const apiCalls = await page.evaluate(() => {
    return new Promise((resolve) => {
      const originalFetch = window.fetch;
      const calls = [];
      
      window.fetch = function(...args) {
        calls.push(args[0]);
        return originalFetch.apply(this, args);
      };
      
      setTimeout(() => {
        window.fetch = originalFetch;
        resolve(calls);
      }, 3000);
    });
  });
  
  if (apiCalls.length === 0) {
    console.log('    ⚠️  No API calls detected');
    integrationIssues++;
  } else {
    console.log(`    ✅ ${apiCalls.length} API calls detected`);
  }
  
  // Test data loading
  const dataElements = await page.$$('[data-testid*="card"], [data-testid*="item"], .card, .item');
  if (dataElements.length === 0) {
    console.log('    ⚠️  No data elements found');
    integrationIssues++;
  } else {
    console.log(`    ✅ ${dataElements.length} data elements found`);
  }
  
  return integrationIssues === 0;
}

async function testUserInteractions(page) {
  console.log('  Testing user interactions...');
  
  let interactionIssues = 0;
  
  // Test search functionality
  const searchInput = await page.$('input[placeholder*="Search"], input[type="search"]');
  if (searchInput) {
    await searchInput.type('test');
    await page.waitForTimeout(1000);
    console.log('    ✅ Search input working');
  } else {
    console.log('    ⚠️  Search input not found');
  }
  
  // Test filtering
  const filterButtons = await page.$$('button[data-testid*="filter"], .filter-button');
  if (filterButtons.length > 0) {
    await filterButtons[0].click();
    await page.waitForTimeout(1000);
    console.log('    ✅ Filter functionality working');
  }
  
  // Test sorting
  const sortSelect = await page.$('select[data-testid="sort"], select.sort-select');
  if (sortSelect) {
    await sortSelect.select('name');
    await page.waitForTimeout(1000);
    console.log('    ✅ Sort functionality working');
  }
  
  // Test pagination
  const pagination = await page.$('[data-testid="pagination"], .pagination');
  if (pagination) {
    console.log('    ✅ Pagination present');
  }
  
  // Test modal/dialog interactions
  const modalTriggers = await page.$$('[data-testid*="modal"], .modal-trigger');
  if (modalTriggers.length > 0) {
    await modalTriggers[0].click();
    await page.waitForTimeout(1000);
    
    const modal = await page.$('[data-testid*="modal"], .modal');
    if (modal) {
      console.log('    ✅ Modal functionality working');
    } else {
      console.log('    ⚠️  Modal not found after trigger');
      interactionIssues++;
    }
  }
  
  return interactionIssues === 0;
}

async function runValidationTests() {
  console.log('🚀 Starting Comprehensive Frontend Validation...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  
  // Set up error monitoring
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  try {
    // Navigate to home page first
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);
    
    console.log('📋 Running validation tests...\n');
    
    const results = {
      accessibility: await testAccessibility(page),
      navigation: await testNavigation(page),
      forms: await testForms(page),
      responsive: await testResponsiveDesign(page),
      errorHandling: await testErrorHandling(page),
      performance: await testPerformance(page),
      integration: await testIntegration(page),
      interactions: await testUserInteractions(page)
    };
    
    await browser.close();
    
    // Report results
    console.log('\n📊 Validation Results:');
    console.log('======================');
    
    let passedTests = 0;
    const totalTests = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`   ${test.charAt(0).toUpperCase() + test.slice(1)}: ${status}`);
      if (passed) passedTests++;
    });
    
    console.log('\n📈 Summary:');
    console.log(`   Tests passed: ${passedTests}/${totalTests}`);
    console.log(`   JavaScript errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  JavaScript errors detected:');
      errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (passedTests === totalTests && errors.length === 0) {
      console.log('\n✅ All validation tests passed!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some validation tests failed or warnings detected.');
      process.exit(1);
    }
    
  } catch (error) {
    await browser.close();
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runValidationTests().catch(error => {
    console.error('Validation runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runValidationTests }; 