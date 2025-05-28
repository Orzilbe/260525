import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  englishLevel?: string;
  exp?: number;
}

export async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, userId: '' };
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JWTPayload;
    
    return { isValid: true, userId: decoded.userId };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { isValid: false, userId: '' };
  }
} 