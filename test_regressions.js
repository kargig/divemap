#!/usr/bin/env node

/**
 * Regression Testing Script
 * Tests for common frontend issues and data type problems
 */

const http = require('http');

const BACKEND_URL = 'http://localhost:8000';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testDataTypes() {
  console.log('🔍 Testing Data Types and Common Issues...\n');
  
  const tests = [
    {
      name: 'Diving Centers Data Types',
      url: '/api/v1/diving-centers/',
      test: (data) => {
        if (!Array.isArray(data)) {
          throw new Error('Expected array of diving centers');
        }
        
        if (data.length === 0) {
          console.log('  ⚠️  No diving centers found (this is OK for empty DB)');
          return;
        }
        
        const center = data[0];
        
        // Test latitude/longitude types
        if (typeof center.latitude !== 'string') {
          throw new Error(`Expected latitude to be string, got ${typeof center.latitude}`);
        }
        if (typeof center.longitude !== 'string') {
          throw new Error(`Expected longitude to be string, got ${typeof center.longitude}`);
        }
        
        // Test numeric conversion
        const latNum = Number(center.latitude);
        const lonNum = Number(center.longitude);
        
        if (isNaN(latNum)) {
          throw new Error(`Cannot convert latitude "${center.latitude}" to number`);
        }
        if (isNaN(lonNum)) {
          throw new Error(`Cannot convert longitude "${center.longitude}" to number`);
        }
        
        console.log(`  ✅ Latitude: ${center.latitude} (string) -> ${latNum} (number)`);
        console.log(`  ✅ Longitude: ${center.longitude} (string) -> ${lonNum} (number)`);
        
        // Test rating types
        if (center.average_rating !== null && typeof center.average_rating !== 'number') {
          throw new Error(`Expected average_rating to be number or null, got ${typeof center.average_rating}`);
        }
        
        if (center.average_rating !== null) {
          console.log(`  ✅ Average Rating: ${center.average_rating} (number)`);
        } else {
          console.log(`  ✅ Average Rating: null (no ratings yet)`);
        }
      }
    },
    {
      name: 'Dive Sites Data Types',
      url: '/api/v1/dive-sites/',
      test: (data) => {
        if (!Array.isArray(data)) {
          throw new Error('Expected array of dive sites');
        }
        
        if (data.length === 0) {
          console.log('  ⚠️  No dive sites found (this is OK for empty DB)');
          return;
        }
        
        const site = data[0];
        
        // Test latitude/longitude types
        if (typeof site.latitude !== 'string') {
          throw new Error(`Expected latitude to be string, got ${typeof site.latitude}`);
        }
        if (typeof site.longitude !== 'string') {
          throw new Error(`Expected longitude to be string, got ${typeof site.longitude}`);
        }
        
        // Test numeric conversion
        const latNum = Number(site.latitude);
        const lonNum = Number(site.longitude);
        
        if (isNaN(latNum)) {
          throw new Error(`Cannot convert latitude "${site.latitude}" to number`);
        }
        if (isNaN(lonNum)) {
          throw new Error(`Cannot convert longitude "${site.longitude}" to number`);
        }
        
        console.log(`  ✅ Latitude: ${site.latitude} (string) -> ${latNum} (number)`);
        console.log(`  ✅ Longitude: ${site.longitude} (string) -> ${lonNum} (number)`);
        
        // Test rating types
        if (site.average_rating !== null && typeof site.average_rating !== 'number') {
          throw new Error(`Expected average_rating to be number or null, got ${typeof site.average_rating}`);
        }
        
        if (site.average_rating !== null) {
          console.log(`  ✅ Average Rating: ${site.average_rating} (number)`);
        } else {
          console.log(`  ✅ Average Rating: null (no ratings yet)`);
        }
      }
    }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const response = await makeRequest(`${BACKEND_URL}${test.url}`);
      
      if (response.statusCode !== 200) {
        throw new Error(`API returned status ${response.statusCode}`);
      }
      
      const data = JSON.parse(response.data);
      test.test(data);
      console.log(`  ✅ ${test.name} - PASSED\n`);
      passedTests++;
      
    } catch (error) {
      console.log(`  ❌ ${test.name} - FAILED: ${error.message}\n`);
    }
  }
  
  console.log(`📊 Data Type Tests: ${passedTests}/${totalTests} passed`);
  return passedTests === totalTests;
}

async function testAPIEndpoints() {
  console.log('🔍 Testing API Endpoints...\n');
  
  const endpoints = [
    '/api/v1/dive-sites/',
    '/api/v1/diving-centers/',
    '/api/v1/dive-sites/1',
    '/api/v1/diving-centers/1',
    '/api/v1/dive-sites/1/media',
    '/api/v1/diving-centers/1/gear-rental'
  ];
  
  let workingEndpoints = 0;
  const totalEndpoints = endpoints.length;
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${BACKEND_URL}${endpoint}`);
      if (response.statusCode === 200) {
        console.log(`  ✅ ${endpoint} - OK`);
        workingEndpoints++;
      } else {
        console.log(`  ❌ ${endpoint} - Status ${response.statusCode}`);
      }
    } catch (error) {
      console.log(`  ❌ ${endpoint} - Error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 API Endpoints: ${workingEndpoints}/${totalEndpoints} working`);
  return workingEndpoints === totalEndpoints;
}

async function runRegressionTests() {
  console.log('🚀 Starting Regression Tests...\n');
  
  const dataTypesOk = await testDataTypes();
  const endpointsOk = await testAPIEndpoints();
  
  console.log('\n📈 Regression Test Summary:');
  console.log(`   Data Types: ${dataTypesOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   API Endpoints: ${endpointsOk ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (dataTypesOk && endpointsOk) {
    console.log('\n✅ All regression tests passed!');
    console.log('   No data type issues detected.');
    console.log('   All API endpoints are working.');
    process.exit(0);
  } else {
    console.log('\n❌ Some regression tests failed!');
    console.log('   Please check the issues above.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runRegressionTests().catch(error => {
    console.error('Regression tests failed:', error);
    process.exit(1);
  });
}

module.exports = { runRegressionTests }; 