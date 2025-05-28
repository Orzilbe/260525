// apps/api/src/models/InteractiveSession.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export enum SessionType {
  CONVERSATION = 'conversation',
}

export interface IInteractiveSession extends RowDataPacket {
  SessionId: string;
  TaskId: string;
  SessionType: SessionType;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class InteractiveSession {
  // Find session by ID
  static async findById(sessionId: string): Promise<IInteractiveSession | null> {
    try {
      const [rows] = await pool.execute<IInteractiveSession[]>(
        'SELECT * FROM InteractiveSessions WHERE SessionId = ?',
        [sessionId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding session by ID:', error);
      throw error;
    }
  }

  // Find session by task ID
  static async findByTaskId(taskId: string): Promise<IInteractiveSession | null> {
    try {
      const [rows] = await pool.execute<IInteractiveSession[]>(
        'SELECT * FROM InteractiveSessions WHERE TaskId = ?',
        [taskId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding session by task ID:', error);
      throw error;
    }
  }

  // Create a new session
  static async create(sessionData: {
    SessionId: string;
    TaskId: string;
    SessionType: SessionType;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO InteractiveSessions 
         (SessionId, TaskId, SessionType, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [
          sessionData.SessionId,
          sessionData.TaskId,
          sessionData.SessionType
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create interactive session');
      }
      
      return sessionData.SessionId;
    } catch (error) {
      console.error('Error creating interactive session:', error);
      throw error;
    }
  }
}

export default InteractiveSession;