// apps/web/src/app/api/user-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSafeDbPool } from '../../lib/db';

// Function to extract user ID from token
function getUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as any;
    return decoded.userId || decoded.id || null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * GET /api/user-profile - Get user profile information
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Unauthorized - No token found' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    
    // Try to get user from database
    const pool = await getSafeDbPool();
    if (!pool) {
      throw new Error('Failed to connect to database');
    }

    const [rows] = await pool.query(
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
        LastLogin,
        Score
      FROM Users 
      WHERE UserId = ?`,
      [userId]
    );
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    const userData = rows[0] as any;
    
    // Return user profile with all necessary fields
    return NextResponse.json({
      FirstName: userData.FirstName || '',
      LastName: userData.LastName || '',
      Email: userData.Email || '',
      PhoneNumber: userData.PhoneNumber || '',
      EnglishLevel: userData.EnglishLevel || 'Not Set',
      AgeRange: userData.AgeRange || '',
      ProfilePicture: userData.ProfilePicture || null,
      CreationDate: userData.CreationDate || new Date(),
      LastLogin: userData.LastLogin || null,
      Score: userData.Score || 0
    });
  } catch (error) {
    console.error('Error in /api/user-profile route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}