// apps/web/src/app/api/tasks/[taskId]/duration/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateTaskDuration } from '../../../services/userLevel';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  exp?: number;
}

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
    
    // Validate required fields
    if (body.duration === undefined) {
      return NextResponse.json(
        { message: 'Duration is required' },
        { status: 400 }
      );
    }
    
    // עדכון משך המשימה
    const success = await updateTaskDuration(taskId, body.duration);
    
    if (!success) {
      return NextResponse.json(
        { message: 'Failed to update task duration' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      message: 'Task duration updated successfully'
    });
  } catch (error) {
    console.error('Error updating task duration:', error);
    return NextResponse.json(
      { message: 'Failed to update task duration', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}