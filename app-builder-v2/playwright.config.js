const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './scripts',
  testMatch: 'ui-smoke-test.js',
  timeout: 30000,
  use: {
    headless: true,
  },
});
