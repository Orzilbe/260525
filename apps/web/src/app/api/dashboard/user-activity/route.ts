//apps/web/src/app/api/dashboard/user-activity/route.ts
// apps/web/src/app/api/dashboard/user-activity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/dbUtils';
import { verifyAuthToken } from '../../../../lib/auth';
import { RowDataPacket } from 'mysql2';

interface UserActivityResult extends RowDataPacket {
  date: string;
  activities: number;
  active_users: number;
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

    // קבלת טווח הזמן מה-query params
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '30d';

    // קביעת המרווח הזמני
    let interval = '30 DAY';
    switch (timeRange) {
      case '7d':
        interval = '7 DAY';
        break;
      case '90d':
        interval = '90 DAY';
        break;
      case '1y':
        interval = '1 YEAR';
        break;
    }

    // פעילות לאורך זמן
    const query = `
      SELECT 
        DATE(CompletionDate) as date,
        COUNT(*) as activities,
        COUNT(DISTINCT UserId) as active_users
      FROM tasks
      WHERE CompletionDate IS NOT NULL
        AND CompletionDate >= DATE_SUB(NOW(), INTERVAL ${interval})
      GROUP BY DATE(CompletionDate)
      ORDER BY date
    `;

    const response = await executeQuery(query, [], 'Fetch user activity');

    if (!response.success) {
      console.error('Database query failed:', response.error);
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    // העמסה מחדש של תאריכים לפורמט הרצוי
    const userActivity = (response.result as UserActivityResult[])?.map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('he-IL')
    })) || [];

    return NextResponse.json(userActivity);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    );
  }
}