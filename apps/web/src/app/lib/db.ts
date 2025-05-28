// apps/web/src/app/lib/db.ts
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool: mysql.Pool | null = null;

// Counter for connection attempts
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// Database configuration
const databaseConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'unityvoice',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  ssl: process.env.MYSQL_SSL === 'true'
};

// Log database configuration (without sensitive information)
function logDatabaseConfig() {
  console.log('Database configuration:', {
    host: databaseConfig.host,
    user: databaseConfig.user,
    database: databaseConfig.database,
    port: databaseConfig.port,
    ssl: databaseConfig.ssl,
    passwordProvided: !!databaseConfig.password
  });
}

// Test database connection function
export async function testConnection(): Promise<boolean> {
  try {
    const pool = await getSafeDbPool();
    if (!pool) return false;
    
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export async function getDbPool(): Promise<mysql.Pool> {
  if (pool) return pool;
  
  try {
    connectionAttempts++;
    
    // Check for SSL certificate
    const sslCertPath = path.join(process.cwd(), 'src/config/DigiCertGlobalRootCA.crt.pem');
    let sslCertificate: Buffer | undefined = undefined;
    
    if (fs.existsSync(sslCertPath)) {
      console.log(`SSL certificate found at: ${sslCertPath}`);
      sslCertificate = fs.readFileSync(sslCertPath);
    } else {
      console.log('SSL certificate not found, using default SSL configuration');
    }
    
    // Log configuration
    console.log(`[${new Date().toISOString()}] Database configuration:`, {
      host: databaseConfig.host,
      user: databaseConfig.user,
      database: databaseConfig.database,
      port: databaseConfig.port,
      ssl: databaseConfig.ssl,
      passwordProvided: !!databaseConfig.password,
      environment: process.env.NODE_ENV || 'unknown'
    });
    
    // Verify we have essential credentials
    if (!databaseConfig.host || !databaseConfig.user) {
      console.error('CRITICAL: Missing essential database credentials (host or user)');
    }
    
    if (!databaseConfig.password) {
      console.error('CRITICAL: No database password provided - connection will likely fail');
      // In development, let's set a default password to make it easier to get started
      if (process.env.NODE_ENV === 'development' && databaseConfig.host === 'localhost') {
        console.log('Development mode detected with localhost - using empty password');
      }
    }
    
    console.log(`[${new Date().toISOString()}] Attempting to connect to MySQL database (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
    
    // Create configuration
    const config: mysql.PoolOptions = {
      host: databaseConfig.host,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      port: databaseConfig.port,
      ssl: databaseConfig.ssl ? 
        (sslCertificate ? { ca: sslCertificate, rejectUnauthorized: false } : { rejectUnauthorized: false }) : 
        undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000, // 10 seconds
    };
    
    // Create the connection pool
    pool = mysql.createPool(config);
    
    // Test the connection
    const connection = await pool.getConnection();
    console.log(`[${new Date().toISOString()}] Successfully connected to MySQL database`);
    connection.release();
    
    // Reset connection attempts counter after successful connection
    connectionAttempts = 0;
    
    return pool;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] Failed to connect to MySQL database:`, errorMessage);
    console.error('Database connection error details:', error);
    
    // Log more details about the environment
    console.error('Environment context:', {
      NODE_ENV: process.env.NODE_ENV,
      cwd: process.cwd(),
      MYSQL_HOST_set: !!process.env.MYSQL_HOST,
      MYSQL_USER_set: !!process.env.MYSQL_USER,
      MYSQL_DATABASE_set: !!process.env.MYSQL_DATABASE,
      MYSQL_PASSWORD_set: !!process.env.MYSQL_PASSWORD,
    });
    
    // If we haven't reached the maximum number of attempts, try again after a delay
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      console.log(`Retrying database connection in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return getDbPool();
    }
    
    // Reset connection attempts counter if we've reached the maximum
    connectionAttempts = 0;
    throw new Error(`Database connection failed: ${errorMessage}`);
  }
}

// Safe version of getDbPool that doesn't throw if connection fails
export async function getSafeDbPool(): Promise<mysql.Pool | null> {
  try {
    return await getDbPool();
  } catch (error) {
    console.error('Database connection failed, returning null:', error);
    return null;
  }
}

// Export the pool for direct usage
export { pool };