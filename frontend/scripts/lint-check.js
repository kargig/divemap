#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 Running comprehensive React JavaScript linting check...\n');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  try {
    log(`📋 ${description}...`, 'blue');
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    log(`✅ ${description} - PASSED`, 'green');
    return { success: true, output: result };
  } catch (error) {
    log(`❌ ${description} - FAILED`, 'red');
    console.log(error.stdout || error.stderr);
    return { success: false, output: error.stdout || error.stderr };
  }
}

function checkFileExists(filePath) {
  return fs.existsSync(path.join(__dirname, '..', filePath));
}

// Check if required config files exist
log('🔧 Checking configuration files...', 'blue');
const configFiles = [
  '.eslintrc.js',
  '.prettierrc',
  '.prettierignore',
  'package.json'
];

configFiles.forEach(file => {
  if (checkFileExists(file)) {
    log(`✅ Found ${file}`, 'green');
  } else {
    log(`❌ Missing ${file}`, 'red');
  }
});

console.log('\n' + '='.repeat(60) + '\n');

// Run ESLint
const eslintResult = runCommand(
  'npm run lint',
  'ESLint check for JavaScript/JSX files'
);

console.log('\n' + '='.repeat(60) + '\n');

// Run Prettier format check
const prettierResult = runCommand(
  'npm run format:check',
  'Prettier format check'
);

console.log('\n' + '='.repeat(60) + '\n');

// Check for common React issues
log('🔍 Checking for common React issues...', 'blue');

const reactIssues = [];

// Check for console.log statements (in production code)
try {
  const consoleLogs = execSync(
    'grep -r "console\\.log" src/ --include="*.js" --include="*.jsx" || true',
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  );

  if (consoleLogs.trim()) {
    reactIssues.push('⚠️  Found console.log statements in source code');
    console.log(consoleLogs);
  }
} catch (error) {
  // No console.log found
}

  // Check for unused imports
  try {
    const unusedImports = execSync(
      'grep -r "import.*from.*but never used" .eslintcache 2>/dev/null || true',
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    );

  if (unusedImports.trim()) {
    reactIssues.push('⚠️  Found unused imports');
  }
} catch (error) {
  // No unused imports found
}

// Check for missing PropTypes
try {
  const componentFiles = execSync(
    'find src -name "*.js" -o -name "*.jsx" | grep -v test | grep -v spec',
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  );

  const files = componentFiles.trim().split('\n').filter(f => f);

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('export default') &&
        content.includes('function') &&
        !content.includes('PropTypes') &&
        !content.includes('prop-types')) {
      reactIssues.push(`⚠️  Missing PropTypes in ${file.replace('src/', '')}`);
    }
  });
} catch (error) {
  // Error reading files
}

if (reactIssues.length > 0) {
  log('React-specific issues found:', 'yellow');
  reactIssues.forEach(issue => log(`  ${issue}`, 'yellow'));
} else {
  log('✅ No common React issues found', 'green');
}

console.log('\n' + '='.repeat(60) + '\n');

// Summary
log('📊 LINTING SUMMARY', 'bold');
log('==================', 'bold');

if (eslintResult.success && prettierResult.success && reactIssues.length === 0) {
  log('🎉 All linting checks PASSED!', 'green');
  log('Your React JavaScript code follows best practices.', 'green');
  process.exit(0);
} else {
  log('❌ Some linting checks FAILED', 'red');

  if (!eslintResult.success) {
    log('  - ESLint found issues that need to be fixed', 'red');
  }

  if (!prettierResult.success) {
    log('  - Code formatting issues detected', 'red');
  }

  if (reactIssues.length > 0) {
    log('  - React-specific issues found', 'yellow');
  }

  log('\n💡 To fix issues:', 'blue');
  log('  npm run lint:fix    # Fix ESLint issues automatically', 'blue');
  log('  npm run format      # Fix formatting issues automatically', 'blue');

  process.exit(1);
}