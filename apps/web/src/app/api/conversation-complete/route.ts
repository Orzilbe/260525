// apps/web/src/app/api/conversation-complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSafeDbPool } from '../../lib/db';
import { updateTaskWithDuration, markTaskComplete, handleConversationTaskCompletion } from '../services/taskService';

/**
 * פונקציה לקבלת פרטי משתמש מטוקן
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
 * נקודת קצה לסיום משימת שיחה
 * מטפלת בעדכון המשימה ועדכון רמת המשתמש במקביל
 */
export async function POST(request: NextRequest) {
  console.group('POST /api/conversation-complete - Handling conversation task completion');
  
  try {
    // אימות המשתמש
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('Authentication header missing');
      console.groupEnd();
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const userData = await verifyAuthToken(token);
    
    if (!userData || !userData.userId) {
      console.error('Invalid authentication token');
      console.groupEnd();
      return NextResponse.json({ success: false, message: 'Invalid authentication' }, { status: 401 });
    }
    
    // קבלת נתוני הבקשה
    const requestData = await request.json();
    const { taskId, score, duration } = requestData;
    
    // וידוא שהנתונים תקינים
    if (!taskId) {
      console.error('Task ID missing in request');
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: 'Missing required field: taskId' },
        { status: 400 }
      );
    }
    
    console.log(`Processing conversation task completion: userId=${userData.userId}, taskId=${taskId}, score=${score}`);
    
    // סימון המשימה כהושלמה
    let updateSuccess;
    
    // אם התקבל משך זמן, נשתמש בפונקציה המתאימה
    if (duration !== undefined) {
      console.log(`Using updateTaskWithDuration with duration ${duration}s`);
      const updateResult = await updateTaskWithDuration(taskId, score || 0, duration);
      updateSuccess = updateResult;
    } else {
      console.log('Using standard markTaskComplete');
      const updateResult = await markTaskComplete(taskId, score || 0);
      updateSuccess = updateResult;
    }
    
    if (!updateSuccess) {
      console.error(`Failed to update task ${taskId}`);
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: 'Failed to update task' },
        { status: 500 }
      );
    }
    
    // טיפול בהתקדמות הרמה
    const levelUpdateResult = await handleConversationTaskCompletion(userData.userId, taskId, score || 0);
    
    // הפעולה יכולה להיכשל חלקית - אם המשימה עודכנה אבל הרמה לא
    if (!levelUpdateResult) {
      console.warn(`Task updated but user level progression failed for task ${taskId}`);
      console.groupEnd();
      return NextResponse.json(
        { 
          success: true, 
          partialSuccess: true,
          message: 'Task completed but user level update failed',
          data: { taskId }
        }
      );
    }
    
    console.log('Task and user level updated successfully');
    console.groupEnd();
    return NextResponse.json({
      success: true,
      message: 'Conversation task completed and user level updated',
      data: { taskId }
    });
    
  } catch (error) {
    console.error('Error in conversation-complete API:', error);
    console.groupEnd();
    return NextResponse.json(
      { success: false, message: 'Server error', error: (error as Error).message },
      { status: 500 }
    );
  }
}