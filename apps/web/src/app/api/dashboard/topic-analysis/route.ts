// apps/web/src/app/api/dashboard/topic-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/dbUtils';
import { verifyAuthToken } from '../../../../lib/auth';

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

    // 1. ניתוח נושאים לפי רמת משתמש
    const topicByLevelQuery = `
      SELECT 
        u.EnglishLevel,
        t.TopicName,
        t.TopicHe,
        COUNT(task.TaskId) as task_count,
        AVG(task.TaskScore) as avg_score,
        COUNT(task.CompletionDate) as completions
      FROM users u
      JOIN tasks task ON u.UserId = task.UserId
      JOIN topics t ON task.TopicName = t.TopicName
      WHERE u.IsActive = 1 AND task.CompletionDate IS NOT NULL
      GROUP BY u.EnglishLevel, t.TopicName, t.TopicHe
      ORDER BY u.EnglishLevel, completions DESC
    `;

    // 2. הנושאים הפופולריים ביותר בחודש האחרון
    const popularTopicsQuery = `
      SELECT 
        t.TopicName,
        t.TopicHe,
        COUNT(task.TaskId) as total_tasks,
        COUNT(task.CompletionDate) as completed_tasks,
        ROUND(AVG(task.TaskScore), 1) as avg_score,
        COUNT(DISTINCT task.UserId) as unique_users
      FROM topics t
      JOIN tasks task ON t.TopicName = task.TopicName
      WHERE task.StartDate > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY t.TopicName, t.TopicHe
      ORDER BY completed_tasks DESC
      LIMIT 10
    `;

    // 3. ניתוח יעילות הלמידה לפי נושא
    const learningEfficiencyQuery = `
      SELECT 
        t.TopicName,
        t.TopicHe,
        AVG(task.DurationTask) as avg_duration_minutes,
        AVG(task.TaskScore) as avg_score,
        COUNT(DISTINCT word.WordId) as unique_words,
        ROUND(AVG(task.TaskScore) / (AVG(task.DurationTask) / 60), 2) as efficiency_score
      FROM topics t
      JOIN tasks task ON t.TopicName = task.TopicName
      LEFT JOIN wordintask wt ON task.TaskId = wt.TaskId
      LEFT JOIN words word ON wt.WordId = word.WordId
      WHERE task.CompletionDate IS NOT NULL 
        AND task.DurationTask > 0
        AND task.CompletionDate > DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY t.TopicName, t.TopicHe
      ORDER BY efficiency_score DESC
    `;

    // ביצוע השאילתות
    const [topicByLevelRes, popularTopicsRes, learningEfficiencyRes] = 
      await Promise.all([
        executeQuery(topicByLevelQuery, [], 'Fetch topics by level'),
        executeQuery(popularTopicsQuery, [], 'Fetch popular topics'),
        executeQuery(learningEfficiencyQuery, [], 'Fetch learning efficiency')
      ]);

    // בדיקה אם כל השאילתות הצליחו
    if (!topicByLevelRes.success || !popularTopicsRes.success || !learningEfficiencyRes.success) {
      console.error('Database query failed');
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    // עיצוב הנתונים לתצוגה
    const topicAnalysis = {
      topicsByLevel: topicByLevelRes.result,
      popularTopics: popularTopicsRes.result,
      learningEfficiency: learningEfficiencyRes.result
    };

    return NextResponse.json(topicAnalysis);
  } catch (error) {
    console.error('Error fetching topic analysis:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    );
  }
}
