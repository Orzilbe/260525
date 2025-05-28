// apps/api/src/models/Comment.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IComment extends RowDataPacket {
  CommentID: string;  // Changed from CommentId to CommentID
  PostID: string;     // Changed from PostId to PostID
  commentContent: string; // Changed from CommentContent to commentContent
  Feedback?: string;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class Comment {
  // Find comment by ID
  static async findById(commentId: string): Promise<IComment | null> {
    try {
      const [rows] = await pool.execute<IComment[]>(
        'SELECT * FROM Comments WHERE CommentID = ?', // Changed from CommentId to CommentID
        [commentId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding comment by ID:', error);
      throw error;
    }
  }

  // Find comments by post ID
  static async findByPostId(postId: string): Promise<IComment[]> {
    try {
      const [rows] = await pool.execute<IComment[]>(
        'SELECT * FROM Comments WHERE PostID = ? ORDER BY CreatedAt', // Changed from PostId to PostID
        [postId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding comments by post ID:', error);
      throw error;
    }
  }

  // Create a new comment
  static async create(commentData: {
    CommentID: string;  // Changed from CommentId to CommentID
    PostID: string;     // Changed from PostId to PostID
    commentContent: string; // Changed from CommentContent to commentContent
    Feedback?: string;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Comments 
         (CommentID, PostID, commentContent, Feedback, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [
          commentData.CommentID,
          commentData.PostID,
          commentData.commentContent,
          commentData.Feedback || null
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create comment');
      }
      
      return commentData.CommentID;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }

  // Update comment
  static async update(commentId: string, updateData: Partial<IComment>): Promise<boolean> {
    try {
      // Don't allow updating CommentID or PostID
      delete updateData.CommentID;
      delete updateData.PostID;
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
      
      const values = [...Object.values(updateData), commentId];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Comments SET ${updateFields} WHERE CommentID = ?`, // Changed from CommentId to CommentID
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }
}

export default Comment;