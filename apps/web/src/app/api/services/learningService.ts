// apps/web/src/app/api/services/learningService.ts
import { createTask, addWordsToTask } from './taskService';

export async function startFlashcardPhase(userId: string, topicName: string, level: string) {
  try {
    // Create a new task
    const taskId = await createTask(userId, topicName, level, 'flashcard');
    
    // Return the task ID so it can be used in subsequent phases
    return {
      success: true,
      taskId
    };
  } catch (error) {
    console.error('Error starting flashcard phase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function completeFlashcardPhase(taskId: string, learnedWordIds: string[]) {
  try {
    // Add learned words to the task
    await addWordsToTask(taskId, learnedWordIds);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error completing flashcard phase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}