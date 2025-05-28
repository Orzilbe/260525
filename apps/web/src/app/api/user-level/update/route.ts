// apps/web/src/app/api/user-level/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSafeDbPool } from '../../../lib/db';
import jwt from 'jsonwebtoken';

/**
 * Verify auth token and extract user ID
 */
async function verifyAuthToken(token: string): Promise<{ userId: string } | null> {
  try {
    const secretKey = process.env.JWT_SECRET || 'default_secret_key';
    const decoded = jwt.verify(token, secretKey) as any;
    return { userId: decoded.userId || decoded.id };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Update user level API endpoint
 */
export async function POST(request: NextRequest) {
  console.log('POST /api/user-level/update - Request received');
  
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userData = await verifyAuthToken(token);
    
    if (!userData || !userData.userId) {
      return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 });
    }
    
    // Get request data
    const requestData = await request.json();
    console.log('Update request data:', requestData);
    
    const { topicName, currentLevel, earnedScore, taskId, isCompleted } = requestData;
    
    // Validate required data
    if (!topicName || currentLevel === undefined) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: topicName and currentLevel' },
        { status: 400 }
      );
    }
    
    const userId = userData.userId;
    console.log(`Processing level update for user ${userId}, topic ${topicName}, level ${currentLevel}`);
    
    // Get database connection
    const pool = await getSafeDbPool();
    if (!pool) {
      return NextResponse.json(
        { success: false, message: 'Database connection failed' },
        { status: 500 }
      );
    }
    
    try {
      // Begin transaction
      await pool.query('START TRANSACTION');
      
      // Calculate score
      let finalScore = earnedScore || 0;
      
      // If task is completed, mark completion date
      const completedAt = isCompleted ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
      
      // Check if user level record exists - FIXED: removed Id column
      const [existingLevelRows] = await pool.query(
        'SELECT EarnedScore FROM userinlevel WHERE UserId = ? AND TopicName = ? AND Level = ?',
        [userId, topicName, currentLevel]
      );
      
      const existingLevels = existingLevelRows as any[];
      
      if (existingLevels.length === 0) {
        // Create new user level record
        console.log(`Creating new user level record: ${userId}, ${topicName}, ${currentLevel}`);
        
        await pool.query(
          'INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore, CompletedAt) VALUES (?, ?, ?, ?, ?)',
          [userId, topicName, currentLevel, finalScore, completedAt]
        );
      } else {
        // Update existing record
        const existingLevel = existingLevels[0];
        
        // Only update score if it's higher than existing
        const scoreToUpdate = (!existingLevel.EarnedScore || finalScore > existingLevel.EarnedScore) 
          ? finalScore 
          : existingLevel.EarnedScore;
        
        console.log(`Updating existing level: ${userId}, ${topicName}, ${currentLevel}, score: ${scoreToUpdate}`);
        
        await pool.query(
          'UPDATE userinlevel SET EarnedScore = ?, CompletedAt = ? WHERE UserId = ? AND TopicName = ? AND Level = ?',
          [scoreToUpdate, completedAt, userId, topicName, currentLevel]
        );
      }
      
      // If completed, create next level if it doesn't exist
      if (isCompleted) {
        const nextLevel = currentLevel + 1;
        
        // Check if next level already exists - FIXED: removed Id column
        const [nextLevelRows] = await pool.query(
          'SELECT EarnedScore FROM userinlevel WHERE UserId = ? AND TopicName = ? AND Level = ?',
          [userId, topicName, nextLevel]
        );
        
        if ((nextLevelRows as any[]).length === 0) {
          console.log(`Creating next level ${nextLevel} for user ${userId} in topic ${topicName}`);
          
          // Create next level
          await pool.query(
            'INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore, CompletedAt) VALUES (?, ?, ?, 0, NULL)',
            [userId, topicName, nextLevel]
          );
        } else {
          console.log(`Next level ${nextLevel} already exists for user ${userId}`);
        }
      }
      
      // Commit transaction
      await pool.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: 'User level updated successfully',
        data: {
          userId,
          topicName,
          level: currentLevel,
          earnedScore: finalScore,
          completed: isCompleted,
          nextLevel: isCompleted ? currentLevel + 1 : currentLevel
        }
      });
      
    } catch (dbError) {
      // Rollback transaction on error
      console.error('Database error in user level update:', dbError);
      
      try {
        await pool.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
      
      return NextResponse.json(
        { success: false, message: 'Database error', error: (dbError as Error).message },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in user-level update API:', error);
    return NextResponse.json(
      { success: false, message: 'Server error', error: (error as Error).message },
      { status: 500 }
    );
  }
}