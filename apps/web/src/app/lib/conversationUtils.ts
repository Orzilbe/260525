// apps/web/src/utils/conversationUtils.ts
import { completeConversationTask, formatTopicName } from '../lib/taskUtils';

/**
 * טיפול בסיום שיחה
 * 
 * @param {object} params הפרמטרים לסיום השיחה
 * @param {string} params.taskId מזהה המשימה
 * @param {string} params.topicName שם הנושא (פורמט URL, עם מקפים)
 * @param {number} params.level רמת הנושא
 * @param {number} params.score ציון המשימה (0-100)
 * @param {number} params.duration משך זמן המשימה בשניות
 * @returns {Promise<{success: boolean, message?: string}>} תוצאת הפעולה
 */
export async function handleConversationCompletion({
  taskId,
  topicName,
  level,
  score = 75,
  duration = 0
}: {
  taskId: string;
  topicName: string;
  level: number;
  score?: number;
  duration?: number;
}): Promise<{success: boolean, message?: string}> {
  try {
    console.log(`Completing conversation for task ${taskId}, topic ${topicName} level ${level}`);
    
    // המרת שם הנושא מפורמט URL לפורמט מסד הנתונים
    const formattedTopicName = formatTopicName(topicName);
    
    // ביצוע השלמת המשימה
    const result = await completeConversationTask(
      taskId,
      formattedTopicName,
      level,
      score,
      duration
    );
    
    if (result) {
      return { 
        success: true,
        message: 'Conversation completed successfully. You can now continue to the next level.'
      };
    } else {
      return {
        success: false,
        message: 'Failed to complete conversation. Please try again or contact support.'
      };
    }
  } catch (error) {
    console.error('Error handling conversation completion:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

/**
 * חישוב ציון לפי מדדים שונים של השיחה
 * 
 * @param params מדדי השיחה
 * @returns ציון בין 0-100
 */
export function calculateConversationScore({
  duration = 0,           // משך השיחה בשניות
  wordCount = 0,          // מספר המילים שנלמדו
  completedExercises = 0, // מספר התרגילים שהושלמו
  answeredQuestions = 0,  // מספר השאלות שנענו
  totalQuestions = 0      // סך השאלות
}: {
  duration?: number;
  wordCount?: number;
  completedExercises?: number;
  answeredQuestions?: number;
  totalQuestions?: number;
}): number {
  // מודל חישוב פשוט - ניתן להתאים לפי הצורך
  let score = 75; // ציון בסיסי
  
  // ציון על משך השיחה (מינימום רצוי: 60 שניות)
  if (duration >= 120) {
    score += 10; // שיחה ארוכה
  } else if (duration >= 60) {
    score += 5;  // שיחה סבירה
  } else if (duration < 30) {
    score -= 10; // שיחה קצרה מדי
  }
  
  // ציון על מילים שנלמדו
  if (wordCount >= 10) {
    score += 10;
  } else if (wordCount >= 5) {
    score += 5;
  }
  
  // ציון על תרגילים ושאלות
  const questionRatio = totalQuestions > 0 ? answeredQuestions / totalQuestions : 0;
  if (questionRatio >= 0.8) {
    score += 10; // השיב על 80% או יותר מהשאלות
  } else if (questionRatio >= 0.5) {
    score += 5;  // השיב על לפחות חצי מהשאלות
  }
  
  // הגבלת הציון בין 0 ל-100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * פונקציה לקבלת טקסט הודעה מתאים לציון
 * 
 * @param score ציון השיחה (0-100)
 * @returns הודעה מתאימה
 */
export function getScoreMessage(score: number): string {
  if (score >= 90) {
    return 'מצוין! השיחה הייתה מעולה.';
  } else if (score >= 80) {
    return 'כל הכבוד! ביצעת את השיחה בהצלחה רבה.';
  } else if (score >= 70) {
    return 'טוב מאוד! ביצעת את השיחה בהצלחה.';
  } else if (score >= 60) {
    return 'טוב! השלמת את השיחה בציון עובר.';
  } else {
    return 'השלמת את השיחה. נסה להשתפר בפעם הבאה.';
  }
}