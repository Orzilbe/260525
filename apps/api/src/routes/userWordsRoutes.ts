import express from 'express';
import { Pool } from 'mysql2/promise';
import pool from '../models/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { TokenPayload } from '../types/auth';
import { v4 as uuidv4 } from 'uuid';

interface IUserRequest extends express.Request {
  user?: TokenPayload;
}

const router = express.Router();

/**
 * GET /api/user-words/known - Get user's known words through tasks
 */
router.get('/known', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  let dbConnection;
  try {
    dbConnection = await pool.getConnection();
    
    // Get words that the user has marked as known through tasks
    const [words] = await dbConnection.execute(
      `SELECT DISTINCT w.* 
       FROM Words w
       INNER JOIN WordsInTask wit ON w.WordId = wit.WordId
       INNER JOIN Tasks t ON wit.TaskId = t.TaskId
       WHERE t.UserId = ?
       ORDER BY wit.AddedAt DESC`,
      [req.user?.id]
    );
    
    res.json(words);
    
  } catch (error) {
    console.error('Error fetching known words:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch known words'
    });
  } finally {
    if (dbConnection) dbConnection.release();
  }
});

/**
 * POST /api/user-words/known - Mark a word as known by creating a task
 */
router.post('/known', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  let dbConnection;
  try {
    dbConnection = await pool.getConnection();
    await dbConnection.beginTransaction();
    
    const { wordId } = req.body;
    
    if (!wordId) {
      return res.status(400).json({
        success: false,
        error: 'Word ID is required'
      });
    }
    
    // Check if word exists
    const [words] = await dbConnection.execute(
      'SELECT TopicName FROM Words WHERE WordId = ?',
      [wordId]
    );
    
    if (!Array.isArray(words) || words.length === 0) {
      await dbConnection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Word not found'
      });
    }
    
    const word = words[0] as any;
    
    // Create a task for this word if it doesn't exist
    const taskId = uuidv4();
    await dbConnection.execute(
      `INSERT INTO Tasks (
        TaskId, 
        UserId, 
        TopicName, 
        Level, 
        TaskType, 
        TaskScore,
        CompletionDate
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        taskId,
        req.user?.id,
        word.TopicName,
        'beginner', // Default level
        'word_known',
        100 // Default score for known words
      ]
    );
    
    // Add word to task
    await dbConnection.execute(
      'INSERT INTO WordsInTask (TaskId, WordId, AddedAt) VALUES (?, ?, NOW())',
      [taskId, wordId]
    );
    
    await dbConnection.commit();
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error marking word as known:', error);
    if (dbConnection) await dbConnection.rollback();
    res.status(500).json({
      success: false,
      error: 'Failed to mark word as known'
    });
  } finally {
    if (dbConnection) dbConnection.release();
  }
});

/**
 * DELETE /api/user-words/known/:wordId - Remove a word from known words
 */
router.delete('/known/:wordId', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  let dbConnection;
  try {
    dbConnection = await pool.getConnection();
    await dbConnection.beginTransaction();
    
    const { wordId } = req.params;
    
    // Delete the task and its word associations
    await dbConnection.execute(
      `DELETE t, wit 
       FROM Tasks t
       INNER JOIN WordsInTask wit ON t.TaskId = wit.TaskId
       WHERE t.UserId = ? 
       AND t.TaskType = 'word_known'
       AND wit.WordId = ?`,
      [req.user?.id, wordId]
    );
    
    await dbConnection.commit();
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error unmarking word as known:', error);
    if (dbConnection) await dbConnection.rollback();
    res.status(500).json({
      success: false,
      error: 'Failed to unmark word as known'
    });
  } finally {
    if (dbConnection) dbConnection.release();
  }
});

export default router; 