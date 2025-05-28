// apps/api/src/routes/interactiveSessionRoutes.ts
import express from 'express';
import * as interactiveSessionController from '../controllers/interactiveSessionController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Create a new interactive session
router.post('/', interactiveSessionController.createInteractiveSession);

// Get interactive session by ID
router.get('/:sessionId', interactiveSessionController.getInteractiveSessionById);

export default router;