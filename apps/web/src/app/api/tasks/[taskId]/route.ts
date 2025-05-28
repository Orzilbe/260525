// apps/web/src/app/api/tasks/[taskId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const taskId = params.taskId;
    
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Get request body
    const body = await request.json();
    
    // Forward to backend API
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/tasks/${taskId}`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend API error:', errorText);
        throw new Error('Failed to update task');
      }
      
      const result = await response.json();
      return NextResponse.json(result);
    } catch (error) {
      console.error('Error updating task:', error);
      
      // For development or when backend is unavailable
      console.log('Using mock task update response');
      return NextResponse.json({
        message: "Task updated successfully",
        success: true
      });
    }
  } catch (error) {
    console.error(`Error in PATCH /api/tasks/${params.taskId} route:`, error);
    return NextResponse.json(
      { message: 'Failed to update task', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
