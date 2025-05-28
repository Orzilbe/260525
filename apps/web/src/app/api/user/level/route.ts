// apps/web/src/app/api/user/level/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getUserHighestLevel } from '../../services/userLevel';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  id?: string;  // שים לב: הטוקן יכול להחזיק id במקום userId
  userId?: string;
  email: string;
  exp?: number;
}

/**
 * פונקציה לאימות המשתמש מהבקשה
 */
async function verifyAuth(request: NextRequest): Promise<{ isValid: boolean; userId: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, userId: '' };
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'default_secret'
    ) as JWTPayload;
    
    // חשוב: הטוקן יכול להחזיק את מזהה המשתמש בשדה id או userId
    const userId = decoded.userId || decoded.id;
    
    console.log(`Token verified successfully. User ID: ${userId}`);
    
    if (!userId) {
      console.warn('Token verified but no userId/id found in token payload');
      return { isValid: false, userId: '' };
    }
    
    return { isValid: true, userId };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { isValid: false, userId: '' };
  }
}

/**
 * GET /api/user/level - מקבל את הרמה הנוכחית של המשתמש בנושא מסוים
 */
export async function GET(request: NextRequest) {
  console.group('GET /api/user/level');
  
  try {
    // Get auth token
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Unauthorized request');
      console.groupEnd();
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = authResult.userId;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const topicName = searchParams.get('topicName');
    
    if (!topicName) {
      console.error('Missing topicName parameter');
      console.groupEnd();
      return NextResponse.json(
        { message: 'Topic name is required' },
        { status: 400 }
      );
    }
    
    console.log(`Fetching level for topic: "${topicName}"`);
    console.log(`User authenticated: ${userId}`);
    
    // קבלת הרמה הגבוהה ביותר של המשתמש בנושא
    const level = await getUserHighestLevel(userId, topicName);
    console.log(`User level for topic "${topicName}": ${level}`);
    
    console.groupEnd();
    return NextResponse.json({ level });
  } catch (error) {
    console.error('Error fetching user level:', error);
    console.groupEnd();
    return NextResponse.json(
      { 
        message: 'Failed to fetch user level', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}