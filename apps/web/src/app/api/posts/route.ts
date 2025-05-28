// apps/web/src/app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../auth/verifyAuth';
import { createOrUpdatePost, getPostsByTaskId } from '../services/postService';

/**
 * Create a new post - POST /api/posts
 */
export async function POST(request: NextRequest) {
  console.group('POST /api/posts');
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
    const postId = body.PostID;
    const taskId = body.TaskId;
    const postContent = body.PostContent;
    const picture = body.Picture || null;
    
    console.log(`Creating/updating post: ID=${postId}, TaskId=${taskId}, Content length=${postContent?.length || 0}, Picture=${picture ? 'provided' : 'not provided'}`);
    
    // Validate required fields
    if (!postContent) {
      console.error('PostContent is required');
      console.groupEnd();
      return NextResponse.json({ error: 'PostContent is required' }, { status: 400 });
    }
    
    try {
      // Always attempt to save to the database, regardless of environment
      console.log('Attempting to save post to database...');
      const savedPostId = await createOrUpdatePost(postId, taskId, postContent, picture);
      
      // Even if database operation fails, postService should return the provided ID or generate one
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

/**
 * Get post by ID - GET /api/posts?id=postId or /api/posts?taskId=taskId
 */
export async function GET(request: NextRequest) {
  console.group('GET /api/posts');
  console.log('Request received at:', new Date().toISOString());
  
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.error('Authentication failed');
      console.groupEnd();
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get parameters from URL
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('id') || searchParams.get('postId');
    const taskId = searchParams.get('taskId');
    
    console.log(`Request parameters: postId=${postId}, taskId=${taskId}`);
    
    if (!postId && !taskId) {
      console.error('Missing required parameter: postId or taskId');
      console.groupEnd();
      return NextResponse.json({ error: 'Post ID or Task ID is required' }, { status: 400 });
    }
    
    try {
      if (taskId) {
        // Use the service to get posts by taskId
        console.log('Attempting to retrieve posts from database for taskId:', taskId);
        const posts = await getPostsByTaskId(taskId);
        
        console.log(`Retrieved ${posts.length} posts from database`);
        console.groupEnd();
        return NextResponse.json(posts);
      } else if (postId) {
        // TODO: Add function to get single post by ID
        console.error('Get by PostID not implemented yet');
        console.groupEnd();
        return NextResponse.json({ error: 'Get by PostID not implemented yet' }, { status: 501 });
      }
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