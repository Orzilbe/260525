// apps/api/src/models/Test.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export enum TestType {
  PLACEMENT = 'placement',
  TOPIC = 'topic',
  LEVEL = 'level'
}

export interface ITest extends RowDataPacket {
  TestId: string;
  UserId: string;
  TestScore: number;
  TestType: TestType;
  CompletionDate?: Date;
  DurationTest?: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class Test {
  // Find test by ID
  static async findById(testId: string): Promise<ITest | null> {
    try {
      const [rows] = await pool.execute<ITest[]>(
        'SELECT * FROM Tests WHERE TestId = ?',
        [testId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding test by ID:', error);
      throw error;
    }
  }

  // Find tests by user ID
  static async findByUser(userId: string): Promise<ITest[]> {
    try {
      const [rows] = await pool.execute<ITest[]>(
        'SELECT * FROM Tests WHERE UserId = ? ORDER BY CreatedAt DESC',
        [userId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding tests by user:', error);
      throw error;
    }
  }

  // Create a new test
  static async create(testData: {
    TestId: string;
    UserId: string;
    TestScore: number;
    TestType: TestType;
    DurationTest?: number;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Tests 
         (TestId, UserId, TestScore, TestType, DurationTest, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          testData.TestId,
          testData.UserId,
          testData.TestScore,
          testData.TestType,
          testData.DurationTest || null
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create test');
      }
      
      return testData.TestId;
    } catch (error) {
      console.error('Error creating test:', error);
      throw error;
    }
  }

  // Complete test
  static async completeTest(testId: string, score: number, duration?: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Tests 
         SET TestScore = ?, CompletionDate = NOW(), DurationTest = ?, UpdatedAt = NOW() 
         WHERE TestId = ?`,
        [score, duration || null, testId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error completing test:', error);
      throw error;
    }
  }
}

export default Test;