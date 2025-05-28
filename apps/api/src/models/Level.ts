// apps/api/src/models/Level.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface ILevel extends RowDataPacket {
  TopicName: string;
  Level: number;
  Title: string;
  Description: string;
  RequiredScore: number;
  IsLocked: boolean;
}

class Level {
  // Get all levels for a topic
  static async findByTopic(topicName: string): Promise<ILevel[]> {
    try {
      const [rows] = await pool.execute<ILevel[]>(
        'SELECT * FROM Levels WHERE TopicName = ? ORDER BY Level',
        [topicName]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding levels by topic:', error);
      throw error;
    }
  }

  // Find specific level
  static async findByTopicAndLevel(topicName: string, level: number): Promise<ILevel | null> {
    try {
      const [rows] = await pool.execute<ILevel[]>(
        'SELECT * FROM Levels WHERE TopicName = ? AND Level = ?',
        [topicName, level]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding level:', error);
      throw error;
    }
  }

  // Create a new level
  static async create(levelData: {
    TopicName: string;
    Level: number;
    Title: string;
    Description: string;
    RequiredScore?: number;
    IsLocked?: boolean;
  }): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Levels 
         (TopicName, Level, Title, Description, RequiredScore, IsLocked)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          levelData.TopicName,
          levelData.Level,
          levelData.Title,
          levelData.Description,
          levelData.RequiredScore || 0,
          levelData.IsLocked || false
        ]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error creating level:', error);
      throw error;
    }
  }

  // Update level
  static async update(
    topicName: string, 
    level: number, 
    updateData: Partial<ILevel>
  ): Promise<boolean> {
    try {
      // Don't allow updating TopicName or Level
      delete updateData.TopicName;
      delete updateData.Level;
      
      // Build the SET part of the SQL query dynamically
      const updateFields = Object.keys(updateData)
        .map(field => `${field} = ?`)
        .join(', ');
      
      if (!updateFields) {
        return true; // Nothing to update
      }
      
      const values = [...Object.values(updateData), topicName, level];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Levels SET ${updateFields} WHERE TopicName = ? AND Level = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating level:', error);
      throw error;
    }
  }
}

export default Level;