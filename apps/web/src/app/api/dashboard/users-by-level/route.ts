//apps/web/src/app/api/dashboard/users-by-level/route.ts
// apps/web/src/app/api/dashboard/users-by-level/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/dbUtils';
import { verifyAuthToken } from '../../../../lib/auth';
import { RowDataPacket } from 'mysql2';

interface UserLevelResult extends RowDataPacket {
  level: string;
  users_count: number;
  percentage: string;
}

export async function GET(request: NextRequest) {
  try {
    // וידוא אימות המשתמש
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'לא מורשה' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const userData = verifyAuthToken(token);
    
    if (!userData) {
      return NextResponse.json({ message: 'טוקן לא תקף' }, { status: 401 });
    }

    // הפלגת משתמשים לפי רמה
    const query = `
      SELECT 
        COALESCE(EnglishLevel, 'לא מוגדר') as level,
        COUNT(*) as users_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users WHERE IsActive = 1), 1) as percentage
      FROM users 
      WHERE IsActive = 1
      GROUP BY EnglishLevel
      ORDER BY users_count DESC
    `;

    const response = await executeQuery(query, [], 'Fetch users by level');

    if (!response.success) {
      console.error('Database query failed:', response.error);
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    // הכנת הנתונים לגרף העוגה
    const levels: Record<string, string> = {
      'beginner': 'מתחיל',
      'intermediate': 'בינוני',
      'advanced': 'מתקדם',
      'לא מוגדר': 'לא מוגדר'
    };

    const usersByLevel = (response.result as UserLevelResult[])?.map(item => ({
      name: levels[item.level] || item.level,
      value: parseFloat(item.percentage),
      users: item.users_count
    })) || [];

    return NextResponse.json(usersByLevel);
  } catch (error) {
    console.error('Error fetching users by level:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    );
  }
}