// apps/web/src/app/api/question/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { createQuestion } from '../../lib/dbUtils';

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
 * יצירת שאלה חדשה
 */
export async function POST(request: NextRequest) {
  console.log('POST /api/question - Request received');
  
  let body: any;
  
  try {
    // בדיקת אימות
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('POST /api/question - No auth token found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
      console.error('POST /api/question - Invalid token');
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    // פענוח גוף הבקשה
    body = await request.json();
    const { QuestionId, SessionId, QuestionText } = body;
    
    console.log('POST /api/question - Request body:', {
      QuestionId,
      SessionId,
      QuestionText: QuestionText ? QuestionText.substring(0, 30) + '...' : 'missing'
    });
    
    if (!SessionId || !QuestionId || !QuestionText) {
      console.error('POST /api/question - Missing required fields');
      return NextResponse.json(
        { error: "SessionId, QuestionId, and QuestionText are required" },
        { status: 400 }
      );
    }
    
    // יצירת שאלה באמצעות פונקציית העזר
    const success = await createQuestion(QuestionId, SessionId, QuestionText);
    
    if (success) {
      console.log(`Successfully created question ${QuestionId} for session ${SessionId}`);
    } else {
      console.warn(`Failed to create question in database, using local question ID`);
    }
    
    // החזרת נתוני השאלה בין אם פעולת מסד הנתונים הצליחה או לא
    return NextResponse.json({
      success: true,
      QuestionId,
      SessionId,
      QuestionText
    });
  } catch (error) {
    console.error("Error in question API:", error);
    
    // יצירת מזהה שאלה חלופי במקרה של שגיאה
    const fallbackQuestionId = uuidv4();
    
    return NextResponse.json({
      success: true,
      message: 'Using fallback question ID due to error',
      error: error instanceof Error ? error.message : 'Unknown error',
      QuestionId: fallbackQuestionId,
      SessionId: body?.SessionId || 'unknown',
      QuestionText: body?.QuestionText || 'Error occurred'
    });
  }
}