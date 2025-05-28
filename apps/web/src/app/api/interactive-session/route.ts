// apps/web/src/app/api/interactive-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { createInteractiveSession } from '../../../lib/dbUtils';

// פונקציה לחילוץ מזהה המשתמש מהטוקן
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
 * יצירת שיחה אינטראקטיבית חדשה
 */
export async function POST(request: NextRequest) {
  console.log('POST /api/interactive-session - Request received');
  
  let body: any;
  
  try {
    // בדיקת אימות
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('POST /api/interactive-session - No auth token found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
      console.error('POST /api/interactive-session - Invalid token');
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    // פענוח גוף הבקשה
    body = await request.json();
    const { taskId, sessionType = 'conversation' } = body;
    
    console.log('POST /api/interactive-session - Request body:', body);
    
    if (!taskId) {
      console.error('POST /api/interactive-session - No taskId provided');
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }
    
    // יצירת מזהה שיחה ייחודי
    const sessionId = body.SessionId || uuidv4();
    console.log(`Generated session ID: ${sessionId} for task ${taskId}`);
    
    // יצירת שיחה אינטראקטיבית באמצעות פונקציית העזר
    const success = await createInteractiveSession(sessionId, taskId, sessionType);
    
    if (success) {
      console.log(`Successfully created interactive session ${sessionId} for task ${taskId}`);
    } else {
      console.warn(`Failed to create interactive session in database, using local session ID`);
    }
    
    // החזרת מזהה השיחה בין אם פעולת מסד הנתונים הצליחה או לא
    return NextResponse.json({
      success: true,
      SessionId: sessionId,
      TaskId: taskId,
      SessionType: sessionType
    });
  } catch (error) {
    console.error("Error in interactive-session API:", error);
    
    // יצירת מזהה שיחה חלופי במקרה של שגיאה
    const fallbackSessionId = uuidv4();
    
    return NextResponse.json({
      success: true,
      message: 'Using fallback session ID due to error',
      error: error instanceof Error ? error.message : 'Unknown error',
      SessionId: fallbackSessionId,
      TaskId: body?.taskId || 'unknown',
      SessionType: body?.sessionType || 'conversation'
    });
  }
}