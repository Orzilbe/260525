// apps/web/src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSafeDbPool } from '../../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * פונקציה לחילוץ מזהה משתמש מטוקן
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
 * פונקציה לאימות המשתמש מהבקשה
 */
async function verifyAuth(request: NextRequest): Promise<{ isValid: boolean; userId: string }> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  
  if (!token) {
    return { isValid: false, userId: '' };
  }
  
  const userId = getUserIdFromToken(token);
  return { isValid: !!userId, userId: userId || '' };
}

/**
 * פונקציה לבדיקה אם המשימה שייכת למשתמש
 */
async function isTaskOwnedByUser(taskId: string, userId: string): Promise<boolean> {
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return false;
    }
    
    const [rows] = await pool.query(
      'SELECT 1 FROM Tasks WHERE TaskId = ? AND UserId = ?',
      [taskId, userId]
    );
    
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    console.error('Error checking task ownership:', error);
    return false;
  }
}

/**
 * יצירת משימה חדשה - POST /api/tasks
 */
export async function POST(request: NextRequest) {
  console.log("API Tasks - Creating new task");
  try {
    // קבלת כותרות הבקשה ולוג לדיבוג
    const headers = Object.fromEntries(request.headers.entries());
    console.log('כותרי הבקשה:', JSON.stringify(headers));
    
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // ניתוח גוף הבקשה
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // עיבוד ה-UserId - אם לא סופק, השתמש במה שהגיע מהטוקן
    let userId = body.UserId;
    if (!userId) {
      userId = authResult.userId;
    }
    console.log(`Creating task: userId=${userId}, topicName=${body.TopicName}, level=${body.Level}, taskType=${body.TaskType}`);
    
    // קבלת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    // בדיקה אם כבר קיימת משימה פתוחה
    const [existingTasks] = await pool.query(
      `SELECT TaskId FROM Tasks 
       WHERE UserId = ? 
       AND TopicName = ? 
       AND Level = ? 
       AND TaskType = ? 
       AND CompletionDate IS NULL`,
      [userId, body.TopicName, body.Level, body.TaskType]
    );
    
    if (Array.isArray(existingTasks) && existingTasks.length > 0) {
      console.log(`Found existing incomplete task: ${(existingTasks[0] as any).TaskId}`);
      return NextResponse.json({ 
        TaskId: (existingTasks[0] as any).TaskId,
        message: 'Using existing task'
      });
    }
    
    // יצירת מזהה למשימה חדשה
    const taskId = uuidv4();
    
    // יצירת משימה חדשה
    const [result] = await pool.query(
      `INSERT INTO Tasks 
       (TaskId, UserId, TopicName, Level, TaskType, TaskScore, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [taskId, userId, body.TopicName, body.Level, body.TaskType]
    );
    
    if (!(result as any).affectedRows) {
      console.error('Failed to create task');
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
    
    console.log(`Task created successfully with ID: ${taskId}`);
    return NextResponse.json({ 
      TaskId: taskId,
      message: 'Task created successfully' 
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ 
      error: 'An error occurred while creating task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}

/**
 * עדכון משימה קיימת - PUT /api/tasks
 */
export async function PUT(request: NextRequest) {
  console.log("API Tasks - Updating task");
  try {
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // ניתוח גוף הבקשה
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // וידוא שיש מזהה משימה
    const taskId = body.taskId;
    if (!taskId) {
      console.error('Missing task ID');
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    // בדיקה אם המשימה שייכת למשתמש
    const isOwned = await isTaskOwnedByUser(taskId, authResult.userId);
    if (!isOwned) {
      console.error(`Task ${taskId} does not belong to user ${authResult.userId}`);
      return NextResponse.json({ error: 'You do not have permission to modify this task' }, { status: 403 });
    }
    
    // הכנת ערכי העדכון
    const updates: any = {};
    const params: any[] = [];
    
    // רשימת שדות שניתן לעדכן
    const allowedFields = [
      'TaskScore', 'CompletionDate', 'DurationTask', 'StartDate'
    ];
    
    // הכנת שאילתת העדכון
    let updateQuery = 'UPDATE Tasks SET ';
    const updateParts: string[] = [];
    
    // הוספת שדות לעדכון
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateParts.push(`${field} = ?`);
        params.push(body[field]);
        updates[field] = body[field];
      }
    }
    
    // הוספת תאריך עדכון
    updateParts.push('UpdatedAt = NOW()');
    
    // אם אין שדות לעדכון, החזר שגיאה
    if (updateParts.length <= 1) {
      console.error('No fields to update');
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    
    // השלמת השאילתה
    updateQuery += updateParts.join(', ') + ' WHERE TaskId = ?';
    params.push(taskId);
    
    console.log(`Updating task ${taskId} with:`, updates);
    console.log('Query:', updateQuery);
    console.log('Params:', params);
    
    // קבלת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    // ביצוע העדכון
    const [result] = await pool.query(updateQuery, params);
    
    if ((result as any).affectedRows === 0) {
      console.error(`No rows affected updating task ${taskId}`);
      return NextResponse.json({ error: 'Task not found or not updated' }, { status: 404 });
    }
    
    console.log(`Task ${taskId} updated successfully`);
    
    // אם יש עדכון ציון, עדכן גם את הציון של המשתמש
    if (body.TaskScore !== undefined || body.CompletionDate !== undefined) {
      try {
        await updateUserScore(pool, taskId, body.TaskScore || 100);
      } catch (scoreError) {
        console.error('Error updating user score:', scoreError);
        // נמשיך למרות השגיאה
      }
    }
    
    return NextResponse.json({ 
      success: true,
      taskId: taskId,
      message: 'Task updated successfully' 
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ 
      error: 'An error occurred while updating task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}

/**
 * עדכון ציון המשתמש
 */
async function updateUserScore(pool: any, taskId: string, score: number): Promise<boolean> {
  try {
    // קבלת פרטי המשימה
    const [tasks] = await pool.query(
      'SELECT UserId, TopicName, Level, TaskType FROM Tasks WHERE TaskId = ?',
      [taskId]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return false;
    }
    
    const task = tasks[0] as any;
    
    // Skip score update for flashcard tasks
    if (task.TaskType === 'FLASHCARD') {
      console.log('Skipping score update for flashcard task');
      return true;
    }
    
    // עדכון הציון של המשתמש ברמה הספציפית
    await pool.query(
      `INSERT INTO UserINLevel (TopicName, Level, UserId, EarnedScore, CompletedAt) 
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE EarnedScore = ?, CompletedAt = NOW()`,
      [task.TopicName, task.Level, task.UserId, score, score]
    );
    
    // עדכון הציון הכללי של המשתמש
    await pool.query(
      `UPDATE Users 
       SET Score = COALESCE(Score, 0) + ?
       WHERE UserId = ?`,
      [score, task.UserId]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating user score:', error);
    throw error;
  }
}

/**
 * עדכון משימה - PATCH /api/tasks/:taskId
 */
export async function PATCH(request: NextRequest) {
  // העברה לפונקציה הראשית
  return PUT(request);
}