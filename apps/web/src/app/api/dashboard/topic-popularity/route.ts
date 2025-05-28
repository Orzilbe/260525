//apps/web/src/app/api/dashboard/topic-popularity/route.ts
// apps/web/src/app/api/dashboard/topic-popularity/route.ts
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

    // קבלת הנושא המסונן מה-query params
    const { searchParams } = new URL(request.url);
    const selectedTopic = searchParams.get('topic') || 'all';

    // פופולריות נושאים
    let query = `
      SELECT 
        t.TopicName,
        t.TopicHe,
        COUNT(DISTINCT task.TaskId) as total_tasks,
        COUNT(task.CompletionDate) as completed_tasks,
        ROUND(AVG(task.TaskScore), 1) as avg_score
      FROM topics t
      LEFT JOIN tasks task ON t.TopicName = task.TopicName
    `;

    if (selectedTopic !== 'all') {
      query += ` WHERE t.TopicName = ?`;
    }

    query += `
      GROUP BY t.TopicName, t.TopicHe
      ORDER BY completed_tasks DESC
      LIMIT 10
    `;

    const params = selectedTopic !== 'all' ? [selectedTopic] : [];
    const response = await executeQuery(query, params, 'Fetch topic popularity');

    if (!response.success) {
      console.error('Database query failed:', response.error);
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('Error fetching topic popularity:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    );
  }
}