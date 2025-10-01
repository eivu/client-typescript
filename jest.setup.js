/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module, no-undef, unicorn/prefer-node-protocol */
const {config} = require('dotenv')
const path = require('path')

// Load .env.test file and override existing environment variables
config({
  override: true,
  path: path.join(__dirname, '.env.test'),
})
