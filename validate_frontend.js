#!/usr/bin/env node

/**
 * Frontend Validation Script
 * Simple validation to check if frontend and APIs are working
 */

const http = require('http');
const https = require('https');

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';

const API_ENDPOINTS = [
  '/api/v1/dive-sites/',
  '/api/v1/diving-centers/',
  '/api/v1/dive-sites/1',
  '/api/v1/diving-centers/1'
];

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
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
  });
}

async function testFrontend() {
  console.log('🔍 Testing Frontend...');
  
  try {
    const response = await makeRequest(FRONTEND_URL);
    if (response.statusCode === 200) {
      console.log('✅ Frontend is accessible');
      return true;
    } else {
      console.log(`❌ Frontend returned status ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Frontend error: ${error.message}`);
    return false;
  }
}

async function testBackend() {
  console.log('\n🔍 Testing Backend APIs...');
  
  let successCount = 0;
  const totalEndpoints = API_ENDPOINTS.length;
  
  for (const endpoint of API_ENDPOINTS) {
    try {
      const response = await makeRequest(`${BACKEND_URL}${endpoint}`);
      if (response.statusCode === 200) {
        console.log(`✅ ${endpoint} - OK`);
        successCount++;
      } else {
        console.log(`❌ ${endpoint} - Status ${response.statusCode}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Backend Results: ${successCount}/${totalEndpoints} endpoints working`);
  return successCount === totalEndpoints;
}

async function validateDataTypes() {
  console.log('\n🔍 Validating API Data Types...');
  
  try {
    // Test diving centers endpoint specifically for the latitude/longitude issue
    const response = await makeRequest(`${BACKEND_URL}/api/v1/diving-centers`);
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      if (data.length > 0) {
        const center = data[0];
        console.log(`✅ Sample diving center data:`);
        console.log(`   - ID: ${center.id} (${typeof center.id})`);
        console.log(`   - Name: ${center.name} (${typeof center.name})`);
        console.log(`   - Latitude: ${center.latitude} (${typeof center.latitude})`);
        console.log(`   - Longitude: ${center.longitude} (${typeof center.longitude})`);
        console.log(`   - Average Rating: ${center.average_rating} (${typeof center.average_rating})`);
        
        // Check if latitude/longitude are strings (which is correct from API)
        if (typeof center.latitude === 'string' && typeof center.longitude === 'string') {
          console.log('✅ Latitude/Longitude are strings (correct for API)');
        } else {
          console.log('⚠️  Latitude/Longitude are not strings (unexpected)');
        }
      }
    }
  } catch (error) {
    console.log(`❌ Data type validation error: ${error.message}`);
  }
}

async function runValidation() {
  console.log('🚀 Starting Frontend Validation...\n');
  
  const frontendOk = await testFrontend();
  const backendOk = await testBackend();
  await validateDataTypes();
  
  console.log('\n📈 Summary:');
  console.log(`   Frontend: ${frontendOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`   Backend: ${backendOk ? '✅ OK' : '❌ Failed'}`);
  
  if (frontendOk && backendOk) {
    console.log('\n✅ All systems operational!');
    process.exit(0);
  } else {
    console.log('\n❌ Some systems are down!');
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  runValidation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = { runValidation }; 