import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

// Function to get database connection
async function getDbConnection() {
  try {
    // Direct connection to ensure we bypass any pooling issues
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'unityvoice',
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : undefined
    });
    
    return connection;
  } catch (error) {
    console.error('Error creating DB connection:', error);
    return null;
  }
}

// Function to extract user ID from token
function getUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as any;
    return decoded.userId || decoded.id || null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Debug endpoint to check the userinlevel table
 */
export async function GET(request: NextRequest) {
  console.group('GET /api/debug/userinlevel - Request received');
  
  let connection;
  
  try {
    // Get authentication token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('GET /api/debug/userinlevel - No auth token found');
      console.groupEnd();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
      console.error('GET /api/debug/userinlevel - Invalid token');
      console.groupEnd();
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    // Get query parameters
    const url = new URL(request.url);
    const specificUser = url.searchParams.get('userId');
    const specificTopic = url.searchParams.get('topic');
    
    // Establish database connection
    connection = await getDbConnection();
    if (!connection) {
      console.error('GET /api/debug/userinlevel - Failed to connect to database');
      console.groupEnd();
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    // Build the query based on filters
    let query = 'SELECT * FROM userinlevel';
    const params = [];
    const conditions = [];
    
    if (specificUser) {
      conditions.push('UserId = ?');
      params.push(specificUser);
    }
    
    if (specificTopic) {
      conditions.push('TopicName = ?');
      params.push(specificTopic);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Add order by clause
    query += ' ORDER BY TopicName, UserId, Level';
    
    console.log('Debug query:', query);
    console.log('Debug params:', params);
    
    const [rows] = await connection.execute(query, params);
    
    // Format results for readability
    const results = Array.isArray(rows) ? rows : [];
    
    console.log(`Found ${results.length} records in userinlevel table`);
    console.groupEnd();
    
    return NextResponse.json({
      success: true,
      count: results.length,
      records: results
    });
    
  } catch (error) {
    console.error("Error in debug userinlevel API:", error);
    console.groupEnd();
    return NextResponse.json(
      { 
        error: "Failed to query userinlevel",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
    }
  }
} 