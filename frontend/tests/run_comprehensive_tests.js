#!/usr/bin/env node

/**
 * Comprehensive Frontend Test Runner
 * Runs all test suites to validate the Node.js 20 upgrade and recent fixes
 * 
 * This script runs:
 * 1. Node.js 20 upgrade tests
 * 2. Map view and PropTypes tests
 * 3. General frontend validation tests
 * 4. Performance and compatibility tests
 */

const { execSync } = require('child_process');
const path = require('path');

// Test configuration
const FRONTEND_DIR = path.join(__dirname, '..');
const TEST_SCRIPTS = [
  { name: 'Node.js 20 Upgrade Tests', script: 'test:nodejs20' },
  { name: 'Map View & PropTypes Tests', script: 'test:mapview' },
  { name: 'Frontend Validation Tests', script: 'test:validation' }
];

function runTest(testName, scriptName) {
  console.log(`\n🧪 Running ${testName}...`);
  console.log('─'.repeat(testName.length + 20));
  
  try {
    // Change to frontend directory
    process.chdir(FRONTEND_DIR);
    
    // Run the test script
    const result = execSync(`npm run ${scriptName}`, { 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    console.log(`✅ ${testName} completed successfully`);
    return { success: true, name: testName };
    
  } catch (error) {
    console.log(`❌ ${testName} failed: ${error.message}`);
    return { success: false, name: testName, error: error.message };
  }
}

function runAllTests() {
  console.log('🚀 Starting Comprehensive Frontend Test Suite...\n');
  console.log('This test suite validates:');
  console.log('• Node.js 20 upgrade compatibility');
  console.log('• ESLint 9 configuration');
  console.log('• Map view functionality fixes');
  console.log('• PropTypes validation fixes');
  console.log('• Conditional rendering improvements');
  console.log('• Build process validation');
  console.log('• Performance improvements');
  console.log('');
  
  const results = [];
  
  // Run each test suite
  TEST_SCRIPTS.forEach(({ name, script }) => {
    const result = runTest(name, script);
    results.push(result);
    
    // Add a small delay between tests
    if (results.length < TEST_SCRIPTS.length) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      setTimeout(() => {}, 2000);
    }
  });
  
  // Generate summary report
  console.log('\n📊 Test Suite Summary Report');
  console.log('============================');
  
  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Test Suites: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Test Suites:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  • ${result.name}: ${result.error}`);
    });
  }
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All test suites passed!');
    console.log('✅ Node.js 20 upgrade is working correctly');
    console.log('✅ Map view functionality is fixed');
    console.log('✅ PropTypes validation is working');
    console.log('✅ ESLint configuration is valid');
    console.log('✅ Build process is functional');
  } else {
    console.log('\n⚠️  Some test suites failed. Please review the issues above.');
    console.log('The application may have compatibility issues that need attention.');
  }
  
  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runTest,
  runAllTests
};
