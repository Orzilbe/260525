#!/usr/bin/env ts-node
// apps/api/src/scripts/diagnoseDb.ts
import { runComprehensiveDiagnostics, auditEnvironmentVariables } from '../lib/dbDiagnostic';
import { diagnoseDbConnection } from '../lib/db';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'run';

async function main() {
  console.log('🔍 Database Connection Diagnostic Tool');
  console.log('======================================');
  
  try {
    switch (command) {
      case 'run':
      case 'full':
        // Run comprehensive diagnostics
        console.log('Running comprehensive diagnostics...');
        const report = await runComprehensiveDiagnostics();
        console.log(report);
        break;
        
      case 'quick':
        // Run quick diagnostics
        console.log('Running quick diagnostics...');
        const diagnostics = await diagnoseDbConnection();
        
        // Format output
        console.log('Quick Diagnostic Results:');
        console.log('======================================');
        console.log(`Host Reachable: ${diagnostics.hostReachable ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Valid Credentials: ${diagnostics.credentialsValid ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`SSL Configuration: ${diagnostics.sslConfigurationCorrect ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Connection Pool: ${diagnostics.connectionPoolCreated ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Sample Query: ${diagnostics.sampleQueryExecutable ? '✅ PASS' : '❌ FAIL'}`);
        
        const overallStatus = 
          diagnostics.hostReachable && 
          diagnostics.credentialsValid && 
          diagnostics.sslConfigurationCorrect && 
          diagnostics.connectionPoolCreated && 
          diagnostics.sampleQueryExecutable;
          
        console.log('======================================');
        console.log(`Overall Status: ${overallStatus ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
        break;
        
      case 'env':
        // Audit environment variables
        console.log('Auditing environment variables...');
        const envAudit = await auditEnvironmentVariables();
        
        console.log('Environment Variables Audit:');
        console.log('======================================');
        console.log(`Variables Identical Across Projects: ${envAudit.identical ? 'YES' : 'NO'}`);
        
        if (envAudit.mismatches.length > 0) {
          console.log(`\nMismatched Variables: ${envAudit.mismatches.join(', ')}`);
          
          // Compare the mismatched variables
          console.log('\nDetails of Mismatches:');
          for (const varName of envAudit.mismatches) {
            const apiValue = envAudit.api[varName] || 'undefined';
            const webValue = envAudit.web[varName] || 'undefined';
            const displayApiValue = varName.includes('PASSWORD') ? '********' : apiValue;
            const displayWebValue = varName.includes('PASSWORD') ? '********' : webValue;
            
            console.log(`${varName}:`);
            console.log(`  - API: ${displayApiValue}`);
            console.log(`  - Web: ${displayWebValue}`);
          }
        }
        break;
        
      case 'help':
      default:
        console.log('Usage: ts-node diagnoseDb.ts [command]');
        console.log('\nCommands:');
        console.log('  run, full   Run comprehensive diagnostics (default)');
        console.log('  quick       Run quick diagnostics');
        console.log('  env         Audit environment variables');
        console.log('  help        Show this help message');
        break;
    }
  } catch (error) {
    console.error('Error running diagnostics:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  }); 