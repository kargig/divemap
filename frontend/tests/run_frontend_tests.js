#!/usr/bin/env node

/**
 * Frontend Test Runner
 * Executes frontend test suites from within the frontend directory
 */

const { spawn } = require('child_process');
const path = require('path');

const FRONTEND_TEST_SCRIPTS = [
  {
    name: 'Frontend Tests',
    script: 'tests/test_frontend.js',
    description: 'Tests frontend pages, components, and user interactions'
  },
  {
    name: 'Frontend Validation',
    script: 'tests/validate_frontend.js',
    description: 'Tests accessibility, performance, and integration'
  }
];

async function runTest(scriptPath, testName) {
  return new Promise((resolve) => {
    console.log(`\n🚀 Running ${testName}...`);
    console.log('='.repeat(50));

    const startTime = Date.now();
    const child = spawn('node', [scriptPath], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0;

      console.log(`\n${'='.repeat(50)}`);
      console.log(`${success ? '✅' : '❌'} ${testName} ${success ? 'PASSED' : 'FAILED'} (${duration}ms)`);

      resolve({
        name: testName,
        success,
        code,
        duration,
        output,
        errorOutput
      });
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.log(`\n${'='.repeat(50)}`);
      console.log(`❌ ${testName} ERROR: ${error.message} (${duration}ms)`);

      resolve({
        name: testName,
        success: false,
        code: -1,
        duration,
        output,
        errorOutput: error.message
      });
    });
  });
}

async function checkFrontendService() {
  console.log('🔍 Checking frontend service availability...\n');

  const http = require('http');

  function makeRequest(url) {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        resolve({ statusCode: res.statusCode, available: true });
      });

      req.on('error', () => {
        resolve({ statusCode: 0, available: false });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ statusCode: 0, available: false });
      });
    });
  }

  try {
    const result = await makeRequest('http://localhost:3000');
    if (result.available && result.statusCode === 200) {
      console.log(`✅ Frontend: Available (${result.statusCode})`);
      return true;
    } else {
      console.log(`❌ Frontend: Not available (${result.statusCode})`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Frontend: Error - ${error.message}`);
    return false;
  }
}

async function runFrontendTests() {
  console.log('🚀 Starting Frontend Test Suite...\n');

  // Check if frontend service is available
  const frontendAvailable = await checkFrontendService();

  if (!frontendAvailable) {
    console.log('\n⚠️  Frontend service is not available.');
    console.log('   Please start the frontend:');
    console.log('   npm start');
    console.log('\n   Continue anyway? (y/N)');
    console.log('   Continuing with tests...\n');
  }

  const results = [];
  let totalDuration = 0;

  // Run each frontend test suite
  for (const test of FRONTEND_TEST_SCRIPTS) {
    const scriptPath = path.join(process.cwd(), test.script);

    try {
      const result = await runTest(scriptPath, test.name);
      results.push(result);
      totalDuration += result.duration;
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        code: -1,
        duration: 0,
        output: '',
        errorOutput: error.message
      });
    }
  }

  // Generate report
  console.log('\n📊 FRONTEND TEST REPORT');
  console.log('='.repeat(50));

  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;

  console.log(`\n📈 Results:`);
  console.log(`   Tests executed: ${totalTests}`);
  console.log(`   Tests passed: ${passedTests}`);
  console.log(`   Tests failed: ${totalTests - passedTests}`);
  console.log(`   Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log(`   Total duration: ${totalDuration}ms`);

  console.log(`\n📋 Detailed Results:`);
  results.forEach(result => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const duration = `${result.duration}ms`;
    console.log(`   ${result.name}: ${status} (${duration})`);

    if (!result.success && result.errorOutput) {
      console.log(`      Error: ${result.errorOutput}`);
    }
  });

  // Summary
  console.log(`\n📝 Summary:`);
  if (passedTests === totalTests) {
    console.log('   🎉 All frontend tests passed!');
    console.log('   ✅ Frontend functionality is operational');
    console.log('   ✅ User interactions work correctly');
    console.log('   ✅ Accessibility standards are met');
    console.log('   ✅ Performance is acceptable');
  } else {
    console.log('   ⚠️  Some frontend tests failed.');
    console.log('   🔧 Recommendations:');

    const failedTests = results.filter(r => !r.success);
    failedTests.forEach(test => {
      console.log(`      - Review ${test.name} for issues`);
    });

    if (!frontendAvailable) {
      console.log('      - Ensure frontend is running on port 3000');
    }

    console.log('      - Check browser console for JavaScript errors');
    console.log('      - Test user interactions manually');
    console.log('      - Verify responsive design on different devices');
  }

  // Exit with appropriate code
  if (passedTests === totalTests) {
    console.log('\n✅ All frontend tests completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Some frontend tests failed. Please address the issues.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Frontend Test Runner');
  console.log('');
  console.log('Usage: node run_frontend_tests.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --verbose, -v  Show detailed output');
  console.log('');
  console.log('This script runs frontend test suites:');
  FRONTEND_TEST_SCRIPTS.forEach(test => {
    console.log(`  - ${test.name}: ${test.description}`);
  });
  console.log('');
  process.exit(0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runFrontendTests().catch(error => {
    console.error('Frontend test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runFrontendTests };