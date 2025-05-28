#!/usr/bin/env node

// Azure deployment script for Node.js monorepo
console.log('Starting Azure deployment process...');

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, cwd = process.cwd()) {
  console.log(`Running: ${command} in ${cwd}`);
  try {
    execSync(command, { stdio: 'inherit', cwd });
  } catch (error) {
    console.error(`Error running command: ${command}`);
    process.exit(1);
  }
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

try {
  // Install dependencies
  console.log('Installing dependencies...');
  runCommand('npm install');

  // Build the API
  console.log('Building API...');
  runCommand('npm run build', path.join(process.cwd(), 'apps', 'api'));

  // Build the web app (if needed for static serving)
  console.log('Building web app...');
  runCommand('npm run build', path.join(process.cwd(), 'apps', 'web'));

  // Copy web.config to the root if it doesn't exist
  const webConfigPath = path.join(process.cwd(), 'web.config');
  if (!fs.existsSync(webConfigPath)) {
    console.log('web.config not found in deployment!');
    process.exit(1);
  }

  // Verify the server.js file exists
  const serverJsPath = path.join(process.cwd(), 'apps', 'api', 'dist', 'server.js');
  if (!fs.existsSync(serverJsPath)) {
    console.error('server.js not found at expected location!');
    process.exit(1);
  }

  console.log('Deployment preparation completed successfully!');
  console.log(`Server file location: ${serverJsPath}`);
  console.log(`Web config location: ${webConfigPath}`);

} catch (error) {
  console.error('Deployment failed:', error);
  process.exit(1);
} 