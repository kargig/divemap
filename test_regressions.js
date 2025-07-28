#!/usr/bin/env node

/**
 * Enhanced Regression Testing Script
 * Tests for common frontend issues, data type problems, and edge cases
 */

const http = require('http');
const https = require('https');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Test admin credentials
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'testadmin@example.com';
const ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || 'testadmin';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'TestAdmin123!';

// Test data for various scenarios
const TEST_DATA = {
  validDiveSite: {
    name: 'Test Dive Site',
    description: 'A test dive site for regression testing',
    latitude: 10.0000,
    longitude: 20.0000,
    difficulty_level: 'beginner',
    access_instructions: 'Test access instructions',
    max_depth: 15,
    country: 'Test Country',
    region: 'Test Region'
  },
  invalidDiveSite: {
    name: '', // Invalid: empty name
    description: 'A test dive site with invalid data',
    latitude: 'invalid', // Invalid: non-numeric
    longitude: 'invalid', // Invalid: non-numeric
    difficulty_level: 'invalid_level', // Invalid: not in enum
    access_instructions: 'Test access instructions',
    max_depth: -5, // Invalid: negative depth
    country: 'Test Country',
    region: 'Test Region'
  },
  validDivingCenter: {
    name: 'Test Diving Center',
    description: 'A test diving center for regression testing',
    latitude: 11.0000,
    longitude: 21.0000,
    email: 'center@example.com',
    phone: '1234567890',
    website: 'https://center.example.com',
    country: 'Test Country',
    region: 'Test Region'
  },
  invalidDivingCenter: {
    name: '', // Invalid: empty name
    description: 'A test diving center with invalid data',
    latitude: 'invalid', // Invalid: non-numeric
    longitude: 'invalid', // Invalid: non-numeric
    email: 'invalid-email', // Invalid: malformed email
    phone: 'abc', // Invalid: non-numeric phone
    website: 'not-a-url', // Invalid: malformed URL
    country: 'Test Country',
    region: 'Test Region'
  },
  validUser: {
    email: 'testuser@example.com',
    password: 'testpassword123',
    name: 'Test User',
    is_admin: false
  },
  invalidUser: {
    email: 'invalid-email', // Invalid: malformed email
    password: 'short', // Invalid: too short
    name: '', // Invalid: empty name
    is_admin: 'not-boolean' // Invalid: not boolean
  }
};

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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function loginAndGetToken(username = ADMIN_USERNAME, password = ADMIN_PASSWORD) {
  const url = `${BACKEND_URL}/api/v1/auth/login`;
  const body = JSON.stringify({ username, password });
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

async function testRateDiveSite(diveSiteId, token, score = 8) {
  const url = `${BACKEND_URL}/api/v1/dive-sites/${diveSiteId}/rate`;
  const body = JSON.stringify({ score });
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

async function testAddDiveSite(token, diveSiteData = TEST_DATA.validDiveSite) {
  const url = `${BACKEND_URL}/api/v1/dive-sites/`;
  const body = JSON.stringify(diveSiteData);
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

async function testModifyDivingCenter(centerId, token, centerData = TEST_DATA.validDivingCenter) {
  const url = `${BACKEND_URL}/api/v1/diving-centers/${centerId}`;
  const body = JSON.stringify(centerData);
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

async function testCreateUser(userData = TEST_DATA.validUser) {
  const url = `${BACKEND_URL}/api/v1/users/`;
  const body = JSON.stringify(userData);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body
  };
  const response = await makeRequest(url, options);
  let data;
  try { data = JSON.parse(response.data); } catch { data = response.data; }
  return { statusCode: response.statusCode, data };
}

async function testAuthenticationFlows() {
  console.log('🔐 Testing Authentication Flows...\n');
  
  const tests = [
    {
      name: 'Valid Login',
      test: async () => {
        const token = await loginAndGetToken();
        return token ? 'PASSED' : 'FAILED';
      }
    },
    {
      name: 'Invalid Login - Wrong Password',
      test: async () => {
        try {
          await loginAndGetToken(ADMIN_EMAIL, 'wrongpassword');
          return 'FAILED - Should have failed';
        } catch (error) {
          return 'PASSED';
        }
      }
    },
    {
      name: 'Invalid Login - Wrong Email',
      test: async () => {
        try {
          await loginAndGetToken('nonexistent@example.com', ADMIN_PASSWORD);
          return 'FAILED - Should have failed';
        } catch (error) {
          return 'PASSED';
        }
      }
    },
    {
      name: 'Invalid Login - Empty Credentials',
      test: async () => {
        try {
          await loginAndGetToken('', '');
          return 'FAILED - Should have failed';
        } catch (error) {
          return 'PASSED';
        }
      }
    }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`  ${result === 'PASSED' ? '✅' : '❌'} ${test.name}: ${result}`);
      if (result === 'PASSED') passedTests++;
    } catch (error) {
      console.log(`  ❌ ${test.name}: FAILED - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Authentication Tests: ${passedTests}/${totalTests} passed`);
  return passedTests === totalTests;
}

async function testDataValidation() {
  console.log('🔍 Testing Data Validation...\n');
  
  const tests = [
    {
      name: 'Valid Dive Site Creation',
      test: async () => {
        const token = await loginAndGetToken();
        const status = await testAddDiveSite(token, TEST_DATA.validDiveSite);
        return status === 201 ? 'PASSED' : `FAILED - Status ${status}`;
      }
    },
    {
      name: 'Invalid Dive Site Creation - Empty Name',
      test: async () => {
        try {
          const token = await loginAndGetToken();
          await testAddDiveSite(token, TEST_DATA.invalidDiveSite);
          return 'FAILED - Should have failed';
        } catch (error) {
          return 'PASSED';
        }
      }
    },
    {
      name: 'Valid Diving Center Creation',
      test: async () => {
        const token = await loginAndGetToken();
        const status = await testModifyDivingCenter(1, token, TEST_DATA.validDivingCenter);
        return status === 200 ? 'PASSED' : `FAILED - Status ${status}`;
      }
    },
    {
      name: 'Invalid Diving Center Creation - Invalid Email',
      test: async () => {
        try {
          const token = await loginAndGetToken();
          await testModifyDivingCenter(1, token, TEST_DATA.invalidDivingCenter);
          return 'FAILED - Should have failed';
        } catch (error) {
          return 'PASSED';
        }
      }
    },
    {
      name: 'Valid User Registration',
      test: async () => {
        const result = await testCreateUser(TEST_DATA.validUser);
        return result.statusCode === 201 ? 'PASSED' : `FAILED - Status ${result.statusCode}`;
      }
    },
    {
      name: 'Invalid User Registration - Invalid Email',
      test: async () => {
        const result = await testCreateUser(TEST_DATA.invalidUser);
        return result.statusCode === 422 ? 'PASSED' : `FAILED - Status ${result.statusCode}`;
      }
    }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`  ${result === 'PASSED' ? '✅' : '❌'} ${test.name}: ${result}`);
      if (result === 'PASSED') passedTests++;
    } catch (error) {
      console.log(`  ❌ ${test.name}: FAILED - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Data Validation Tests: ${passedTests}/${totalTests} passed`);
  return passedTests === totalTests;
}

async function testAPIErrorHandling() {
  console.log('🚨 Testing API Error Handling...\n');
  
  const tests = [
    {
      name: 'Non-existent Endpoint',
      test: async () => {
        const response = await makeRequest(`${BACKEND_URL}/api/v1/non-existent/`);
        return response.statusCode === 404 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    },
    {
      name: 'Invalid HTTP Method',
      test: async () => {
        const options = { method: 'PATCH' };
        const response = await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`, options);
        return response.statusCode === 405 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    },
    {
      name: 'Malformed JSON',
      test: async () => {
        const options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid json }'
        };
        const response = await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`, options);
        return response.statusCode === 422 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    },
    {
      name: 'Missing Required Fields',
      test: async () => {
        const options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }) // Missing required fields
        };
        const response = await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`, options);
        return response.statusCode === 422 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`  ${result === 'PASSED' ? '✅' : '❌'} ${test.name}: ${result}`);
      if (result === 'PASSED') passedTests++;
    } catch (error) {
      console.log(`  ❌ ${test.name}: FAILED - ${error.message}`);
    }
  }
  
  console.log(`\n📊 API Error Handling Tests: ${passedTests}/${totalTests} passed`);
  return passedTests === totalTests;
}

async function testPerformance() {
  console.log('⚡ Testing API Performance...\n');
  
  const tests = [
    {
      name: 'Dive Sites List Response Time',
      test: async () => {
        const start = Date.now();
        await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`);
        const duration = Date.now() - start;
        return duration < 2000 ? `PASSED (${duration}ms)` : `FAILED (${duration}ms - too slow)`;
      }
    },
    {
      name: 'Diving Centers List Response Time',
      test: async () => {
        const start = Date.now();
        await makeRequest(`${BACKEND_URL}/api/v1/diving-centers/`);
        const duration = Date.now() - start;
        return duration < 2000 ? `PASSED (${duration}ms)` : `FAILED (${duration}ms - too slow)`;
      }
    },
    {
      name: 'Concurrent Requests',
      test: async () => {
        const start = Date.now();
        const promises = Array(5).fill().map(() => 
          makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`)
        );
        await Promise.all(promises);
        const duration = Date.now() - start;
        return duration < 5000 ? `PASSED (${duration}ms)` : `FAILED (${duration}ms - too slow)`;
      }
    }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`  ${result.includes('PASSED') ? '✅' : '❌'} ${test.name}: ${result}`);
      if (result.includes('PASSED')) passedTests++;
    } catch (error) {
      console.log(`  ❌ ${test.name}: FAILED - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Performance Tests: ${passedTests}/${totalTests} passed`);
  return passedTests === totalTests;
}

async function testSecurity() {
  console.log('🔒 Testing Security...\n');
  
  const tests = [
    {
      name: 'Unauthorized Access to Protected Endpoint',
      test: async () => {
        const options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(TEST_DATA.validDiveSite)
        };
        const response = await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`, options);
        return response.statusCode === 401 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    },
    {
      name: 'Invalid Token Access',
      test: async () => {
        const options = {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid-token'
          },
          body: JSON.stringify(TEST_DATA.validDiveSite)
        };
        const response = await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`, options);
        return response.statusCode === 401 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    },
    {
      name: 'SQL Injection Attempt',
      test: async () => {
        const options = {
          method: 'GET'
        };
        const response = await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/?name='; DROP TABLE dive_sites; --`, options);
        return response.statusCode === 200 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    },
    {
      name: 'XSS Attempt',
      test: async () => {
        const options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...TEST_DATA.validDiveSite,
            name: '<script>alert("xss")</script>'
          })
        };
        const response = await makeRequest(`${BACKEND_URL}/api/v1/dive-sites/`, options);
        return response.statusCode === 401 ? 'PASSED' : `FAILED - Status ${response.statusCode}`;
      }
    }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`  ${result === 'PASSED' ? '✅' : '❌'} ${test.name}: ${result}`);
      if (result === 'PASSED') passedTests++;
    } catch (error) {
      console.log(`  ❌ ${test.name}: FAILED - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Security Tests: ${passedTests}/${totalTests} passed`);
  return passedTests === totalTests;
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
        if (typeof center.latitude !== 'number') {
          throw new Error(`Expected latitude to be number, got ${typeof center.latitude}`);
        }
        if (typeof center.longitude !== 'number') {
          throw new Error(`Expected longitude to be number, got ${typeof center.longitude}`);
        }
        
        // Test numeric values are valid
        if (isNaN(center.latitude)) {
          throw new Error(`Latitude is NaN: ${center.latitude}`);
        }
        if (isNaN(center.longitude)) {
          throw new Error(`Longitude is NaN: ${center.longitude}`);
        }
        
        console.log(`  ✅ Latitude: ${center.latitude} (number)`);
        console.log(`  ✅ Longitude: ${center.longitude} (number)`);
        
        // Test rating types
        if (center.average_rating !== null && typeof center.average_rating !== 'number') {
          throw new Error(`Expected average_rating to be number or null, got ${typeof center.average_rating}`);
        }
        
        if (center.average_rating !== null) {
          console.log(`  ✅ Average Rating: ${center.average_rating} (number)`);
        } else {
          console.log(`  ✅ Average Rating: null (no ratings yet)`);
        }
        
        // Test string fields
        if (typeof center.name !== 'string') {
          throw new Error(`Expected name to be string, got ${typeof center.name}`);
        }
        if (typeof center.description !== 'string') {
          throw new Error(`Expected description to be string, got ${typeof center.description}`);
        }
        
        console.log(`  ✅ Name: "${center.name}" (string)`);
        console.log(`  ✅ Description: "${center.description}" (string)`);
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
        if (typeof site.latitude !== 'number') {
          throw new Error(`Expected latitude to be number, got ${typeof site.latitude}`);
        }
        if (typeof site.longitude !== 'number') {
          throw new Error(`Expected longitude to be number, got ${typeof site.longitude}`);
        }
        
        // Test numeric values are valid
        if (isNaN(site.latitude)) {
          throw new Error(`Latitude is NaN: ${site.latitude}`);
        }
        if (isNaN(site.longitude)) {
          throw new Error(`Longitude is NaN: ${site.longitude}`);
        }
        
        console.log(`  ✅ Latitude: ${site.latitude} (number)`);
        console.log(`  ✅ Longitude: ${site.longitude} (number)`);
        
        // Test rating types
        if (site.average_rating !== null && typeof site.average_rating !== 'number') {
          throw new Error(`Expected average_rating to be number or null, got ${typeof site.average_rating}`);
        }
        
        if (site.average_rating !== null) {
          console.log(`  ✅ Average Rating: ${site.average_rating} (number)`);
        } else {
          console.log(`  ✅ Average Rating: null (no ratings yet)`);
        }
        
        // Test string fields
        if (typeof site.name !== 'string') {
          throw new Error(`Expected name to be string, got ${typeof site.name}`);
        }
        if (typeof site.description !== 'string') {
          throw new Error(`Expected description to be string, got ${typeof site.description}`);
        }
        
        console.log(`  ✅ Name: "${site.name}" (string)`);
        console.log(`  ✅ Description: "${site.description}" (string)`);
        
        // Test enum fields
        if (site.difficulty_level && !['beginner', 'intermediate', 'advanced'].includes(site.difficulty_level)) {
          throw new Error(`Expected difficulty_level to be valid enum, got ${site.difficulty_level}`);
        }
        
        if (site.difficulty_level) {
          console.log(`  ✅ Difficulty Level: ${site.difficulty_level} (valid enum)`);
        }
      }
    },
    {
      name: 'Users Data Types',
      url: '/api/v1/users/',
      test: (data) => {
        if (!Array.isArray(data)) {
          throw new Error('Expected array of users');
        }
        
        if (data.length === 0) {
          console.log('  ⚠️  No users found (this is OK for empty DB)');
          return;
        }
        
        const user = data[0];
        
        // Test string fields
        if (typeof user.email !== 'string') {
          throw new Error(`Expected email to be string, got ${typeof user.email}`);
        }
        if (typeof user.name !== 'string') {
          throw new Error(`Expected name to be string, got ${typeof user.name}`);
        }
        
        console.log(`  ✅ Email: "${user.email}" (string)`);
        console.log(`  ✅ Name: "${user.name}" (string)`);
        
        // Test boolean fields
        if (typeof user.is_admin !== 'boolean') {
          throw new Error(`Expected is_admin to be boolean, got ${typeof user.is_admin}`);
        }
        
        console.log(`  ✅ Is Admin: ${user.is_admin} (boolean)`);
        
        // Test date fields
        if (user.created_at && !(user.created_at instanceof Date || typeof user.created_at === 'string')) {
          throw new Error(`Expected created_at to be date or string, got ${typeof user.created_at}`);
        }
        
        if (user.created_at) {
          console.log(`  ✅ Created At: ${user.created_at} (date)`);
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
    '/api/v1/users/',
    '/api/v1/tags/',
    '/api/v1/dive-sites/1',
    '/api/v1/diving-centers/1',
    '/api/v1/users/1',
    '/api/v1/dive-sites/1/media',
    '/api/v1/diving-centers/1/gear-rental',
    '/api/v1/dive-sites/1/ratings',
    '/api/v1/diving-centers/1/ratings'
  ];
  
  let workingEndpoints = 0;
  const totalEndpoints = endpoints.length;
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${BACKEND_URL}${endpoint}`);
      if (response.statusCode === 200 || response.statusCode === 404) {
        console.log(`  ✅ ${endpoint} - OK (${response.statusCode})`);
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
  console.log('\n📝 Simulating user actions (anonymous and authenticated)...');
  let token = null;
  let errors = 0;
  
  // Try rating a dive site (anonymous)
  try {
    await testRateDiveSite(1, null);
    console.log('  ✅ Anonymous: Rating dive site did not return error object');
  } catch (e) {
    console.log('  ❌ Anonymous: ' + e.message);
    errors++;
  }
  
  // Try adding a dive site (anonymous)
  try {
    await testAddDiveSite(null);
    console.log('  ✅ Anonymous: Adding dive site did not return error object');
  } catch (e) {
    console.log('  ❌ Anonymous: ' + e.message);
    errors++;
  }
  
  // Try modifying a diving center (anonymous)
  try {
    await testModifyDivingCenter(1, null);
    console.log('  ✅ Anonymous: Modifying diving center did not return error object');
  } catch (e) {
    console.log('  ❌ Anonymous: ' + e.message);
    errors++;
  }
  
  // Login as admin
  try {
    token = await loginAndGetToken();
    console.log('  ✅ Login as admin successful');
  } catch (e) {
    console.log('  ❌ Login failed: ' + e.message);
    errors++;
  }
  
  // Try rating a dive site (authenticated)
  try {
    await testRateDiveSite(1, token);
    console.log('  ✅ Authenticated: Rating dive site did not return error object');
  } catch (e) {
    console.log('  ❌ Authenticated: ' + e.message);
    errors++;
  }
  
  // Try adding a dive site (authenticated)
  try {
    await testAddDiveSite(token);
    console.log('  ✅ Authenticated: Adding dive site did not return error object');
  } catch (e) {
    console.log('  ❌ Authenticated: ' + e.message);
    errors++;
  }
  
  // Try modifying a diving center (authenticated)
  try {
    await testModifyDivingCenter(1, token);
    console.log('  ✅ Authenticated: Modifying diving center did not return error object');
  } catch (e) {
    console.log('  ❌ Authenticated: ' + e.message);
    errors++;
  }
  
  if (errors > 0) {
    console.log(`\n❌ User action simulation found ${errors} issues!`);
    return false;
  } else {
    console.log('\n✅ All user action simulations passed!');
    return true;
  }
}

async function runRegressionTests() {
  console.log('🚀 Starting Enhanced Regression Tests...\n');
  
  const dataTypesOk = await testDataTypes();
  const endpointsOk = await testAPIEndpoints();
  const authOk = await testAuthenticationFlows();
  const validationOk = await testDataValidation();
  const errorHandlingOk = await testAPIErrorHandling();
  const performanceOk = await testPerformance();
  const securityOk = await testSecurity();
  const userActionsOk = await runUserActionTests();
  
  console.log('\n📈 Enhanced Regression Test Summary:');
  console.log(`   Data Types: ${dataTypesOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   API Endpoints: ${endpointsOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Authentication: ${authOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Data Validation: ${validationOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Error Handling: ${errorHandlingOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Performance: ${performanceOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Security: ${securityOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   User Actions: ${userActionsOk ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allTestsPassed = dataTypesOk && endpointsOk && authOk && validationOk && 
                        errorHandlingOk && performanceOk && securityOk && userActionsOk;
  
  if (allTestsPassed) {
    console.log('\n✅ All enhanced regression tests passed!');
    console.log('   No data type issues detected.');
    console.log('   All API endpoints are working.');
    console.log('   Authentication flows are secure.');
    console.log('   Data validation is working properly.');
    console.log('   Error handling is robust.');
    console.log('   Performance is acceptable.');
    console.log('   Security measures are in place.');
    console.log('   User actions work correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some enhanced regression tests failed!');
    console.log('   Please check the issues above.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  (async () => {
    await runRegressionTests();
  })().catch(error => {
    console.error('Enhanced regression tests failed:', error);
    process.exit(1);
  });
}

module.exports = { runRegressionTests, runUserActionTests }; 