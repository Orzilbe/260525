// apps/web/src/lib/taskUtils.ts

/**
 * פונקציה לשמירת מילים למשימה
 * 
 * @param taskId - מזהה המשימה
 * @param wordIds - מערך של מזהי מילים
 * @returns הבטחה עם תוצאת הפעולה
 */
export async function saveWordsToTask(taskId: string, wordIds: string[] | any[]): Promise<boolean> {
  console.log(`[TaskUtils] Saving ${wordIds?.length || 0} words to task ${taskId}`);
  
  try {
    // התעלם ממזהי משימה זמניים
    if (!taskId || taskId.startsWith('client_') || taskId.startsWith('temp_')) {
      console.log('[TaskUtils] Skipping word saving for temporary task ID');
      return true;
    }
    
    // וודא שיש מילים להוסיף
    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      console.log('[TaskUtils] No words to save');
      return true;
    }
    
    // המר את מזהי המילים לפורמט הנכון
    const processedWordIds = wordIds.map(word => {
      if (typeof word === 'string') {
        return word;
      } else if (typeof word === 'object' && word !== null) {
        return word.WordId || word.wordId || word.id;
      }
      return null;
    }).filter(id => id !== null && id !== undefined);
    
    console.log(`[TaskUtils] Processed ${processedWordIds.length} valid word IDs`);
    
    // קבל טוקן אימות
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('[TaskUtils] Missing authentication token');
      throw new Error('Authentication required');
    }
    
    // שלח בקשה ל-API
    const response = await fetch('/api/words-in-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        taskId,
        wordIds: processedWordIds
      })
    });
    
    // בדוק תוצאה
    if (response.ok) {
      const result = await response.json();
      console.log('[TaskUtils] Words saved successfully:', result);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`[TaskUtils] Failed to save words: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('[TaskUtils] Error saving words to task:', error);
    return false;
  }
}

/**
* Complete a task and record word usage
* @param taskId Task ID
* @param score Task score (default: 100)
* @param durationSeconds Task duration in seconds
* @param wordIds Optional array of word IDs to mark as completed
*/
export async function completeTask(
taskId: string,
score: number = 100,
durationSeconds: number = 0,
wordIds?: string[]
): Promise<boolean> {
console.log(`[TaskUtils] Completing task ${taskId} with score ${score} and ${wordIds?.length || 0} words`);

try {
  // Skip temporary task IDs
  if (!taskId || taskId.startsWith('client_') || taskId.startsWith('temp_')) {
    console.log('[TaskUtils] Skipping completion for temporary task ID');
    return true;
  }
  
  // Get auth token
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.error('[TaskUtils] Missing authentication token');
    throw new Error('Authentication required');
  }
  
  // Complete task and record word usage in a single request
  const response = await fetch(`/api/tasks/${taskId}/complete`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      TaskScore: score,
      DurationTask: durationSeconds,
      wordIds: wordIds || []
    })
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log('[TaskUtils] Task completed successfully:', result);
    return true;
  } else {
    const errorText = await response.text();
    console.error(`[TaskUtils] Failed to complete task: ${response.status} - ${errorText}`);
    return false;
  }
} catch (error) {
  console.error('[TaskUtils] Error completing task:', error);
  return false;
}
}

/**
* Record word usage in a task
* @param taskId Task ID
* @param wordIds Array of word IDs to record
*/
export async function recordWordUsage(taskId: string, wordIds: string[]): Promise<boolean> {
console.log(`[TaskUtils] Recording ${wordIds.length} words for task ${taskId}`);

try {
  // Skip temporary task IDs
  if (!taskId || taskId.startsWith('client_') || taskId.startsWith('temp_')) {
    console.log('[TaskUtils] Skipping word recording for temporary task ID');
    return true;
  }
  
  // Get auth token
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.error('[TaskUtils] Missing authentication token');
    throw new Error('Authentication required');
  }
  
  // Record word usage
  const response = await fetch(`/api/tasks/${taskId}/words`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      wordIds
    })
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log('[TaskUtils] Words recorded successfully:', result);
    return true;
  } else {
    const errorText = await response.text();
    console.error(`[TaskUtils] Failed to record words: ${response.status} - ${errorText}`);
    return false;
  }
} catch (error) {
  console.error('[TaskUtils] Error recording words:', error);
  return false;
}
}

/**
* סיום משימת שיחה עם עדכון רמת משתמש
* 
* @param taskId מזהה המשימה
* @param topicName שם הנושא
* @param level רמת הנושא
* @param score ציון המשימה (0-100)
* @param durationSeconds משך זמן המשימה בשניות
* @returns הבטחה עם תוצאת הפעולה
*/
export async function completeConversationTask(
taskId: string,
topicName: string,
level: number,
score: number = 100,
durationSeconds: number = 0
): Promise<boolean> {
console.log(`[TaskUtils] Completing conversation task ${taskId} for topic ${topicName} level ${level}`);

try {
  // דילוג על מזהי משימה זמניים
  if (!taskId || taskId.startsWith('client_') || taskId.startsWith('temp_')) {
    console.log('[TaskUtils] Skipping completion for temporary task ID');
    return true;
  }
  
  // קבלת טוקן אימות
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('[TaskUtils] Missing authentication token');
    throw new Error('Authentication required');
  }
  
  // שלב 1: עדכון המשימה
  const taskResponse = await fetch('/api/tasks', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      taskId,
      score,
      duration: durationSeconds
    })
  });
  
  if (!taskResponse.ok) {
    const errorText = await taskResponse.text();
    console.error(`[TaskUtils] Failed to update task: ${taskResponse.status} - ${errorText}`);
    return false;
  }
  
  console.log('[TaskUtils] Task updated successfully');
  
  // שלב 2: עדכון רמת המשתמש
  const userLevelResponse = await fetch('/api/user-level/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      topicName,
      currentLevel: level,
      earnedScore: score,
      taskId, // אופציונלי, API יכול להתעלם מזה
      isCompleted: true // לסמן השלמת רמה
    })
  });
  
  if (!userLevelResponse.ok) {
    const errorText = await userLevelResponse.text();
    console.error(`[TaskUtils] Failed to update user level: ${userLevelResponse.status} - ${errorText}`);
    // המשימה עדיין עודכנה, לכן נחשיב חלקית כהצלחה
    return true;
  }
  
  console.log('[TaskUtils] User level updated successfully');
  return true;
} catch (error) {
  console.error('[TaskUtils] Error completing conversation task:', error);
  return false;
}
}

/**
* המרת שם נושא מפורמט URL לפורמט מסד הנתונים
* למשל: 'society-and-multiculturalism' -> 'Society and Multiculturalism'
*/
export function formatTopicName(urlTopicName: string): string {
// ההמרה - החלפת מקפים ברווחים והפיכת האות הראשונה של כל מילה לגדולה
return urlTopicName
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');
}

/**
* המרת שם נושא מפורמט מסד הנתונים לפורמט URL
* למשל: 'Society and Multiculturalism' -> 'society-and-multiculturalism'
*/
export function formatTopicNameForUrl(dbTopicName: string): string {
return dbTopicName.toLowerCase().replace(/\s+/g, '-');
}