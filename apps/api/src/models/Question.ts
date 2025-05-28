// apps/api/src/models/Question.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IQuestion extends RowDataPacket {
  QuestionId: string;
  SessionId: string;
  QuestionText: string;
  AnswerText: string | null;
  Feedback: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class Question {
  // Find question by ID
  static async findById(questionId: string): Promise<IQuestion | null> {
    try {
      const [rows] = await pool.execute<IQuestion[]>(
        'SELECT * FROM Questions WHERE QuestionId = ?',
        [questionId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding question by ID:', error);
      throw error;
    }
  }

  // Find questions by session ID
  static async findBySessionId(sessionId: string): Promise<IQuestion[]> {
    try {
      const [rows] = await pool.execute<IQuestion[]>(
        'SELECT * FROM Questions WHERE SessionId = ? ORDER BY CreatedAt',
        [sessionId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding questions by session ID:', error);
      throw error;
    }
  }

  // Create a new question
  static async create(questionData: {
    QuestionId: string;
    SessionId: string;
    QuestionText: string;
    AnswerText?: string | null;
    Feedback?: string | null;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Questions 
         (QuestionId, SessionId, QuestionText, AnswerText, Feedback, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          questionData.QuestionId,
          questionData.SessionId,
          questionData.QuestionText,
          questionData.AnswerText || null,
          questionData.Feedback || null
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create question');
      }
      
      return questionData.QuestionId;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  // Update question answer and feedback
  static async update(questionId: string, updateData: {
    AnswerText?: string;
    Feedback?: string;
  }): Promise<boolean> {
    try {
      // Build update query dynamically based on provided fields
      const updateFields: string[] = [];
      const params: any[] = [];
      
      if (updateData.AnswerText !== undefined) {
        updateFields.push('AnswerText = ?');
        params.push(updateData.AnswerText);
      }
      
      if (updateData.Feedback !== undefined) {
        updateFields.push('Feedback = ?');
        params.push(updateData.Feedback);
      }
      
      if (updateFields.length === 0) {
        return false; // Nothing to update
      }
      
      updateFields.push('UpdatedAt = NOW()');
      params.push(questionId); // For the WHERE clause
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Questions SET ${updateFields.join(', ')} WHERE QuestionId = ?`,
        params
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  }
}

export default Question;