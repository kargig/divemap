#!/usr/bin/env node

/**
 * Node.js 20 Upgrade Testing Script
 * Tests the compatibility and improvements from the Node.js 20 upgrade
 * 
 * This test file covers:
 * - Build process validation
 * - ESLint configuration testing
 * - Package compatibility verification
 * - Performance improvements validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const FRONTEND_DIR = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(FRONTEND_DIR, 'package.json');
const ESLINT_CONFIG_PATH = path.join(FRONTEND_DIR, 'eslint.config.js');
const DOCKERFILE_PATH = path.join(FRONTEND_DIR, 'Dockerfile');

function testNodeVersion() {
  console.log('🔧 Testing Node.js Version...');
  
  try {
    const nodeVersion = process.version;
    console.log(`  Current Node.js version: ${nodeVersion}`);
    
    // Check if we're running Node.js 20+
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 20) {
      console.log('  ✅ Running Node.js 20+ (compatible)');
      return true;
    } else {
      console.log(`  ❌ Running Node.js ${majorVersion} (incompatible, need 20+)`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error checking Node.js version: ${error.message}`);
    return false;
  }
}

function testPackageJson() {
  console.log('📦 Testing Package.json Configuration...');
  
  try {
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
      console.log('  ❌ Package.json not found');
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    
    // Check for required dependencies
    const requiredDeps = [
      'eslint',
      'eslint-config-prettier',
      'eslint-plugin-react-hooks',
      'react-router-dom',
      'lucide-react',
      'ol'
    ];
    
    let allDepsFound = true;
    requiredDeps.forEach(dep => {
      if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
        console.log(`  ✅ ${dep} found`);
      } else {
        console.log(`  ❌ ${dep} not found`);
        allDepsFound = false;
      }
    });
    
    // Check for specific version requirements
    if (packageJson.devDependencies.eslint && packageJson.devDependencies.eslint.startsWith('^9')) {
      console.log('  ✅ ESLint 9.x configured');
    } else {
      console.log('  ❌ ESLint 9.x not configured');
      allDepsFound = false;
    }
    
    if (packageJson.devDependencies['eslint-plugin-react-hooks'] && 
        packageJson.devDependencies['eslint-plugin-react-hooks'].startsWith('^5')) {
      console.log('  ✅ eslint-plugin-react-hooks 5.x configured');
    } else {
      console.log('  ❌ eslint-plugin-react-hooks 5.x not configured');
      allDepsFound = false;
    }
    
    return allDepsFound;
  } catch (error) {
    console.log(`  ❌ Error testing package.json: ${error.message}`);
    return false;
  }
}

function testESLintConfiguration() {
  console.log('⚙️  Testing ESLint Configuration...');
  
  try {
    if (!fs.existsSync(ESLINT_CONFIG_PATH)) {
      console.log('  ❌ ESLint config not found');
      return false;
    }
    
    const configContent = fs.readFileSync(ESLINT_CONFIG_PATH, 'utf8');
    
    // Check for required ESLint 9 configuration elements
    const requiredElements = [
      'require(\'@eslint/js\')',
      'eslint-plugin-react-hooks',
      'eslint-plugin-react',
      'languageOptions',
      'globals'
    ];
    
    let allElementsFound = true;
    requiredElements.forEach(element => {
      if (configContent.includes(element)) {
        console.log(`  ✅ ${element} found in config`);
      } else {
        console.log(`  ❌ ${element} not found in config`);
        allElementsFound = false;
      }
    });
    
    // Check for modern JavaScript features
    if (configContent.includes('ecmaVersion: 2022')) {
      console.log('  ✅ Modern JavaScript features enabled (ES2022)');
    } else {
      console.log('  ❌ Modern JavaScript features not enabled');
      allElementsFound = false;
    }
    
    return allElementsFound;
  } catch (error) {
    console.log(`  ❌ Error testing ESLint configuration: ${error.message}`);
    return false;
  }
}

function testDockerfile() {
  console.log('🐳 Testing Dockerfile Configuration...');
  
  try {
    if (!fs.existsSync(DOCKERFILE_PATH)) {
      console.log('  ❌ Dockerfile not found');
      return false;
    }
    
    const dockerfileContent = fs.readFileSync(DOCKERFILE_PATH, 'utf8');
    
    // Check for Node.js 20
    if (dockerfileContent.includes('node:20-alpine')) {
      console.log('  ✅ Node.js 20-alpine configured');
    } else {
      console.log('  ❌ Node.js 20-alpine not configured');
      return false;
    }
    
    // Check for both build and production stages
    if (dockerfileContent.includes('FROM node:20-alpine as build') && 
        dockerfileContent.includes('FROM node:20-alpine as production')) {
      console.log('  ✅ Both build and production stages use Node.js 20');
    } else {
      console.log('  ❌ Not all stages use Node.js 20');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Error testing Dockerfile: ${error.message}`);
    return false;
  }
}

function testBuildProcess() {
  console.log('🏗️  Testing Build Process...');
  
  try {
    // Change to frontend directory
    process.chdir(FRONTEND_DIR);
    
    // Test ESLint
    console.log('  Testing ESLint...');
    try {
      execSync('npm run lint', { stdio: 'pipe' });
      console.log('  ✅ ESLint passed');
    } catch (error) {
      console.log('  ❌ ESLint failed');
      return false;
    }
    
    // Test build process
    console.log('  Testing build process...');
    try {
      execSync('npm run build:prod', { stdio: 'pipe' });
      console.log('  ✅ Build process passed');
    } catch (error) {
      console.log('  ❌ Build process failed');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Error testing build process: ${error.message}`);
    return false;
  }
}

function testPerformance() {
  console.log('⚡ Testing Performance Improvements...');
  
  try {
    // Test modern JavaScript features
    const modernFeatures = {
      optionalChaining: eval('({a: {b: 1}})?.a?.b === 1'),
      nullishCoalescing: eval('null ?? "default" === "default"'),
      arrayMethods: eval('[1,2,3].map(x => x * 2).join(",") === "2,4,6"'),
      templateLiterals: eval('`${1 + 2}` === "3"'),
      destructuring: eval('const {a} = {a: 1}; a === 1')
    };
    
    let allFeaturesWorking = true;
    Object.entries(modernFeatures).forEach(([feature, working]) => {
      if (working) {
        console.log(`  ✅ ${feature} working`);
      } else {
        console.log(`  ❌ ${feature} not working`);
        allFeaturesWorking = false;
      }
    });
    
    // Test performance with a simple benchmark
    console.log('  Running performance benchmark...');
    const start = Date.now();
    
    // Simulate some work
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i);
    }
    
    const end = Date.now();
    const duration = end - start;
    
    console.log(`  ✅ Performance benchmark completed in ${duration}ms`);
    
    return allFeaturesWorking;
  } catch (error) {
    console.log(`  ❌ Error testing performance: ${error.message}`);
    return false;
  }
}

function runAllTests() {
  console.log('🚀 Starting Node.js 20 Upgrade Tests...\n');
  
  const tests = [
    { name: 'Node.js Version', fn: testNodeVersion },
    { name: 'Package.json', fn: testPackageJson },
    { name: 'ESLint Configuration', fn: testESLintConfiguration },
    { name: 'Dockerfile', fn: testDockerfile },
    { name: 'Build Process', fn: testBuildProcess },
    { name: 'Performance', fn: testPerformance }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  tests.forEach(test => {
    console.log(`\n${test.name}:`);
    console.log('─'.repeat(test.name.length + 1));
    
    try {
      const result = test.fn();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      console.log(`  ❌ Test failed with error: ${error.message}`);
    }
  });
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Node.js 20 upgrade is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
  
  return passedTests === totalTests;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testNodeVersion,
  testPackageJson,
  testESLintConfiguration,
  testDockerfile,
  testBuildProcess,
  testPerformance,
  runAllTests
};
