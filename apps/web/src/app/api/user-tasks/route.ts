// apps/web/src/app/api/user-tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSafeDbPool } from '../../../../../api/src/lib/db';
import jwt from 'jsonwebtoken';
import { formatTopicNameForDb, formatTopicNameForUrl, areTopicNamesEquivalent } from '../../lib/topicUtils';


interface JWTPayload {
  userId: string;
  email: string;
  englishLevel?: string;
  exp?: number;
}
/**
 * פונקציה לאימות המשתמש מהבקשה
 */
async function verifyAuth(request: NextRequest) {
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
    
    return { isValid: true, userId: decoded.userId };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { isValid: false, userId: '' };
  }
}

/**
 * GET /api/user-tasks - קבלת משימות של המשתמש בנושא מסוים
 * 
 * Query Parameters:
 * - topicName: שם הנושא
 * 
 * Headers:
 * - Authorization: Bearer [jwt token]
 */
export async function GET(request: NextRequest) {
  console.group('GET /api/user-tasks');
  console.log('Request received');
  
  try {
    // אימות המשתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.log('Unauthorized request');
      console.groupEnd();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId;
    console.log(`Authenticated userId: ${userId}`);
    
    // קבלת פרמטרים מה-URL
    const searchParams = request.nextUrl.searchParams;
    const topicName = searchParams.get('topicName');
    console.log(`TopicName parameter: "${topicName}"`);

    // וידוא שהפרמטרים קיימים
    if (!topicName) {
      console.log('Missing topicName parameter');
      console.groupEnd();
      return NextResponse.json(
        { error: 'Missing required parameter: topicName' },
        { status: 400 }
      );
    }

    // פורמט שם הנושא באופן עקבי
    const dbTopicName = formatTopicNameForDb(topicName);
    const urlTopicName = formatTopicNameForUrl(topicName);
    
    console.log(`Formatted topic names - DB: "${dbTopicName}", URL: "${urlTopicName}"`);

    // השגת חיבור למסד הנתונים
    console.log('Getting database connection');
    const pool = await getSafeDbPool();
    
    if (!pool) {
      // החזרת מערך ריק אם מסד הנתונים אינו זמין
      console.warn('Database connection not available, returning empty tasks array');
      console.groupEnd();
      return NextResponse.json([]);
    }

    // שליפת המשימות מהמסד נתונים עבור המשתמש והנושא
    console.log(`Querying tasks for userId: ${userId}, topicName: "${dbTopicName}"`);
    
    // שימוש בשאילתא שתתאים לכל צורות הפורמט האפשריות של שם הנושא
    const [tasks] = await pool.query(
      `SELECT * FROM Tasks 
       WHERE UserId = ? AND (
         TopicName = ? OR 
         TopicName = ? OR
         LOWER(TopicName) = LOWER(?) OR
         LOWER(TopicName) = LOWER(?) OR
         REPLACE(LOWER(TopicName), ' ', '-') = LOWER(?) OR
         REPLACE(LOWER(?), '-', ' ') = LOWER(TopicName)
       )
       ORDER BY Level ASC, StartDate DESC`,
      [userId, dbTopicName, urlTopicName, dbTopicName, urlTopicName, urlTopicName, urlTopicName]
    );

    console.log(`Found ${Array.isArray(tasks) ? tasks.length : 0} tasks`);
    
    // לפרמט את כל המשימות כך ששם הנושא יהיה בפורמט אחיד
    const formattedTasks = Array.isArray(tasks) ? (tasks as any[]).map(task => ({
      ...task,
      TopicName: dbTopicName // הפיכת שם הנושא לפורמט אחיד
    })) : [];
    
    if (formattedTasks.length > 0) {
      const firstTask = formattedTasks[0];
      console.log(`First task: TaskId=${firstTask.TaskId}, TaskType=${firstTask.TaskType}, Level=${firstTask.Level}`);
    }

    console.groupEnd();
    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    // החזרת מערך ריק במקום שגיאה כדי למנוע שבירת ממשק המשתמש
    console.log('Error occurred, returning empty array');
    console.groupEnd();
    return NextResponse.json([]);
  }
}
