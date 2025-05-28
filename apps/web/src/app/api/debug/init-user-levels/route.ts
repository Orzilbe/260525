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
 * Debug endpoint to initialize user level records
 */
export async function POST(request: NextRequest) {
  console.group('POST /api/debug/init-user-levels - Request received');
  
  let connection;
  
  try {
    // Get authentication token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('POST /api/debug/init-user-levels - No auth token found');
      console.groupEnd();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
      console.error('POST /api/debug/init-user-levels - Invalid token');
      console.groupEnd();
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    // Get request body
    const body = await request.json();
    const targetUserId = body.userId || userId; // Use specified userId or default to authenticated user
    
    console.log(`Initializing user levels for userId: ${targetUserId}`);
    
    // Establish database connection
    connection = await getDbConnection();
    if (!connection) {
      console.error('POST /api/debug/init-user-levels - Failed to connect to database');
      console.groupEnd();
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      // Get all topics from the database
      const [topicsResult] = await connection.execute('SELECT TopicName FROM topics');
      const topics = Array.isArray(topicsResult) ? topicsResult.map((row: any) => row.TopicName) : [];
      
      if (topics.length === 0) {
        console.warn('No topics found in the database');
        console.groupEnd();
        await connection.rollback();
        return NextResponse.json(
          { error: "No topics found" },
          { status: 404 }
        );
      }
      
      console.log(`Found ${topics.length} topics: ${topics.join(', ')}`);
      
      // Create level 1 records for each topic
      const results = [];
      
      for (const topic of topics) {
        // Check if record already exists
        const [existingRows] = await connection.execute(
          'SELECT * FROM userinlevel WHERE TopicName = ? AND Level = ? AND UserId = ?',
          [topic, 1, targetUserId]
        );
        
        const existingRecords = Array.isArray(existingRows) ? existingRows : [];
        
        if (existingRecords.length > 0) {
          console.log(`Record already exists for topic ${topic}, level 1, user ${targetUserId}`);
          results.push({
            topic,
            level: 1,
            userId: targetUserId,
            status: 'exists'
          });
        } else {
          // Insert new record
          const [insertResult] = await connection.execute(
            'INSERT INTO userinlevel (TopicName, Level, UserId, EarnedScore, CompletedAt, IsCompleted) VALUES (?, ?, ?, 0, NULL, 0)',
            [topic, 1, targetUserId]
          );
          
          console.log(`Created record for topic ${topic}, level 1, user ${targetUserId}`);
          results.push({
            topic,
            level: 1,
            userId: targetUserId,
            status: 'created'
          });
        }
      }
      
      // Commit transaction
      await connection.commit();
      
      console.log(`Initialization completed with ${results.length} records`);
      console.groupEnd();
      
      return NextResponse.json({
        success: true,
        userId: targetUserId,
        count: results.length,
        results
      });
    } catch (dbError) {
      // Rollback transaction in case of error
      await connection.rollback();
      console.error('Database error:', dbError);
      console.groupEnd();
      throw dbError;
    }
  } catch (error) {
    console.error("Error in init-user-levels API:", error);
    console.groupEnd();
    return NextResponse.json(
      { 
        error: "Failed to initialize user levels",
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