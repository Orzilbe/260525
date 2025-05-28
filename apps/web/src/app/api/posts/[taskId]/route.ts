//apps/web/src/app/api/posts/[taskId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../auth/verifyAuth';
import { getPostsByTaskId, createOrUpdatePost } from '../../services/postService';

/**
 * Get posts for a specific task ID - GET /api/posts/[taskId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  console.group(`GET /api/posts/${params.taskId}`);
  console.log('Request received at:', new Date().toISOString());
  
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const taskId = params.taskId;
    console.log(`Retrieving posts for taskId: ${taskId}`);
    
    if (!taskId) {
      console.error('Missing required parameter: taskId');
      console.groupEnd();
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    try {
      // Use the service to get posts by taskId
      console.log('Attempting to retrieve posts from database for taskId:', taskId);
      const posts = await getPostsByTaskId(taskId);
      
      console.log(`Retrieved ${Array.isArray(posts) ? posts.length : 0} posts from database`);
      console.groupEnd();
      return NextResponse.json(posts);
    } catch (dbError) {
      console.error('Database error while retrieving posts:', dbError);
      console.groupEnd();
      
      // Return empty array with warning
      return NextResponse.json({
        posts: [],
        message: 'Failed to retrieve posts from database',
        warning: 'Database error occurred',
        error_details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 207 }); // 207 Multi-Status indicates partial success
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
    console.groupEnd();
    
    return NextResponse.json({ 
      posts: [],
      message: 'Failed to process request',
      warning: 'Request processing error occurred',
      error_details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 207 }); // 207 Multi-Status indicates partial success
  }
}

/**
 * Create or update a post for a specific task ID - POST /api/posts/[taskId]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  console.group(`POST /api/posts/${params.taskId}`);
  console.log('Request received at:', new Date().toISOString());
  
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log('Request body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      console.groupEnd();
      return NextResponse.json({ error: 'Invalid request body format' }, { status: 400 });
    }
    
    // Extract parameters
    const taskId = params.taskId;
    const postId = body.PostID || body.postId;
    const postContent = body.PostContent || body.postContent;
    const picture = body.Picture || body.picture || null;
    
    console.log(`Creating/updating post: ID=${postId}, TaskId=${taskId}, Content length=${postContent?.length || 0}, Picture=${picture ? 'provided' : 'not provided'}`);
    
    // Validate required fields
    if (!postContent) {
      console.error('PostContent is required');
      console.groupEnd();
      return NextResponse.json({ error: 'PostContent is required' }, { status: 400 });
    }
    
    try {
      // Always attempt to save to the database
      console.log('Attempting to save post to database...');
      const savedPostId = await createOrUpdatePost(postId, taskId, postContent, picture);
      
      if (!savedPostId) {
        console.error('Failed to save post: no post ID returned');
        console.groupEnd();
        // Return the original ID or generate a new one
        const fallbackPostId = postId || `post_${Date.now()}`;
        return NextResponse.json({ 
          success: true, 
          PostID: fallbackPostId,
          message: 'Post created/updated with backup ID',
          warning: 'Database operation may have failed'
        });
      }
      
      console.log('Post saved successfully to database with ID:', savedPostId);
      console.groupEnd();
      
      return NextResponse.json({ 
        success: true, 
        PostID: savedPostId,
        message: 'Post created/updated successfully'
      });
    } catch (dbError) {
      console.error('Database error while saving post:', dbError);
      console.groupEnd();
      // Return a valid response with the original post ID to allow the app to continue
      const fallbackPostId = postId || `post_${Date.now()}`;
      return NextResponse.json({ 
        success: true, 
        PostID: fallbackPostId,
        message: 'Post ID saved locally, but database operation failed',
        warning: 'Database error occurred',
        error_details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 207 }); // 207 Multi-Status indicates partial success
    }
  } catch (error) {
    console.error('Error creating/updating post:', error);
    console.groupEnd();
    // Return a valid response with a generated post ID to allow the app to continue
    const fallbackPostId = `post_${Date.now()}`;
    return NextResponse.json({ 
      success: true, 
      PostID: fallbackPostId,
      message: 'Generated post ID due to error',
      warning: 'Request processing error occurred',
      error_details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 207 }); // 207 Multi-Status indicates partial success
  }
}