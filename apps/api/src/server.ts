// apps/api/src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import app from './app';
import { initializeDatabase } from './models';

// Import routes
import authRoutes from './routes/auth';
import topicsRoutes from './routes/topicsRoutes';
import userRoutes from './routes/userRoutes';
import diagnosticRoutes from './routes/diagnosticRoutes';
import taskRoutes from './routes/taskRoutes'; // הוספת הראוטר החדש

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { connectToDatabase } from './lib/db';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Adds security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/tasks', taskRoutes); // הוספת הנתיב החדש

// Enhanced health check with basic database status
app.get('/health', async (req, res) => {
  try {
    // Try to get a database connection
    const dbPool = await connectToDatabase();
    const connection = await dbPool.getConnection();
    connection.release();
    
    res.status(200).json({ 
      status: 'OK', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    // Database connection failed
    console.error('Health check detected database issue:', error);
    res.status(200).json({ 
      status: 'DEGRADED', 
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown database error',
      timestamp: new Date().toISOString() 
    });
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});