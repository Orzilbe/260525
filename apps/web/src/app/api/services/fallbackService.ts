// src/app/api/services/fallbackService.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define interfaces for our data types
interface Word {
  WordId?: string;
  Word: string;
  Translation: string;
  ExampleUsage?: string;
  TopicName: string;
  CreatedAt?: string;
  PartOfSpeech?: string;
  EnglishLevel: string;
}

interface Task {
  TaskId?: string;
  UserId: string;
  TopicName: string;
  Level: string;
  TaskType: string;
  TaskScore?: number;
  CreationDate?: string;
  CompletionDate?: string;
}

// Helper function to ensure directory exists
async function ensureDirectoryExists(directoryPath: string) {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${directoryPath}:`, error);
  }
}

// Get data directory path
function getDataDir() {
  // Check if we're in production or development
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, use a dedicated data directory
  // In development, use a local directory in the project
  const baseDir = isProduction ? 
    path.join(process.cwd(), '..', 'data') : 
    path.join(process.cwd(), 'data');
    
  return baseDir;
}

// Get file path for a specific data type
function getFilePath(dataType: string) {
  return path.join(getDataDir(), `${dataType}.json`);
}

// Read data from a local JSON file
async function readLocalData<T>(dataType: string): Promise<T[]> {
  try {
    const dataDir = getDataDir();
    await ensureDirectoryExists(dataDir);
    
    const filePath = getFilePath(dataType);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet, return empty array
        await fs.writeFile(filePath, JSON.stringify([]), 'utf8');
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error reading ${dataType} data:`, error);
    return [];
  }
}

// Write data to a local JSON file
async function writeLocalData<T>(dataType: string, data: T[]): Promise<boolean> {
  try {
    const dataDir = getDataDir();
    await ensureDirectoryExists(dataDir);
    
    const filePath = getFilePath(dataType);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${dataType} data:`, error);
    return false;
  }
}

// Words-specific functions
export async function getLocalWords(topicName: string, level: string): Promise<Word[]> {
  try {
    const words = await readLocalData<Word>('words');
    return words.filter(word => 
      word.TopicName.toLowerCase() === topicName.toLowerCase() && 
      word.EnglishLevel === 'intermediate' // Default to intermediate for local storage
    );
  } catch (error) {
    console.error('Error getting local words:', error);
    return [];
  }
}

export async function saveLocalWords(words: Word[]): Promise<string[]> {
  try {
    if (!words || words.length === 0) {
      return [];
    }
    
    // Get existing words
    const existingWords = await readLocalData<Word>('words');
    
    // Assign IDs and timestamps to new words
    const wordsWithIds = words.map(word => {
      const wordId = word.WordId || `word_${uuidv4()}`;
      return { 
        ...word, 
        WordId: wordId,
        CreatedAt: word.CreatedAt || new Date().toISOString()
      };
    });
    
    // Extract just the word IDs for returning
    const wordIds = wordsWithIds.map(w => w.WordId as string);
    
    // Merge with existing words, replacing any with the same word+topic+level
    const updatedWords = [
      ...existingWords.filter(existing => 
        !wordsWithIds.some(word => 
          word.Word === existing.Word && 
          word.TopicName === existing.TopicName && 
          word.EnglishLevel === existing.EnglishLevel
        )
      ),
      ...wordsWithIds
    ];
    
    await writeLocalData<Word>('words', updatedWords);
    return wordIds;
  } catch (error) {
    console.error('Error saving local words:', error);
    return words.map(w => w.WordId || `word_${uuidv4()}`);
  }
}

// Tasks-specific functions
export async function createLocalTask(task: Omit<Task, 'TaskId' | 'CreationDate'>): Promise<string> {
  try {
    // Get existing tasks
    const existingTasks = await readLocalData<Task>('tasks');
    
    // Generate ID and CreationDate
    const taskId = `task_${uuidv4()}`;
    
    const newTask: Task = {
      ...task,
      TaskId: taskId,
      CreationDate: new Date().toISOString()
    };
    
    // Add to existing tasks
    const updatedTasks = [...existingTasks, newTask];
    
    const success = await writeLocalData<Task>('tasks', updatedTasks);
    return taskId;
  } catch (error) {
    console.error('Error creating local task:', error);
    return `task_${uuidv4()}`;
  }
}

export async function updateLocalTaskStatus(taskId: string, score: number): Promise<boolean> {
  try {
    // Get existing tasks
    const existingTasks = await readLocalData<Task>('tasks');
    
    // Find the task to update
    const taskIndex = existingTasks.findIndex(t => t.TaskId === taskId);
    if (taskIndex === -1) {
      console.error(`Task with ID ${taskId} not found`);
      return false;
    }
    
    // Update the task
    const updatedTask = { 
      ...existingTasks[taskIndex], 
      TaskScore: score,
      CompletionDate: new Date().toISOString()
    };
    
    // Replace the task in the array
    const updatedTasks = [
      ...existingTasks.slice(0, taskIndex),
      updatedTask,
      ...existingTasks.slice(taskIndex + 1)
    ];
    
    return await writeLocalData<Task>('tasks', updatedTasks);
  } catch (error) {
    console.error('Error updating local task:', error);
    return false;
  }
}

export async function getLocalUserTasks(userId: string): Promise<Task[]> {
  try {
    const tasks = await readLocalData<Task>('tasks');
    return tasks
      .filter(task => task.UserId === userId)
      .sort((a, b) => new Date(b.CreationDate || "").getTime() - new Date(a.CreationDate || "").getTime());
  } catch (error) {
    console.error('Error getting local user tasks:', error);
    return [];
  }
}

// Words in Task relationship
interface WordInTask {
  TaskId: string;
  WordId: string;
}

export async function addLocalWordsToTask(taskId: string, wordIds: string[]): Promise<boolean> {
  try {
    const existingRelations = await readLocalData<WordInTask>('wordsInTask');
    
    // Create new relations
    const newRelations = wordIds.map(wordId => ({
      TaskId: taskId,
      WordId: wordId
    }));
    
    // Merge, avoiding duplicates
    const updatedRelations = [
      ...existingRelations.filter(rel => 
        rel.TaskId !== taskId || 
        !wordIds.includes(rel.WordId)
      ),
      ...newRelations
    ];
    
    return await writeLocalData<WordInTask>('wordsInTask', updatedRelations);
  } catch (error) {
    console.error('Error adding words to task locally:', error);
    return false;
  }
}

export async function getLocalWordsForTask(taskId: string): Promise<string[]> {
  try {
    const relations = await readLocalData<WordInTask>('wordsInTask');
    return relations
      .filter(rel => rel.TaskId === taskId)
      .map(rel => rel.WordId);
  } catch (error) {
    console.error('Error getting words for task locally:', error);
    return [];
  }
}