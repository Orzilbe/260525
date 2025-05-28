// apps/api/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

interface TokenPayload {
  id: number;
  email: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  console.log('Auth middleware - Headers:', req.headers);

  if (!authHeader) {
    return next(new AppError('No token provided', 401));
  }

  const [bearer, token] = authHeader.split(' ');

  if (bearer !== 'Bearer' || !token) {
    return next(new AppError('Invalid token format', 401));
  }

  try {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT secret is not defined');
    }

    const decoded = jwt.verify(token, secret) as TokenPayload;
    console.log('Auth middleware - Decoded token:', decoded);
    
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401));
    }
    return next(new AppError('Authentication failed', 500));
  }
};