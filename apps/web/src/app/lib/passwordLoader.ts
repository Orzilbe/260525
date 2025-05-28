// src/app/lib/passwordLoader.ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Tries multiple methods to load database password
 * This helps ensure we don't get "using password: NO" errors
 */
export function loadDatabasePassword(): string {
  console.log("Attempting to load database password through multiple methods");
  
  // Method 1: Direct environment variable
  const envPassword = process.env.MYSQL_PASSWORD || '';
  if (envPassword) {
    console.log("✓ Password found in environment variables");
    return envPassword;
  }
  
  // Method 2: Try to load from .env file at project root
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      console.log(`Found .env file at ${envPath}`);
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      
      if (envConfig.MYSQL_PASSWORD) {
        console.log("✓ Password found in .env file");
        // Also set it in process.env for future use
        process.env.MYSQL_PASSWORD = envConfig.MYSQL_PASSWORD;
        return envConfig.MYSQL_PASSWORD;
      }
    }
  } catch (error) {
    console.error("Error loading from .env file:", error);
  }
  
  // Method 3: Check if in development and try parent directory .env
  if (process.env.NODE_ENV === 'development') {
    try {
      const parentEnvPath = path.join(process.cwd(), '..', '.env');
      if (fs.existsSync(parentEnvPath)) {
        console.log(`Found parent .env file at ${parentEnvPath}`);
        const envConfig = dotenv.parse(fs.readFileSync(parentEnvPath));
        
        if (envConfig.MYSQL_PASSWORD) {
          console.log("✓ Password found in parent .env file");
          // Also set it in process.env for future use
          process.env.MYSQL_PASSWORD = envConfig.MYSQL_PASSWORD;
          return envConfig.MYSQL_PASSWORD;
        }
      }
    } catch (error) {
      console.error("Error loading from parent .env file:", error);
    }
  }
  
  // Method 4: Check if we're in a Next.js monorepo structure with apps/web
  try {
    const monorepoEnvPath = path.join(process.cwd(), 'apps', 'web', '.env');
    if (fs.existsSync(monorepoEnvPath)) {
      console.log(`Found monorepo .env file at ${monorepoEnvPath}`);
      const envConfig = dotenv.parse(fs.readFileSync(monorepoEnvPath));
      
      if (envConfig.MYSQL_PASSWORD) {
        console.log("✓ Password found in monorepo .env file");
        // Also set it in process.env for future use
        process.env.MYSQL_PASSWORD = envConfig.MYSQL_PASSWORD;
        return envConfig.MYSQL_PASSWORD;
      }
    }
  } catch (error) {
    console.error("Error loading from monorepo .env file:", error);
  }
  
  // No password found through any method
  console.warn("⚠ No password found through any method");
  return '';
}