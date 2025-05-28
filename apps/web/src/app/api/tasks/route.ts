// apps/web/src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createTask, markTaskComplete, addWordsToTask, getUserTasks, updateTaskWithDuration } from '../services/taskService';

/**
 * פונקציה לחילוץ מזהה משתמש מהטוקן
 */
function getUserIdFromToken(token: string): string | null {
  try {
    // הוספת לוג לדיבוג
    console.log(`מנסה לפענח טוקן: ${token.slice(0, 15)}...`);
    
    let decoded;
    try {
      // ניסיון לפענח עם המפתח הסודי המוגדר
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as any;
    } catch (verifyError) {
      console.error('שגיאת אימות טוקן רגילה:', verifyError);
      // נסה גם עם מפתח משני במידה וקיים
      if (process.env.SECONDARY_JWT_SECRET) {
        try {
          decoded = jwt.verify(token, process.env.SECONDARY_JWT_SECRET) as any;
        } catch (secondaryError) {
          console.error('שגיאת אימות גם עם המפתח המשני:', secondaryError);
          return null;
        }
      } else {
        return null;
      }
    }
    
    // בדוק את המבנה של האובייקט המפוענח
    console.log('מבנה האובייקט המפוענח:', Object.keys(decoded).join(', '));
    
    // נסה למצוא את מזהה המשתמש (ייתכן שנקרא userId או sub או משהו אחר)
    const userId = decoded.userId || decoded.sub || decoded.id;
    
    if (!userId) {
      console.error('לא נמצא שדה מזהה משתמש בטוקן המפוענח');
    }
    
    return userId || null;
  } catch (error) {
    console.error('שגיאה כללית בפענוח טוקן:', error);
    return null;
  }
}

/**
 * פונקציה לאימות המשתמש מהבקשה
 */
async function verifyAuth(request: NextRequest): Promise<{ isValid: boolean; userId: string }> {
  // הצגת הכותרים שהגיעו בבקשה
  const headers = Object.fromEntries(request.headers.entries());
  console.log('כותרי הבקשה:', JSON.stringify(headers));
  
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  
  if (!authHeader) {
    console.error('לא נמצא כותר אימות בבקשה');
    return { isValid: false, userId: '' };
  }
  
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;
  
  if (!token) {
    console.error('לא נמצא טוקן בכותר האימות');
    return { isValid: false, userId: '' };
  }
  
  const userId = getUserIdFromToken(token);
  
  console.log(`תוצאת אימות: ${!!userId ? 'הצלחה' : 'כישלון'}, userId=${userId || 'לא נמצא'}`);
  
  return { isValid: !!userId, userId: userId || '' };
}

/**
 * יצירת משימה חדשה - POST /api/tasks
 */
export async function POST(request: NextRequest) {
  console.log("API Tasks - Creating new task");
  try {
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      return NextResponse.json({ error: 'Authentication required', details: 'Token verification failed' }, { status: 401 });
    }
    
    // ניתוח גוף הבקשה
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // הוצאת ושיטוח פרמטרים (תמיכה בפורמטים שונים של פרמטרים)
    const providedUserId = body.UserId || body.userId;
    const topicName = body.topic || body.TopicName || body.topicName;
    const level = body.level || body.Level || '1';
    const taskType = body.taskType || body.TaskType || 'flashcard';
    
    // שימוש במזהה המשתמש מהטוקן אם לא סופק
    let userId = providedUserId || authResult.userId;
    
    // וידוא שמשתמש רשאי ליצור משימות רק לעצמו
    if (providedUserId && providedUserId !== authResult.userId) {
      console.warn(`User ID mismatch: Token userId=${authResult.userId}, Request UserId=${providedUserId}`);
    }
    
    // וידוא שסופק שם נושא
    if (!topicName) {
      console.error('Missing topic name');
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }
    
    // יצירת המשימה
    console.log(`Creating task: userId=${userId}, topicName=${topicName}, level=${level}, taskType=${taskType}`);
    const taskId = await createTask(userId, topicName, level, taskType);
    
    if (taskId) {
      console.log(`Task created successfully with ID: ${taskId}`);
      return NextResponse.json({ 
        success: true,
        TaskId: taskId,
        UserId: userId,
        TopicName: topicName,
        Level: level,
        TaskType: taskType,
        StartDate: new Date().toISOString()
      });
    } else {
      console.error('Task creation failed');
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in task creation:', error);
    return NextResponse.json({ 
      error: 'An error occurred during task creation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}



/**
 * עדכון משימה - PUT /api/tasks
 */
export async function PUT(request: NextRequest) {
  console.group("API Tasks - Updating task");
  try {
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // ניתוח גוף הבקשה
    const body = await request.json();
    console.log('Update request body:', JSON.stringify(body, null, 2));
    
    // הוצאת פרמטרים (תמיכה בפורמטים שונים של פרמטרים)
    const taskId = body.taskId || body.TaskId;
    const score = body.score || body.TaskScore || 100;
    const wordIds = body.wordIds || [];
    const durationTask = body.DurationTask || body.durationTask;
    
    if (!taskId) {
      console.error('Missing task ID');
      console.groupEnd();
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    console.log(`Processing task update for taskId=${taskId}, score=${score}, durationTask=${durationTask || 'not specified'}`);
    
    // סימון המשימה כהושלמה
    let completed = false;
    if (typeof durationTask === 'number') {
      console.log(`Updating task with explicit duration: ${durationTask} seconds`);
      
      try {
        // להשתמש בפונקציה עם משך זמן מפורש אם היא קיימת
        const { updateTaskWithDuration } = await import('../services/taskService');
        
        if (typeof updateTaskWithDuration === 'function') {
          completed = await updateTaskWithDuration(taskId, score, durationTask);
        } else {
          console.log('updateTaskWithDuration not found, falling back to markTaskComplete');
          completed = await markTaskComplete(taskId, score);
        }
      } catch (importError) {
        console.error('Error importing updateTaskWithDuration:', importError);
        console.log('Falling back to markTaskComplete');
        completed = await markTaskComplete(taskId, score);
      }
    } else {
      console.log(`Completing task without explicit duration`);
      completed = await markTaskComplete(taskId, score);
    }
    
    if (completed && wordIds.length > 0) {
      // הוספת מילים למשימה אם סופקו
      console.log(`Adding ${wordIds.length} words to task ${taskId}`);
      await addWordsToTask(taskId, wordIds);
    }
    
    if (completed) {
      console.log(`Task ${taskId} completed successfully`);
      console.groupEnd();
      return NextResponse.json({ 
        success: true,
        TaskId: taskId,
        CompletionDate: new Date().toISOString(),
        TaskScore: score
      });
    } else {
      console.error(`Failed to complete task ${taskId}`);
      console.groupEnd();
      return NextResponse.json({ error: 'Task completion failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in task update:', error);
    console.groupEnd();
    return NextResponse.json({ 
      error: 'An error occurred during task update',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}

/**
 * קבלת משימות - GET /api/tasks
 */
export async function GET(request: NextRequest) {
  console.log("API Tasks - Getting user tasks");
  try {
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // קבלת פרמטרים מה-URL
    const searchParams = request.nextUrl.searchParams;
    const topicName = searchParams.get('topicName');
    
    // קבלת המשימות של המשתמש
    const tasks = await getUserTasks(authResult.userId);
    
    // סינון לפי נושא אם נדרש
    const filteredTasks = topicName 
      ? tasks.filter(task => task.TopicName === topicName || task.TopicName === topicName.toLowerCase())
      : tasks;
    
    console.log(`Retrieved ${filteredTasks.length} tasks for user ${authResult.userId}`);
    return NextResponse.json(filteredTasks);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    return NextResponse.json({ 
      error: 'An error occurred while fetching tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}