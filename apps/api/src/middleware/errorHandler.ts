// apps/api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (
  err: Error | AppError, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const statusCode = err instanceof AppError 
    ? err.statusCode 
    : 500;
  
  const errorResponse = {
    status: 'error',
    statusCode,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  console.error(`[ERROR] ${new Date().toISOString()}:`, err);

  res.status(statusCode).json(errorResponse);
};

export { 
  AppError, 
  errorHandler 
};