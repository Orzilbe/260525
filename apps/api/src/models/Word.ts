// apps/api/src/models/Word.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IWord extends RowDataPacket {
  WordId: string;
  Word: string;
  Translation: string;
  ExampleUsage: string;
  TopicName: string;
  EnglishLevel: string;
  PartOfSpeech?: string;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class Word {
  // Find word by ID
  static async findById(wordId: string): Promise<IWord | null> {
    try {
      const [rows] = await pool.execute<IWord[]>(
        'SELECT * FROM Words WHERE WordId = ?',
        [wordId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error finding word by ID:', error);
      throw error;
    }
  }

  // Find word by text
  static async findByWord(word: string): Promise<IWord | null> {
    try {
      const [rows] = await pool.execute<IWord[]>(
        'SELECT * FROM Words WHERE Word = ?',
        [word]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding word by text:', error);
      throw error;
    }
  }

  // Find words by topic and English level
  static async findByTopicAndEnglishLevel(
    topicName: string, 
    englishLevel: string
  ): Promise<IWord[]> {
    try {
      const [rows] = await pool.execute<IWord[]>(
        'SELECT * FROM Words WHERE TopicName = ? AND EnglishLevel = ?',
        [topicName, englishLevel]
      );
      return rows;
    } catch (error) {
      console.error('Error finding words by topic and English level:', error);
      throw error;
    }
  }

  // Create a new word
  static async create(wordData: {
    WordId: string;
    Word: string;
    Translation: string;
    ExampleUsage: string;
    TopicName: string;
    EnglishLevel: string;
    PartOfSpeech?: string;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Words 
         (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel, PartOfSpeech, CreatedAt, UpdatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          wordData.WordId,
          wordData.Word,
          wordData.Translation,
          wordData.ExampleUsage,
          wordData.TopicName,
          wordData.EnglishLevel,
          wordData.PartOfSpeech || ''
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create word');
      }
      
      return wordData.WordId;
    } catch (error) {
      console.error('Error creating word:', error);
      throw error;
    }
  }

  // Update word
  static async update(wordId: string, updateData: Partial<IWord>): Promise<boolean> {
    try {
      // Don't allow updating WordId
      delete updateData.WordId;
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
      
      const values = [...Object.values(updateData), wordId];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Words SET ${updateFields} WHERE WordId = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating word:', error);
      throw error;
    }
  }

  // Delete word
  static async delete(wordId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM Words WHERE WordId = ?',
        [wordId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting word:', error);
      throw error;
    }
  }
}

export default Word;