#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Executes all test suites and provides unified reporting
 */

const { spawn } = require('child_process');
const path = require('path');

const TEST_SCRIPTS = [
  {
    name: 'Frontend Tests',
    script: 'frontend/tests/test_frontend.js',
    description: 'Tests frontend pages, components, and user interactions'
  },
  {
    name: 'Regression Tests',
    script: 'frontend/tests/test_regressions.js',
    description: 'Tests API endpoints, data types, and edge cases'
  },
  {
    name: 'Frontend Validation',
    script: 'frontend/tests/validate_frontend.js',
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

async function checkServices() {
  console.log('🔍 Checking service availability...\n');

  const services = [
    { name: 'Frontend', url: 'http://localhost' },
    { name: 'Backend', url: 'http://localhost:8000' }
  ];

  const http = require('http');
  const https = require('https');

  function makeRequest(url) {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, (res) => {
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

  let allServicesAvailable = true;

  for (const service of services) {
    try {
      const result = await makeRequest(service.url);
      if (result.available && result.statusCode === 200) {
        console.log(`✅ ${service.name}: Available (${result.statusCode})`);
      } else {
        console.log(`❌ ${service.name}: Not available (${result.statusCode})`);
        allServicesAvailable = false;
      }
    } catch (error) {
      console.log(`❌ ${service.name}: Error - ${error.message}`);
      allServicesAvailable = false;
    }
  }

  return allServicesAvailable;
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Test Suite...\n');

  // Check if services are available
  const servicesAvailable = await checkServices();

  if (!servicesAvailable) {
    console.log('\n⚠️  Some services are not available. Tests may fail.');
    console.log('   Please ensure frontend and backend are running:');
    console.log('   - Frontend: http://localhost');
    console.log('   - Backend: http://localhost:8000');
    console.log('\n   Continue anyway? (y/N)');

    // For automated runs, continue anyway
    console.log('   Continuing with tests...\n');
  }

  const results = [];
  let totalDuration = 0;

  // Run each test suite
  for (const test of TEST_SCRIPTS) {
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

  // Generate comprehensive report
  console.log('\n📊 COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(60));

  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;

  console.log(`\n📈 Overall Results:`);
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

  // Summary and recommendations
  console.log(`\n📝 Summary:`);
  if (passedTests === totalTests) {
    console.log('   🎉 All tests passed! Your application is working correctly.');
    console.log('   ✅ Frontend functionality is operational');
    console.log('   ✅ Backend APIs are responding properly');
    console.log('   ✅ Data types are consistent');
    console.log('   ✅ User interactions work as expected');
    console.log('   ✅ Accessibility standards are met');
    console.log('   ✅ Performance is acceptable');
  } else {
    console.log('   ⚠️  Some tests failed. Please review the issues above.');
    console.log('   🔧 Recommendations:');

    const failedTests = results.filter(r => !r.success);
    failedTests.forEach(test => {
      console.log(`      - Review ${test.name} for issues`);
    });

    if (!servicesAvailable) {
      console.log('      - Ensure all services are running');
    }

    console.log('      - Check console output for specific errors');
    console.log('      - Verify API endpoints are accessible');
    console.log('      - Test user interactions manually');
  }

  // Exit with appropriate code
  if (passedTests === totalTests) {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please address the issues.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Comprehensive Test Runner');
  console.log('');
  console.log('Usage: node run_all_tests.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --verbose, -v  Show detailed output');
  console.log('');
  console.log('This script runs all test suites:');
  TEST_SCRIPTS.forEach(test => {
    console.log(`  - ${test.name}: ${test.description}`);
  });
  console.log('');
  console.log('Docker-Based Testing:');
  console.log('  For Docker-based testing, use:');
  console.log('    docker build -f Dockerfile.dev -t divemap_frontend_test .');
  console.log('    docker run divemap_frontend_test npm run test:frontend');
  console.log('    docker run divemap_frontend_test npm run test:validation');
  console.log('    docker run divemap_frontend_test npm run test:e2e');
  console.log('');
  process.exit(0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };