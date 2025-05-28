// apps/api/src/routes/userRoutes.ts
import express from 'express';
import DatabaseConnection from '../config/database';
import { authMiddleware } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const pool = DatabaseConnection.getPool();
    
    // Fetch user profile 
    const [users] = await pool.query(
      `SELECT 
        UserId, 
        FirstName, 
        LastName, 
        Email, 
        PhoneNumber, 
        EnglishLevel, 
        AgeRange, 
        ProfilePicture, 
        CreationDate, 
        LastLogin 
      FROM Users 
      WHERE UserId = ?`, 
      [req.user.id]
    );

    // Check if user exists
    if (!users || (users as any[]).length === 0) {
      throw new AppError('User profile not found', 404);
    }

    // Return user profile
    res.json((users as any[])[0]);
  } catch (error) {
    next(error);
  }
});

// Get user gamification data
router.get('/data', authMiddleware, async (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const pool = DatabaseConnection.getPool();
    
    // Complex query to fetch user gamification data
    const [userData] = await pool.query(`
      SELECT 
        u.Score as totalScore,
        u.CreationDate,
        (SELECT COUNT(*) FROM Tasks t WHERE t.UserId = u.UserId AND t.CompletionDate IS NOT NULL) as completedTasksCount,
        ul.Level as currentLevel,
ul.EarnedScore as currentLevelPoints,
        (SELECT Level FROM UserINLevel 
         WHERE UserId = u.UserId 
         ORDER BY EarnedScore DESC 
         LIMIT 1) as nextLevel,
        (SELECT LevelScore FROM Levels 
         WHERE TopicName = (
           SELECT TopicName FROM UserINLevel 
           WHERE UserId = u.UserId 
           ORDER BY EarnedScore DESC 
           LIMIT 1
         ) 
         AND Level = (
           SELECT Level FROM UserINLevel 
           WHERE UserId = u.UserId 
           ORDER BY EarnedScore DESC 
           LIMIT 1
         )
        ) as pointsToNextLevel
      FROM 
        Users u
      LEFT JOIN 
        UserINLevel ul ON u.UserId = ul.UserId
      WHERE 
        u.UserId = ?
    `, [req.user.id]);

    // Check if user data exists
    if (!userData || (userData as any[]).length === 0) {
      throw new AppError('User data not found', 404);
    }

    // Return user gamification data
    res.json((userData as any[])[0]);
  } catch (error) {
    next(error);
  }
});

export default router;