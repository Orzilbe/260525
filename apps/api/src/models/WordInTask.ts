// apps/api/src/models/WordInTask.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IWordInTask extends RowDataPacket {
  TaskId: string;
  WordId: string;
  IsCompleted: boolean;
  Score: number;
  Attempts: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class WordInTask {
  // Find word in task
  static async findByTaskAndWord(taskId: string, wordId: string): Promise<IWordInTask | null> {
    try {
      const [rows] = await pool.execute<IWordInTask[]>(
        'SELECT * FROM WordsInTask WHERE TaskId = ? AND WordId = ?',
        [taskId, wordId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding word in task:', error);
      throw error;
    }
  }

  // Find words by task ID
  static async findByTaskId(taskId: string): Promise<IWordInTask[]> {
    try {
      const [rows] = await pool.execute<IWordInTask[]>(
        'SELECT * FROM WordsInTask WHERE TaskId = ? ORDER BY CreatedAt',
        [taskId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding words by task ID:', error);
      throw error;
    }
  }

  // Find tasks by user and word ID
  static async findTasksByUserAndWord(userId: string, wordId: string): Promise<IWordInTask[]> {
    try {
      const [rows] = await pool.execute<IWordInTask[]>(
        `SELECT wit.* FROM WordsInTask wit
         JOIN Tasks t ON wit.TaskId = t.TaskId
         WHERE t.UserId = ? AND wit.WordId = ?
         ORDER BY wit.CreatedAt DESC`,
        [userId, wordId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding tasks by user and word:', error);
      throw error;
    }
  }

  // Check if user has learned a specific word
  static async hasUserLearnedWord(userId: string, wordId: string): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM WordsInTask wit
         JOIN Tasks t ON wit.TaskId = t.TaskId
         WHERE t.UserId = ? AND wit.WordId = ? AND wit.IsCompleted = TRUE
         LIMIT 1`,
        [userId, wordId]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking if user learned word:', error);
      throw error;
    }
  }

  // Get all words learned by a user
  static async getWordsLearnedByUser(userId: string): Promise<IWordInTask[]> {
    try {
      const [rows] = await pool.execute<IWordInTask[]>(
        `SELECT wit.* FROM WordsInTask wit
         JOIN Tasks t ON wit.TaskId = t.TaskId
         WHERE t.UserId = ? AND wit.IsCompleted = TRUE
         ORDER BY wit.CreatedAt DESC`,
        [userId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error getting words learned by user:', error);
      throw error;
    }
  }

  // Add word to task
  static async addWordToTask(wordInTaskData: {
    TaskId: string;
    WordId: string;
    IsCompleted?: boolean;
    Score?: number;
    Attempts?: number;
  }): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO WordsInTask 
         (TaskId, WordId, IsCompleted, Score, Attempts, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          wordInTaskData.TaskId,
          wordInTaskData.WordId,
          wordInTaskData.IsCompleted || false,
          wordInTaskData.Score || 0,
          wordInTaskData.Attempts || 0
        ]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error adding word to task:', error);
      throw error;
    }
  }

  // Mark word as completed in task
  static async markWordAsCompleted(
    taskId: string, 
    wordId: string, 
    score?: number
  ): Promise<boolean> {
    try {
      const wordInTask = await WordInTask.findByTaskAndWord(taskId, wordId);
      
      if (!wordInTask) {
        return false;
      }
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE WordsInTask 
         SET IsCompleted = TRUE, Score = ?, Attempts = Attempts + 1, UpdatedAt = NOW() 
         WHERE TaskId = ? AND WordId = ?`,
        [score || 100, taskId, wordId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error marking word as completed:', error);
      throw error;
    }
  }

  // Check if all words in task are completed
  static async areAllWordsCompleted(taskId: string): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) AS completed
         FROM WordsInTask WHERE TaskId = ?`,
        [taskId]
      );
      
      if (rows.length === 0 || rows[0].total === 0) {
        return false;
      }
      
      return rows[0].total === rows[0].completed;
    } catch (error) {
      console.error('Error checking if all words are completed:', error);
      throw error;
    }
  }
}

export default WordInTask;