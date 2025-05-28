// apps/web/src/app/api/services/taskService.ts
import { getAuthToken } from '../../lib/auth';
import { getSafeDbPool } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

// Flashcard interface definition
interface Flashcard {
  WordId: string;
  Word: string;
  Translation: string;
  ExampleUsage: string;
  TopicName: string;
  StartDate?: string;
}

/**
 * המרת שם נושא מפורמט URL לפורמט מסד הנתונים
 * למשל: 'society-and-multiculturalism' -> 'Society and Multiculturalism'
 */
function formatTopicName(urlTopicName: string): string {
  // ההמרה - החלפת מקפים ברווחים והפיכת האות הראשונה של כל מילה לגדולה
  return urlTopicName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * המרת שם נושא מפורמט מסד הנתונים לפורמט URL
 * למשל: 'Society and Multiculturalism' -> 'society-and-multiculturalism'
 */
function formatTopicNameForUrl(dbTopicName: string): string {
  return dbTopicName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * פונקציה לוידוא שהנושא והרמה קיימים
 */
async function ensureTopicLevelExists(connection: any, urlTopicName: string, levelNum: number): Promise<boolean> {
  try {
    // המרת שם הנושא מפורמט URL לפורמט מסד הנתונים
    const dbTopicName = formatTopicName(urlTopicName);
    
    console.log(`Checking if topic ${dbTopicName} with level ${levelNum} exists`);
    
    // בדיקה אם הנושא קיים בטבלת topics
    const [topicRows] = await connection.query(
      'SELECT 1 FROM topics WHERE TopicName = ?',
      [dbTopicName]
    );
    
    if (!Array.isArray(topicRows) || topicRows.length === 0) {
      console.warn(`Topic ${dbTopicName} does not exist in database`);
      // במקום ליצור את הנושא, אולי כדאי לחפש אותו בצורה חופשית יותר
      const [similarTopics] = await connection.query(
        'SELECT TopicName FROM topics WHERE TopicName LIKE ?',
        [`%${urlTopicName.split('-')[0]}%`]
      );
      
      if (Array.isArray(similarTopics) && similarTopics.length > 0) {
        // מצאנו נושא דומה, נשתמש בו
        const foundTopic = (similarTopics[0] as any).TopicName;
        console.log(`Found similar topic: ${foundTopic} instead of ${dbTopicName}`);
        return await checkLevelExists(connection, foundTopic, levelNum);
      } else {
        console.error(`No similar topics found for ${urlTopicName}`);
        return false;
      }
    }
    
    // בדיקה אם הרמה קיימת
    return await checkLevelExists(connection, dbTopicName, levelNum);
    
  } catch (error) {
    console.error('Error ensuring topic and level exist:', error);
    return false;
  }
}

/**
 * פונקציה לבדיקה אם רמה קיימת (הופרדה לפונקציה נפרדת)
 */
async function checkLevelExists(connection: any, dbTopicName: string, levelNum: number): Promise<boolean> {
  try {
    // בדיקה אם הרמה קיימת בטבלת levels
    const [levelRows] = await connection.query(
      'SELECT 1 FROM levels WHERE TopicName = ? AND Level = ?',
      [dbTopicName, levelNum]
    );
    
    if (!Array.isArray(levelRows) || levelRows.length === 0) {
      console.warn(`Level ${levelNum} for topic ${dbTopicName} does not exist`);
      
      // בדיקת מבנה טבלת levels
      const [columnsResult] = await connection.query('SHOW COLUMNS FROM levels');
      const columns = columnsResult as any[];
      
      if (columns.length < 2) {
        console.error('Invalid levels table structure');
        return false;
      }
      
      // יצירת מחרוזת השאילתה בהתאם למבנה הטבלה
      let insertQuery = 'INSERT INTO levels (TopicName, Level';
      let valuesQuery = 'VALUES (?, ?';
      let params = [dbTopicName, levelNum];
      
      // הוספת העמודה השלישית אם קיימת (לפי הנתונים שלך, זה 150)
      if (columns.length >= 3) {
        const thirdColumnName = columns[2].Field;
        insertQuery += `, ${thirdColumnName}`;
        valuesQuery += ', ?';
        params.push(150); // ערך ברירת מחדל לעמודה השלישית
      }
      
      insertQuery += ') ' + valuesQuery + ')';
      
      try {
        await connection.query(insertQuery, params);
        console.log(`Created level ${levelNum} for topic ${dbTopicName}`);
        return true;
      } catch (createLevelError) {
        console.error('Failed to create level:', createLevelError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking level existence:', error);
    return false;
  }
}

/**
 * מטפל בסיום משימת שיחה - מעדכן את טבלת userinlevel ומוסיף רמה חדשה
 * @param userId מזהה המשתמש
 * @param taskId מזהה המשימה
 * @param taskScore ציון המשימה שהושלמה
 * @returns האם הפעולה הצליחה
 */
export async function handleConversationTaskCompletion(userId: string, taskId: string, taskScore: number): Promise<boolean> {
  console.group(`Handling conversation task completion for userId=${userId}, taskId=${taskId}, score=${taskScore}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Cannot connect to database');
      console.groupEnd();
      return false;
    }
    
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 1. קבלת פרטי המשימה שהושלמה
      const [taskRows] = await connection.query(
        'SELECT TopicName, Level FROM tasks WHERE TaskId = ? AND UserId = ?',
        [taskId, userId]
      );
      
      const tasks = taskRows as any[];
      if (!Array.isArray(tasks) || tasks.length === 0) {
        console.error(`Task ${taskId} not found for user ${userId}`);
        await connection.rollback();
        console.groupEnd();
        return false;
      }
      
      const { TopicName, Level } = tasks[0];
      console.log(`Found task with topic: ${TopicName}, level: ${Level}`);
      
      // 2. מציאת רשומה רלוונטית בטבלת userinlevel
      const [userLevelRows] = await connection.query(
        'SELECT Id, Level FROM userinlevel WHERE UserId = ? AND TopicName = ? AND CompletedAt IS NULL',
        [userId, TopicName]
      );
      
      const userLevels = userLevelRows as any[];
      if (!Array.isArray(userLevels) || userLevels.length === 0) {
        console.warn(`No open user level record found for user ${userId}, topic ${TopicName}. Creating new one.`);
        
        // יצירת רשומה חדשה אם לא נמצאה
        await connection.query(
          'INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore, CompletedAt) VALUES (?, ?, ?, 0, NULL)',
          [userId, TopicName, Level]
        );
        
        // מציאת הרשומה שנוצרה
        const [newLevelRows] = await connection.query(
          'SELECT Id, Level FROM userinlevel WHERE UserId = ? AND TopicName = ? AND CompletedAt IS NULL',
          [userId, TopicName]
        );
        
        if (!Array.isArray(newLevelRows) || newLevelRows.length === 0) {
          console.error('Failed to create new user level record');
          await connection.rollback();
          console.groupEnd();
          return false;
        }
        
        userLevels[0] = newLevelRows[0];
        console.log(`Created new user level record with ID: ${userLevels[0].Id}`);
      }
      
      const currentUserLevelId = userLevels[0].Id;
      const currentLevel = userLevels[0].Level;
      
      console.log(`Found user level record with ID: ${currentUserLevelId}, level: ${currentLevel}`);
      
      // 3. סכימת הניקוד מכל משימות הנושא והרמה המתאימות
      const [scoreRows] = await connection.query(
        'SELECT SUM(TaskScore) AS TotalScore FROM tasks WHERE UserId = ? AND TopicName = ? AND Level = ?',
        [userId, TopicName, currentLevel]
      );
      
      const totalScore = (scoreRows as any[])[0]?.TotalScore || 0;
      console.log(`Calculated total score for level ${currentLevel}: ${totalScore}`);
      
      // 4. עדכון הרשומה הנוכחית - סימון כהושלמה ועדכון הניקוד
      const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // עדכון באמצעות API - כדי לשמור על עקביות (אם API פעיל)
      try {
        const token = getAuthToken();
        if (token) {
          console.log(`Updating user level via API for topic ${TopicName}, level ${currentLevel}`);
          
          const response = await fetch('/api/user-level/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              topicName: TopicName,
              currentLevel: currentLevel,
              earnedScore: totalScore,
              isCompleted: true
            })
          });
          
          if (response.ok) {
            console.log('User level updated successfully via API');
            // API כבר יוצר את הרמה הבאה, לכן אפשר לסיים כאן
            await connection.commit();
            console.log('Successfully completed all operations via API');
            console.groupEnd();
            return true;
          } else {
            console.warn('Failed to update via API, falling back to direct DB update');
          }
        }
      } catch (apiError) {
        console.warn('API update failed, falling back to direct DB update:', apiError);
      }
      
      // נפילה חזרה לעדכון ישיר במסד הנתונים אם API נכשל
      await connection.query(
        'UPDATE userinlevel SET CompletedAt = ?, EarnedScore = ? WHERE Id = ?',
        [currentDate, totalScore, currentUserLevelId]
      );
      
      console.log(`Updated user level ${currentUserLevelId} with completion date and total score ${totalScore}`);
      
      // 5. יצירת רשומה חדשה לרמה הבאה
      const nextLevel = currentLevel + 1;
      
      await connection.query(
        'INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore, CompletedAt) VALUES (?, ?, ?, 0, NULL)',
        [userId, TopicName, nextLevel]
      );
      
      console.log(`Created new user level record for level ${nextLevel}`);
      
      // Commit the transaction
      await connection.commit();
      console.log('Successfully completed all operations');
      console.groupEnd();
      return true;
      
    } catch (error) {
      await connection.rollback();
      console.error('Error in transaction:', error);
      console.groupEnd();
      return false;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('General error handling conversation task completion:', error);
    console.groupEnd();
    return false;
  }
}

/**
 * עדכון משימה עם משך זמן מפורש
 * @param taskId מזהה המשימה
 * @param score ציון המשימה
 * @param duration משך הזמן בשניות
 * @returns תוצאת העדכון (האם הצליח)
 */
export async function updateTaskWithDuration(taskId: string, score: number, duration: number): Promise<boolean> {
  console.group(`Updating task ${taskId} with score ${score} and duration ${duration}s`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Cannot connect to database');
      console.groupEnd();
      return false;
    }
    
    // Check if task exists first
    console.log(`Verifying task ${taskId} exists in database`);
    const [taskCheck] = await pool.query('SELECT TaskId FROM tasks WHERE TaskId = ?', [taskId]);
    const tasks = taskCheck as any[];
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      console.error(`Task ${taskId} not found in database`);
      
      // Debug log to see what tasks do exist (helps identify case sensitivity issues)
      const [allTasks] = await pool.query('SELECT TaskId FROM tasks LIMIT 5');
      console.log('Sample of existing tasks:', allTasks);
      
      console.groupEnd();
      return false;
    }
    
    const completionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Log the exact SQL that will be executed
    const sql = 'UPDATE tasks SET CompletionDate = ?, TaskScore = ?, DurationTask = ? WHERE TaskId = ?';
    const params = [completionDate, score, duration, taskId];
    console.log('Executing SQL:', sql);
    console.log('With parameters:', params);
    
    // Update the task
    const [result] = await pool.query(sql, params);
    
    // Check if update was successful
    const affectedRows = (result as any).affectedRows || 0;
    console.log(`Update result: ${affectedRows} rows affected`);
    
    if (affectedRows > 0) {
      console.log(`Successfully updated task ${taskId}`);
      console.groupEnd();
      return true;
    } else {
      // If no rows affected, try a case-insensitive match
      console.warn(`No rows affected when updating task ${taskId}, trying case-insensitive match`);
      
      // This is a workaround for potential case sensitivity issues
      const [ciResult] = await pool.query(
        'UPDATE tasks SET CompletionDate = ?, TaskScore = ?, DurationTask = ? WHERE LOWER(TaskId) = LOWER(?)',
        [completionDate, score, duration, taskId]
      );
      
      const ciAffectedRows = (ciResult as any).affectedRows || 0;
      console.log(`Case-insensitive update result: ${ciAffectedRows} rows affected`);
      
      if (ciAffectedRows > 0) {
        console.log(`Successfully updated task with case-insensitive match`);
        console.groupEnd();
        return true;
      }
      
      console.warn(`No rows affected when updating task ${taskId}, even with case-insensitive match`);
      console.groupEnd();
      return false;
    }
  } catch (error) {
    console.error('Error updating task with duration:', error);
    console.groupEnd();
    return false;
  }
}

/**
 * פונקציה ליצירת משימה חדשה
 */
export async function createTask(userId: string, topicName: string, level: string | number, taskType: string): Promise<string> {
  // Convert level to number
  const levelNum = typeof level === 'number' ? level : parseInt(level, 10) || 1;
  
  console.log(`Creating new task: userId=${userId}, topicName=${topicName}, level=${levelNum}, taskType=${taskType}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return '';
    }
    
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Check if user exists
      const [userRows] = await connection.query('SELECT UserId FROM users WHERE UserId = ?', [userId]);
      const users = userRows as any[];
      
      if (users.length === 0) {
        console.error(`User ${userId} not found in users table`);
        await connection.rollback();
        return '';
      }
      
      // וידוא שהנושא והרמה קיימים - שימוש ב-urlTopicName כמו שהוא
      const topicLevelExists = await ensureTopicLevelExists(connection, topicName, levelNum);
      if (!topicLevelExists) {
        console.error(`Cannot ensure topic ${topicName} with level ${levelNum} exists`);
        await connection.rollback();
        return '';
      }
      
      // המרת שם הנושא לפורמט מסד הנתונים
      const dbTopicName = formatTopicName(topicName);
      
      // Check for existing incomplete task
      const [existingTasks] = await connection.query(
        `SELECT TaskId FROM tasks 
         WHERE UserId = ? AND TopicName = ? AND Level = ? AND TaskType = ? AND CompletionDate IS NULL`,
        [userId, dbTopicName, levelNum, taskType]
      );
      
      if (Array.isArray(existingTasks) && existingTasks.length > 0) {
        console.log(`Found existing incomplete task: ${(existingTasks[0] as any).TaskId}`);
        await connection.commit();
        return (existingTasks[0] as any).TaskId;
      }
      
      // Create new task - שימוש בשם הנושא המותאם למסד הנתונים
      const taskId = uuidv4();
      
      const [result] = await connection.query(
        `INSERT INTO tasks 
         (TaskId, UserId, TopicName, Level, TaskScore, TaskType, StartDate)
         VALUES (?, ?, ?, ?, 0, ?, NOW())`,
        [taskId, userId, dbTopicName, levelNum, taskType]
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
    return '';
  }
}

// פונקציה לסימון משימה כהושלמה
export async function markTaskComplete(taskId: string, score: number): Promise<boolean> {
  console.log(`Marking task ${taskId} as completed with score ${score}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Cannot connect to database');
      return false;
    }
    
    const completionDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    try {
      // בדיקה אם המשימה קיימת ומה הסוג שלה
      const [taskRows] = await pool.query(
        'SELECT TaskId, UserId, TopicName, Level, TaskType, StartDate FROM tasks WHERE TaskId = ?', 
        [taskId]
      );
      const tasks = taskRows as any[];
      
      if (tasks.length === 0) {
        console.error(`Task ${taskId} not found`);
        return false;
      }
      
      const taskInfo = tasks[0];
      const { UserId, TaskType } = taskInfo;
      
      // חישוב משך המשימה, אם יש תאריך התחלה
      let durationTask = null;
      if (taskInfo.StartDate) {
        const startDate = new Date(taskInfo.StartDate);
        const completionDateTime = new Date(completionDate);
        // חישוב משך בשניות
        durationTask = Math.floor((completionDateTime.getTime() - startDate.getTime()) / 1000);
      }
      
      // עדכון המשימה
      const result = await pool.query(
        'UPDATE tasks SET CompletionDate = ?, TaskScore = ?, DurationTask = ? WHERE TaskId = ?',
        [completionDate, score, durationTask, taskId]
      );
      
      console.log('Task update result:', result);
      
      // אם זוהי משימת שיחה, הפעל את הטיפול המיוחד
      if (TaskType === 'conversation') {
        console.log('This is a conversation task, handling level progression');
        
        // קריאה לפונקציה החדשה
        const levelUpdateResult = await handleConversationTaskCompletion(UserId, taskId, score);
        if (!levelUpdateResult) {
          console.warn(`Failed to update user level progression for task ${taskId}`);
          // לא נחשיב כשגיאה מכיוון שהמשימה עדיין הושלמה
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      return false;
    }
  } catch (error) {
    console.error('General error marking task as completed:', error);
    return false;
  }
}

// פונקציה להוספת מילים למשימה
export async function addWordsToTask(taskId: string, wordIds: string[]): Promise<boolean> {
  console.log(`Adding ${wordIds.length} words to task ${taskId}`);
  
  if (!wordIds.length) {
    console.log('No words to add');
    return true;
  }
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Cannot connect to database');
      return false;
    }
    
    try {
      // בדיקה אם הטבלה קיימת
      const [tables] = await pool.query('SHOW TABLES LIKE ?', ['wordintask']);
      const tablesArray = tables as any[];
      
      if (tablesArray.length === 0) {
        console.log('wordintask table does not exist, creating it');
        await pool.query(`
          CREATE TABLE wordintask (
            TaskId CHAR(36) NOT NULL,
            WordId CHAR(36) NOT NULL,
            AddedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (TaskId, WordId)
          )
        `);
      } else {
        // בדיקה אם חסר עמודת AddedAt
        const [columns] = await pool.query('SHOW COLUMNS FROM wordintask LIKE ?', ['AddedAt']);
        const columnsArray = columns as any[];
        
        if (columnsArray.length === 0) {
          console.log('Adding AddedAt column to wordintask table');
          await pool.query('ALTER TABLE wordintask ADD COLUMN AddedAt DATETIME DEFAULT CURRENT_TIMESTAMP');
        }
      }
      
      // התאריך הנוכחי לכל המילים שיתווספו עכשיו
      const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // הוספת כל המילים למשימה עם תאריך הוספה
      for (const wordId of wordIds) {
        try {
          // שימוש ב-ON DUPLICATE KEY UPDATE כדי לא לשנות את התאריך אם המילה כבר קיימת
          await pool.query(
            `INSERT INTO wordintask (TaskId, WordId, AddedAt) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE AddedAt = IF(AddedAt IS NULL, VALUES(AddedAt), AddedAt)`,
            [taskId, wordId, currentDateTime]
          );
        } catch (insertError) {
          console.error(`Error adding word ${wordId} to task:`, insertError);
          // ממשיכים למילה הבאה
        }
      }
      
      console.log(`Successfully added ${wordIds.length} words to task ${taskId}`);
      return true;
    } catch (error) {
      console.error('Error adding words to task:', error);
      return false;
    }
  } catch (error) {
    console.error('General error adding words to task:', error);
    return false;
  }
}

// פונקציה משופרת לשמירת מילים למשימה באמצעות addWordsToTask
/**
 * שומר מילים למשימה
 * @param taskId מזהה המשימה
 * @param learnedWords מערך של מילים שנלמדו (אובייקטים או מזהים)
 * @returns תוצאת הפעולה
 */
export async function saveWordsToTask(taskId: string, learnedWords: any[]): Promise<{ success: boolean, data?: any, reason?: string }> {
  try {
    console.log(`Saving ${learnedWords.length} words to task ${taskId}`);
    
    // בדיקה שיש מזהה משימה תקין
    if (!taskId || taskId.trim() === '') {
      console.error('Invalid task ID');
      return { success: false, reason: 'invalid_task_id' };
    }
    
    // אם זה מזהה זמני, לא לשלוח את הבקשה לשרת
    if (taskId.startsWith('client_') || taskId.startsWith('temp_')) {
      console.warn(`Skipping API call for temporary task ID: ${taskId}`);
      return { success: true, data: { taskId, wordsAdded: 0, skipReason: 'temporary_id' } };
    }
    
    // הכנת מערך המזהים
    let wordIds: string[] = [];
    
    // בדיקה אם קיבלנו מערך של אובייקטים או מערך של מזהים
    if (learnedWords.length > 0) {
      if (typeof learnedWords[0] === 'string') {
        // אם קיבלנו מערך של מחרוזות (מזהים)
        wordIds = learnedWords as string[];
      } else if (typeof learnedWords[0] === 'object') {
        // אם קיבלנו מערך של אובייקטים עם מזהים
        wordIds = learnedWords
          .filter(word => word && word.WordId)
          .map(word => word.WordId);
      }
    }
    
    // בדיקה שיש מזהי מילים להוספה
    if (wordIds.length === 0) {
      console.warn('No valid word IDs to save');
      return { success: false, reason: 'no_words' };
    }
    
    // שליחת הבקשה לשרת
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('Authentication token missing');
      return { success: false, reason: 'auth_missing' };
    }
    
    const response = await fetch('/api/words-in-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        taskId,
        wordIds
      })
    });
    
    // בדיקת תקינות התשובה
    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return { success: false, reason: 'api_error' };
    }
    
    // פענוח התשובה
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error saving words to task:', error);
    return { success: false, reason: 'exception', data: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * מקבל את המילים של משימה מסוימת
 * @param taskId מזהה המשימה
 * @returns מערך של מילים עם פרטים נוספים
 */
export async function getWordsForTask(taskId: string): Promise<any[]> {
  try {
    // אם זה מזהה זמני, החזר מערך ריק
    if (!taskId || taskId.startsWith('client_') || taskId.startsWith('temp_')) {
      return [];
    }
    
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication token missing');
    }
    
    const response = await fetch(`/api/words-in-task?taskId=${encodeURIComponent(taskId)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting words for task:', error);
    return [];
  }
}
// פונקציה לקבלת משימות משתמש
export async function getUserTasks(userId: string): Promise<any[]> {
  console.log(`Getting tasks for user ${userId}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Cannot connect to database');
      return [];
    }
    
    try {
      const [rows] = await pool.query(
        'SELECT * FROM tasks WHERE UserId = ? ORDER BY StartDate DESC',
        [userId]
      );
      
      console.log(`Retrieved ${(rows as any[]).length} tasks for user`);
      return rows as any[];
    } catch (error) {
      console.error('Error getting user tasks:', error);
      return [];
    }
  } catch (error) {
    console.error('General error getting user tasks:', error);
    return [];
  }
}
