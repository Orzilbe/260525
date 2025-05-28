// apps/api/src/controllers/questionController.ts
import { Request, Response } from 'express';
import Question from '../models/Question';
import InteractiveSession from '../models/InteractiveSession';

// Create a new question
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { QuestionId, SessionId, QuestionText } = req.body;
    
    // Validate required fields
    if (!QuestionId || !SessionId || !QuestionText) {
      return res.status(400).json({
        success: false,
        error: 'QuestionId, SessionId, and QuestionText are required'
      });
    }
    
    // Check if the session exists
    const session = await InteractiveSession.findById(SessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interactive session not found'
      });
    }
    
    // Create new question
    const questionId = await Question.create({
      QuestionId,
      SessionId,
      QuestionText
    });
    
    res.status(201).json({
      success: true,
      QuestionId: questionId,
      SessionId,
      QuestionText
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create question',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update a question with answer and feedback
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const { AnswerText, Feedback } = req.body;
    
    // Validate required fields
    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: 'Question ID is required'
      });
    }
    
    if (!AnswerText && !Feedback) {
      return res.status(400).json({
        success: false,
        error: 'At least one update field (AnswerText or Feedback) is required'
      });
    }
    
    // Check if the question exists
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }
    
    // Update the question
    const updateData: { AnswerText?: string; Feedback?: string } = {};
    
    if (AnswerText !== undefined) {
      updateData.AnswerText = AnswerText;
    }
    
    if (Feedback !== undefined) {
      updateData.Feedback = Feedback;
    }
    
    const updated = await Question.update(questionId, updateData);
    
    if (!updated) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update question'
      });
    }
    
    res.status(200).json({
      success: true,
      QuestionId: questionId,
      ...updateData
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update question',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all questions for a session
export const getQuestionsBySessionId = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    // Check if the session exists
    const session = await InteractiveSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interactive session not found'
      });
    }
    
    // Get all questions for the session
    const questions = await Question.findBySessionId(sessionId);
    
    res.status(200).json({
      success: true,
      questions
    });
  } catch (error) {
    console.error('Error retrieving questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};