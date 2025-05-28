// apps/web/src/app/components/TopicCard.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";


interface Topic {
  TopicName: string;
  TopicHe: string;
  Icon: string;
}

interface TopicCardProps {
  topic: Topic;
  userId: string;
  onError?: (message: string) => void;
}

const TopicCard = ({ topic, userId, onError }: TopicCardProps) => {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // פונקציה ליצירת משימה ולניווט לדף התוכן
  const handleTopicClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // מניעת ניווט ברירת מחדל של ה-Link
    
    // אם כבר מעבד, אל תעשה כלום
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // קבלת הטוקן
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('לא נמצא טוקן אימות - יש להתחבר מחדש');
      }
      
      // עיצוב שם הנושא לשימוש ב-URL
      const topicUrlName = topic.TopicName.toLowerCase().replace(/\s+/g, '-');
      
      // לוג הפרטים לפני השליחה - חשוב לדיבוג
      console.log(`מנסה ליצור משימה: userId=${userId}, topicName=${topicUrlName}, token=${token.slice(0, 10)}...`);
      
      // יצירת משימה חדשה
      const taskResponse = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          UserId: userId, // מוסיף את UserId במפורש
          TopicName: topicUrlName,
          Level: '1',
          TaskType: 'flashcard'
        })
      });

      // טיפול בשגיאה
      if (!taskResponse.ok) {
        console.error('תגובת שגיאה מהשרת:', taskResponse.status, taskResponse.statusText);
        const errorData = await taskResponse.json().catch(() => ({ error: 'שגיאה לא ידועה' }));
        throw new Error(errorData.error || `שגיאת שרת: ${taskResponse.status}`);
      }

      // קבלת פרטי המשימה
      const taskData = await taskResponse.json();
      const taskId = taskData.TaskId;
      console.log('משימה נוצרה בהצלחה עם מזהה:', taskId);

      // ניווט לדף כרטיסיות עם מזהה המשימה
      const path = `/topics/${topicUrlName}/tasks/flashcard?level=1&taskId=${taskId}`;
      console.log(`ניווט אל: ${path}`);
      router.push(path);
    } catch (error) {
      console.error('שגיאה בבחירת נושא:', error);
      
      // בדיקה אם השגיאה היא שגיאת אימות
      if (error instanceof Error && (
          error.message.includes('401') || 
          error.message.includes('אימות') || 
          error.message.includes('להתחבר')
      )) {
        // ניווט לדף ההתחברות במקרה של שגיאת אימות
        console.log('מזהה שגיאת אימות - מנווט לדף התחברות');
        router.push('/login');
      }
      
      if (onError) {
        onError(error instanceof Error ? error.message : 'אירעה שגיאה בהתחלת פעילות. אנא נסה שוב.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      onClick={handleTopicClick}
      className="group bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
    >
      <div className="flex flex-col items-center space-y-4">
        {isProcessing ? (
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <span className="text-4xl group-hover:scale-110 transition-transform duration-300">
            {topic.Icon || '🌟'}
          </span>
        )}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-orange-600 transition-colors">
            {topic.TopicName}
          </h2>
          <p className="text-gray-500 text-sm">
            {topic.TopicHe}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TopicCard;