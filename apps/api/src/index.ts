// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import { connectToDatabase } from './lib/db';
import { errorHandler } from './middleware/errorHandler';
import userRoutes from './routes/userRoutes'; // If this exists
import taskRoutes from './routes/taskRoutes'; // If this exists
import interactiveSessionRoutes from './routes/interactiveSessionRoutes';
import questionRoutes from './routes/questionRoutes';

async function startServer() {
  try {
    // Connect to database before starting the server
    await connectToDatabase();
    
    const app = express();
    
    // Middleware
    app.use(cors());
    app.use(express.json());
    
    // Routes
    // Only include routes that exist in your codebase
    if (typeof userRoutes === 'function') {
      app.use('/api/users', userRoutes);
    }
    
    if (typeof taskRoutes === 'function') {
      app.use('/api/tasks', taskRoutes);
    }
    
    // Add the new routes for interactive sessions
    app.use('/api/interactive-session', interactiveSessionRoutes);
    app.use('/api/question', questionRoutes);
    
    // Error handling middleware
    app.use(errorHandler);
    
    // Root route
    app.get('/', (req, res) => {
      res.send('English Speaking Practice API is running');
    });
    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();