// apps/api/src/services/userScoreService.ts
import { RowDataPacket } from 'mysql2';
import DatabaseConnection from '../config/database';
import { TaskType } from '../models/Task';
import pool from '../models/db';

/**
 * Updates user's cumulative score based on task completion
 * @param taskId - ID of the completed task
 * @param score - Score earned for the task
 * @returns Promise<boolean> - Whether the update was successful
 */
export async function updateUserScoreFromTask(taskId: string, score: number): Promise<boolean> {
  console.group('updateUserScoreFromTask');
  console.log('Starting score update process');
  console.log('Task ID:', taskId);
  console.log('Score:', score);

  const pool = DatabaseConnection.getPool();
  let connection;

  try {
    connection = await pool.getConnection();
    console.log('Database connection established');

    await connection.beginTransaction();
    console.log('Transaction begun');

    // 1. Get task details
    const [taskRows] = await connection.query<RowDataPacket[]>(
      'SELECT UserId, TopicName, Level, TaskType FROM Tasks WHERE TaskId = ?',
      [taskId]
    );
    console.log('Task query result:', taskRows);

    if (!taskRows || taskRows.length === 0) {
      console.error('Task not found');
      throw new Error('Task not found');
    }

    const task = taskRows[0];
    const { UserId, TopicName, Level, TaskType } = task;
    console.log('Task details:', { UserId, TopicName, Level, TaskType });

    // Skip score update for flashcard tasks
    if (TaskType === TaskType.FLASHCARD) {
      console.log('Skipping score update for flashcard task');
      await connection.commit();
      console.log('Transaction committed successfully');
      console.groupEnd();
      return true;
    }

    // 2. Update user's level score
    const [levelUpdateResult] = await connection.query(
      `INSERT INTO UserINLevel (TopicName, Level, UserId, EarnedScore, CompletedAt) 
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
       EarnedScore = GREATEST(EarnedScore, ?),
       CompletedAt = CASE 
         WHEN CompletedAt IS NULL THEN NOW()
         ELSE CompletedAt
       END`,
      [TopicName, Level, UserId, score, score]
    );
    console.log('Level score update result:', levelUpdateResult);

    // 3. Update user's total score by adding the new score
    const [totalScoreResult] = await connection.query(
      `UPDATE Users 
       SET Score = COALESCE(Score, 0) + ?
       WHERE UserId = ?`,
      [score, UserId]
    );
    console.log('Total score update result:', totalScoreResult);

    // 4. Handle conversation task completion
    if (TaskType === TaskType.CONVERSATION) {
      console.log('Handling conversation task completion');
      
      // Calculate total score for the level
      const [scoreRows] = await connection.query<RowDataPacket[]>(
        `SELECT SUM(TaskScore) as TotalScore 
         FROM Tasks 
         WHERE UserId = ? AND TopicName = ? AND Level = ?`,
        [UserId, TopicName, Level]
      );
      console.log('Level total score calculation:', scoreRows);

      const totalScore = scoreRows[0]?.TotalScore || 0;
      console.log('Calculated total score:', totalScore);

      // Update the level score
      const [conversationUpdateResult] = await connection.query(
        `UPDATE UserINLevel 
         SET EarnedScore = ? 
         WHERE UserId = ? AND TopicName = ? AND Level = ?`,
        [totalScore, UserId, TopicName, Level]
      );
      console.log('Conversation level update result:', conversationUpdateResult);

      // Create next level record if it doesn't exist
      const nextLevel = parseInt(Level) + 1;
      const [nextLevelResult] = await connection.query(
        `INSERT INTO UserINLevel (UserId, TopicName, Level, EarnedScore, CompletedAt) 
         VALUES (?, ?, ?, 0, NULL)
         ON DUPLICATE KEY UPDATE EarnedScore = EarnedScore`,
        [UserId, TopicName, nextLevel]
      );
      console.log('Next level creation result:', nextLevelResult);
    }

    await connection.commit();
    console.log('Transaction committed successfully');
    console.groupEnd();
    return true;
  } catch (error) {
    console.error('Error updating user score:', error);
    if (connection) {
      await connection.rollback();
      console.log('Transaction rolled back due to error');
    }
    console.groupEnd();
    return false;
  } finally {
    if (connection) {
      connection.release();
      console.log('Database connection released');
    }
  }
}

/**
 * Gets the current total score for a user
 * @param userId - ID of the user
 * @returns Promise<number> - User's total score
 */
export async function getUserTotalScore(userId: string): Promise<number> {
  console.log('Getting total score for user:', userId);
  
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT Score FROM Users WHERE UserId = ?',
      [userId]
    );

    const result = rows[0]?.Score || 0;
    console.log('Total score result:', result);
    return result;
  } catch (error) {
    console.error('Error getting user total score:', error);
    return 0;
  }
}

/**
 * Gets the score for a specific level and topic
 * @param userId - ID of the user
 * @param topicName - Name of the topic
 * @param level - Level number
 * @returns Promise<number> - Score for the specific level and topic
 */
export async function getUserLevelScore(
  userId: string, 
  topicName: string, 
  level: number
): Promise<number> {
  console.log('Getting level score:', { userId, topicName, level });
  
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT EarnedScore as LevelScore 
       FROM UserINLevel 
       WHERE UserId = ? AND TopicName = ? AND Level = ?`,
      [userId, topicName, level]
    );

    const result = rows[0]?.LevelScore || 0;
    console.log('Level score result:', result);
    return result;
  } catch (error) {
    console.error('Error getting user level score:', error);
    return 0;
  }
} 