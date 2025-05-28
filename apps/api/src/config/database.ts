import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PoolOptions } from 'mysql2/promise';

dotenv.config();

class DatabaseConnection {
  private static instance: mysql.Pool;

  private static createPool(): mysql.Pool {
    // Enhanced SSL configuration with more detailed logging
    const sslOptions = {
      rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true,
      // Optional: Add CA certificate if using specific SSL certificates
      // ca: fs.readFileSync(path.resolve(__dirname, './ca-certificate.pem'))
    };

    const connectionOptions: PoolOptions = {
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      ssl: sslOptions,
      
      // Enhanced connection pool settings
      waitForConnections: true,
      connectionLimit: 20, // Increased from 10
      queueLimit: 0,
      
      // Additional timeout configurations
      connectTimeout: 30000, // 30 seconds
      
      // Detailed connection logging
      debug: process.env.NODE_ENV === 'development' ? ['ComQueryPacket', 'RowDataPacket'] : false
    };

    console.log('DatabaseConnection: Creating pool with enhanced configuration', {
      host: connectionOptions.host,
      port: connectionOptions.port,
      database: connectionOptions.database,
      connectionLimit: connectionOptions.connectionLimit
    });

    return mysql.createPool(connectionOptions);
  }

  public static getPool(): mysql.Pool {
    if (!this.instance) {
      this.instance = this.createPool();
    }
    return this.instance;
  }

  public static async testConnection(): Promise<boolean> {
    try {
      console.time('Database Connection Test');
      const connection = await this.getPool().getConnection();
      
      try {
        // Comprehensive connection test
        const [rows] = await connection.query('SELECT 1');
        console.log('✅ Database Connection Successful');
        console.log('Connection details:', {
          threadId: connection.threadId
        });
      } finally {
        connection.release();
      }
      
      console.timeEnd('Database Connection Test');
      return true;
    } catch (error) {
      console.error('❌ Database Connection Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        code: (error as any).code,
        errno: (error as any).errno
      });
      return false;
    }
  }

  // New method to get detailed connection error information
  public static async getConnectionErrorDetails(): Promise<string> {
    try {
      const pool = this.getPool();
      const connection = await pool.getConnection();
      connection.release();
      return 'Connection successful';
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any).code,
        errno: (error as any).errno,
        sqlState: (error as any).sqlState,
        sqlMessage: (error as any).sqlMessage
      };
      return JSON.stringify(errorDetails, null, 2);
    }
  }
}

export default DatabaseConnection;