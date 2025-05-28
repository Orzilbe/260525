// apps/web/src/app/api/posts/verify/[postId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../auth/verifyAuth';
import { getSafeDbPool } from '../../../../lib/db';

/**
 * בדיקה אם פוסט קיים - GET /api/posts/verify/[postId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  console.group(`GET /api/posts/verify/${params.postId}`);
  console.log('Request received at:', new Date().toISOString());
  
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const postId = params.postId;
    console.log(`Verifying post exists: ${postId}`);
    
    if (!postId) {
      console.error('Missing required parameter: postId');
      console.groupEnd();
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }
    
    try {
      // Get DB connection
      const pool = await getSafeDbPool();
      if (!pool) {
        console.error('Database connection not available');
        console.groupEnd();
        return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
      }
      
      // Check if post exists in 'posts' table
      const [postsResult] = await pool.query(
        'SELECT 1 FROM posts WHERE PostID = ?',
        [postId]
      );
      
      const posts = postsResult as any[];
      
      if (Array.isArray(posts) && posts.length > 0) {
        console.log(`Post ${postId} exists in posts table`);
        console.groupEnd();
        return NextResponse.json({ exists: true, table: 'posts' });
      }
      
      // Check if post exists in 'Posts' table (capitalized)
      const [capitalizedResult] = await pool.query(
        'SELECT 1 FROM Posts WHERE PostID = ?',
        [postId]
      );
      
      const capitalizedPosts = capitalizedResult as any[];
      
      if (Array.isArray(capitalizedPosts) && capitalizedPosts.length > 0) {
        console.log(`Post ${postId} exists in Posts table`);
        console.groupEnd();
        return NextResponse.json({ exists: true, table: 'Posts' });
      }
      
      // Post not found in either table
      console.log(`Post ${postId} does not exist in database`);
      console.groupEnd();
      return NextResponse.json({ exists: false }, { status: 404 });
    } catch (dbError) {
      console.error('Database error while verifying post:', dbError);
      console.groupEnd();
      return NextResponse.json({ 
        error: 'Database error occurred',
        error_details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error verifying post:', error);
    console.groupEnd();
    return NextResponse.json({ 
      error: 'An error occurred during post verification',
      error_details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}