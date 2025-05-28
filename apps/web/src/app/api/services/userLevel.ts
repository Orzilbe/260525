// apps/web/src/app/services/userLevel.ts

import { getSafeDbPool } from '../../../../../../apps/api/src/lib/db';
import { formatTopicNameForDb, formatTopicNameForUrl, areTopicNamesEquivalent } from '../../lib/topicUtils';

/**
 * קבלת הרמה הגבוהה ביותר של המשתמש בנושא מסוים
 * @param userId מזהה המשתמש
 * @param topicName שם הנושא
 * @returns מספר הרמה הגבוהה ביותר של המשתמש בנושא (1, 2, או 3), או 1 אם אין רמה
 */
export async function getUserHighestLevel(userId: string, topicName: string): Promise<number> {
  try {
    // וידוא שמקבלים פרמטרים תקינים
    if (!userId || !topicName) {
      console.warn('getUserHighestLevel: Missing parameter', { userId, topicName });
      return 1; // החזרת ברירת מחדל
    }
    
    console.log(`getUserHighestLevel: Checking level for user ${userId} in topic "${topicName}"`);
    
    // השגת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('getUserHighestLevel: Database connection not available');
      return 1; // החזרת ברירת מחדל אם אין חיבור למסד נתונים
    }
    
    // לפרמט את שם הנושא באופן עקבי עבור מסד הנתונים
    const dbTopicName = formatTopicNameForDb(topicName);
    const urlTopicName = formatTopicNameForUrl(topicName);
    
    console.log(`getUserHighestLevel: Checking for topic formats: DB="${dbTopicName}", URL="${urlTopicName}"`);
    
    // לוג נוסף של הפרמטרים לצורך דיבוג
    console.log(`getUserHighestLevel: SQL parameters - userId=${userId}, dbTopicName=${dbTopicName}, urlTopicName=${urlTopicName}`);
    
    // בדיקה אם המשתמש קיים בטבלת userinlevel
    try {
      // ניסיון מציאת הרשומה עם כל צורות הפורמט האפשריות של שם הנושא
      const query = `
        SELECT Level FROM userinlevel 
        WHERE UserId = ? AND (
          TopicName = ? OR 
          TopicName = ? OR
          LOWER(TopicName) = LOWER(?) OR
          LOWER(TopicName) = LOWER(?) OR
          REPLACE(LOWER(TopicName), ' ', '-') = LOWER(?) OR
          REPLACE(LOWER(?), '-', ' ') = LOWER(TopicName)
        )
        ORDER BY Level DESC
        LIMIT 1
      `;
      
      const params = [userId, dbTopicName, urlTopicName, dbTopicName, urlTopicName, urlTopicName, urlTopicName];
      
      console.log(`getUserHighestLevel: Executing query with params:`, params);
      
      const [userLevelRows] = await pool.query(query, params);
      
      console.log(`getUserHighestLevel: Query results:`, userLevelRows);
      
      // אם נמצאו תוצאות, להחזיר את הרמה הגבוהה ביותר
      if (Array.isArray(userLevelRows) && userLevelRows.length > 0) {
        const highestLevel = parseInt((userLevelRows[0] as any).Level, 10);
        console.log(`getUserHighestLevel: Found user level ${highestLevel} for topic "${dbTopicName}"`);
        return highestLevel;
      }
      
      // אם לא נמצאו תוצאות בטבלת userinlevel, נבדוק את טבלת Tasks
      console.log(`getUserHighestLevel: No records in userinlevel, checking Tasks table`);
      
      // חיפוש משימות שהושלמו בנושא זה
      const tasksQuery = `
        SELECT DISTINCT Level 
        FROM Tasks 
        WHERE UserId = ? 
          AND (
            TopicName = ? OR 
            TopicName = ? OR
            LOWER(TopicName) = LOWER(?) OR
            LOWER(TopicName) = LOWER(?) OR
            REPLACE(LOWER(TopicName), ' ', '-') = LOWER(?) OR
            REPLACE(LOWER(?), '-', ' ') = LOWER(TopicName)
          )
          AND CompletionDate IS NOT NULL
        ORDER BY Level DESC
        LIMIT 1
      `;
      
      console.log(`getUserHighestLevel: Checking completed tasks with params:`, params);
      
      const [completedTasksRows] = await pool.query(tasksQuery, params);
      
      console.log(`getUserHighestLevel: Completed tasks results:`, completedTasksRows);
      
      // אם נמצאו משימות שהושלמו, נחזיר את הרמה הגבוהה ביותר + 1 (אם אפשר)
      if (Array.isArray(completedTasksRows) && completedTasksRows.length > 0) {
        const completedLevel = parseInt((completedTasksRows[0] as any).Level, 10);
        // אם השלים רמה 3, הוא נשאר ברמה 3
        const nextLevel = completedLevel >= 3 ? 3 : completedLevel + 1;
        console.log(`getUserHighestLevel: Found completed tasks at level ${completedLevel}, next level is ${nextLevel}`);
        
        // עדכון טבלת userinlevel עם הרמה החדשה
        try {
          const updateQuery = `
            INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore, CompletedAt)
            VALUES (?, ?, ?, 0, NOW())
            ON DUPLICATE KEY UPDATE 
              Level = VALUES(Level),
              CompletedAt = NOW()
          `;
          
          await pool.query(updateQuery, [userId, dbTopicName, nextLevel]);
          console.log(`getUserHighestLevel: Updated userinlevel table with level ${nextLevel} for topic "${dbTopicName}"`);
        } catch (updateError) {
          console.error('getUserHighestLevel: Error updating userinlevel table:', updateError);
          // ממשיכים בכל מקרה
        }
        
        return nextLevel;
      }
      
      // אם לא נמצאו משימות שהושלמו, נבדוק אם יש משימות פתוחות
      console.log(`getUserHighestLevel: No completed tasks, checking for open tasks`);
      
      const openTasksQuery = `
        SELECT DISTINCT Level 
        FROM Tasks 
        WHERE UserId = ? 
          AND (
            TopicName = ? OR 
            TopicName = ? OR
            LOWER(TopicName) = LOWER(?) OR
            LOWER(TopicName) = LOWER(?) OR
            REPLACE(LOWER(TopicName), ' ', '-') = LOWER(?) OR
            REPLACE(LOWER(?), '-', ' ') = LOWER(TopicName)
          )
        ORDER BY Level ASC
        LIMIT 1
      `;
      
      console.log(`getUserHighestLevel: Checking open tasks with params:`, params);
      
      const [openTasksRows] = await pool.query(openTasksQuery, params);
      
      console.log(`getUserHighestLevel: Open tasks results:`, openTasksRows);
      
      // אם נמצאו משימות פתוחות, נחזיר את הרמה הנמוכה ביותר
      if (Array.isArray(openTasksRows) && openTasksRows.length > 0) {
        const openLevel = parseInt((openTasksRows[0] as any).Level, 10);
        console.log(`getUserHighestLevel: Found open tasks at level ${openLevel}`);
        
        // עדכון טבלת userinlevel עם הרמה שהתחיל
        try {
          const createOpenLevelQuery = `
            INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore)
            VALUES (?, ?, ?, 0)
            ON DUPLICATE KEY UPDATE 
              Level = VALUES(Level)
          `;
          
          await pool.query(createOpenLevelQuery, [userId, dbTopicName, openLevel]);
          console.log(`getUserHighestLevel: Updated userinlevel table with starting level ${openLevel} for topic "${dbTopicName}"`);
        } catch (updateError) {
          console.error('getUserHighestLevel: Error updating userinlevel table for open tasks:', updateError);
          // ממשיכים בכל מקרה
        }
        
        return openLevel;
      }
      
      // אם לא נמצאו משימות פתוחות או שהושלמו, מחזירים רמה 1 כברירת מחדל
      console.log(`getUserHighestLevel: No tasks found, using default level 1`);
      
      // יצירת רשומה חדשה בטבלת userinlevel עם רמה 1
      try {
        const createDefaultLevelQuery = `
          INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore)
          VALUES (?, ?, 1, 0)
          ON DUPLICATE KEY UPDATE 
            Level = 1
        `;
        
        await pool.query(createDefaultLevelQuery, [userId, dbTopicName]);
        console.log(`getUserHighestLevel: Created new userinlevel record with level 1 for topic "${dbTopicName}"`);
      } catch (insertError) {
        console.error('getUserHighestLevel: Error creating userinlevel record:', insertError);
        // ממשיכים בכל מקרה
      }
      
      return 1; // החזרת רמה 1 כברירת מחדל
    } catch (dbError) {
      console.error('getUserHighestLevel: Database error checking user level:', dbError);
      return 1; // החזרת ברירת מחדל במקרה של שגיאה
    }
  } catch (error) {
    console.error('getUserHighestLevel: Unexpected error:', error);
    return 1; // החזרת ברירת מחדל במקרה של שגיאה כלשהי
  }
}

/**
 * עדכון הרמה של המשתמש בנושא מסוים
 * @param userId מזהה המשתמש
 * @param topicName שם הנושא
 * @param level הרמה החדשה
 * @param earnedScore ניקוד שהושג (אופציונלי)
 * @returns הצלחה או כישלון
 */
export async function updateUserLevel(
  userId: string, 
  topicName: string, 
  level: number,
  earnedScore?: number
): Promise<boolean> {
  try {
    // וידוא שמקבלים פרמטרים תקינים
    if (!userId || !topicName || !level) {
      console.warn('updateUserLevel: Missing parameter', { userId, topicName, level });
      return false;
    }
    
    // השגת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('updateUserLevel: Database connection not available');
      return false;
    }
    
    // לפרמט את שם הנושא באופן עקבי עבור מסד הנתונים
    const dbTopicName = formatTopicNameForDb(topicName);
    
    console.log(`updateUserLevel: Updating level for user ${userId} in topic "${dbTopicName}" to level ${level}`);
    
    // עדכון או הוספת רשומה בטבלת userinlevel
    try {
      await pool.query(
        `INSERT INTO userinlevel (UserId, TopicName, Level, EarnedScore, CompletedAt)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           Level = VALUES(Level),
           EarnedScore = VALUES(EarnedScore),
           CompletedAt = NOW()`,
        [userId, dbTopicName, level, earnedScore || 0]
      );
      
      console.log(`updateUserLevel: Successfully updated level for user ${userId} in topic "${dbTopicName}" to level ${level}`);
      return true;
    } catch (dbError) {
      console.error('updateUserLevel: Database error updating user level:', dbError);
      return false;
    }
  } catch (error) {
    console.error('updateUserLevel: Unexpected error:', error);
    return false;
  }
}

/**
 * עדכון משך המשימה
 * @param taskId מזהה המשימה
 * @param duration משך המשימה בדקות
 * @returns הצלחה או כישלון
 */
export async function updateTaskDuration(
  taskId: string, 
  duration: number
): Promise<boolean> {
  try {
    // וידוא שמקבלים פרמטרים תקינים
    if (!taskId || duration === undefined || duration === null) {
      console.warn('updateTaskDuration: Missing parameter', { taskId, duration });
      return false;
    }
    
    // השגת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('updateTaskDuration: Database connection not available');
      return false;
    }
    
    console.log(`updateTaskDuration: Updating duration for task ${taskId} to ${duration} minutes`);
    
    // עדכון משך המשימה בטבלת Tasks
    try {
      const [result] = await pool.query(
        `UPDATE Tasks SET Duration = ? WHERE TaskId = ?`,
        [duration, taskId]
      );
      
      // בדיקה שהעדכון הצליח
      if ((result as any).affectedRows > 0) {
        console.log(`updateTaskDuration: Successfully updated duration for task ${taskId} to ${duration} minutes`);
        return true;
      } else {
        console.warn(`updateTaskDuration: No task found with ID ${taskId}`);
        return false;
      }
    } catch (dbError) {
      console.error('updateTaskDuration: Database error updating task duration:', dbError);
      return false;
    }
  } catch (error) {
    console.error('updateTaskDuration: Unexpected error:', error);
    return false;
  }
}