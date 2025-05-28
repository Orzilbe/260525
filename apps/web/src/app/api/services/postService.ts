// apps/web/src/app/api/services/postService.ts
import { getSafeDbPool } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';


/**
 * Function to create a new post or update an existing one
 */
export async function createOrUpdatePost(postId: string, taskId: string, postContent: string, picture?: string | null): Promise<string> {
  console.group('Creating/updating post');
  console.log(`postId=${postId}, taskId=${taskId}, content length=${postContent?.length || 0}, picture=${picture ? 'provided' : 'not provided'}`);
  
  // Create new ID if not provided - do this early so we have an ID to return even if DB fails
  const finalPostId = postId || uuidv4();
  
  try {
    // Get database connection
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      // Return the ID even if we can't save to database
      return finalPostId;
    }
    
    // Begin transaction
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      // Check if table exists - Use catch block instead of checking results
      try {
        // Create table if it doesn't exist - safer approach with correct column names
        await connection.query(`
          CREATE TABLE IF NOT EXISTS posts (
            PostID char(36) NOT NULL PRIMARY KEY,
            TaskId char(36) NOT NULL,
            PostContent text,
            Picture varchar(255),
            INDEX (TaskId)
          )
        `);
        
        // Check if post already exists
        const [existingPosts] = await connection.query(
          'SELECT PostID FROM posts WHERE PostID = ?',
          [finalPostId]
        );
        
        const posts = existingPosts as any[];
        
        if (posts.length > 0) {
          // Update existing post
          console.log(`Updating existing post with ID ${finalPostId}`);
          
          // Ensure content is not too large (MySQL TEXT limit is 65,535 bytes)
          const safeContent = postContent && postContent.length > 65000 
            ? postContent.substring(0, 65000) 
            : postContent;
          
          // Ensure picture URL is not too large (varchar(255) limit)
          const safePicture = picture && picture.length > 250 
            ? picture.substring(0, 250) 
            : picture;
            
          await connection.query(
            'UPDATE posts SET TaskId = ?, PostContent = ?, Picture = ? WHERE PostID = ?',
            [taskId, safeContent, safePicture, finalPostId]
          );
        } else {
          // Create new post
          console.log(`Creating new post with ID ${finalPostId}`);
          
          // Ensure content is not too large
          const safeContent = postContent && postContent.length > 65000 
            ? postContent.substring(0, 65000) 
            : postContent;
          
          // Ensure picture URL is not too large
          const safePicture = picture && picture.length > 250 
            ? picture.substring(0, 250) 
            : picture;
            
          await connection.query(
            'INSERT INTO posts (PostID, TaskId, PostContent, Picture) VALUES (?, ?, ?, ?)',
            [finalPostId, taskId, safeContent, safePicture]
          );
        }
        
        // Commit transaction
        await connection.commit();
        console.log('Post saved successfully');
        console.groupEnd();
        return finalPostId;
      } catch (tableErr) {
        // If issue with table operations, try with alternative table name (capitalized)
        console.log('Error with default table name, trying with capitalized table name:', tableErr);
        
        try {
          // Create table if it doesn't exist (capitalized version) with correct column names
          await connection.query(`
            CREATE TABLE IF NOT EXISTS Posts (
              PostID char(36) NOT NULL PRIMARY KEY,
              TaskId char(36) NOT NULL,
              PostContent text,
              Picture varchar(255),
              INDEX (TaskId)
            )
          `);
          
          // Check if post already exists
          const [existingPosts] = await connection.query(
            'SELECT PostID FROM Posts WHERE PostID = ?',
            [finalPostId]
          );
          
          const posts = existingPosts as any[];
          
          if (posts.length > 0) {
            // Update existing post
            console.log(`Updating existing post with ID ${finalPostId} in capitalized table`);
            
            // Ensure content is not too large
            const safeContent = postContent && postContent.length > 65000 
              ? postContent.substring(0, 65000) 
              : postContent;
            
            // Ensure picture URL is not too large
            const safePicture = picture && picture.length > 250 
              ? picture.substring(0, 250) 
              : picture;
              
            await connection.query(
              'UPDATE Posts SET TaskId = ?, PostContent = ?, Picture = ? WHERE PostID = ?',
              [taskId, safeContent, safePicture, finalPostId]
            );
          } else {
            // Create new post
            console.log(`Creating new post with ID ${finalPostId} in capitalized table`);
            
            // Ensure content is not too large
            const safeContent = postContent && postContent.length > 65000 
              ? postContent.substring(0, 65000) 
              : postContent;
            
            // Ensure picture URL is not too large
            const safePicture = picture && picture.length > 250 
              ? picture.substring(0, 250) 
              : picture;
              
            await connection.query(
              'INSERT INTO Posts (PostID, TaskId, PostContent, Picture) VALUES (?, ?, ?, ?)',
              [finalPostId, taskId, safeContent, safePicture]
            );
          }
          
          // Commit transaction
          await connection.commit();
          console.log('Post saved successfully in capitalized table');
          console.groupEnd();
          return finalPostId;
        } catch (capitalizedErr) {
          // Both table approaches failed, rollback and throw
          await connection.rollback();
          console.error('Failed with both table name approaches:', capitalizedErr);
          // Return post ID even if save failed - better than returning nothing
          return finalPostId;
        }
      }
    } catch (error) {
      // Rollback on error
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackErr) {
          console.error('Error rolling back transaction:', rollbackErr);
        }
      }
      
      console.error('Transaction error:', error);
      console.groupEnd();
      // Return post ID even if save failed - better than returning nothing
      return finalPostId;
    } finally {
      // Release connection
      if (connection) {
        try {
          connection.release();
        } catch (releaseErr) {
          console.error('Error releasing connection:', releaseErr);
        }
      }
    }
  } catch (error) {
    console.error('Error saving post:', error);
    console.groupEnd();
    // Return post ID even if save failed - better than returning nothing
    return finalPostId;
  }
}

/**
 * בודק אם פוסט קיים בבסיס הנתונים לפי מזהה
 * 
 * @param postId מזהה הפוסט לבדיקה
 * @returns אמת אם הפוסט קיים, שקר אחרת
 */
export async function doesPostExist(postId: string): Promise<boolean> {
  console.group(`Checking if post exists: ${postId}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      return false;
    }
    
    // ניסיון לבדוק אם הפוסט קיים בטבלה posts
    try {
      const [result] = await pool.query(
        'SELECT 1 FROM posts WHERE PostID = ?',
        [postId]
      );
      
      const rows = result as any[];
      
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`Post ${postId} exists in posts table`);
        console.groupEnd();
        return true;
      }
      
      // אם לא נמצא, ננסה בטבלה עם אות גדולה
      const [capitalizedResult] = await pool.query(
        'SELECT 1 FROM Posts WHERE PostID = ?',
        [postId]
      );
      
      const capitalizedRows = capitalizedResult as any[];
      
      if (Array.isArray(capitalizedRows) && capitalizedRows.length > 0) {
        console.log(`Post ${postId} exists in Posts table`);
        console.groupEnd();
        return true;
      }
      
      console.log(`Post ${postId} does not exist in database`);
      console.groupEnd();
      return false;
    } catch (error) {
      console.error('Error checking if post exists:', error);
      console.groupEnd();
      return false;
    }
  } catch (error) {
    console.error('General error in doesPostExist:', error);
    console.groupEnd();
    return false;
  }
}
/**
 * מקבל את מזהה הפוסט (PostID) המקושר למזהה משימה (TaskID)
 * 
 * @param taskId מזהה המשימה
 * @returns מזהה הפוסט, או null אם לא נמצא
 */
export async function getPostIdByTaskId(taskId: string): Promise<string | null> {
  console.group(`Getting PostID for TaskId: ${taskId}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      return null;
    }
    
    // ניסיון לקבל את מזהה הפוסט מהטבלה posts
    try {
      const [result] = await pool.query(
        'SELECT PostID FROM posts WHERE TaskId = ?',
        [taskId]
      );
      
      const rows = result as any[];
      
      if (Array.isArray(rows) && rows.length > 0) {
        const postId = rows[0].PostID;
        console.log(`Found PostID ${postId} for TaskId ${taskId} in posts table`);
        console.groupEnd();
        return postId;
      }
      
      // אם לא נמצא, ננסה בטבלה עם אות גדולה
      const [capitalizedResult] = await pool.query(
        'SELECT PostID FROM Posts WHERE TaskId = ?',
        [taskId]
      );
      
      const capitalizedRows = capitalizedResult as any[];
      
      if (Array.isArray(capitalizedRows) && capitalizedRows.length > 0) {
        const postId = capitalizedRows[0].PostID;
        console.log(`Found PostID ${postId} for TaskId ${taskId} in Posts table`);
        console.groupEnd();
        return postId;
      }
      
      console.log(`No post found for TaskId ${taskId}`);
      console.groupEnd();
      return null;
    } catch (error) {
      console.error('Error querying for PostID:', error);
      console.groupEnd();
      return null;
    }
  } catch (error) {
    console.error('General error in getPostIdByTaskId:', error);
    console.groupEnd();
    return null;
  }
}
/**
 * Ensures a post exists for a task, creating a fallback if needed
 * @param taskId The task ID to ensure has a post
 * @param topicName Optional topic name for generating fallback content
 * @returns The post ID of the existing or newly created post
 */
export async function ensurePostExists(taskId: string, topicName?: string): Promise<string> {
  console.group('Ensuring post exists for task:', taskId);
  
  try {
    // First check if post already exists
    const existingPosts = await getPostsByTaskId(taskId);
    
    if (Array.isArray(existingPosts) && existingPosts.length > 0) {
      const existingPost = existingPosts[0];
      console.log('Found existing post:', existingPost.PostID);
      console.groupEnd();
      return existingPost.PostID;
    }
    
    // No post exists, create a fallback post
    console.log('No existing post found, creating fallback post');
    const postId = uuidv4();
    
    // Generate fallback content based on topic name
    let postContent = 'This is a fallback post content.';
    if (topicName) {
      const formattedTopic = topicName
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      postContent = `Welcome to this discussion about ${formattedTopic}! 

This is an important topic that has many interesting aspects to explore. What do you think about recent developments in this area? Have you had any personal experiences related to ${formattedTopic}?

I'd love to hear your thoughts on how this impacts our daily lives and what changes you'd like to see in the future.`;
    }
    
    // Save the fallback post
  const savedPostId = await createOrUpdatePost(postId, taskId, postContent);
    
    console.log('Created fallback post with ID:', savedPostId);
    console.groupEnd();
    return savedPostId;
  } catch (error) {
    console.error('Error ensuring post exists:', error);
    console.groupEnd();
    // Return a generated ID even in case of failure
    return uuidv4();
  }
}

/**
 * Gets the first post for a task, creating a fallback if none exists
 * @param taskId The task ID to get the post for
 * @param topicName Optional topic name for generating fallback content
 * @returns The post data or a fallback
 */
export async function getOrCreatePost(taskId: string, topicName?: string): Promise<any> {
  console.group('Getting or creating post for task:', taskId);
  
  try {
    // First check if post already exists
    const existingPosts = await getPostsByTaskId(taskId);
    
    if (Array.isArray(existingPosts) && existingPosts.length > 0) {
      const existingPost = existingPosts[0];
      console.log('Found existing post:', existingPost.PostID);
      console.groupEnd();
      return existingPost;
    }
    
    // No post exists, create a fallback post
    console.log('No existing post found, creating fallback post');
    const postId = uuidv4();
    
    // Generate fallback content based on topic name
    let postContent = 'This is a fallback post content.';
    if (topicName) {
      const formattedTopic = topicName
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      postContent = `Welcome to this discussion about ${formattedTopic}! 

This is an important topic that has many interesting aspects to explore. What do you think about recent developments in this area? Have you had any personal experiences related to ${formattedTopic}?

I'd love to hear your thoughts on how this impacts our daily lives and what changes you'd like to see in the future.`;
    }
    
    // Save the fallback post
    const savedPostId = await createOrUpdatePost(postId, taskId, postContent);
    
    console.log('Created fallback post with ID:', savedPostId);
    console.groupEnd();
    
    // Return the created post
    return {
      PostID: savedPostId,
      TaskId: taskId,
      PostContent: postContent,
      Picture: null,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting or creating post:', error);
    console.groupEnd();
    // Return a fallback post object even in case of failure
    const fallbackId = uuidv4();
    return {
      PostID: fallbackId,
      TaskId: taskId,
      PostContent: 'This is a fallback post created due to an error.',
      Picture: null,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
  }
}
/**
 * Function to get posts by task ID
 */
export async function getPostsByTaskId(taskId: string): Promise<any[]> {
  console.group(`Getting posts for task ${taskId}`);
  
  try {
    const pool = await getSafeDbPool();
    if (!pool) {
      console.error('Database connection not available');
      console.groupEnd();
      return [];
    }
    
    try {
      // Try to find posts in both possible tables
      let posts: any[] = [];
      
      try {
        const [postsResult] = await pool.query(
          'SELECT * FROM posts WHERE TaskId = ?',
          [taskId]
        );
        posts = postsResult as any[];
        console.log(`Found ${posts.length} posts in regular table`);
      } catch (error) {
        console.warn('Error querying posts table:', error);
        
        // Try with capitalized table name
        try {
          const [capitalizedResult] = await pool.query(
            'SELECT * FROM Posts WHERE TaskId = ?',
            [taskId]
          );
          posts = capitalizedResult as any[];
          console.log(`Found ${posts.length} posts in capitalized table`);
        } catch (capitalizedError) {
          console.warn('Error querying Posts (capitalized) table:', capitalizedError);
          
          // As a last resort, try to create the table if it doesn't exist
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS posts (
                PostID VARCHAR(255) PRIMARY KEY,
                TaskId VARCHAR(255),
                PostContent TEXT NOT NULL,
                Picture TEXT,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (TaskId)
              )
            `);
            console.log('Created posts table as it did not exist');
          } catch (createError) {
            console.error('Failed to create posts table:', createError);
          }
        }
      }
      
      console.log(`Returning ${posts.length} posts`);
      console.groupEnd();
      return posts;
    } catch (error) {
      console.error('Error retrieving posts:', error);
      console.groupEnd();
      return [];
    }
  } catch (error) {
    console.error('General error getting posts:', error);
    console.groupEnd();
    return [];
  }
}