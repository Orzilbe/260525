// apps/web/src/services/getFilteredWords.ts

import { getSafeDbPool } from '../lib/db';
import { formatTopicNameForDb } from '../lib/topicUtils';

/**
 * פונקציה לקבלת מילים עבור נושא ורמה, תוך פילטור מילים שכבר נלמדו
 * @param userId מזהה המשתמש
 * @param topicName שם הנושא
 * @param level רמת האנגלית (beginner/intermediate/advanced)
 * @param limit מספר מקסימלי של מילים להחזיר
 * @returns מערך של מילים מסוננות (ללא מילים שכבר נלמדו ברמות קודמות)
 */
export async function getSmartFilteredWords(
  userId: string,
  topicName: string,
  level: string,
  limit: number = 20
): Promise<any[]> {
  try {
    console.group('getSmartFilteredWords');
    console.log(`Getting words for userId ${userId}, topic "${topicName}", level ${level}`);
    
    // קבלת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      return [];
    }
    
    // המרת שם הנושא לפורמט אחיד
    const dbTopicName = formatTopicNameForDb(topicName);
    
    // קבלת מידע על רמת המשתמש הנוכחית בנושא זה
    const [userLevelRows] = await pool.query(
      `SELECT Level FROM userinlevel
       WHERE UserId = ? AND TopicName = ?`,
      [userId, dbTopicName]
    );
    
    let userLevel = 1; // ברירת מחדל
    if (Array.isArray(userLevelRows) && userLevelRows.length > 0) {
      userLevel = parseInt((userLevelRows[0] as any).Level, 10);
    }
    console.log(`User level in topic "${dbTopicName}": ${userLevel}`);
    
    // === שיפור #1: בדיקה ישירה של טבלת wordintask ===
    
    // קודם נבדוק אם טבלת wordintask קיימת
    const [tableCheck] = await pool.query('SHOW TABLES LIKE ?', ['wordintask']);
    if (!Array.isArray(tableCheck) || tableCheck.length === 0) {
      console.log('wordintask table not found, filtering not possible');
      
      // אם הטבלה לא קיימת, נחזיר מילים ללא פילטור
      const [words] = await pool.query(
        `SELECT * FROM Words 
         WHERE TopicName = ? AND EnglishLevel = ?
         ORDER BY RAND() LIMIT ?`,
        [dbTopicName, level, limit]
      );
      
      console.log(`Retrieved ${Array.isArray(words) ? words.length : 0} words without wordintask filtering`);
      console.groupEnd();
      return Array.isArray(words) ? words : [];
    }
    
    // שאילתא לקבלת כל המילים שהמשתמש כבר למד (מכל המשימות של המשתמש)
    const learnedWordsQuery = `
      SELECT DISTINCT wit.WordId
      FROM wordintask wit
      JOIN Tasks t ON wit.TaskId = t.TaskId
      WHERE t.UserId = ?
        AND t.CompletionDate IS NOT NULL
    `;
    
    const [learnedWords] = await pool.query(learnedWordsQuery, [userId]);
    const learnedWordIds = Array.isArray(learnedWords) 
      ? (learnedWords as any[]).map(row => row.WordId) 
      : [];
    
    console.log(`User has learned ${learnedWordIds.length} words in total`);
    
    // אם אין מילים שנלמדו, פשוט מחזירים מילים ללא פילטור
    if (learnedWordIds.length === 0) {
      console.log('No previously learned words found, no filtering needed');
      const [words] = await pool.query(
        `SELECT * FROM Words 
         WHERE TopicName = ? AND EnglishLevel = ?
         ORDER BY RAND() LIMIT ?`,
        [dbTopicName, level, limit]
      );
      
      console.log(`Retrieved ${Array.isArray(words) ? words.length : 0} words without filtering`);
      console.groupEnd();
      return Array.isArray(words) ? words : [];
    }
    
    // פילטור מילים - קבלת מילים שלא נלמדו עדיין
    console.log(`Filtering out ${learnedWordIds.length} previously learned words`);
    
    let filteredWordsQuery;
    let queryParams;
    
    // אם יש יותר מדי מילים שכבר נלמדו, נשתמש בגישה אחרת לשאילתא
    if (learnedWordIds.length > 100) {
      console.log('Large number of learned words, using sub-query approach');
      
      filteredWordsQuery = `
        SELECT * FROM Words 
        WHERE TopicName = ? 
          AND EnglishLevel = ? 
          AND WordId NOT IN (
            SELECT DISTINCT wit.WordId
            FROM wordintask wit
            JOIN Tasks t ON wit.TaskId = t.TaskId
            WHERE t.UserId = ?
              AND t.CompletionDate IS NOT NULL
          )
        ORDER BY RAND() 
        LIMIT ?
      `;
      
      queryParams = [dbTopicName, level, userId, limit];
    } else {
      // כשיש פחות מילים, נשתמש בגישת IN (,,)
      const learnedPlaceholders = learnedWordIds.map(() => '?').join(',');
      
      filteredWordsQuery = `
        SELECT * FROM Words 
        WHERE TopicName = ? 
          AND EnglishLevel = ? 
          AND WordId NOT IN (${learnedPlaceholders})
        ORDER BY RAND() 
        LIMIT ?
      `;
      
      queryParams = [dbTopicName, level, ...learnedWordIds, limit];
    }
    
    try {
      const [filteredWords] = await pool.query(filteredWordsQuery, queryParams);
      
      console.log(`Retrieved ${Array.isArray(filteredWords) ? filteredWords.length : 0} filtered words`);
      
      // אם לא נמצאו מילים מסוננות או יש מעט מדי, ננסה שוב עם גישה אחרת
      if (!Array.isArray(filteredWords) || filteredWords.length < 3) {
        console.log(`Too few words after filtering (${Array.isArray(filteredWords) ? filteredWords.length : 0}), trying alternate approach`);
        
        // שאילתא אלטרנטיבית - מילים מהנושא הזה שטרם נלמדו (ללא קשר לרמה)
        const alternateQuery = `
          SELECT * FROM Words 
          WHERE TopicName = ? 
            AND WordId NOT IN (
              SELECT DISTINCT wit.WordId
              FROM wordintask wit
              JOIN Tasks t ON wit.TaskId = t.TaskId
              WHERE t.UserId = ?
                AND t.CompletionDate IS NOT NULL
            )
          ORDER BY RAND() 
          LIMIT ?
        `;
        
        const [alternateWords] = await pool.query(alternateQuery, [dbTopicName, userId, limit]);
        
        if (Array.isArray(alternateWords) && alternateWords.length >= 3) {
          console.log(`Retrieved ${alternateWords.length} alternate words`);
          console.groupEnd();
          return alternateWords as any[];
        }
        
        // אם עדיין אין מספיק מילים, ננסה להחזיר מילים ללא פילטור
        console.log('Still too few words, returning unfiltered words as fallback');
        
        const [unfilteredWords] = await pool.query(
          `SELECT * FROM Words 
           WHERE TopicName = ? AND EnglishLevel = ?
           ORDER BY RAND() LIMIT ?`,
          [dbTopicName, level, limit]
        );
        
        console.log(`Retrieved ${Array.isArray(unfilteredWords) ? unfilteredWords.length : 0} unfiltered words as fallback`);
        console.groupEnd();
        return Array.isArray(unfilteredWords) ? unfilteredWords : [];
      }
      
      console.groupEnd();
      return filteredWords as any[];
    } catch (sqlError) {
      console.error('SQL Error in filtered query:', sqlError);
      
      // במקרה של שגיאת SQL, ננסה להחזיר מילים ללא פילטור
      console.log('Falling back to unfiltered words due to SQL error');
      
      const [unfilteredWords] = await pool.query(
        `SELECT * FROM Words 
         WHERE TopicName = ? AND EnglishLevel = ?
         ORDER BY RAND() LIMIT ?`,
        [dbTopicName, level, limit]
      );
      
      console.log(`Retrieved ${Array.isArray(unfilteredWords) ? unfilteredWords.length : 0} unfiltered words after SQL error`);
      console.groupEnd();
      return Array.isArray(unfilteredWords) ? unfilteredWords : [];
    }
  } catch (error) {
    console.error('Error in getSmartFilteredWords:', error);
    console.groupEnd();
    return [];
  }
}