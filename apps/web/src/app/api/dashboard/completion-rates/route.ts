// apps/web/src/app/api/dashboard/completion-rates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/dbUtils';
import { verifyAuthToken } from '../../../../lib/auth';
import { RowDataPacket } from 'mysql2';

interface CompletionRateResult extends RowDataPacket {
  total: number;
  completed: number;
  completion_rate: string;
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

    // שיעור השלמה למשימות
    const tasksQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CompletionDate) as completed,
        ROUND(COUNT(CompletionDate) * 100.0 / COUNT(*), 1) as completion_rate
      FROM tasks
    `;

    // שיעור השלמה למבחנים
    const testsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CompletionDate) as completed,
        ROUND(COUNT(CompletionDate) * 100.0 / COUNT(*), 1) as completion_rate
      FROM tests
    `;

    // שיעור השלמה לתרגילים (interactive sessions)
    const exercisesQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) as completed,
        100.0 as completion_rate
      FROM interactivesessions
    `;

    // ביצוע השאילתות
    const [tasksRes, testsRes, exercisesRes] = await Promise.all([
      executeQuery(tasksQuery, [], 'Fetch tasks completion rate'),
      executeQuery(testsQuery, [], 'Fetch tests completion rate'),
      executeQuery(exercisesQuery, [], 'Fetch exercises completion rate')
    ]);

    // בדיקה אם כל השאילתות הצליחו
    if (!tasksRes.success || !testsRes.success || !exercisesRes.success) {
      console.error('Database query failed');
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    const completionRates = [
      {
        name: 'משימות',
        rate: parseFloat((tasksRes.result as CompletionRateResult[])?.[0]?.completion_rate || '0'),
        color: '#10B981'
      },
      {
        name: 'מבחנים',
        rate: parseFloat((testsRes.result as CompletionRateResult[])?.[0]?.completion_rate || '0'),
        color: '#3B82F6'
      },
      {
        name: 'תרגילים',
        rate: parseFloat((exercisesRes.result as CompletionRateResult[])?.[0]?.completion_rate || '0'),
        color: '#8B5CF6'
      }
    ];

    return NextResponse.json(completionRates);
  } catch (error) {
    console.error('Error fetching completion rates:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    );
  }
}