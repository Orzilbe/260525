// apps/web/src/app/api/dashboard/user-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/dbUtils';
import { verifyAuthToken } from '../../../../lib/auth';
import { RowDataPacket } from 'mysql2';

interface UserStatsResult extends RowDataPacket {
  totalUsers?: number;
  activeUsers?: number;
  newUsersThisMonth?: number;
  newUsersLastMonth?: number;
  averageScore?: number;
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

    // סה"כ משתמשים
    const totalUsersQuery = `
      SELECT COUNT(*) as totalUsers FROM users WHERE IsActive = 1
    `;
    
    // משתמשים פעילים (שהתחברו ב-30 הימים האחרונים)
    const activeUsersQuery = `
      SELECT COUNT(*) as activeUsers 
      FROM users 
      WHERE LastLogin > DATE_SUB(NOW(), INTERVAL 30 DAY) AND IsActive = 1
    `;
    
    // משתמשים חדשים החודש
    const newUsersThisMonthQuery = `
      SELECT COUNT(*) as newUsersThisMonth
      FROM users 
      WHERE DATE_FORMAT(CreationDate, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
    `;
    
    // ציון ממוצע
    const averageScoreQuery = `
      SELECT AVG(Score) as averageScore FROM users WHERE IsActive = 1
    `;
    
    // משתמשים חדשים בחודש הקודם (לחישוב שינוי)
    const newUsersLastMonthQuery = `
      SELECT COUNT(*) as newUsersLastMonth
      FROM users 
      WHERE DATE_FORMAT(CreationDate, '%Y-%m') = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')
    `;
    
    // ביצוע השאילתות
    const [totalUsersRes, activeUsersRes, newUsersThisMonthRes, averageScoreRes, newUsersLastMonthRes] = 
      await Promise.all([
        executeQuery(totalUsersQuery, [], 'Fetch total users'),
        executeQuery(activeUsersQuery, [], 'Fetch active users'),
        executeQuery(newUsersThisMonthQuery, [], 'Fetch new users this month'),
        executeQuery(averageScoreQuery, [], 'Fetch average score'),
        executeQuery(newUsersLastMonthQuery, [], 'Fetch new users last month')
      ]);

    // בדיקה אם כל השאילתות הצליחו
    if (!totalUsersRes.success || !activeUsersRes.success || !newUsersThisMonthRes.success || 
        !averageScoreRes.success || !newUsersLastMonthRes.success) {
      console.error('Database query failed');
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    // חישוב שיעורי השינוי
    const newUsersThisMonth = (newUsersThisMonthRes.result as UserStatsResult[])?.[0]?.newUsersThisMonth || 0;
    const newUsersLastMonth = (newUsersLastMonthRes.result as UserStatsResult[])?.[0]?.newUsersLastMonth || 0;
    const newUserGrowth = newUsersLastMonth > 0 
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(1)
      : '0';

    const stats = {
      totalUsers: (totalUsersRes.result as UserStatsResult[])?.[0]?.totalUsers || 0,
      activeUsers: (activeUsersRes.result as UserStatsResult[])?.[0]?.activeUsers || 0,
      newUsersThisMonth: newUsersThisMonth,
      averageScore: Math.round((averageScoreRes.result as UserStatsResult[])?.[0]?.averageScore || 0),
      userGrowth: 0,
      activityChange: 0,
      newUserGrowth: parseFloat(newUserGrowth),
      scoreChange: 0
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    );
  }
}