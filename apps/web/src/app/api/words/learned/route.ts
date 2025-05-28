// apps/web/src/app/api/words/learned/route.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSafeDbPool } from '../../../lib/db';
import { formatTopicNameForDb, formatTopicNameForUrl, areTopicNamesEquivalent } from '../../../lib/topicUtils';

/**
 * Function to extract user ID from token
 */
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
 * Function to verify the user from request
 */
async function verifyAuth(request: NextRequest): Promise<{ isValid: boolean; userId: string; englishLevel: string }> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  
  if (!token) {
    return { isValid: false, userId: '', englishLevel: 'intermediate' };
  }
  
  const userId = getUserIdFromToken(token);
  
  // Get user's English level
  let englishLevel = 'intermediate'; // Default
  
  if (userId) {
    try {
      const pool = await getSafeDbPool();
      if (pool) {
        const [rows] = await pool.query(
          'SELECT EnglishLevel FROM Users WHERE UserId = ?',
          [userId]
        );
        
        if (Array.isArray(rows) && rows.length > 0 && (rows[0] as any).EnglishLevel) {
          englishLevel = (rows[0] as any).EnglishLevel;
        }
      }
    } catch (error) {
      console.error('Error getting user English level:', error);
    }
  }
  
  return { isValid: !!userId, userId: userId || '', englishLevel };
}

/**
 * GET /api/words/learned - Get words that the user has learned for a specific topic
 */
export async function GET(request: NextRequest) {
  console.group('GET /api/words/learned');
  
  try {
    // Authenticate user
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const userId = authResult.userId;
    console.log(`User authenticated: ${userId}`);
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const rawLevel = searchParams.get('level');
    
    // Convert level parameter to valid EnglishLevel value if provided
    let level: string | null = null;
    
    if (rawLevel) {
      // Map numeric level to appropriate EnglishLevel
      if (/^\d+$/.test(rawLevel)) {
        const levelNum = parseInt(rawLevel, 10);
        switch (levelNum) {
          case 1:
            level = 'beginner';
            break;
          case 2:
            level = 'intermediate';
            break;
          case 3:
          default:
            level = 'advanced';
            break;
        }
      } else {
        // Normalize string level
        const normalizedLevel = rawLevel.toLowerCase();
        if (['beginner', 'intermediate', 'advanced'].includes(normalizedLevel)) {
          level = normalizedLevel;
        } else {
          level = 'intermediate'; // Default for invalid strings
        }
      }
      
      console.log(`Mapped level parameter "${rawLevel}" to EnglishLevel value: "${level}"`);
    }
    
    if (!topic) {
      console.error('Topic parameter is required');
      console.groupEnd();
      return NextResponse.json({ error: 'Topic parameter is required' }, { status: 400 });
    }
    
    // Format the topic name consistently for the database
    const urlTopicName = topic;
    const dbTopicName = formatTopicNameForDb(topic);
    
    console.log(`Fetching learned words for topic - URL: "${urlTopicName}", DB: "${dbTopicName}"`);
    
    // Get database connection
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    try {
      // Construct the query based on whether level parameter is provided
      let query;
      let params;
      
      if (level) {
        console.log(`Filtering by level: ${level}`);
        query = `
          SELECT DISTINCT w.*
          FROM Words w
          JOIN wordintask wit ON w.WordId = wit.WordId
          JOIN Tasks t ON wit.TaskId = t.TaskId
          WHERE t.UserId = ?
            AND t.CompletionDate IS NOT NULL
            AND t.Level = ?
            AND (
              LOWER(w.TopicName) = LOWER(?) 
              OR LOWER(w.TopicName) = LOWER(?)
              OR (
                REPLACE(LOWER(w.TopicName), ' ', '-') = LOWER(?)
                OR REPLACE(LOWER(?), '-', ' ') = LOWER(w.TopicName)
              )
            )
          ORDER BY w.Word
        `;
        params = [
          userId,
          level,
          dbTopicName,
          urlTopicName,
          urlTopicName,
          urlTopicName
        ];
      } else {
        console.log('Getting all learned words regardless of level');
        query = `
          SELECT DISTINCT w.*
          FROM Words w
          JOIN wordintask wit ON w.WordId = wit.WordId
          JOIN Tasks t ON wit.TaskId = t.TaskId
          WHERE t.UserId = ?
            AND t.CompletionDate IS NOT NULL
            AND (
              LOWER(w.TopicName) = LOWER(?) 
              OR LOWER(w.TopicName) = LOWER(?)
              OR (
                REPLACE(LOWER(w.TopicName), ' ', '-') = LOWER(?)
                OR REPLACE(LOWER(?), '-', ' ') = LOWER(w.TopicName)
              )
            )
          ORDER BY w.Word
        `;
        params = [
          userId,
          dbTopicName,
          urlTopicName,
          urlTopicName,
          urlTopicName
        ];
      }
      
      const [learnedWordsRows] = await pool.query(query, params);
      
      const learnedWords = Array.isArray(learnedWordsRows) ? learnedWordsRows : [];
      console.log(`Found ${learnedWords.length} learned words for topic "${dbTopicName}"`);
      
      // If no words found, try an alternative approach
      if (learnedWords.length === 0) {
        console.log('No learned words found. Returning empty array.');
        console.groupEnd();
        return NextResponse.json({
          success: true,
          data: [],
          source: 'none'
        });
      }
      
      // Normalize all learned words to use the consistent DB format for topic name
      const normalizedLearnedWords = (learnedWords as any[]).map(word => ({
        ...word,
        TopicName: dbTopicName // Ensure consistent format
      }));
      
      console.groupEnd();
      return NextResponse.json({
        success: true,
        data: normalizedLearnedWords,
        source: 'learned'
      });
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      console.groupEnd();
      
      // Return empty results rather than an error to prevent blocking the conversation
      return NextResponse.json({ 
        success: true,
        data: [],
        source: 'error',
        message: 'Database error occurred, using empty word set'
      });
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    console.groupEnd();
    
    // Return empty results rather than an error to prevent blocking the conversation
    return NextResponse.json({ 
      success: true,
      data: [],
      source: 'error',
      message: 'Error occurred, using empty word set'
    });
  }
}