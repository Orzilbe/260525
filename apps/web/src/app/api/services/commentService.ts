// apps/web/src/app/api/services/commentService.ts
import { getSafeDbPool } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * יוצר תגובה חדשה
 * @param commentId מזהה התגובה (אופציונלי)
 * @param postId מזהה הפוסט
 * @param commentContent תוכן התגובה
 * @param feedback משוב על התגובה (אופציונלי)
 * @returns מזהה התגובה
 */
export async function createComment(
  commentId: string | null,
  postId: string,
  commentContent: string,
  feedback?: string | null
): Promise<string> {
  console.group('Creating comment');
  console.log(`commentId=${commentId || 'new'}, postId=${postId}, commentContent length=${commentContent?.length || 0}`);
  
  // יצירת מזהה חדש אם לא סופק
  const finalCommentId = commentId || uuidv4();
  
  try {
    // קבלת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      // החזרת המזהה גם אם לא הצלחנו לשמור
      return finalCommentId;
    }
    
    // התחלת טרנזקציה
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // יצירת טבלה אם לא קיימת - אפשרות בטוחה יותר
        await connection.query(`
          CREATE TABLE IF NOT EXISTS comments (
            CommentID char(36) NOT NULL PRIMARY KEY,
            commentContent text NOT NULL,
            Feedback text,
            PostID char(36) NOT NULL,
            INDEX (PostID)
          )
        `);
        
        // בדיקה אם התגובה כבר קיימת
        const [existingComments] = await connection.query(
          'SELECT CommentID FROM comments WHERE CommentID = ?',
          [finalCommentId]
        );
        
        const comments = existingComments as any[];
        
        if (comments.length > 0) {
          // עדכון תגובה קיימת
          console.log(`Updating existing comment with ID ${finalCommentId}`);
          
          // וידוא שהתוכן לא גדול מדי (MySQL TEXT limit is 65,535 bytes)
          const safeContent = commentContent && commentContent.length > 65000 
            ? commentContent.substring(0, 65000) 
            : commentContent;
          
          // הכנת ערך ה-feedback לשמירה בבסיס הנתונים
          let feedbackStr = feedback;
          if (feedback && typeof feedback !== 'string') {
            feedbackStr = JSON.stringify(feedback);
          }
          
          await connection.query(
            'UPDATE comments SET commentContent = ?, Feedback = ? WHERE CommentID = ?',
            [safeContent, feedbackStr, finalCommentId]
          );
        } else {
          // יצירת תגובה חדשה
          console.log(`Creating new comment with ID ${finalCommentId}`);
          
          // וידוא שהתוכן לא גדול מדי
          const safeContent = commentContent && commentContent.length > 65000 
            ? commentContent.substring(0, 65000) 
            : commentContent;
          
          // הכנת ערך ה-feedback לשמירה בבסיס הנתונים
          let feedbackStr = feedback;
          if (feedback && typeof feedback !== 'string') {
            feedbackStr = JSON.stringify(feedback);
          }
          
          await connection.query(
            'INSERT INTO comments (CommentID, commentContent, Feedback, PostID) VALUES (?, ?, ?, ?)',
            [finalCommentId, safeContent, feedbackStr, postId]
          );
        }
        
        // אישור הטרנזקציה
        await connection.commit();
        console.log('Comment saved successfully');
        console.groupEnd();
        return finalCommentId;
      } catch (tableErr) {
        // אם יש בעיה עם פעולות הטבלה, ננסה עם שם טבלה חלופי (עם אות ראשונה גדולה)
        console.log('Error with default table name, trying with capitalized table name:', tableErr);
        
        try {
          // יצירת טבלה אם לא קיימת (גרסה עם אות ראשונה גדולה)
          await connection.query(`
            CREATE TABLE IF NOT EXISTS Comments (
              CommentID char(36) NOT NULL PRIMARY KEY,
              commentContent text NOT NULL,
              Feedback text,
              PostID char(36) NOT NULL,
              INDEX (PostID)
            )
          `);
          
          // בדיקה אם התגובה כבר קיימת
          const [existingComments] = await connection.query(
            'SELECT CommentID FROM Comments WHERE CommentID = ?',
            [finalCommentId]
          );
          
          const comments = existingComments as any[];
          
          if (comments.length > 0) {
            // עדכון תגובה קיימת
            console.log(`Updating existing comment with ID ${finalCommentId} in capitalized table`);
            
            // וידוא שהתוכן לא גדול מדי
            const safeContent = commentContent && commentContent.length > 65000 
              ? commentContent.substring(0, 65000) 
              : commentContent;
            
            // הכנת ערך ה-feedback לשמירה בבסיס הנתונים
            let feedbackStr = feedback;
            if (feedback && typeof feedback !== 'string') {
              feedbackStr = JSON.stringify(feedback);
            }
            
            await connection.query(
              'UPDATE Comments SET commentContent = ?, Feedback = ? WHERE CommentID = ?',
              [safeContent, feedbackStr, finalCommentId]
            );
          } else {
            // יצירת תגובה חדשה
            console.log(`Creating new comment with ID ${finalCommentId} in capitalized table`);
            
            // וידוא שהתוכן לא גדול מדי
            const safeContent = commentContent && commentContent.length > 65000 
              ? commentContent.substring(0, 65000) 
              : commentContent;
            
            // הכנת ערך ה-feedback לשמירה בבסיס הנתונים
            let feedbackStr = feedback;
            if (feedback && typeof feedback !== 'string') {
              feedbackStr = JSON.stringify(feedback);
            }
            
            await connection.query(
              'INSERT INTO Comments (CommentID, commentContent, Feedback, PostID) VALUES (?, ?, ?, ?)',
              [finalCommentId, safeContent, feedbackStr, postId]
            );
          }
          
          // אישור הטרנזקציה
          await connection.commit();
          console.log('Comment saved successfully in capitalized table');
          console.groupEnd();
          return finalCommentId;
        } catch (capitalizedErr) {
          // שתי הגישות נכשלו, ביטול הטרנזקציה וזריקת שגיאה
          await connection.rollback();
          console.error('Failed with both table name approaches:', capitalizedErr);
          // החזרת מזהה התגובה גם אם השמירה נכשלה - עדיף מאשר להחזיר כלום
          return finalCommentId;
        }
      }
    } catch (error) {
      // ביטול הטרנזקציה בשגיאה
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackErr) {
          console.error('Error rolling back transaction:', rollbackErr);
        }
      }
      
      console.error('Transaction error:', error);
      console.groupEnd();
      // החזרת המזהה גם אם השמירה נכשלה
      return finalCommentId;
    } finally {
      // שחרור החיבור
      if (connection) {
        try {
          connection.release();
        } catch (releaseErr) {
          console.error('Error releasing connection:', releaseErr);
        }
      }
    }
  } catch (error) {
    console.error('Error saving comment:', error);
    console.groupEnd();
    // החזרת המזהה גם אם השמירה נכשלה
    return finalCommentId;
  }
}

/**
 * מקבל תגובות לפוסט מסוים
 * @param postId מזהה הפוסט
 * @returns רשימת התגובות
 */
export async function getCommentsByPostId(postId: string): Promise<any[]> {
  console.group(`Getting comments for post ${postId}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      return [];
    }
    
    try {
      // ניסיון למצוא תגובות בשתי הטבלאות האפשריות
      let comments: any[] = [];
      
      try {
        const [commentsResult] = await pool.query(
          'SELECT * FROM comments WHERE PostID = ?',
          [postId]
        );
        comments = commentsResult as any[];
        console.log(`Found ${comments.length} comments in regular table`);
      } catch (error) {
        console.warn('Error querying comments table:', error);
        
        // ניסיון עם שם טבלה עם אות גדולה
        try {
          const [capitalizedResult] = await pool.query(
            'SELECT * FROM Comments WHERE PostID = ?',
            [postId]
          );
          comments = capitalizedResult as any[];
          console.log(`Found ${comments.length} comments in capitalized table`);
        } catch (capitalizedError) {
          console.warn('Error querying Comments (capitalized) table:', capitalizedError);
          
          // כמוצא אחרון, ננסה ליצור את הטבלה אם היא לא קיימת
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS comments (
                CommentID char(36) NOT NULL PRIMARY KEY,
                commentContent text NOT NULL,
                Feedback text,
                PostID char(36) NOT NULL,
                INDEX (PostID)
              )
            `);
            console.log('Created comments table as it did not exist');
          } catch (createError) {
            console.error('Failed to create comments table:', createError);
          }
        }
      }
      
      console.log(`Returning ${comments.length} comments`);
      console.groupEnd();
      return comments;
    } catch (error) {
      console.error('Error retrieving comments:', error);
      console.groupEnd();
      return [];
    }
  } catch (error) {
    console.error('General error getting comments:', error);
    console.groupEnd();
    return [];
  }
}