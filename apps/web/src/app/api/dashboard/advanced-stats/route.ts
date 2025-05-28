// apps/web/src/app/api/dashboard/advanced-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/dbUtils';
import { verifyAuthToken } from '../../../../lib/auth';
import { RowDataPacket } from 'mysql2';

interface ActivityChangeResult extends RowDataPacket {
  current_active: number;
  previous_active: number;
}

interface ScoreChangeResult extends RowDataPacket {
  current_score: number;
  previous_score: number;
}

interface UserGrowthResult extends RowDataPacket {
  current_month: number;
  previous_month: number;
}

interface WeeklyActivityResult extends RowDataPacket {
  day_name: string;
  activities: number;
  avg_score: number;
}

interface TrendForecastResult extends RowDataPacket {
  activity_date: string;
  daily_activities: number;
  unique_users: number;
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

    // 1. הנתונים המשולבים לשיעור שינוי במשתמשים פעילים
    const userActivityChangeQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN LastLogin > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN UserId END) as current_active,
        COUNT(DISTINCT CASE WHEN LastLogin BETWEEN DATE_SUB(NOW(), INTERVAL 60 DAY) 
          AND DATE_SUB(NOW(), INTERVAL 30 DAY) THEN UserId END) as previous_active
      FROM users
      WHERE IsActive = 1
    `;

    // 2. שינוי בציון הממוצע לעומת השבוע הקודם
    const scoreChangeQuery = `
      SELECT 
        (SELECT AVG(TaskScore) FROM tasks WHERE CompletionDate > DATE_SUB(NOW(), INTERVAL 7 DAY)) as current_score,
        (SELECT AVG(TaskScore) FROM tasks WHERE CompletionDate BETWEEN DATE_SUB(NOW(), INTERVAL 14 DAY) 
          AND DATE_SUB(NOW(), INTERVAL 7 DAY)) as previous_score
    `;

    // 3. שיעור גדילה במשתמשים חדשים
    const userGrowthQuery = `
      SELECT 
        COUNT(CASE WHEN CreationDate > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as current_month,
        COUNT(CASE WHEN CreationDate BETWEEN DATE_SUB(NOW(), INTERVAL 60 DAY) 
          AND DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as previous_month
      FROM users
      WHERE IsActive = 1
    `;

    // 4. הנתונים המובילים להכנת דוח ביום בשבוע הזה
    const weeklyActivityQuery = `
      SELECT 
        DAYNAME(CompletionDate) as day_name,
        COUNT(*) as activities,
        AVG(TaskScore) as avg_score
      FROM tasks
      WHERE CompletionDate > DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DAYNAME(CompletionDate), WEEKDAY(CompletionDate)
      ORDER BY WEEKDAY(CompletionDate)
    `;

    // 5. תחזית מגמות
    const trendForecastQuery = `
      SELECT 
        DATE(CompletionDate) as activity_date,
        COUNT(*) as daily_activities,
        COUNT(DISTINCT UserId) as unique_users
      FROM tasks
      WHERE CompletionDate > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(CompletionDate)
      ORDER BY activity_date
    `;

    // ביצוע כל השאילתות
    const [activityChangeRes, scoreChangeRes, userGrowthRes, weeklyActivityRes, trendForecastRes] = 
      await Promise.all([
        executeQuery(userActivityChangeQuery, [], 'Fetch user activity change'),
        executeQuery(scoreChangeQuery, [], 'Fetch score change'),
        executeQuery(userGrowthQuery, [], 'Fetch user growth'),
        executeQuery(weeklyActivityQuery, [], 'Fetch weekly activity'),
        executeQuery(trendForecastQuery, [], 'Fetch trend forecast')
      ]);

    // בדיקה אם כל השאילתות הצליחו
    if (!activityChangeRes.success || !scoreChangeRes.success || !userGrowthRes.success || 
        !weeklyActivityRes.success || !trendForecastRes.success) {
      console.error('Database query failed');
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    // חישוב שיעורי השינוי
    const activityData = (activityChangeRes.result as ActivityChangeResult[])?.[0];
    const activityChange = activityData?.previous_active && activityData?.current_active
      ? ((activityData.current_active - activityData.previous_active) / activityData.previous_active * 100).toFixed(1)
      : '0';

    const scoreData = (scoreChangeRes.result as ScoreChangeResult[])?.[0];
    const scoreChange = scoreData?.previous_score && scoreData?.current_score
      ? ((scoreData.current_score - scoreData.previous_score) / scoreData.previous_score * 100).toFixed(1)
      : '0';

    const growthData = (userGrowthRes.result as UserGrowthResult[])?.[0];
    const userGrowth = growthData?.previous_month && growthData?.current_month
      ? ((growthData.current_month - growthData.previous_month) / growthData.previous_month * 100).toFixed(1)
      : '0';

    // הכנת התשובה
    const advancedStats = {
      activityChange: parseFloat(activityChange),
      scoreChange: parseFloat(scoreChange),
      userGrowth: parseFloat(userGrowth),
      weeklyActivity: ((weeklyActivityRes.result as WeeklyActivityResult[]) || []).map(item => ({
        ...item,
        day_name: item.day_name === 'Sunday' ? 'ראשון' :
                  item.day_name === 'Monday' ? 'שני' :
                  item.day_name === 'Tuesday' ? 'שלישי' :
                  item.day_name === 'Wednesday' ? 'רביעי' :
                  item.day_name === 'Thursday' ? 'חמישי' :
                  item.day_name === 'Friday' ? 'שישי' : 'שבת'
      })),
      trendForecast: (trendForecastRes.result as TrendForecastResult[]) || []
    };

    return NextResponse.json(advancedStats);
  } catch (error) {
    console.error('Error fetching advanced stats:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    );
  }
}