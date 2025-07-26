#!/usr/bin/env node

/**
 * Regression Testing Script
 * Tests for common frontend issues and data type problems
 */

const http = require('http');
const https = require('https');
const BACKEND_URL = 'http://localhost:8000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'adminpassword';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function loginAndGetToken() {
  const url = `${BACKEND_URL}/api/v1/auth/login`;
  const body = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    body
  };
  const response = await makeRequest(url, options);
  if (response.statusCode !== 200) throw new Error('Login failed');
  const data = JSON.parse(response.data);
  return data.access_token;
}

function isLikelyFastAPIError(obj) {
  return obj && typeof obj === 'object' && Array.isArray(obj) && obj.length > 0 && obj[0].msg && obj[0].loc;
}

function isLikelyErrorObject(obj) {
  // FastAPI or other error object
  if (!obj || typeof obj !== 'object') return false;
  if (obj.detail && (typeof obj.detail === 'string' || Array.isArray(obj.detail))) return true;
  if (obj.msg && obj.type) return true;
  if (obj.type && obj.loc && obj.msg) return true;
  if (Array.isArray(obj) && obj[0] && obj[0].msg && obj[0].loc) return true;
  // Check for objects that would cause React "Objects are not valid as a React child" error
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && !obj.id && !obj.name && !obj.message) return true;
  return false;
}

async function testRateDiveSite(diveSiteId, token) {
  const url = `${BACKEND_URL}/api/v1/dive-sites/${diveSiteId}/rate`;
  const body = JSON.stringify({ score: 8 });
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body
  };
  const response = await makeRequest(url, options);
  let data;
  try { data = JSON.parse(response.data); } catch { data = response.data; }
  if (response.statusCode === 422) {
    throw new Error(`422 Unprocessable Entity: ${JSON.stringify(data)}`);
  }
  if (isLikelyErrorObject(data)) {
    throw new Error(`Rating dive site returned error object: ${JSON.stringify(data)}`);
  }
  if (typeof data === 'object' && !Array.isArray(data) && !data.id) {
    throw new Error(`Rating dive site returned object that may cause React error: ${JSON.stringify(data)}`);
  }
  return response.statusCode;
}

async function testAddDiveSite(token) {
  const url = `${BACKEND_URL}/api/v1/dive-sites/`;
  const body = JSON.stringify({
    name: 'Test Dive Site',
    description: 'Test description',
    latitude: '10.0000',
    longitude: '20.0000',
    access_instructions: 'Test access',
    difficulty_level: 'beginner'
  });
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body
  };
  const response = await makeRequest(url, options);
  let data;
  try { data = JSON.parse(response.data); } catch { data = response.data; }
  if (response.statusCode === 422) {
    throw new Error(`422 Unprocessable Entity: ${JSON.stringify(data)}`);
  }
  if (isLikelyErrorObject(data)) {
    throw new Error(`Adding dive site returned error object: ${JSON.stringify(data)}`);
  }
  if (typeof data === 'object' && !Array.isArray(data) && !data.id) {
    throw new Error(`Adding dive site returned object that may cause React error: ${JSON.stringify(data)}`);
  }
  return response.statusCode;
}

async function testModifyDivingCenter(centerId, token) {
  const url = `${BACKEND_URL}/api/v1/diving-centers/${centerId}`;
  const body = JSON.stringify({
    name: 'Updated Center',
    description: 'Updated description',
    latitude: '11.0000',
    longitude: '21.0000',
    email: 'center@example.com',
    phone: '1234567890',
    website: 'https://center.example.com'
  });
  const options = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body
  };
  const response = await makeRequest(url, options);
  let data;
  try { data = JSON.parse(response.data); } catch { data = response.data; }
  if (response.statusCode === 422) {
    throw new Error(`422 Unprocessable Entity: ${JSON.stringify(data)}`);
  }
  if (isLikelyErrorObject(data)) {
    throw new Error(`Modifying diving center returned error object: ${JSON.stringify(data)}`);
  }
  if (typeof data === 'object' && !Array.isArray(data) && !data.id) {
    throw new Error(`Modifying diving center returned object that may cause React error: ${JSON.stringify(data)}`);
  }
  return response.statusCode;
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

async function runUserActionTests() {
  console.log('\n\ud83d\udcdd Simulating user actions (anonymous and authenticated)...');
  let token = null;
  let errors = 0;
  // Try rating a dive site (anonymous)
  try {
    await testRateDiveSite(1, null);
    console.log('  \u2705 Anonymous: Rating dive site did not return error object');
  } catch (e) {
    console.log('  \u274c Anonymous: ' + e.message);
    errors++;
  }
  // Try adding a dive site (anonymous)
  try {
    await testAddDiveSite(null);
    console.log('  \u2705 Anonymous: Adding dive site did not return error object');
  } catch (e) {
    console.log('  \u274c Anonymous: ' + e.message);
    errors++;
  }
  // Try modifying a diving center (anonymous)
  try {
    await testModifyDivingCenter(1, null);
    console.log('  \u2705 Anonymous: Modifying diving center did not return error object');
  } catch (e) {
    console.log('  \u274c Anonymous: ' + e.message);
    errors++;
  }
  // Login as admin
  try {
    token = await loginAndGetToken();
    console.log('  \u2705 Login as admin successful');
  } catch (e) {
    console.log('  \u274c Login failed: ' + e.message);
    errors++;
  }
  // Try rating a dive site (authenticated)
  try {
    await testRateDiveSite(1, token);
    console.log('  \u2705 Authenticated: Rating dive site did not return error object');
  } catch (e) {
    console.log('  \u274c Authenticated: ' + e.message);
    errors++;
  }
  // Try adding a dive site (authenticated)
  try {
    await testAddDiveSite(token);
    console.log('  \u2705 Authenticated: Adding dive site did not return error object');
  } catch (e) {
    console.log('  \u274c Authenticated: ' + e.message);
    errors++;
  }
  // Try modifying a diving center (authenticated)
  try {
    await testModifyDivingCenter(1, token);
    console.log('  \u2705 Authenticated: Modifying diving center did not return error object');
  } catch (e) {
    console.log('  \u274c Authenticated: ' + e.message);
    errors++;
  }
  if (errors > 0) {
    console.log(`\n\u274c User action simulation found ${errors} issues!`);
    process.exit(1);
  } else {
    console.log('\n\u2705 All user action simulations passed!');
  }
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
  (async () => {
    await runRegressionTests();
    await runUserActionTests();
  })().catch(error => {
    console.error('Regression tests failed:', error);
    process.exit(1);
  });
}

module.exports = { runRegressionTests, runUserActionTests }; 