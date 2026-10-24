#!/usr/bin/env node

/**
 * Launch Chromium for frontend e2e scripts.
 * Prefers system Chromium (Alpine apk) so Docker images do not need
 * Playwright's bundled browser download.
 */

const fs = require('fs');
const { chromium } = require('playwright');

const CANDIDATE_PATHS = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

function resolveExecutablePath() {
  for (const candidate of CANDIDATE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function launchChromium(options = {}) {
  const executablePath = resolveExecutablePath();
  const { args: extraArgs = [], ...rest } = options;

  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    ...rest,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      ...extraArgs,
    ],
  });
}

module.exports = { launchChromium, resolveExecutablePath };
