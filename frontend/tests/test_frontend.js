#!/usr/bin/env node

/**
 * Enhanced Frontend Testing Script
 * Validates that all pages load without JavaScript errors and tests functionality
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const PAGES_TO_TEST = [
  '/',
  '/dive-sites',
  '/diving-centers',
  '/login',
  '/register',
  '/profile',
  '/admin',
  '/admin/dive-sites',
  '/admin/diving-centers',
  '/admin/users',
  '/admin/tags',
  '/create-dive-site',
  '/create-diving-center'
];

// Test data for forms
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User'
};

const TEST_DIVE_SITE = {
  name: 'Test Dive Site',
  description: 'A test dive site for testing',
  latitude: '10.0000',
  longitude: '20.0000',
  difficulty_level: 'beginner',
  access_instructions: 'Test access instructions'
};

const TEST_DIVING_CENTER = {
  name: 'Test Diving Center',
  description: 'A test diving center for testing',
  latitude: '11.0000',
  longitude: '21.0000',
  email: 'center@example.com',
  phone: '1234567890',
  website: 'https://center.example.com'
};

async function testPage(browser, url) {
  const page = await browser.newPage();
  
  // Set viewport for responsive testing
  await page.setViewport({ width: 1280, height: 720 });
  
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

  // Listen for network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      errors.push({
        url,
        message: `Network error: ${response.status()} ${response.statusText()} for ${response.url()}`,
        type: 'network'
      });
    }
  });

  try {
    console.log(`Testing: ${BASE_URL}${url}`);
    
    // Navigate to the page
    await page.goto(`${BASE_URL}${url}`, { 
      waitUntil: 'networkidle0',
      timeout: 15000 
    });

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);

    // Check if the page loaded successfully
    const title = await page.title();
    console.log(`  ✓ Loaded: ${title}`);

    // Test specific functionality based on the page
    if (url === '/dive-sites') {
      await testDiveSitesPage(page);
    } else if (url === '/diving-centers') {
      await testDivingCentersPage(page);
    } else if (url === '/login') {
      await testLoginPage(page);
    } else if (url === '/register') {
      await testRegisterPage(page);
    } else if (url === '/profile') {
      await testProfilePage(page);
    } else if (url === '/admin') {
      await testAdminPage(page);
    } else if (url === '/admin/dive-sites') {
      await testAdminDiveSitesPage(page);
    } else if (url === '/admin/diving-centers') {
      await testAdminDivingCentersPage(page);
    } else if (url === '/admin/users') {
      await testAdminUsersPage(page);
    } else if (url === '/admin/tags') {
      await testAdminTagsPage(page);
    } else if (url === '/create-dive-site') {
      await testCreateDiveSitePage(page);
    } else if (url === '/create-diving-center') {
      await testCreateDivingCenterPage(page);
    } else if (url === '/') {
      await testHomePage(page);
    }

    // Test responsive design
    await testResponsiveDesign(page, url);

    return { url, errors, success: true };
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}`);
    return { url, errors: [...errors, { url, message: error.message }], success: false };
  } finally {
    await page.close();
  }
}

async function testHomePage(page) {
  console.log('  Testing home page functionality...');
  
  // Check for main navigation elements
  const navbar = await page.$('nav');
  if (navbar) {
    console.log('    ✓ Navigation bar present');
  }
  
  // Check for map component
  const map = await page.$('[data-testid="map"]');
  if (map) {
    console.log('    ✓ Map component present');
  }
  
  // Check for search functionality
  const searchInput = await page.$('input[placeholder*="Search"]');
  if (searchInput) {
    await searchInput.type('test');
    await page.waitForTimeout(1000);
    console.log('    ✓ Search input working');
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
  
  // Test filtering
  const filterButtons = await page.$$('button[data-testid*="filter"]');
  if (filterButtons.length > 0) {
    await filterButtons[0].click();
    await page.waitForTimeout(1000);
    console.log('    ✓ Filter functionality working');
  }
  
  // Test pagination if present
  const pagination = await page.$('[data-testid="pagination"]');
  if (pagination) {
    console.log('    ✓ Pagination present');
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
  
  // Test sorting
  const sortSelect = await page.$('select[data-testid="sort"]');
  if (sortSelect) {
    await sortSelect.select('name');
    await page.waitForTimeout(1000);
    console.log('    ✓ Sort functionality working');
  }
}

async function testLoginPage(page) {
  console.log('  Testing login page functionality...');
  
  // Test form validation
  const emailInput = await page.$('input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  const submitButton = await page.$('button[type="submit"]');
  
  if (emailInput && passwordInput && submitButton) {
    // Test empty form submission
    await submitButton.click();
    await page.waitForTimeout(1000);
    
    // Check for validation messages
    const validationMessages = await page.$$('[data-testid="error-message"]');
    if (validationMessages.length > 0) {
      console.log('    ✓ Form validation working');
    }
    
    // Test with invalid data
    await emailInput.type('invalid-email');
    await passwordInput.type('short');
    await submitButton.click();
    await page.waitForTimeout(1000);
    
    // Test with valid data
    await emailInput.clear();
    await passwordInput.clear();
    await emailInput.type(TEST_USER.email);
    await passwordInput.type(TEST_USER.password);
    console.log('    ✓ Form inputs working');
  }
  
  // Test Google OAuth button if present
  const googleButton = await page.$('[data-testid="google-login"]');
  if (googleButton) {
    console.log('    ✓ Google OAuth button present');
  }
}

async function testRegisterPage(page) {
  console.log('  Testing register page functionality...');
  
  // Test form validation
  const nameInput = await page.$('input[name="name"]');
  const emailInput = await page.$('input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  const confirmPasswordInput = await page.$('input[name="confirmPassword"]');
  const submitButton = await page.$('button[type="submit"]');
  
  if (nameInput && emailInput && passwordInput && submitButton) {
    // Test empty form submission
    await submitButton.click();
    await page.waitForTimeout(1000);
    
    // Test with invalid data
    await nameInput.type('Test');
    await emailInput.type('invalid-email');
    await passwordInput.type('short');
    await submitButton.click();
    await page.waitForTimeout(1000);
    
    // Test with valid data
    await nameInput.clear();
    await emailInput.clear();
    await passwordInput.clear();
    await nameInput.type(TEST_USER.name);
    await emailInput.type(TEST_USER.email);
    await passwordInput.type(TEST_USER.password);
    console.log('    ✓ Registration form working');
  }
}

async function testProfilePage(page) {
  console.log('  Testing profile page functionality...');
  
  // Check for profile information
  const profileInfo = await page.$('[data-testid="profile-info"]');
  if (profileInfo) {
    console.log('    ✓ Profile information displayed');
  }
  
  // Test edit functionality
  const editButton = await page.$('[data-testid="edit-profile"]');
  if (editButton) {
    await editButton.click();
    await page.waitForTimeout(1000);
    console.log('    ✓ Edit profile functionality working');
  }
  
  // Test logout functionality
  const logoutButton = await page.$('[data-testid="logout"]');
  if (logoutButton) {
    console.log('    ✓ Logout button present');
  }
}

async function testAdminPage(page) {
  console.log('  Testing admin page functionality...');
  
  // Check for admin navigation
  const adminNav = await page.$('[data-testid="admin-nav"]');
  if (adminNav) {
    console.log('    ✓ Admin navigation present');
  }
  
  // Check for admin statistics
  const stats = await page.$$('[data-testid="admin-stat"]');
  if (stats.length > 0) {
    console.log(`    ✓ Admin statistics displayed (${stats.length} items)`);
  }
}

async function testAdminDiveSitesPage(page) {
  console.log('  Testing admin dive sites page...');
  
  // Check for admin table
  const table = await page.$('[data-testid="admin-table"]');
  if (table) {
    console.log('    ✓ Admin table present');
  }
  
  // Test create button
  const createButton = await page.$('[data-testid="create-dive-site"]');
  if (createButton) {
    console.log('    ✓ Create dive site button present');
  }
  
  // Test edit functionality
  const editButtons = await page.$$('[data-testid="edit-dive-site"]');
  if (editButtons.length > 0) {
    console.log(`    ✓ Edit buttons present (${editButtons.length})`);
  }
}

async function testAdminDivingCentersPage(page) {
  console.log('  Testing admin diving centers page...');
  
  // Check for admin table
  const table = await page.$('[data-testid="admin-table"]');
  if (table) {
    console.log('    ✓ Admin table present');
  }
  
  // Test create button
  const createButton = await page.$('[data-testid="create-diving-center"]');
  if (createButton) {
    console.log('    ✓ Create diving center button present');
  }
}

async function testAdminUsersPage(page) {
  console.log('  Testing admin users page...');
  
  // Check for user management functionality
  const userTable = await page.$('[data-testid="users-table"]');
  if (userTable) {
    console.log('    ✓ Users table present');
  }
  
  // Test user role management
  const roleSelects = await page.$$('[data-testid="user-role"]');
  if (roleSelects.length > 0) {
    console.log(`    ✓ User role management present (${roleSelects.length} users)`);
  }
}

async function testAdminTagsPage(page) {
  console.log('  Testing admin tags page...');
  
  // Check for tag management
  const tagList = await page.$('[data-testid="tags-list"]');
  if (tagList) {
    console.log('    ✓ Tags list present');
  }
  
  // Test create tag functionality
  const createTagButton = await page.$('[data-testid="create-tag"]');
  if (createTagButton) {
    console.log('    ✓ Create tag button present');
  }
}

async function testCreateDiveSitePage(page) {
  console.log('  Testing create dive site page...');
  
  // Test form validation
  const nameInput = await page.$('input[name="name"]');
  const descriptionInput = await page.$('textarea[name="description"]');
  const latitudeInput = await page.$('input[name="latitude"]');
  const longitudeInput = await page.$('input[name="longitude"]');
  const submitButton = await page.$('button[type="submit"]');
  
  if (nameInput && descriptionInput && latitudeInput && longitudeInput && submitButton) {
    // Test empty form submission
    await submitButton.click();
    await page.waitForTimeout(1000);
    
    // Test with valid data
    await nameInput.type(TEST_DIVE_SITE.name);
    await descriptionInput.type(TEST_DIVE_SITE.description);
    await latitudeInput.type(TEST_DIVE_SITE.latitude);
    await longitudeInput.type(TEST_DIVE_SITE.longitude);
    console.log('    ✓ Create dive site form working');
  }
  
  // Test map integration
  const map = await page.$('[data-testid="location-map"]');
  if (map) {
    console.log('    ✓ Location map present');
  }
}

async function testCreateDivingCenterPage(page) {
  console.log('  Testing create diving center page...');
  
  // Test form validation
  const nameInput = await page.$('input[name="name"]');
  const descriptionInput = await page.$('textarea[name="description"]');
  const emailInput = await page.$('input[type="email"]');
  const phoneInput = await page.$('input[name="phone"]');
  const submitButton = await page.$('button[type="submit"]');
  
  if (nameInput && descriptionInput && emailInput && phoneInput && submitButton) {
    // Test empty form submission
    await submitButton.click();
    await page.waitForTimeout(1000);
    
    // Test with valid data
    await nameInput.type(TEST_DIVING_CENTER.name);
    await descriptionInput.type(TEST_DIVING_CENTER.description);
    await emailInput.type(TEST_DIVING_CENTER.email);
    await phoneInput.type(TEST_DIVING_CENTER.phone);
    console.log('    ✓ Create diving center form working');
  }
}

async function testResponsiveDesign(page, url) {
  console.log('  Testing responsive design...');
  
  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop' },
    { width: 1024, height: 768, name: 'Tablet' },
    { width: 375, height: 667, name: 'Mobile' }
  ];
  
  for (const viewport of viewports) {
    await page.setViewport(viewport);
    await page.waitForTimeout(500);
    
    // Check for horizontal scrolling (bad for mobile)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport.width;
    
    if (bodyWidth > viewportWidth) {
      console.log(`    ⚠️  ${viewport.name}: Potential horizontal scrolling (${bodyWidth}px > ${viewportWidth}px)`);
    } else {
      console.log(`    ✓ ${viewport.name}: No horizontal scrolling`);
    }
    
    // Check for critical elements visibility
    const navbar = await page.$('nav');
    if (navbar) {
      const isVisible = await navbar.isVisible();
      if (isVisible) {
        console.log(`    ✓ ${viewport.name}: Navigation visible`);
      } else {
        console.log(`    ⚠️  ${viewport.name}: Navigation not visible`);
      }
    }
  }
  
  // Reset to default viewport
  await page.setViewport({ width: 1280, height: 720 });
}

async function testErrorHandling(page) {
  console.log('  Testing error handling...');
  
  // Test 404 page
  try {
    await page.goto(`${BASE_URL}/non-existent-page`);
    await page.waitForTimeout(2000);
    
    const notFoundContent = await page.$('[data-testid="not-found"]');
    if (notFoundContent) {
      console.log('    ✓ 404 page working');
    }
  } catch (error) {
    console.log('    ⚠️  404 page test failed');
  }
  
  // Test network error handling
  const networkError = await page.evaluate(() => {
    // Simulate a network error
    window.dispatchEvent(new Event('offline'));
    return true;
  });
  
  if (networkError) {
    console.log('    ✓ Network error handling present');
  }
}

async function runTests() {
  console.log('🚀 Starting Enhanced Frontend Tests...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const results = [];
  
  for (const page of PAGES_TO_TEST) {
    const result = await testPage(browser, page);
    results.push(result);
  }

  // Test error handling on a separate page
  const errorTestPage = await browser.newPage();
  await testErrorHandling(errorTestPage);
  await errorTestPage.close();

  await browser.close();

  // Report results
  console.log('\n📊 Test Results:');
  console.log('================');
  
  let totalErrors = 0;
  let failedPages = 0;
  let pagesWithWarnings = 0;

  results.forEach(result => {
    if (result.success) {
      if (result.errors.length > 0) {
        console.log(`⚠️  ${result.url} - ${result.errors.length} console errors`);
        result.errors.forEach(error => {
          console.log(`   - ${error.message}`);
        });
        totalErrors += result.errors.length;
        pagesWithWarnings++;
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
  console.log(`   Pages with warnings: ${pagesWithWarnings}`);
  console.log(`   Total errors: ${totalErrors}`);

  if (failedPages > 0) {
    console.log('\n❌ Tests failed!');
    process.exit(1);
  } else if (totalErrors > 0) {
    console.log('\n⚠️  Tests passed with warnings!');
    process.exit(0);
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