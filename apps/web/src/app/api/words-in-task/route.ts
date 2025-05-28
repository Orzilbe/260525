// apps/web/src/app/api/words-in-task/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSafeDbPool } from '../../lib/db';

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
 * בדיקה אם טבלה קיימת
 */
async function doesTableExist(pool: any, tableName: string): Promise<boolean> {
  try {
    const [result] = await pool.query('SHOW TABLES LIKE ?', [tableName]);
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * הוספת מילים למשימה - POST /api/words-in-task
 */
export async function POST(request: NextRequest) {
  console.log("API Words-In-Task - Adding words to task");
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
    
    const taskId = body.taskId;
    const wordIds = body.wordIds || [];
    
    if (!taskId) {
      console.error('Missing task ID');
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      console.error('Missing or invalid word IDs');
      return NextResponse.json({ error: 'Word IDs must be a non-empty array' }, { status: 400 });
    }
    
    // בדיקה אם המשימה שייכת למשתמש
    const isOwned = await isTaskOwnedByUser(taskId, authResult.userId);
    if (!isOwned) {
      console.error(`Task ${taskId} does not belong to user ${authResult.userId}`);
      return NextResponse.json({ error: 'You do not have permission to modify this task' }, { status: 403 });
    }
    
    // קבלת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    // בדיקה ויצירת טבלה אם לא קיימת
    const tablesToCheck = ['wordintask'];
    let tableExists = false;
    let tableToUse = 'wordintask'; // Always use 'wordintask' (lowercase) for consistency
    
    tableExists = await doesTableExist(pool, tableToUse);
    
    if (!tableExists) {
      console.log('No word-task relationship table found, creating one');
      
      try {
        await pool.query(`
          CREATE TABLE ${tableToUse} (
            TaskId CHAR(36) NOT NULL,
            WordId CHAR(36) NOT NULL,
            AddedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (TaskId, WordId)
          )
        `);
        console.log(`Created new table: ${tableToUse}`);
      } catch (createError) {
        console.error('Error creating word-task table:', createError);
        return NextResponse.json({ 
          error: 'Failed to create word-task relationship table', 
          details: createError instanceof Error ? createError.message : 'Unknown error'
        }, { status: 500 });
      }
    } else {
      console.log(`Using existing table: ${tableToUse}`);
    }
    
    // בדיקת מבנה הטבלה
    try {
      const [columns] = await pool.query(`SHOW COLUMNS FROM ${tableToUse}`);
      const hasAddedAt = (columns as any[]).some((col: any) => col.Field === 'AddedAt');
      
      // אם אין שדה AddedAt, ננסה להוסיף אותו
      if (!hasAddedAt) {
        try {
          await pool.query(`
            ALTER TABLE ${tableToUse} 
            ADD COLUMN AddedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          `);
          console.log(`Added AddedAt column to ${tableToUse}`);
        } catch (alterError) {
          console.warn(`Could not add AddedAt column to ${tableToUse}:`, alterError);
          // נמשיך בכל זאת
        }
      }
    } catch (error) {
      console.warn('Error checking table columns:', error);
      // נמשיך בכל זאת
    }
    
    // הוספת המילים לטבלה
    let successCount = 0;
    let errors = [];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    try {
      // ננסה להוסיף את כל המילים בבת אחת
      const values = wordIds.map(wordId => [taskId, wordId, now]);
      const placeholders = values.map(() => '(?, ?, ?)').join(', ');
      
      if (values.length > 0) {
        try {
          // בדיקה אם הטבלה תומכת בAddedAt
          let query;
          let flatValues;
          
          if (await doesColumnExist(pool, tableToUse, 'AddedAt')) {
            query = `INSERT IGNORE INTO ${tableToUse} (TaskId, WordId, AddedAt) VALUES ${placeholders}`;
            flatValues = values.flat();
          } else {
            // ללא AddedAt
            query = `INSERT IGNORE INTO ${tableToUse} (TaskId, WordId) VALUES ` + 
                   values.map(() => '(?, ?)').join(', ');
            flatValues = values.map(v => [v[0], v[1]]).flat();
          }
          
          console.log(`Adding ${values.length} words to ${tableToUse}, SQL:`, query);
          
          const [result] = await pool.query(query, flatValues);
          successCount = (result as any).affectedRows || 0;
          console.log(`Bulk insert successful, added ${successCount} words`);
        } catch (bulkError) {
          console.error('Bulk insert failed, trying individual inserts:', bulkError);
          
          // אם הוספה מרוכזת נכשלה, ננסה אחד-אחד
          for (const wordId of wordIds) {
            try {
              let query;
              let params;
              
              if (await doesColumnExist(pool, tableToUse, 'AddedAt')) {
                query = `INSERT IGNORE INTO ${tableToUse} (TaskId, WordId, AddedAt) VALUES (?, ?, ?)`;
                params = [taskId, wordId, now];
              } else {
                query = `INSERT IGNORE INTO ${tableToUse} (TaskId, WordId) VALUES (?, ?)`;
                params = [taskId, wordId];
              }
              
              const [result] = await pool.query(query, params);
              
              if ((result as any).affectedRows > 0) {
                successCount++;
              }
            } catch (individualError) {
              console.error(`Error adding word ${wordId}:`, individualError);
              errors.push(wordId);
            }
          }
          
          console.log(`Individual inserts completed, added ${successCount} words`);
        }
      }
    } catch (insertError) {
      console.error('All insertion attempts failed:', insertError);
      return NextResponse.json({ 
        error: 'Failed to add words to task', 
        details: insertError instanceof Error ? insertError.message : 'Unknown error'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      taskId,
      wordsAdded: successCount,
      totalWords: wordIds.length,
      errors: errors.length > 0 ? errors : undefined,
      tableName: tableToUse
    });
  } catch (error) {
    console.error('Error adding words to task:', error);
    return NextResponse.json({ 
      error: 'An error occurred while adding words to task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}

/**
 * בדיקה אם עמודה קיימת בטבלה
 */
async function doesColumnExist(pool: any, tableName: string, columnName: string): Promise<boolean> {
  try {
    const [columns] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
    return Array.isArray(columns) && columns.length > 0;
  } catch (error) {
    console.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
    return false;
  }
}

/**
 * קבלת מילים של משימה - GET /api/words-in-task?taskId={taskId}
 */
export async function GET(request: NextRequest) {
  console.log("API Words-In-Task - Getting words for task");
  try {
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // קבלת פרמטרים מה-URL
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      console.error('Missing task ID');
      return NextResponse.json({ error: 'Task ID parameter is required' }, { status: 400 });
    }
    
    // בדיקה אם המשימה שייכת למשתמש
    const isOwned = await isTaskOwnedByUser(taskId, authResult.userId);
    if (!isOwned) {
      console.error(`Task ${taskId} does not belong to user ${authResult.userId}`);
      return NextResponse.json({ error: 'You do not have permission to view this task' }, { status: 403 });
    }
    
    // קבלת המילים של המשימה
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    // בדיקה איזו טבלה קיימת
    const tableNames = ['wordintask', 'WordsInTask', 'WordInTask'];
    let tableToUse = '';
    
    for (const tableName of tableNames) {
      if (await doesTableExist(pool, tableName)) {
        tableToUse = tableName;
        break;
      }
    }
    
    if (!tableToUse) {
      console.error('No word-task relationship table found');
      return NextResponse.json({ 
        success: false,
        error: 'No word-task relationship table found',
        data: []
      });
    }
    
    console.log(`Using table ${tableToUse} to get words for task ${taskId}`);
    
    // שליפת המילים עם פרטים נוספים
    try {
      const hasAddedAt = await doesColumnExist(pool, tableToUse, 'AddedAt');
      
      // בניית שאילתה בהתאם למבנה הטבלה
      let query;
      
      if (hasAddedAt) {
        query = `
          SELECT wit.WordId, wit.AddedAt, w.Word, w.Translation, w.ExampleUsage, w.PartOfSpeech, w.TopicName
          FROM ${tableToUse} wit
          JOIN Words w ON wit.WordId = w.WordId
          WHERE wit.TaskId = ?
          ORDER BY wit.AddedAt DESC
        `;
      } else {
        query = `
          SELECT wit.WordId, NOW() as AddedAt, w.Word, w.Translation, w.ExampleUsage, w.PartOfSpeech, w.TopicName
          FROM ${tableToUse} wit
          JOIN Words w ON wit.WordId = w.WordId
          WHERE wit.TaskId = ?
        `;
      }
      
      const [rows] = await pool.query(query, [taskId]);
      
      console.log(`Retrieved ${Array.isArray(rows) ? rows.length : 0} words for task ${taskId}`);
      return NextResponse.json({ 
        success: true, 
        taskId,
        data: rows 
      });
    } catch (error) {
      console.error('Error getting words for task:', error);
      return NextResponse.json({ 
        error: 'An error occurred while getting words for task',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { 
        status: 500 
      });
    }
  } catch (error) {
    console.error('Error getting words for task:', error);
    return NextResponse.json({ 
      error: 'An error occurred while getting words for task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}