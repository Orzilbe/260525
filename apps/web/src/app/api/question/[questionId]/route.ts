// apps/web/src/app/api/question/[questionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { updateQuestion } from '../../../lib/dbUtils';

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
 * עדכון שאלה עם תשובה ומשוב
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  const questionId = params.questionId;
  console.log(`PATCH /api/question/${questionId} - Request received`);
  
  try {
    // בדיקת אימות
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error(`PATCH /api/question/${questionId} - No auth token found`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
      console.error(`PATCH /api/question/${questionId} - Invalid token`);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    // פענוח גוף הבקשה
    const body = await request.json();
    const { AnswerText, Feedback } = body;
    
    console.log(`PATCH /api/question/${questionId} - Request body:`, {
      AnswerText: AnswerText ? AnswerText.substring(0, 30) + '...' : 'missing',
      Feedback: Feedback ? (typeof Feedback === 'string' ? Feedback.substring(0, 30) + '...' : 'object') : 'missing'
    });
    
    if (!AnswerText && !Feedback) {
      console.error(`PATCH /api/question/${questionId} - Missing required fields`);
      return NextResponse.json(
        { error: "At least one of AnswerText or Feedback is required" },
        { status: 400 }
      );
    }
    
    // עדכון השאלה באמצעות פונקציית העזר
    const success = await updateQuestion(questionId, AnswerText, Feedback);
    
    if (success) {
      console.log(`Successfully updated question ${questionId}`);
    } else {
      console.warn(`Failed to update question in database`);
    }
    
    // החזרת תגובה בין אם פעולת מסד הנתונים הצליחה או לא
    return NextResponse.json({
      success: true,
      QuestionId: questionId,
      ...(AnswerText !== undefined && { AnswerText }),
      ...(Feedback !== undefined && { Feedback })
    });
  } catch (error) {
    console.error(`Error in question update API for ${questionId}:`, error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to update question",
        details: error instanceof Error ? error.message : 'Unknown error',
        QuestionId: params.questionId
      },
      { status: 500 }
    );
  }
}