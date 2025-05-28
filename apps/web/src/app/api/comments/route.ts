// apps/web/src/app/api/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../auth/verifyAuth';
import { getSafeDbPool } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * יצירת תגובה חדשה - POST /api/comments
 */
export async function POST(request: NextRequest) {
  console.group('POST /api/comments');
  console.log('Request received at:', new Date().toISOString());
  
  try {
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // פענוח גוף הבקשה
    let body;
    try {
      body = await request.json();
      console.log('Request body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      console.groupEnd();
      return NextResponse.json({ error: 'Invalid request body format' }, { status: 400 });
    }
    
    // חילוץ פרמטרים
    const commentId = body.CommentID || body.commentId || uuidv4();
    const postId = body.PostID || body.postId;
    const commentContent = body.commentContent || body.CommentContent;
    const feedback = body.Feedback || body.feedback;
    
    console.log(`Creating comment: ID=${commentId}, PostID=${postId}, content length=${commentContent?.length || 0}`);
    
    // וידוא פרמטרים נדרשים
    if (!postId) {
      console.error('PostID is required');
      console.groupEnd();
      return NextResponse.json({ error: 'PostID is required' }, { status: 400 });
    }
    
    if (!commentContent) {
      console.error('commentContent is required');
      console.groupEnd();
      return NextResponse.json({ error: 'commentContent is required' }, { status: 400 });
    }
    
    try {
      // קבלת חיבור למסד הנתונים
      const pool = await getSafeDbPool();
      if (!pool) {
        console.error('Database connection not available');
        console.groupEnd();
        return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
      }
      
      // וידוא שהפוסט קיים בבסיס הנתונים
      console.log(`Verifying post ${postId} exists...`);
      const [postRows] = await pool.query('SELECT 1 FROM posts WHERE PostID = ?', [postId]);
      
      if (!Array.isArray(postRows) || (postRows as any[]).length === 0) {
        // אם הפוסט לא קיים בטבלה הרגילה, נבדוק בטבלה עם אות גדולה
        const [capitalizedRows] = await pool.query('SELECT 1 FROM Posts WHERE PostID = ?', [postId]);
        
        if (!Array.isArray(capitalizedRows) || (capitalizedRows as any[]).length === 0) {
          console.error(`Post ${postId} does not exist in either posts or Posts table`);
          
          // במקום להחזיר שגיאה, ננסה ליצור את הפוסט אם קיבלנו TaskId
          if (body.TaskId) {
            try {
              await pool.query(
                'INSERT INTO posts (PostID, TaskId, PostContent) VALUES (?, ?, ?)',
                [postId, body.TaskId, 'Placeholder post content']
              );
              console.log(`Created placeholder post ${postId} for task ${body.TaskId}`);
            } catch (createPostError) {
              console.error('Failed to create placeholder post:', createPostError);
              console.groupEnd();
              return NextResponse.json({ 
                error: 'Post does not exist and failed to create one', 
                details: 'Post verification failed'
              }, { status: 400 });
            }
          } else {
            console.groupEnd();
            return NextResponse.json({ 
              error: 'Post does not exist', 
              details: 'Post verification failed'
            }, { status: 400 });
          }
        }
      }
      
      // הכנת ערך ה-feedback לשמירה בבסיס הנתונים
      let feedbackStr = feedback;
      if (feedback && typeof feedback !== 'string') {
        feedbackStr = JSON.stringify(feedback);
      }
      
      // ניסיון לשמור את התגובה באופן פשוט וישיר
      console.log(`Inserting comment into database: CommentID=${commentId}`);
      
      // הוספת תמיכה בהתייחסות לאותיות גדולות/קטנות
      try {
        await pool.query(
          'INSERT INTO comments (CommentID, commentContent, Feedback, PostID) VALUES (?, ?, ?, ?)',
          [commentId, commentContent, feedbackStr, postId]
        );
        
        console.log('Comment saved successfully in comments table');
      } catch (insertError) {
        // אם השגיאה היא duplicate key, ננסה לעדכן במקום להוסיף
        if ((insertError as any).code === 'ER_DUP_ENTRY') {
          console.log('Comment already exists, updating instead');
          
          try {
            await pool.query(
              'UPDATE comments SET commentContent = ?, Feedback = ? WHERE CommentID = ?',
              [commentContent, feedbackStr, commentId]
            );
            
            console.log('Comment updated successfully in comments table');
          } catch (updateError) {
            console.error('Failed to update comment:', updateError);
            throw updateError;
          }
        } else {
          // אם השגיאה היא לא duplicate, ננסה את הטבלה עם אות גדולה
          console.log('Error inserting into comments, trying Comments (capitalized) table');
          
          try {
            // בדיקה אם הטבלה עם אות גדולה קיימת
            await pool.query(
              'CREATE TABLE IF NOT EXISTS Comments (CommentID char(36) NOT NULL PRIMARY KEY, commentContent text NOT NULL, Feedback text, PostID char(36) NOT NULL, INDEX(PostID))'
            );
            
            await pool.query(
              'INSERT INTO Comments (CommentID, commentContent, Feedback, PostID) VALUES (?, ?, ?, ?)',
              [commentId, commentContent, feedbackStr, postId]
            );
            
            console.log('Comment saved successfully in Comments (capitalized) table');
          } catch (capitalizedError) {
            console.error('Failed with both table approaches:', capitalizedError);
            throw capitalizedError;
          }
        }
      }
      
      console.log('Comment saving process completed successfully');
      console.groupEnd();
      
      return NextResponse.json({ 
        success: true, 
        CommentID: commentId,
        message: 'Comment created/updated successfully'
      });
    } catch (dbError) {
      console.error('Database error while saving comment:', dbError);
      console.groupEnd();
      
      return NextResponse.json({ 
        success: false, 
        CommentID: commentId,
        message: 'Failed to save comment',
        error: 'Database error occurred',
        error_details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating/updating comment:', error);
    console.groupEnd();
    
    return NextResponse.json({ 
      error: 'An error occurred during comment creation/update',
      error_details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * קבלת תגובות לפוסט - GET /api/comments?postId=X
 */
export async function GET(request: NextRequest) {
  console.group('GET /api/comments');
  console.log('Request received at:', new Date().toISOString());
  
  try {
    // אימות משתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // קבלת פרמטרים מה-URL
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    
    if (!postId) {
      console.error('Missing required parameter: postId');
      console.groupEnd();
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }
    
    // קבלת חיבור למסד הנתונים
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    // קבלת התגובות
    try {
      const [commentsResult] = await pool.query(
        'SELECT * FROM comments WHERE PostID = ?',
        [postId]
      );
      
      const comments = commentsResult as any[];
      console.log(`Found ${comments.length} comments for post ${postId}`);
      console.groupEnd();
      
      return NextResponse.json(comments);
    } catch (tableErr) {
      // ניסיון עם טבלה עם אות ראשונה גדולה
      try {
        const [capitalizedResult] = await pool.query(
          'SELECT * FROM Comments WHERE PostID = ?',
          [postId]
        );
        
        const comments = capitalizedResult as any[];
        console.log(`Found ${comments.length} comments for post ${postId} in capitalized table`);
        console.groupEnd();
        
        return NextResponse.json(comments);
      } catch (capitalizedErr) {
        console.error('Error querying both tables:', capitalizedErr);
        console.groupEnd();
        
        // ניסיון ליצור את הטבלה אם לא קיימת
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
        } catch (createErr) {
          console.error('Failed to create comments table:', createErr);
        }
        
        return NextResponse.json([]);
      }
    }
  } catch (error) {
    console.error('Error fetching comments:', error);
    console.groupEnd();
    
    return NextResponse.json({ 
      comments: [],
      message: 'Failed to retrieve comments',
      error_details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}