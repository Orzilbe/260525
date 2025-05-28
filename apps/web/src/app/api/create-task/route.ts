// apps/web/src/app/api/create-task/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../auth/verifyAuth';
import { createTask } from '../services/taskService';

export async function POST(request: NextRequest) {
  console.log('POST /api/create-task - Task creation request received');
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.log('POST /api/create-task - Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const data = await request.json();
    const { UserId, TopicName, Level, TaskType } = data;
    
    console.log(`POST /api/create-task - Request data: UserId=${UserId}, TopicName=${TopicName}, Level=${Level}, TaskType=${TaskType}`);

    // Verify the authenticated user can only create tasks for themselves
    if (UserId !== authResult.userId) {
      console.log(`POST /api/create-task - User ID mismatch: Auth userId=${authResult.userId}, Request UserId=${UserId}`);
      return NextResponse.json({ 
        error: 'You can only create tasks for your own account' 
      }, { 
        status: 403 
      });
    }

    // Validate required fields
    if (!UserId || !TopicName || !Level || !TaskType) {
      const missingFields = [];
      if (!UserId) missingFields.push('UserId');
      if (!TopicName) missingFields.push('TopicName');
      if (!Level) missingFields.push('Level');
      if (!TaskType) missingFields.push('TaskType');
      
      console.log(`POST /api/create-task - Missing required fields: ${missingFields.join(', ')}`);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Create the task using the task service
    const taskId = await createTask(UserId, TopicName, Level, TaskType);
    
    if (!taskId) {
      console.error('POST /api/create-task - Task creation failed');
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    console.log(`POST /api/create-task - Task created successfully with ID: ${taskId}`);
    return NextResponse.json({
      success: true,
      message: 'Task created successfully',
      TaskId: taskId,
      UserId,
      TopicName,
      Level,
      TaskType
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}