// apps/web/src/app/api/user-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * פונקציה לפענוח טוקן JWT
 */
function decodeToken(token: string): any {
  try {
    // ראשית, פענוח בסיסי ללא אימות (רק לבדיקת מבנה)
    const base64Payload = token.split('.')[1];
    const payload = Buffer.from(base64Payload, 'base64').toString('utf8');
    const rawPayload = JSON.parse(payload);
    
    // כעת ננסה אימות מלא
    try {
      const verifiedPayload = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
      return { ...rawPayload, verified: true };
    } catch (verifyError) {
      console.log('אימות הטוקן נכשל:', verifyError);
      
      // ננסה עם מפתח משני אם קיים
      if (process.env.SECONDARY_JWT_SECRET) {
        try {
          const verifiedWithSecondary = jwt.verify(token, process.env.SECONDARY_JWT_SECRET);
          return { ...rawPayload, verified: true, secondaryKey: true };
        } catch (secondaryError) {
          return { ...rawPayload, verified: false, error: 'Token verification failed' };
        }
      }
      
      return { ...rawPayload, verified: false, error: 'Token verification failed' };
    }
  } catch (error) {
    console.error('שגיאה בפענוח טוקן:', error);
    return { verified: false, error: 'Invalid token format' };
  }
}

/**
 * API לבדיקת אימות משתמש
 * GET /api/user-check
 */
export async function GET(request: NextRequest) {
  console.log('GET /api/user-check - קבלת בקשה לבדיקת אימות');
  
  try {
    // קבלת כותר האימות
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    console.log('Authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'לא נמצא');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('לא נמצא כותר אימות תקין');
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }
    
    // חילוץ הטוקן
    const token = authHeader.substring(7);
    
    if (!token) {
      console.log('לא נמצא טוקן');
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    
    // פענוח הטוקן
    const decodedToken = decodeToken(token);
    console.log('מידע מפוענח:', JSON.stringify(decodedToken, null, 2));
    
    if (!decodedToken.verified) {
      return NextResponse.json(
        { 
          error: 'Invalid token', 
          details: decodedToken.error || 'Token verification failed',
          decoded: decodedToken // מידע בסיסי מהטוקן גם אם האימות נכשל
        },
        { status: 401 }
      );
    }
    
    // חילוץ מידע רלוונטי על המשתמש מהטוקן
    const userId = decodedToken.userId || decodedToken.sub || decodedToken.id;
    const email = decodedToken.email || '';
    const name = decodedToken.name || '';
    
    // החזרת מידע בסיסי על המשתמש המאומת
    return NextResponse.json({
      authenticated: true,
      userId,
      email,
      name,
      tokenInfo: {
        expiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : 'unknown',
        issuedAt: decodedToken.iat ? new Date(decodedToken.iat * 1000).toISOString() : 'unknown',
      }
    });
    
  } catch (error) {
    console.error('שגיאה בבדיקת אימות:', error);
    return NextResponse.json(
      { 
        error: 'Authentication check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}