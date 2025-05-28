// apps/web/src/app/services/wordService.ts

import { getSafeDbPool } from '../../lib/db';
import { GeneratedWord } from './openai';

/**
 * Save generated words to the database
 */
export async function saveWords(words: GeneratedWord[]): Promise<GeneratedWord[]> {
  console.log(`Saving ${words.length} words`);
  
  if (!words || words.length === 0) {
    console.log('No words to save');
    return [];
  }
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return [];
    }
    
    const savedWords: GeneratedWord[] = [];
    
    // Get a connection and start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      for (const word of words) {
        // Check if word already exists
        const [existingWords] = await connection.query(
          'SELECT WordId FROM Words WHERE Word = ? AND TopicName = ?',
          [word.Word, word.TopicName]
        );
        
        if (Array.isArray(existingWords) && existingWords.length > 0) {
          // Word exists, add to saved list and continue
          savedWords.push({
            ...word,
            WordId: (existingWords[0] as any).WordId
          });
          continue;
        }
        
        // Insert new word
        await connection.query(
          `INSERT INTO Words 
           (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel, CreatedAt, UpdatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            word.WordId,
            word.Word,
            word.Translation,
            word.ExampleUsage,
            word.TopicName,
            word.EnglishLevel
          ]
        );
        
        savedWords.push(word);
      }
      
      // Commit the transaction
      await connection.commit();
      console.log(`Successfully saved ${savedWords.length} words to database`);
      
      return savedWords;
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      console.error('Error in save transaction:', error);
      throw error;
    } finally {
      // Release the connection
      connection.release();
    }
  } catch (error) {
    console.error('Error saving words:', error);
    return [];
  }
}

/**
 * Get words from the database by topic and level
 */
export async function getWordsByTopicAndLevel(
  topicName: string, 
  englishLevel: string,
  limit: number = 20
): Promise<GeneratedWord[]> {
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      return [];
    }
    
    // Query for words matching topic and level
    const [rows] = await pool.query(
      `SELECT * FROM Words 
       WHERE TopicName = ? AND EnglishLevel = ?
       ORDER BY RAND() LIMIT ?`,
      [topicName, englishLevel, limit]
    );
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }
    
    // Convert to GeneratedWord format
    return (rows as any[]).map(row => ({
      WordId: row.WordId,
      Word: row.Word,
      Translation: row.Translation,
      ExampleUsage: row.ExampleUsage || '',
      TopicName: row.TopicName,
      EnglishLevel: row.EnglishLevel
    }));
  } catch (error) {
    console.error('Error getting words by topic and level:', error);
    return [];
  }
}

export default {
  saveWords,
  getWordsByTopicAndLevel
};