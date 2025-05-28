// apps/web/src/lib/dbUtils.ts
import { getDbPool, getSafeDbPool } from '../../../api/src/lib/db';
import { ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

/**
 * יוצר שיחה אינטראקטיבית חדשה בבסיס הנתונים
 * @param sessionId מזהה השיחה
 * @param taskId מזהה המשימה המקושרת
 * @param sessionType סוג השיחה (ברירת מחדל: 'conversation')
 * @returns אמת אם הצליח, שקר אחרת
 */
export async function createInteractiveSession(
  sessionId: string,
  taskId: string,
  sessionType: string = 'conversation'
): Promise<boolean> {
  try {
    // שימוש ב-getSafeDbPool כדי להימנע מזריקת שגיאה אם החיבור נכשל
    const pool = await getSafeDbPool();
    if (!pool) {
      console.warn('Database connection not available for createInteractiveSession');
      return false;
    }

    // הכנסת השיחה החדשה
    const [result] = await pool.execute(
      'INSERT INTO InteractiveSessions (SessionID, SessionType, TaskId) VALUES (?, ?, ?)',
      [sessionId, sessionType, taskId]
    );

    const header = result as ResultSetHeader;
    return header.affectedRows === 1;
  } catch (error) {
    console.error('Error creating interactive session:', error);
    return false;
  }
}

/**
 * יוצר שאלה חדשה בבסיס הנתונים
 * @param questionId מזהה השאלה
 * @param sessionId מזהה השיחה המקושרת
 * @param questionText טקסט השאלה
 * @returns אמת אם הצליח, שקר אחרת
 */
export async function createQuestion(
  questionId: string,
  sessionId: string,
  questionText: string
): Promise<boolean> {
  try {
    // שימוש ב-getSafeDbPool כדי להימנע מזריקת שגיאה אם החיבור נכשל
    const pool = await getSafeDbPool();
    if (!pool) {
      console.warn('Database connection not available for createQuestion');
      return false;
    }

    // קיצור טקסט השאלה אם הוא ארוך מדי (למניעת בעיות בבסיס הנתונים)
    const truncatedText = questionText.length > 1000 
      ? questionText.substring(0, 997) + '...' 
      : questionText;

    // הכנסת השאלה החדשה
    const [result] = await pool.execute(
      'INSERT INTO Questions (QuestionID, QuestionText, SessionID) VALUES (?, ?, ?)',
      [questionId, truncatedText, sessionId]
    );

    const header = result as ResultSetHeader;
    return header.affectedRows === 1;
  } catch (error) {
    console.error('Error creating question:', error);
    return false;
  }
}

/**
 * מעדכן שאלה עם תשובה ומשוב
 * @param questionId מזהה השאלה
 * @param answerText טקסט התשובה
 * @param feedback מידע המשוב
 * @returns אמת אם הצליח, שקר אחרת
 */
export async function updateQuestion(
  questionId: string,
  answerText?: string,
  feedback?: any
): Promise<boolean> {
  try {
    // שימוש ב-getSafeDbPool כדי להימנע מזריקת שגיאה אם החיבור נכשל
    const pool = await getSafeDbPool();
    if (!pool) {
      console.warn('Database connection not available for updateQuestion');
      return false;
    }

    // עיבוד טקסט התשובה והמשוב
    const truncatedAnswer = answerText && answerText.length > 1000 
      ? answerText.substring(0, 997) + '...' 
      : answerText;
    
    // עיבוד המשוב (יכול להיות מחרוזת או אובייקט)
    let feedbackText = feedback;
    if (feedback && typeof feedback !== 'string') {
      feedbackText = JSON.stringify(feedback);
    }
    
    const truncatedFeedback = feedbackText && feedbackText.length > 1000 
      ? feedbackText.substring(0, 997) + '...' 
      : feedbackText;

    // בניית שאילתה על סמך הפרמטרים שסופקו
    let query = 'UPDATE Questions SET';
    const params: any[] = [];
    const updates: string[] = [];

    if (truncatedAnswer !== undefined) {
      updates.push(' AnswerText = ?');
      params.push(truncatedAnswer);
    }

    if (truncatedFeedback !== undefined) {
      updates.push(' Feedback = ?');
      params.push(truncatedFeedback);
    }

    // אם אין עדכונים, החזר הצלחה
    if (updates.length === 0) {
      return true;
    }

    // השלמת השאילתה
    query += updates.join(',') + ' WHERE QuestionID = ?';
    params.push(questionId);

    // ביצוע השאילתה
    const [result] = await pool.execute(query, params);
    const header = result as ResultSetHeader;
    
    // החזר אמת אם לפחות שורה אחת הושפעה
    return header.affectedRows > 0;
  } catch (error) {
    console.error('Error updating question:', error);
    return false;
  }
}