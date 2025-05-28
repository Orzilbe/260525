// apps/api/src/services/taskService.ts
import { v4 as uuidv4 } from 'uuid';
import { getDbPool } from '../lib/db';
import { TaskType } from '../models/Task';

/**
 * פונקציה מאוחדת ליצירת משימה חדשה
 * 
 * @param userId - מזהה המשתמש
 * @param topicName - שם הנושא
 * @param level - רמת המשימה (מספר או מחרוזת)
 * @param taskType - סוג המשימה
 * @returns מזהה המשימה החדשה, או null אם היצירה נכשלה
 */
export async function createTask(
  userId: string,
  topicName: string,
  level: string | number,
  taskType: string
): Promise<string | null> {
  // המרת level למחרוזת אם הוא מספר
  const levelStr = typeof level === 'number' ? level.toString() : level;
  
  console.log(`Creating new task: userId=${userId}, topicName=${topicName}, level=${levelStr}, taskType=${taskType}`);
  
  try {
    // קבלת חיבור למסד הנתונים
    const pool = await getDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return null;
    }
    
    // התחלת טרנזקציה
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // בדיקה אם המשתמש קיים
      const [userRows] = await connection.query(
        'SELECT UserId FROM Users WHERE UserId = ?',
        [userId]
      );
      
      const users = userRows as any[];
      if (users.length === 0) {
        console.error(`User ${userId} not found in Users table`);
        await connection.rollback();
        return null;
      }
      
      // בדיקה אם הנושא והרמה קיימים
      const [levelRows] = await connection.query(
        'SELECT 1 FROM Levels WHERE TopicName = ? AND Level = ?',
        [topicName, levelStr]
      );
      
      if (!Array.isArray(levelRows) || levelRows.length === 0) {
        console.error(`Topic ${topicName} with level ${levelStr} not found in Levels table`);
        await connection.rollback();
        return null;
      }
      
      // בדיקה אם כבר קיימת משימה פתוחה
      const [existingTasks] = await connection.query(
        `SELECT TaskId FROM Tasks 
         WHERE UserId = ? 
         AND TopicName = ? 
         AND Level = ? 
         AND TaskType = ? 
         AND CompletionDate IS NULL`,
        [userId, topicName, levelStr, taskType]
      );
      
      if (Array.isArray(existingTasks) && existingTasks.length > 0) {
        console.log(`Found existing incomplete task: ${(existingTasks[0] as any).TaskId}`);
        await connection.commit();
        return (existingTasks[0] as any).TaskId;
      }
      
      // יצירת מזהה למשימה חדשה
      const taskId = uuidv4();
      
      // יצירת משימה חדשה
      const [result] = await connection.query(
        `INSERT INTO Tasks 
         (TaskId, UserId, TopicName, Level, TaskType, TaskScore, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
        [taskId, userId, topicName, levelStr, taskType]
      );
      
      if (!result || (result as any).affectedRows !== 1) {
        throw new Error('Failed to create task');
      }
      
      await connection.commit();
      console.log(`Task created successfully with ID: ${taskId}`);
      return taskId;
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating task:', error);
    return null;
  }
}

/**
 * פונקציה לסימון משימה כהושלמה
 * 
 * @param taskId - מזהה המשימה
 * @param score - ציון המשימה
 * @param duration - משך הזמן (אופציונלי)
 * @returns האם העדכון הצליח
 */
export async function completeTask(
  taskId: string,
  score: number,
  duration?: number
): Promise<boolean> {
  console.log(`Completing task ${taskId} with score ${score}`);
  
  try {
    const pool = await getDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return false;
    }
    
    const completionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // חישוב משך זמן אם לא סופק
    let taskDuration = duration;
    if (!taskDuration) {
      const [taskRows] = await pool.query(
        'SELECT StartDate, TaskType FROM Tasks WHERE TaskId = ?',
        [taskId]
      );
      
      const tasks = taskRows as any[];
      if (tasks.length > 0 && tasks[0].StartDate) {
        const startDate = new Date(tasks[0].StartDate);
        const completionDateTime = new Date(completionDate);
        taskDuration = Math.floor((completionDateTime.getTime() - startDate.getTime()) / 1000);
      }
    }
    
    // עדכון המשימה
    const [result] = await pool.query(
      'UPDATE Tasks SET CompletionDate = ?, TaskScore = ?, DurationTask = ?, UpdatedAt = NOW() WHERE TaskId = ?',
      [completionDate, score, taskDuration || 0, taskId]
    );
    
    // עדכון הציון של המשתמש
    await updateUserScore(taskId, score);
    
    console.log('Task completion result:', result);
    return (result as any).affectedRows > 0;
  } catch (error) {
    console.error('Error completing task:', error);
    return false;
  }
}

/**
 * עדכון ציון המשתמש בהתבסס על המשימה שהושלמה
 * 
 * @param taskId - מזהה המשימה
 * @param score - ציון המשימה
 * @returns האם העדכון הצליח
 */
async function updateUserScore(taskId: string, score: number): Promise<boolean> {
  try {
    const pool = await getDbPool();
    if (!pool) {
      return false;
    }
    
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
    return false;
  }
}

/**
 * פונקציה להוספת מילים למשימה
 * 
 * @param taskId - מזהה המשימה
 * @param wordIds - מערך של מזהי מילים
 * @returns האם ההוספה הצליחה
 */
export async function addWordsToTask(
  taskId: string,
  wordIds: string[]
): Promise<boolean> {
  console.log(`Adding ${wordIds.length} words to task ${taskId}`);
  
  if (!wordIds.length) {
    console.log('No words to add');
    return true;
  }
  
  try {
    const pool = await getDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return false;
    }
    
    // בדיקה אם הטבלה קיימת ויצירה אם צריך
    const [tables] = await pool.query('SHOW TABLES LIKE ?', ['WordsInTask']);
    if (!Array.isArray(tables) || tables.length === 0) {
      console.log('Creating WordsInTask table');
      await pool.query(`
        CREATE TABLE WordsInTask (
          TaskId CHAR(36) NOT NULL,
          WordId CHAR(36) NOT NULL,
          PRIMARY KEY (TaskId, WordId)
        )
      `);
    }
    
    // הוספת כל המילים למשימה
    for (const wordId of wordIds) {
      try {
        await pool.query(
          'INSERT IGNORE INTO WordsInTask (TaskId, WordId) VALUES (?, ?)',
          [taskId, wordId]
        );
      } catch (error) {
        console.error(`Error adding word ${wordId} to task:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error adding words to task:', error);
    return false;
  }
}

/**
 * פונקציה לקבלת משימות של משתמש
 * 
 * @param userId - מזהה המשתמש
 * @param topicName - שם הנושא (אופציונלי)
 * @returns מערך של משימות
 */
export async function getUserTasks(
  userId: string,
  topicName?: string
): Promise<any[]> {
  console.log(`Getting tasks for user ${userId}${topicName ? ` and topic ${topicName}` : ''}`);
  
  try {
    const pool = await getDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return [];
    }
    
    let query = 'SELECT * FROM Tasks WHERE UserId = ?';
    const params: any[] = [userId];
    
    if (topicName) {
      query += ' AND TopicName = ?';
      params.push(topicName);
    }
    
    query += ' ORDER BY CompletionDate IS NULL DESC, CreatedAt DESC';
    
    const [rows] = await pool.query(query, params);
    const tasks = rows as any[];
    
    console.log(`Retrieved ${tasks.length} tasks`);
    return tasks;
  } catch (error) {
    console.error('Error getting user tasks:', error);
    return [];
  }
}