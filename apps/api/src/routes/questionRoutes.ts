// apps/api/src/routes/questionRoutes.ts
import express from 'express';
import * as questionController from '../controllers/questionController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Create a new question
router.post('/', questionController.createQuestion);

// Update a question
router.patch('/:questionId', questionController.updateQuestion);

// Get all questions for a session
router.get('/session/:sessionId', questionController.getQuestionsBySessionId);

export default router;