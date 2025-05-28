// apps/api/src/routes/taskRoutes.ts
import express from 'express';
import { Pool } from 'mysql2/promise';
import pool from '../models/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { TokenPayload } from '../types/auth';
import { updateUserScoreFromTask } from '../services/userScoreService';

// Define the user request interface
interface IUserRequest extends express.Request {
  user?: TokenPayload;
}

const router = express.Router();

/**
 * יצירת משימה חדשה
 * POST /api/tasks
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('Creating new task with data:', req.body);
    const { UserId, TopicName, Level, TaskType, TaskScore = 0, StartDate } = req.body;
    
    // בדיקת הפרמטרים הנדרשים
    if (!UserId || !TopicName || !Level || !TaskType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: UserId, TopicName, Level, TaskType',
        missingFields: [
          !UserId ? 'UserId' : null,
          !TopicName ? 'TopicName' : null,
          !Level ? 'Level' : null,
          !TaskType ? 'TaskType' : null
        ].filter(Boolean)
      });
    }
    
    // ודא שהמשתמש שמוטמע בטוקן תואם לשדה UserId
    if (req.user?.id && req.user.id.toString() !== UserId) {
      console.warn(`User ID mismatch: ${req.user.id} vs ${UserId}`);
      return res.status(403).json({
        success: false,
        error: 'UserId in request does not match authenticated user'
      });
    }
    
    // קבלת חיבור למסד הנתונים
    const connection = await pool.getConnection();
    
    // בדיקה אם הנושא והרמה קיימים
    const [levelExists] = await connection.execute(
      'SELECT 1 FROM Levels WHERE TopicName = ? AND Level = ?',
      [TopicName, Level]
    );
    
    if (!Array.isArray(levelExists) || levelExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Topic '${TopicName}' with level ${Level} not found`
      });
    }
    
    // בדיקה אם המשתמש קיים
    const [userExists] = await connection.execute(
      'SELECT 1 FROM Users WHERE UserId = ?',
      [UserId]
    );
    
    if (!Array.isArray(userExists) || userExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${UserId} not found`
      });
    }
    
    // יצירת מזהה למשימה
    const TaskId = uuidv4();
    console.log('Generated new TaskId:', TaskId);
    
    // SQL לצורך הכנסת המשימה
    const insertSql = `
      INSERT INTO Tasks (
        TaskId, 
        UserId, 
        TopicName, 
        Level, 
        TaskType, 
        TaskScore
        ${StartDate ? ', StartDate' : ''}
      ) VALUES (?, ?, ?, ?, ?, ?${StartDate ? ', ?' : ''})
    `;
    
    // הפרמטרים להכנסה
    const insertParams = [
      TaskId,
      UserId,
      TopicName,
      Level,
      TaskType,
      TaskScore,
    ];
    
    // הוספת StartDate אם קיים
    if (StartDate) {
      insertParams.push(StartDate);
    }
    
    // ביצוע השאילתה
    console.log('Executing SQL:', insertSql);
    console.log('With parameters:', insertParams);
    
    const [result] = await connection.execute(insertSql, insertParams);
    
    console.log('Task created successfully:', result);
    
    // החזרת תוצאה מוצלחת
    return res.status(201).json({
      success: true,
      TaskId: TaskId,
      UserId: UserId,
      TopicName: TopicName,
      Level: Level,
      TaskType: TaskType,
      TaskScore: TaskScore,
      StartDate: StartDate || null
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * עדכון משימה קיימת
 * PATCH /api/tasks/:taskId
 */
router.patch('/:taskId', authMiddleware, async (req, res) => {
  try {
    console.log(`Updating task ${req.params.taskId} with data:`, req.body);
    const { taskId } = req.params;
    const { TaskScore, DurationTask, CompletionDate } = req.body;
    
    // קבלת חיבור למסד הנתונים
    const connection = await pool.getConnection();
    
    // בדיקה שהמשימה קיימת
    const [tasks] = await connection.execute(
      'SELECT UserId FROM Tasks WHERE TaskId = ?',
      [taskId]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Task with ID ${taskId} not found`
      });
    }
    
    // בדיקה שהמשתמש מורשה לעדכן את המשימה הזו
    const task = tasks[0] as any;
    if (req.user?.id && req.user.id.toString() !== task.UserId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this task'
      });
    }
    
    // בניית שאילתת העדכון
    let updateSql = 'UPDATE Tasks SET ';
    const updateParams = [];
    
    if (TaskScore !== undefined) {
      updateSql += 'TaskScore = ?, ';
      updateParams.push(TaskScore);
    }
    
    if (DurationTask !== undefined) {
      updateSql += 'DurationTask = ?, ';
      updateParams.push(DurationTask);
    }
    
    if (CompletionDate !== undefined) {
      updateSql += 'CompletionDate = ?, ';
      updateParams.push(CompletionDate);
    }
    
    // הסרת הפסיק האחרון
    updateSql = updateSql.slice(0, -2);
    
    // הוספת תנאי ה-WHERE
    updateSql += ' WHERE TaskId = ?';
    updateParams.push(taskId);
    
    // אם אין שדות לעדכון, החזר שגיאה
    if (updateParams.length === 1) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update provided'
      });
    }
    
    // ביצוע העדכון
    console.log('Executing SQL:', updateSql);
    console.log('With parameters:', updateParams);
    
    const [result] = await connection.execute(updateSql, updateParams);
    
    // בדיקה שהעדכון הצליח
    if ((result as any).affectedRows === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task not updated'
      });
    }
    
    console.log('Task updated successfully:', result);
    
    // החזרת תוצאה מוצלחת
    return res.json({
      success: true,
      message: 'Task updated successfully',
      taskId: taskId
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * PUT /api/tasks/:taskId/complete - Complete a task and record word usage
 */
router.put('/:taskId/complete', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  let dbConnection;
  try {
    console.group('Task Completion');
    console.log('Completing task:', req.params.taskId);
    console.log('Request body:', req.body);

    dbConnection = await pool.getConnection();
    await dbConnection.beginTransaction();
    
    const { taskId } = req.params;
    const { wordIds, TaskScore = 100, DurationTask = 0 } = req.body;
    
    // Verify task exists and belongs to user
    const [tasks] = await dbConnection.execute(
      'SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?',
      [taskId, req.user?.id]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      console.error('Task not found or unauthorized');
      await dbConnection.rollback();
      return res.status(404).json({ 
        success: false, 
        error: 'Task not found or unauthorized' 
      });
    }
    
    console.log('Found task:', tasks[0]);
    
    // Update task completion status
    const [updateResult] = await dbConnection.execute(
      `UPDATE Tasks 
       SET CompletionDate = NOW(),
           TaskScore = ?,
           DurationTask = ?
       WHERE TaskId = ?`,
      [TaskScore, DurationTask, taskId]
    );
    
    console.log('Task update result:', updateResult);
    
    // Record word usage
    if (Array.isArray(wordIds) && wordIds.length > 0) {
      console.log('Recording word usage for words:', wordIds);
      
      // Check if UserKnownWords table exists, create if not
      const [tables] = await dbConnection.query('SHOW TABLES LIKE ?', ['UserKnownWords']);
      if (!Array.isArray(tables) || tables.length === 0) {
        console.log('Creating UserKnownWords table');
        await dbConnection.query(`
          CREATE TABLE UserKnownWords (
            UserId CHAR(36) NOT NULL,
            WordId CHAR(36) NOT NULL,
            LearnedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (UserId, WordId),
            FOREIGN KEY (UserId) REFERENCES Users(UserId),
            FOREIGN KEY (WordId) REFERENCES Words(WordId)
          )
        `);
      }
      
      // Prepare values for batch insert
      const values = wordIds.map(wordId => [
        taskId,
        wordId,
        new Date().toISOString()
      ]);
      
      // Insert word usage records into WordsInTask
      const [wordResult] = await dbConnection.query(
        'INSERT INTO WordsInTask (TaskId, WordId, AddedAt) VALUES ?',
        [values]
      );
      
      // Insert or update UserKnownWords records
      for (const wordId of wordIds) {
        await dbConnection.query(
          `INSERT INTO UserKnownWords (UserId, WordId, LearnedAt) 
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE LearnedAt = IF(LearnedAt IS NULL, NOW(), LearnedAt)`,
          [req.user?.id, wordId]
        );
      }
      
      console.log('Word usage records result:', wordResult);
    }
    
    // Update user score using the new service
    console.log('Updating user score');
    const scoreUpdated = await updateUserScoreFromTask(taskId, TaskScore);
    if (!scoreUpdated) {
      console.error('Failed to update user score');
      throw new Error('Failed to update user score');
    }
    
    await dbConnection.commit();
    console.log('Transaction committed successfully');
    console.groupEnd();
    
    res.json({ 
      success: true,
      message: 'Task completed successfully'
    });
    
  } catch (error: any) {
    console.error('Error completing task:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (dbConnection) {
      await dbConnection.rollback();
      console.log('Transaction rolled back due to error');
    }
    
    console.groupEnd();
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete task',
      details: error.message
    });
  } finally {
    if (dbConnection) {
      dbConnection.release();
      console.log('Database connection released');
    }
  }
});

/**
 * POST /api/tasks/:taskId/words - Record word usage in a task
 */
router.post('/:taskId/words', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  let dbConnection;
  try {
    dbConnection = await pool.getConnection();
    await dbConnection.beginTransaction();
    
    const { taskId } = req.params;
    const { wordIds } = req.body;
    
    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No word IDs provided'
      });
    }
    
    // Verify task exists and belongs to user
    const [tasks] = await dbConnection.execute(
      'SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?',
      [taskId, req.user?.id]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      await dbConnection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Task not found or unauthorized'
      });
    }
    
    // Prepare values for batch insert
    const values = wordIds.map(wordId => [
      taskId,
      wordId,
      new Date().toISOString()
    ]);
    
    // Insert word usage records
    await dbConnection.query(
      'INSERT INTO WordsInTask (TaskId, WordId, AddedAt) VALUES ?',
      [values]
    );
    
    await dbConnection.commit();
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error recording word usage:', error);
    if (dbConnection) await dbConnection.rollback();
    res.status(500).json({
      success: false,
      error: 'Failed to record word usage'
    });
  } finally {
    if (dbConnection) dbConnection.release();
  }
});

/**
 * קבלת משימות לפי משתמש
 * GET /api/tasks/user/:userId
 */
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // בדיקה שהמשתמש מורשה לראות את המשימות האלו
    if (req.user?.id && req.user.id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view these tasks'
      });
    }
    
    // קבלת חיבור למסד הנתונים
    const connection = await pool.getConnection();
    
    // קבלת המשימות
    const [tasks] = await connection.execute(
      `SELECT * FROM Tasks 
       WHERE UserId = ? 
       ORDER BY 
         CASE WHEN CompletionDate IS NULL THEN 0 ELSE 1 END, 
         StartDate DESC`,
      [userId]
    );
    
    return res.json({
      success: true,
      tasks: tasks
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;