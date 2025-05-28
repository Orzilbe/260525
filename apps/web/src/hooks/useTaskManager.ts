// hooks/useTaskManager.ts
import { useState } from 'react';

// Define task types enum
export enum TaskType {
  FLASHCARD = 'flashcard',
  QUIZ = 'quiz',
  POST = 'post',
  CONVERSATION = 'conversation'
}

// Define order for task types (chronological order)
const taskTypeOrder = [
  TaskType.FLASHCARD,
  TaskType.QUIZ,
  TaskType.POST,
  TaskType.CONVERSATION
];

interface Task {
  TaskId: string;
  UserId: string;
  TopicName: string;
  Level: string | number;
  TaskScore: number;
  TaskType: TaskType;
  CompletionDate?: string;
  DurationTask?: number;
}

export function useTaskManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Determines and routes to the next task for a user based on their selected topic
   * @param topicName The topic selected by the user
   * @param userId The user ID
   * @returns Promise with path to navigate to
   */
  const handleTopicSelection = async (topicName: string, userId: string) => {
    try {
      console.log(`handleTopicSelection called with topicName: ${topicName}, userId: ${userId}`);
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Convert topic name to URL-friendly format for routing purposes
      const urlTopicName = topicName.toLowerCase().replace(/\s+/g, '-');
      console.log(`Using original topicName for API calls: "${topicName}", and URL version for routing: "${urlTopicName}"`);
      
      // Fetch all tasks for this user and topic - use original topic name
      console.log(`Fetching tasks for topic: ${topicName}`);
      const response = await fetch(`/api/user-tasks?topicName=${encodeURIComponent(topicName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`API response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
      }
      
      const tasks: Task[] = await response.json();
      console.log(`Received ${tasks.length} tasks for topic ${topicName}`);
      
      // If no tasks exist for this topic, return path for new flashcard task at level 1
      if (tasks.length === 0) {
        console.log(`No tasks found for topic ${topicName}, creating new flashcard task at level 1`);
        // Create a new flashcard task at level 1
        const newTaskId = await createTask(userId, topicName, TaskType.FLASHCARD, 1);
        console.log(`Created new task with ID: ${newTaskId}`);
        return {
          path: `/topics/${urlTopicName}/tasks/flashcard?level=1&taskId=${newTaskId}`,
          taskType: TaskType.FLASHCARD,
          level: 1
        };
      }
      
      // Sort tasks by level (descending)
      const sortedByLevel = [...tasks].sort((a, b) => 
        Number(b.Level) - Number(a.Level)
      );
      
      // Get the highest level
      const highestLevel = Number(sortedByLevel[0].Level);
      console.log(`Highest level found: ${highestLevel}`);
      
      // Filter tasks with the highest level
      const highestLevelTasks = sortedByLevel.filter(
        task => Number(task.Level) === highestLevel
      );
      
      // Find the task with the highest task type at this level
      const sortedByTypeAndCompletion = [...highestLevelTasks].sort((a, b) => {
        // First by task type order (higher index = more advanced)
        const aTypeIndex = taskTypeOrder.indexOf(a.TaskType as TaskType);
        const bTypeIndex = taskTypeOrder.indexOf(b.TaskType as TaskType);
        
        if (aTypeIndex !== bTypeIndex) return bTypeIndex - aTypeIndex;
        
        // Then by completion status (completed tasks come before incomplete)
        const aComplete = !!a.CompletionDate;
        const bComplete = !!b.CompletionDate;
        
        if (aComplete !== bComplete) return aComplete ? -1 : 1;
        
        return 0;
      });
      
      // Get the "most advanced" task
      const mostAdvancedTask = sortedByTypeAndCompletion[0];
      console.log(`Most advanced task: Type=${mostAdvancedTask.TaskType}, Level=${mostAdvancedTask.Level}, Completed=${!!mostAdvancedTask.CompletionDate}`);
      
      // If the most advanced task is not completed, continue with that task
      if (!mostAdvancedTask.CompletionDate) {
        console.log(`Continuing with incomplete task: ${mostAdvancedTask.TaskId}`);
        return {
          path: `/topics/${urlTopicName}/tasks/${mostAdvancedTask.TaskType}?level=${mostAdvancedTask.Level}&taskId=${mostAdvancedTask.TaskId}`,
          taskType: mostAdvancedTask.TaskType as TaskType,
          level: Number(mostAdvancedTask.Level)
        };
      }
      
      // If the most advanced task is completed
      const currentTypeIndex = taskTypeOrder.indexOf(mostAdvancedTask.TaskType as TaskType);
      
      // If it's a conversation (last in the sequence), increment level
      if (mostAdvancedTask.TaskType === TaskType.CONVERSATION) {
        const newLevel = Number(mostAdvancedTask.Level) + 1;
        console.log(`Moving to next level: ${newLevel}`);
        const newTaskId = await createTask(userId, topicName, TaskType.FLASHCARD, newLevel);
        return {
          path: `/topics/${urlTopicName}/tasks/flashcard?level=${newLevel}&taskId=${newTaskId}`,
          taskType: TaskType.FLASHCARD,
          level: newLevel
        };
      } 
      // Otherwise, move to the next task type at the same level
      else {
        const nextTypeIndex = currentTypeIndex + 1;
        if (nextTypeIndex < taskTypeOrder.length) {
          const nextTaskType = taskTypeOrder[nextTypeIndex];
          console.log(`Moving to next task type: ${nextTaskType} at level ${mostAdvancedTask.Level}`);
          const newTaskId = await createTask(userId, topicName, nextTaskType, Number(mostAdvancedTask.Level));
          return {
            path: `/topics/${urlTopicName}/tasks/${nextTaskType}?level=${mostAdvancedTask.Level}&taskId=${newTaskId}`,
            taskType: nextTaskType,
            level: Number(mostAdvancedTask.Level)
          };
        }
      }
      
      // Fallback (should never reach here)
      throw new Error('Could not determine next task');
      
    } catch (error) {
      console.error('Error handling topic selection:', error);
      setError(error instanceof Error ? error.message : 'Error determining next task');
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Creates a new task
   * @param userId User ID
   * @param topicName Topic name
   * @param taskType Task type
   * @param level Task level
   * @returns Promise with task ID
   */
  const createTask = async (
    userId: string,
    topicName: string,
    taskType: TaskType,
    level: number
  ): Promise<string> => {
    try {
      console.log(`Creating task: userId=${userId}, topicName=${topicName}, taskType=${taskType}, level=${level}`);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const payload = {
        UserId: userId,
        TopicName: topicName,
        Level: level.toString(),
        TaskType: taskType,
        TaskScore: 0
      };
      console.log('Task creation payload:', payload);
      
      const response = await fetch('/api/create-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      console.log(`Task creation API response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create task: ${response.status} ${response.statusText}. Details: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Task creation result:', result);
      return result.TaskId;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };
  
  return {
    handleTopicSelection,
    isLoading,
    error
  };
}