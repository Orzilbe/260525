// src/app/api/test-env/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Collect environment variables (redacting sensitive information)
  const envVars = {
    // Database config
    MYSQL_HOST: process.env.MYSQL_HOST || 'not set',
    MYSQL_USER: process.env.MYSQL_USER || 'not set',
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? '[REDACTED]' : 'not set',
    MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'not set',
    MYSQL_PORT: process.env.MYSQL_PORT || 'not set',
    MYSQL_SSL: process.env.MYSQL_SSL || 'not set',
    
    // API config
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'not set',
    
    // App config
    NODE_ENV: process.env.NODE_ENV || 'not set',
    
    // Auth config
    JWT_SECRET: process.env.JWT_SECRET ? '[REDACTED]' : 'not set',
    
    // File paths
    PWD: process.env.PWD || 'not set',
    APP_ROOT: process.cwd(),
  };
  
  // Test for SSL certificate file
  let sslCertStatus = 'Not checked';
  try {
    const fs = require('fs');
    const path = require('path');
    const sslCertPath = path.join(process.cwd(), 'src/config/DigiCertGlobalRootCA.crt.pem');
    
    if (fs.existsSync(sslCertPath)) {
      sslCertStatus = `Found at ${sslCertPath}`;
    } else {
      sslCertStatus = `Not found at ${sslCertPath}`;
    }
  } catch (error) {
    sslCertStatus = `Error checking: ${error instanceof Error ? error.message : String(error)}`;
  }
  
  // Return the collected information
  return NextResponse.json({
    environment: envVars,
    ssl_certificate: sslCertStatus,
    timestamp: new Date().toISOString()
  });
}