// apps/api/src/models/index.ts
import pool from './db';
import User from './User';
import Topic from './Topic';
import Level from './Level';
import Task from './Task';
import Word from './Word';
import Post from './Post';
import Comment from './Comment';
import InteractiveSession from './InteractiveSession';
import Question from './Question';
import Test from './Test';
import UserInLevel from './UserInLevel';
import WordInTask from './WordInTask';
import runMigrations from './migrations';

// Initialize essential data at startup
const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Run migrations first
    await runMigrations();
    console.log('Database migrations completed.');
    
    // Initialize topics
    await Topic.initializeTopics();
    console.log('Topics initialized.');
    
    console.log('Database initialization complete.');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Close the database connection when the application shuts down
const closeDatabase = async () => {
  try {
    await pool.end();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

// Export everything
export {
  pool,
  User,
  Topic,
  Level,
  Task,
  Word,
  Post,
  Comment,
  InteractiveSession,
  Question,
  Test,
  UserInLevel,
  WordInTask,
  initializeDatabase,
  closeDatabase
};