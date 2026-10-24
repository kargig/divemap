#!/usr/bin/env node

/**
 * Node.js 22 LTS Upgrade Testing Script
 * Tests the compatibility and runtime requirements of the Node.js 22 upgrade
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(FRONTEND_DIR, 'package.json');
const DOCKERFILE_PATH = path.join(FRONTEND_DIR, 'Dockerfile');
const DOCKERFILE_DEV_PATH = path.join(FRONTEND_DIR, 'Dockerfile.dev');

function testNodeVersion() {
  console.log('🔧 Testing Node.js Version...');
  const nodeVersion = process.version;
  console.log(`  Current Node.js version: ${nodeVersion}`);
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion >= 22) {
    console.log('  ✅ Running Node.js 22+ (compatible)');
    return true;
  } else {
    console.log(`  ❌ Running Node.js ${majorVersion} (incompatible, need 22+)`);
    return false;
  }
}

function testDockerfile() {
  console.log('🐳 Testing Dockerfile Configuration...');
  if (!fs.existsSync(DOCKERFILE_PATH)) {
    console.log('  ❌ Dockerfile not found');
    return false;
  }
  const dockerfileContent = fs.readFileSync(DOCKERFILE_PATH, 'utf8');
  if (
    dockerfileContent.includes('FROM node:22-alpine as build') &&
    dockerfileContent.includes('FROM node:22-alpine as production')
  ) {
    console.log('  ✅ Dockerfile build and production stages use node:22-alpine');
  } else {
    console.log('  ❌ Dockerfile does not configure node:22-alpine for build & production');
    return false;
  }

  if (!fs.existsSync(DOCKERFILE_DEV_PATH)) {
    console.log('  ❌ Dockerfile.dev not found');
    return false;
  }
  const devContent = fs.readFileSync(DOCKERFILE_DEV_PATH, 'utf8');
  if (devContent.includes('FROM node:22-alpine')) {
    console.log('  ✅ Dockerfile.dev uses node:22-alpine');
  } else {
    console.log('  ❌ Dockerfile.dev does not use node:22-alpine');
    return false;
  }
  return true;
}

function testPackageJson() {
  console.log('📦 Testing Package.json Configuration...');
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    console.log('  ❌ Package.json not found');
    return false;
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  if (pkg.scripts && pkg.scripts['test:nodejs']) {
    console.log('  ✅ script test:nodejs found');
    return true;
  } else {
    console.log('  ❌ script test:nodejs not found');
    return false;
  }
}

function runAll() {
  console.log('🚀 Running Node.js 22 Upgrade Verification...\n');
  const results = [testNodeVersion(), testDockerfile(), testPackageJson()];
  const passed = results.every(Boolean);
  if (passed) {
    console.log('\n🎉 All Node.js 22 upgrade checks passed!');
    process.exit(0);
  } else {
    console.error('\n⚠️ Some Node.js 22 upgrade checks failed.');
    process.exit(1);
  }
}

if (require.main === module) {
  runAll();
}

module.exports = {
  testNodeVersion,
  testDockerfile,
  testPackageJson
};
