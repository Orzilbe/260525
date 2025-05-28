// apps/api/src/models/Post.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IPost extends RowDataPacket {
  PostID: string;
  TaskId: string;
  PostContent: string;
  Picture?: string;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class Post {
  // Find post by ID
  static async findById(postId: string): Promise<IPost | null> {
    try {
      const [rows] = await pool.execute<IPost[]>(
        'SELECT * FROM Posts WHERE PostID = ?',
        [postId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding post by ID:', error);
      throw error;
    }
  }

  // Find post by task ID
  static async findByTaskId(taskId: string): Promise<IPost | null> {
    try {
      const [rows] = await pool.execute<IPost[]>(
        'SELECT * FROM Posts WHERE TaskId = ?',
        [taskId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding post by task ID:', error);
      throw error;
    }
  }

  // Create a new post
  static async create(postData: {
    PostID: string;
    TaskId: string;
    PostContent: string;
    Picture?: string;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Posts 
         (PostID, TaskId, PostContent, Picture, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [
          postData.PostID,
          postData.TaskId,
          postData.PostContent,
          postData.Picture || null
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create post');
      }
      
      return postData.PostID;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  // Update post
  static async update(postId: string, updateData: Partial<IPost>): Promise<boolean> {
    try {
      // Don't allow updating PostID or TaskId
      delete updateData.PostID;
      delete updateData.TaskId;
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
      
      const values = [...Object.values(updateData), postId];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Posts SET ${updateFields} WHERE PostID = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }
}

export default Post;