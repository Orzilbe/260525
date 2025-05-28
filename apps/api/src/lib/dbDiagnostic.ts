// apps/api/src/lib/dbDiagnostic.ts
import { diagnoseDbConnection, generateDbDiagnosticReport, DbDiagnostics } from './db';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';

/**
 * Audit environment variables across projects
 */
export async function auditEnvironmentVariables(): Promise<{
  api: Record<string, string | undefined>;
  web: Record<string, string | undefined>;
  identical: boolean;
  mismatches: string[];
}> {
  // Variables to check
  const dbVars = [
    'MYSQL_HOST',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE',
    'MYSQL_PORT',
    'MYSQL_SSL'
  ];
  
  // Load API environment
  const apiEnvPath = path.resolve(process.cwd(), '../api/.env');
  let apiEnv: Record<string, string | undefined> = {};
  
  try {
    if (fs.existsSync(apiEnvPath)) {
      const apiEnvContent = fs.readFileSync(apiEnvPath, 'utf8');
      const apiDotenv = dotenv.parse(apiEnvContent);
      apiEnv = dbVars.reduce((acc, varName) => {
        acc[varName] = apiDotenv[varName] || process.env[varName];
        return acc;
      }, {} as Record<string, string | undefined>);
    } else {
      // Fall back to process.env if no .env file
      apiEnv = dbVars.reduce((acc, varName) => {
        acc[varName] = process.env[varName];
        return acc;
      }, {} as Record<string, string | undefined>);
    }
  } catch (error) {
    console.error('Error loading API environment variables:', error);
  }
  
  // Load Web environment
  const webEnvPath = path.resolve(process.cwd(), '../web/.env');
  let webEnv: Record<string, string | undefined> = {};
  
  try {
    if (fs.existsSync(webEnvPath)) {
      const webEnvContent = fs.readFileSync(webEnvPath, 'utf8');
      const webDotenv = dotenv.parse(webEnvContent);
      webEnv = dbVars.reduce((acc, varName) => {
        acc[varName] = webDotenv[varName] || process.env[varName];
        return acc;
      }, {} as Record<string, string | undefined>);
    } else {
      // Fall back to process.env if no .env file
      webEnv = dbVars.reduce((acc, varName) => {
        acc[varName] = process.env[varName];
        return acc;
      }, {} as Record<string, string | undefined>);
    }
  } catch (error) {
    console.error('Error loading Web environment variables:', error);
  }
  
  // Check for mismatches
  const mismatches: string[] = [];
  for (const varName of dbVars) {
    if (apiEnv[varName] !== webEnv[varName]) {
      mismatches.push(varName);
    }
  }
  
  return {
    api: apiEnv,
    web: webEnv,
    identical: mismatches.length === 0,
    mismatches
  };
}

/**
 * Run comprehensive database diagnostics and save report
 */
export async function runComprehensiveDiagnostics(): Promise<string> {
  console.log('Starting comprehensive database diagnostics...');
  
  // Generate timestamp for report filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.resolve(process.cwd(), 'logs');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = path.resolve(reportDir, `db-diagnostic-${timestamp}.log`);
  
  // Run environment variable audit
  const envAudit = await auditEnvironmentVariables();
  
  // Run database diagnostics
  const diagnostics = await diagnoseDbConnection();
  
  // Generate system information
  const systemInfo = {
    os: {
      type: os.type(),
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname()
    },
    env: process.env.NODE_ENV,
    user: os.userInfo().username,
    cwd: process.cwd(),
    memory: {
      total: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
      free: `${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`
    }
  };
  
  // Generate report
  const dbReport = await generateDbDiagnosticReport();
  
  // Compose the full report
  const report = `
=============================================================
UNITY VOICE LEARNING PLATFORM - DATABASE DIAGNOSTIC REPORT
=============================================================
Generated: ${new Date().toISOString()}

SYSTEM INFORMATION
-------------------------------------------------------------
OS: ${systemInfo.os.type} ${systemInfo.os.platform} ${systemInfo.os.release}
Hostname: ${systemInfo.os.hostname}
Environment: ${systemInfo.env}
User: ${systemInfo.user}
Working Directory: ${systemInfo.cwd}
Memory: Total: ${systemInfo.memory.total}, Free: ${systemInfo.memory.free}

ENVIRONMENT VARIABLES AUDIT
-------------------------------------------------------------
Variables Identical Across Projects: ${envAudit.identical ? 'YES' : 'NO'}
${envAudit.mismatches.length > 0 ? `Mismatched Variables: ${envAudit.mismatches.join(', ')}` : ''}

API Environment:
${Object.entries(envAudit.api)
  .map(([key, value]) => `  ${key}: ${value ? (key.includes('PASSWORD') ? '********' : value) : 'undefined'}`)
  .join('\n')}

Web Environment:
${Object.entries(envAudit.web)
  .map(([key, value]) => `  ${key}: ${value ? (key.includes('PASSWORD') ? '********' : value) : 'undefined'}`)
  .join('\n')}

${dbReport}
`;

  // Save report to file
  fs.writeFileSync(reportPath, report);
  console.log(`Diagnostic report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Create an Express route handler for diagnosing database connections
 */
export function createDiagnosticHandler() {
  return async (req: any, res: any) => {
    try {
      const report = await runComprehensiveDiagnostics();
      
      // Determine response format based on query param or accept header
      const format = req.query.format || (req.headers.accept?.includes('application/json') ? 'json' : 'text');
      
      if (format === 'json') {
        const diagnostics = await diagnoseDbConnection();
        const envAudit = await auditEnvironmentVariables();
        
        res.json({
          timestamp: new Date().toISOString(),
          diagnostics,
          environmentAudit: envAudit,
          status: diagnostics.hostReachable && 
                 diagnostics.credentialsValid && 
                 diagnostics.sslConfigurationCorrect && 
                 diagnostics.connectionPoolCreated && 
                 diagnostics.sampleQueryExecutable ? 'healthy' : 'unhealthy'
        });
      } else {
        res.setHeader('Content-Type', 'text/plain');
        res.send(report);
      }
    } catch (error) {
      console.error('Error in diagnostic handler:', error);
      res.status(500).json({
        error: 'Diagnostic failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

// If this module is run directly from the command line
if (require.main === module) {
  runComprehensiveDiagnostics()
    .then(report => {
      console.log(report);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to run diagnostics:', error);
      process.exit(1);
    });
} 