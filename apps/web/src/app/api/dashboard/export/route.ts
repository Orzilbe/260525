// apps/web/src/app/api/dashboard/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../lib/dbUtils';
import { verifyAuthToken } from '../../../../lib/auth';
import { RowDataPacket } from 'mysql2';

interface ExportResult extends RowDataPacket {
  category: string;
  data: string;
}

interface ExportData {
  metadata: {
    exportDate: string;
    exportedBy: string;
    format: string;
  };
  data: Record<string, any>;
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
      return NextResponse.json({ message: 'אין הרשאה לייצוא נתונים' }, { status: 403 });
    }

    // קבלת פורמט הייצוא
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // שאילתה משולבת לכל הנתונים
    const fullDataQuery = `
      SELECT 
        'user_stats' as category,
        JSON_OBJECT(
          'total_users', (SELECT COUNT(*) FROM users WHERE IsActive = 1),
          'active_users', (SELECT COUNT(*) FROM users WHERE LastLogin > DATE_SUB(NOW(), INTERVAL 30 DAY)),
          'average_score', (SELECT AVG(Score) FROM users WHERE IsActive = 1),
          'total_tasks', (SELECT COUNT(*) FROM tasks),
          'completed_tasks', (SELECT COUNT(*) FROM tasks WHERE CompletionDate IS NOT NULL),
          'total_words', (SELECT COUNT(*) FROM words),
          'last_updated', NOW()
        ) as data
      UNION ALL
      SELECT 
        'topics' as category,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'TopicName', t.TopicName,
            'TopicHe', t.TopicHe,
            'total_tasks', COUNT(task.TaskId),
            'completed_tasks', COUNT(task.CompletionDate),
            'avg_score', ROUND(AVG(task.TaskScore), 1)
          )
        ) as data
      FROM topics t
      LEFT JOIN tasks task ON t.TopicName = task.TopicName
      GROUP BY NULL
    `;

    const response = await executeQuery(fullDataQuery, [], 'Export dashboard data');

    if (!response.success) {
      console.error('Database query failed:', response.error);
      return NextResponse.json(
        { message: 'שגיאה בשאילתת מסד הנתונים' }, 
        { status: 500 }
      );
    }

    // עיצוב הנתונים לייצוא
    const exportData: ExportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        exportedBy: userData.FirstName + ' ' + userData.LastName,
        format: format
      },
      data: {}
    };

    // ארגון הנתונים לפי קטגוריות
    (response.result as ExportResult[])?.forEach(item => {
      try {
        exportData.data[item.category] = JSON.parse(item.data);
      } catch (e) {
        console.error('Error parsing data for category:', item.category, e);
      }
    });

    // החזרת הנתונים בפורמט המבוקש
    if (format === 'csv') {
      // הסבת נתונים ל-CSV
      const csv = convertToCSV(exportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="dashboard-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else {
      // החזרה בפורמט JSON
      return NextResponse.json(exportData);
    }
  } catch (error) {
    console.error('Error exporting dashboard data:', error);
    return NextResponse.json(
      { message: 'שגיאה בלתי צפויה בייצוא נתונים' },
      { status: 500 }
    );
  }
}

// פונקציה להמרת נתונים ל-CSV (דוגמה בסיסית)
function convertToCSV(data: any): string {
  let csv = '';
  
  // הוספת מטא-דטא
  csv += '=== Dashboard Export ===' + '\n';
  csv += `Export Date: ${data.metadata.exportDate}\n`;
  csv += `Exported By: ${data.metadata.exportedBy}\n\n`;
  
  // הוספת נתוני משתמשים
  if (data.data.user_stats) {
    csv += '=== User Statistics ===' + '\n';
    Object.entries(data.data.user_stats).forEach(([key, value]) => {
      csv += `${key},${value}\n`;
    });
    csv += '\n';
  }
  
  // הוספת נתוני נושאים
  if (data.data.topics && Array.isArray(data.data.topics)) {
    csv += '=== Topics Overview ===' + '\n';
    csv += 'Topic Name,Topic (Hebrew),Total Tasks,Completed Tasks,Average Score\n';
    data.data.topics.forEach((topic: any) => {
      csv += `${topic.TopicName},${topic.TopicHe},${topic.total_tasks},${topic.completed_tasks},${topic.avg_score}\n`;
    });
  }
  
  return csv;
}