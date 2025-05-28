// apps/api/src/models/Task.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export enum TaskType {
  QUIZ = 'quiz',
  POST = 'post',
  CONVERSATION = 'conversation',
  FLASHCARD = 'flashcard'
}

export interface ITask extends RowDataPacket {
  TaskId: string;
  UserId: string;
  TopicName: string;
  Level: number;
  TaskScore: number;
  TaskType: TaskType;
  CompletionDate?: Date;
  DurationTask?: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class Task {
  // Find task by ID
  static async findById(taskId: string): Promise<ITask | null> {
    try {
      const [rows] = await pool.execute<ITask[]>(
        'SELECT * FROM Tasks WHERE TaskId = ?',
        [taskId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding task by ID:', error);
      throw error;
    }
  }

  // Find tasks by user ID
  static async findByUser(userId: string): Promise<ITask[]> {
    try {
      const [rows] = await pool.execute<ITask[]>(
        'SELECT * FROM Tasks WHERE UserId = ? ORDER BY CreatedAt DESC',
        [userId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding tasks by user:', error);
      throw error;
    }
  }

  // Find tasks by user ID and topic
  static async findByUserAndTopic(userId: string, topicName: string): Promise<ITask[]> {
    try {
      const [rows] = await pool.execute<ITask[]>(
        'SELECT * FROM Tasks WHERE UserId = ? AND TopicName = ? ORDER BY Level, CreatedAt',
        [userId, topicName]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding tasks by user and topic:', error);
      throw error;
    }
  }

  // Create a new task
  static async create(taskData: {
    TaskId: string;
    UserId: string;
    TopicName: string;
    Level: number;
    TaskScore?: number;
    TaskType: TaskType;
    DurationTask?: number;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Tasks 
         (TaskId, UserId, TopicName, Level, TaskScore, TaskType, DurationTask, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          taskData.TaskId,
          taskData.UserId,
          taskData.TopicName,
          taskData.Level,
          taskData.TaskScore || 0,
          taskData.TaskType,
          taskData.DurationTask || null
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create task');
      }
      
      return taskData.TaskId;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  // Update task
  static async update(taskId: string, updateData: Partial<ITask>): Promise<boolean> {
    try {
      // Don't allow updating TaskId, UserId
      delete updateData.TaskId;
      delete updateData.UserId;
      delete updateData.CreatedAt;
      
      // Add UpdatedAt
      updateData.UpdatedAt = new Date();
      
      // Build the SET part of the SQL query dynamically
      const updateFields = Object.keys(updateData)
        .map(field => `${field} = ?`)
        .join(', ');
      
      if (!updateFields) {
        return true; // Nothing to update
      }
      
      const values = [...Object.values(updateData), taskId];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Tasks SET ${updateFields} WHERE TaskId = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  // Complete task
  static async completeTask(taskId: string, score: number, duration?: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Tasks 
         SET TaskScore = ?, CompletionDate = NOW(), DurationTask = ?, UpdatedAt = NOW() 
         WHERE TaskId = ?`,
        [score, duration || null, taskId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error completing task:', error);
      throw error;
    }
  }
}

export default Task;