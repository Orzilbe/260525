// apps/api/src/routes/topicsRoutes.ts
import express from 'express';
import DatabaseConnection from '../config/database';
import { authMiddleware } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

// Get all topics
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const pool = DatabaseConnection.getPool();
    const [topics] = await pool.query('SELECT TopicName, TopicHe, Icon FROM Topics');
    
    res.json(topics);
  } catch (error) {
    next(error);
  }
});

export default router;