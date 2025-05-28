// apps/api/src/routes/flashcardRoutes.ts
import express from 'express';
import { getDbPool } from '../lib/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { IUser } from '../models/User';
import { AzureOpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload {
  id: number;
  email: string;
  role?: string;
}

interface IUserRequest extends express.Request {
  user?: TokenPayload;
}

const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiVersion: "2024-04-01-preview"
});

const router = express.Router();

/**
 * מקבל את רמת האנגלית של המשתמש לפי המזהה שלו
 */
async function getUserEnglishLevel(userId: string): Promise<string> {
  try {
    const pool = await getDbPool();
    const [users] = await pool.execute(
      'SELECT EnglishLevel FROM Users WHERE UserId = ?',
      [userId]
    );

    if (Array.isArray(users) && users.length > 0) {
      return (users[0] as any).EnglishLevel || 'intermediate';
    }
    
    return 'intermediate';
  } catch (error) {
    console.error('Error getting user English level:', error);
    return 'intermediate';
  }
}

/**
 * יוצר כרטיסיות פלאש חדשות באמצעות OpenAI לפי רמת האנגלית של המשתמש
 */
async function generateFlashcardsWithOpenAI(topicName: string, userId: string | number) {
  try {
    // קבלת רמת האנגלית של המשתמש
    const userEnglishLevel = await getUserEnglishLevel(String(userId));
    
    let prompt = '';
    
    if(topicName === "Diplomacy and International Relations") {
      prompt = `Generate 7 unique words related to diplomacy and international relations, appropriate for ${userEnglishLevel} level English learners.
        highlighting:
           - Diplomatic negotiations
           - International conflict resolution
           - Geopolitical strategies
           - Cross-cultural communication
           - Israeli diplomatic tasks
 
           For each word, provide:
           1. An innovative diplomatic term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed diplomatic context
           4. An example sentence showing its application
 
           Respond as a JSON array with these fields:
           [{
             "word": "Diplomatic term",
             "translation": "Hebrew translation",
             "example": "Contextual usage sentence highlighting diplomatic nuance"
           }, ...]
             IMPORTANT: 
             - Focus on diplomacy and international relations terms
             -Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
             - Keep examples diplomatic-oriented
             - Adjust difficulty to ${userEnglishLevel} level`;
    } else if(topicName === "Economy and Entrepreneurship") {
      prompt = `Generate 7 unique words related to economy and entrepreneurship, appropriate for ${userEnglishLevel} level English learners.
      focusing on:
          - Startup ecosystem
          - Economic innovation
          - Financial technologies
          - Entrepreneurial strategies
          - Global economic influence
          For each word, provide:
           1. An innovative economic term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed innovative context
           4. An example sentence showing its application
 
      Respond as a JSON array with these fields:
      [{
        "word": "English word",
        "translation": "Hebrew translation",
        "example": "A clear, natural example sentence in English using the word"
      }, ...]

      IMPORTANT: 
      - Focus on economic and financial terms
                   -Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
      - Keep examples business-oriented
      - Adjust difficulty to ${userEnglishLevel} level`;
    } 
    else if(topicName === "Environment and Sustainability") {
      prompt = `Generate 7 unique words related to environment and sustainability, appropriate for ${userEnglishLevel} level English learners.
      focusing on:
          - Environmental conservation
          - Climate change
          - Sustainable development
          - Environmental policies
          - Global environmental issues
          For each word, provide:
           1. An innovative environmental term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed innovative context
           4. An example sentence showing its application
 
      Respond as a JSON array with these fields:
      [{
        "word": "English word",
        "translation": "Hebrew translation",
        "example": "A clear, natural example sentence in English using the word"
      }, ...]

      IMPORTANT: 
      - Focus on environmental and sustainability terms
                   -Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
      - Keep examples environmental-oriented
      - Adjust difficulty to ${userEnglishLevel} level`;
    }
    else if(topicName === "Innovation and Technology") {
      prompt = `Generate 7 unique words related to innovation and technology, appropriate for ${userEnglishLevel} level English learners.
      focusing on:
         - Startup ecosystem
          - Technological breakthroughs
          - AI and machine learning
          - Cybersecurity innovations
          - Green tech and sustainability
          For each word, provide:
          1. An innovative technological term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed technological context
           4. An example sentence showing its application
 
      Respond as a JSON array with these fields:
      [{
        "word": "English word",
        "translation": "Hebrew translation",
        "example": "A clear, natural example sentence in English using the word"
      }, ...]
           IMPORTANT: 
      - Focus on innovation and technology terms
      - Keep examples focusing on innovation and technology terms
      - Adjust difficulty to ${userEnglishLevel} level`;
    } else if(topicName === "History and Heritage") {
      prompt = `Generate 7 unique words related to history and historical events, appropriate for ${userEnglishLevel} level English learners.
      focusing on:
          - Historical israeli and jewish milestones
          - Cultural heritage
          - Zionist movement
          - Jewish diaspora experiences
          - Historical resiliences
          For each word, provide:
           1. An innovative historical term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed historical context
           4. An example sentence showing its application
 
      Respond as a JSON array with these fields:
      [{
        "word": "English word",
        "translation": "Hebrew translation",
        "example": "A clear, natural example sentence in English using the word"
      }, ...]

           IMPORTANT: 
      - Focus on historical and cultural terms
                   -Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
      - pro israeli and jewish history
      - Keep examples focusing on historical and cultural terms of Israel and Judaism - Pro-Israeli
      - Adjust difficulty to ${userEnglishLevel} level`;
    } else if(topicName === "Holocaust and Revival") {
      prompt = `Generate 7 unique words related to Holocaust and Revival, appropriate for ${userEnglishLevel} level English learners.
      focusing on:
          - Holocaust remembrance
          - Jewish resilience
          - Post-traumatic recovery
          - Cultural preservation
          - Rebirth and hope
          For each word, provide:
           1. An innovative historical term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed historical context
           4. An example sentence showing its application
 
      Respond as a JSON array with these fields:
      [{
        "word": "English word",
        "translation": "Hebrew translation",
        "example": "A clear, natural example sentence in English using the word"
      }, ...]

           IMPORTANT: 
      - Focus on historical and cultural terms
     -Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
      - Keep examples focusing on historical and cultural terms of Israel and Judaism - Pro-Israeli
      - Adjust difficulty to ${userEnglishLevel} level`;
    } else if(topicName === "Iron Swords War") {
      prompt = `Generate 7 unique words related to the Gaza war, appropriate for ${userEnglishLevel} level English learners.
      focusing on:
          - Israeli military operations
          - Palestinian resistance
          - International response
          - Humanitarian concerns
          - Geopolitical implications
          For each word, provide:
           1. An innovative diplomatic term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed diplomatic context
           4. An example sentence showing its application
 
      Respond as a JSON array with these fields:
      [{
        "word": "English word",
        "translation": "Hebrew translation",
        "example": "A clear, natural example sentence in English using the word"
      }, ...]

          IMPORTANT: 
      - Focus on historical and cultural terms
      - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
      - Keep examples focusing on historical and cultural terms of Israel and Judaism - Pro-Israeli
      - Adjust difficulty to ${userEnglishLevel} level
      For each word, provide:
           1. An innovative diplomatic term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed diplomatic context
           4. An example sentence showing its application
 
      about gaza war:
      - The Gaza war has been fought between Israel and Hamas-led Palestinian militant groups in the Gaza Strip and Israel since 7 October 2023.
      -The first day was the deadliest in Israel's history
      `;
    } else if(topicName === "Society and Multiculturalism") {
      prompt = `Generate 7 precise English words and phrases specifically related to social dynamics and multicultural interactions, appropriate for ${userEnglishLevel} level English learners.

Focus Areas:
- Social interaction terms
- Multicultural communication concepts
- Real-world social dynamics vocabulary
- Terminology that captures nuanced social experiences

Requirements for Each Term:
1. A specific, meaningful English word or phrase
2. Accurate Hebrew translation
3. Contextual explanation 
4. A natural, conversational example sentence

Specific Guidance:
- Select actual English words, not descriptive phrases
- Ensure words reflect real social interactions
- Prioritize terms that:
  * Describe social relationships
  * Capture cultural nuances
  * Represent meaningful communication concepts

IMPORTANT:
- Words must be actual English terms
- Translations must be precise
- Provide real-world, usable vocabulary
- Adjust complexity to ${userEnglishLevel} language level

Output Format:
[{
  "word": "Actual English word",
  "translation": "Precise Hebrew translation",
  "example": "Natural example sentence using the word in context"
}, ...]`;
    } else {
      // אם הנושא לא מוכר, יצירת פרומפט כללי
      prompt = `Generate 7 unique words related to ${topicName}, appropriate for ${userEnglishLevel} level English learners.
      For each word, provide:
           1. An innovative diplomatic term
           2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
           3. Detailed diplomatic context
           4. An example sentence showing its application
 
      Respond as a JSON array with these fields:
      [{
        "word": "English word",
        "translation": "Hebrew translation",
        "example": "A clear, natural example sentence in English using the word"
      }, ...]
      
      IMPORTANT: 
      - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context.
      - Adjust difficulty to ${userEnglishLevel} level`;
    }

    // שליחת בקשה ל-OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
      messages: [
        { role: "system", content: "You are a precise language learning assistant creating vocabulary words." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    // עיבוד התשובה
    const responseText = completion.choices[0].message.content?.trim() || '';
    let wordsData;

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      try {
        wordsData = JSON.parse(jsonString);
      } catch (jsonError) {
        console.error('Error parsing OpenAI response as JSON:', jsonError);
        const wordEntries = responseText.split(/\d+\.\s+/).filter(entry => entry.trim().length > 0);
        wordsData = wordEntries.map(entry => {
          const parts = entry.split(':');
          if (parts.length >= 2) {
            const word = parts[0].trim();
            const rest = parts.slice(1).join(':').trim();
            const sentences = rest.split(/\.\s+/);
            const translation = sentences[0].trim();
            const example = sentences.length > 1 ? sentences.slice(1).join('. ').trim() : '';
            return { word, translation, example };
          }
          return null;
        }).filter(item => item !== null);
      }
    } catch (error) {
      console.error('Error processing OpenAI response:', error);
      console.log('Raw response:', responseText);
      return [];
    }

    // שמירת המילים במסד הנתונים
    const pool = await getDbPool();
    const savedWords = [];

    for (const item of wordsData) {
      const wordId = uuidv4();
      const { word, translation, example = "" } = item;

      // בדיקה אם המילה כבר קיימת
      const [existingWords] = await pool.execute(
        'SELECT * FROM Words WHERE Word = ? AND TopicName = ?',
        [word, topicName]
      );

      // אם המילה כבר קיימת, דלג עליה
      if (Array.isArray(existingWords) && existingWords.length > 0) {
        savedWords.push({
          WordId: (existingWords[0] as any).WordId,
          Word: word,
          Translation: translation,
          ExampleUsage: example,
          TopicName: topicName
        });
        continue;
      }

      // שמירת מילה חדשה
      await pool.execute(
        `INSERT INTO Words 
         (WordId, Word, Translation, ExampleUsage, TopicName, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          wordId,
          word,
          translation,
          example,
          topicName
        ]
      );

      savedWords.push({
        WordId: wordId,
        Word: word,
        Translation: translation,
        ExampleUsage: example,
        TopicName: topicName
      });
    }

    return savedWords;
  } catch (error) {
    console.error('Error generating flashcards with OpenAI:', error);
    return [];
  }
}

// נתיב ליצירת כרטיסיית פלאש חדשה
router.post('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { Word, Translation, TopicName, Level = 1, ExampleUsage = "" } = req.body;
    
    if (!Word || !Translation || !TopicName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Word, translation, and topic are required' 
      });
    }
    
    const pool = await getDbPool();
    
    // בדיקה שהנושא קיים
    const [topics] = await pool.execute(
      'SELECT * FROM Topics WHERE TopicName = ?',
      [TopicName]
    );
    
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Topic not found' 
      });
    }
    
    // יצירת מזהה ייחודי למילה
    const WordId = uuidv4();
    
    // שמירת המילה החדשה
    await pool.execute(
      `INSERT INTO Words 
       (WordId, Word, Translation, ExampleUsage, TopicName, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        WordId,
        Word,
        Translation,
        ExampleUsage,
        TopicName
      ]
    );
    
    return res.json({ 
      success: true, 
      data: {
        WordId,
        Word,
        Translation,
        ExampleUsage,
        TopicName,
        Level
      } 
    });
  } catch (error) {
    console.error('Error creating flashcard:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create flashcard' 
    });
  }
});

// נתיב לקבלת כרטיסיות פלאש לפי נושא ורמה
router.get('/:topic/:level', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { topic, level } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }
    
    const pool = await getDbPool();
    
    // בדיקה שהנושא קיים
    const [topics] = await pool.execute(
      'SELECT * FROM Topics WHERE TopicName = ?',
      [topic]
    );
    
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Topic not found' 
      });
    }
    
    // שאילתה לקבלת מילים בנושא וברמה המבוקשים, ללא מילים שכבר נלמדו
    let query = `
      SELECT w.WordId, w.Word, w.Translation, w.ExampleUsage, w.TopicName 
      FROM Words w
      JOIN Topics t ON w.TopicName = t.TopicName
      JOIN Level l ON t.TopicName = l.TopicName
      WHERE t.TopicName = ? AND l.Level = ?
    `;
    
    // אם המשתמש מחובר, סנן מילים שכבר למד
    if (userId) {
      query += `
        AND w.WordId NOT IN (
          SELECT wi.WordId
          FROM WordsInTask wi
          JOIN Tasks ta ON wi.TaskId = ta.TaskId
          WHERE ta.UserId = ?
        )
      `;
    }
    
    const queryParams = [topic, level];
    if (userId) queryParams.push(String(userId));
    
    const [words] = await pool.execute(query, queryParams);
    
    // אם אין מספיק מילים, צור מילים חדשות עם OpenAI
    if (Array.isArray(words) && words.length < 5 && userId) {
      const newWords = await generateFlashcardsWithOpenAI(topic, userId);
      return res.json({ 
        success: true, 
        data: [...words, ...newWords] 
      });
    }
    
    return res.json({ 
      success: true, 
      data: words 
    });
  } catch (error) {
    console.error('Error fetching flashcards:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch flashcards' 
    });
  }
});

// נתיב לסימון מילה כנלמדה
router.post('/mark-learned', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { WordId, TaskId, TopicName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    if (!WordId || !TaskId) {
      return res.status(400).json({ 
        success: false, 
        message: 'WordId and TaskId are required' 
      });
    }

    const pool = await getDbPool();
    
    // בדיקה שהמילה קיימת
    const [words] = await pool.execute(
      'SELECT * FROM Words WHERE WordId = ?',
      [WordId]
    );
    
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Word not found' 
      });
    }
    
    // בדיקה שהמשימה קיימת ושייכת למשתמש
    const [tasks] = await pool.execute(
      'SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?',
      [TaskId, String(userId)]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Task not found or not authorized' 
      });
    }
    
    // בדיקה אם המילה כבר נמצאת במשימה
    const [wordsInTask] = await pool.execute(
      'SELECT * FROM WordsInTask WHERE TaskId = ? AND WordId = ?',
      [TaskId, WordId]
    );
    
    // אם המילה כבר במשימה, החזר הצלחה
    if (Array.isArray(wordsInTask) && wordsInTask.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Word already marked as learned' 
      });
    }
    
    // הוספת המילה למשימה
    await pool.execute(
      'INSERT INTO WordsInTask (TaskId, WordId) VALUES (?, ?)',
      [TaskId, WordId]
    );
    
    return res.json({ 
      success: true, 
      message: 'Word marked as learned'
    });
  } catch (error) {
    console.error('Error marking word as learned:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to mark word as learned' 
    });
  }
});

/**
 * POST /words - Save words and create word-task associations
 * Endpoint to store words learned by a user and associate them with a task
 */
router.post('/words', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  try {
    const pool = await getDbPool();
    const userId = req.user?.id;
    const { words, taskId } = req.body;
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ message: 'Words array is required' });
    }
    
    if (!taskId) {
      return res.status(400).json({ message: 'Task ID is required' });
    }
    
    // Start a transaction to ensure data integrity
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const savedWordIds = [];
      
      // Save each word to the Words table if it doesn't exist
      for (const word of words) {
        // Check if the word already exists
        const [existingWords] = await connection.execute(
          'SELECT WordId FROM Words WHERE Word = ? AND TopicName = ?',
          [word.Word, word.TopicName]
        );
        
        let wordId;
        
        if (Array.isArray(existingWords) && existingWords.length > 0) {
          // Word already exists, use its ID
          wordId = (existingWords[0] as any).WordId;
        } else {
          // Word doesn't exist, insert it
          const newWordId = word.WordId || uuidv4();
          await connection.execute(
            `INSERT INTO Words 
             (WordId, Word, Translation, ExampleUsage, TopicName, CreatedAt, UpdatedAt)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              newWordId,
              word.Word,
              word.Translation,
              word.ExampleUsage,
              word.TopicName
            ]
          );
          wordId = newWordId;
        }
        
        savedWordIds.push(wordId);
        
        // Create word-task association
        // Skip if association already exists
        const [existingAssoc] = await connection.execute(
          'SELECT TaskId FROM WordsInTask WHERE TaskId = ? AND WordId = ?',
          [taskId, wordId]
        );
        
        if (!(Array.isArray(existingAssoc) && existingAssoc.length > 0)) {
          await connection.execute(
            `INSERT INTO WordsInTask 
             (TaskId, WordId, IsCompleted, Score, Attempts, CreatedAt, UpdatedAt)
             VALUES (?, ?, TRUE, 100, 1, NOW(), NOW())`,
            [taskId, wordId]
          );
        }
      }
      
      // Commit the transaction
      await connection.commit();
      
      // Return success response
      return res.status(200).json({
        message: 'Words saved and associated with task successfully',
        wordIds: savedWordIds
      });
    } catch (error) {
      // Rollback the transaction if an error occurs
      await connection.rollback();
      throw error;
    } finally {
      // Release the connection
      connection.release();
    }
  } catch (error) {
    console.error('Error saving words:', error);
    return res.status(500).json({
      message: 'Failed to save words',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /tasks/:taskId/complete - Complete a task
 * Endpoint to mark a task as completed and update task status
 */
router.put('/tasks/:taskId/complete', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  try {
    const pool = await getDbPool();
    const taskId = req.params.taskId;
    const { wordIds, CompletionDate, TaskScore } = req.body;
    
    // Get the task to ensure it exists and belongs to the user
    const [tasks] = await pool.execute(
      'SELECT * FROM Tasks WHERE TaskId = ?',
      [taskId]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const task = tasks[0] as any;
    
    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Associate words with the task if provided
      if (wordIds && Array.isArray(wordIds)) {
        for (const wordId of wordIds) {
          // Skip if association already exists
          const [existingAssoc] = await connection.execute(
            'SELECT TaskId FROM WordsInTask WHERE TaskId = ? AND WordId = ?',
            [taskId, wordId]
          );
          
          if (!(Array.isArray(existingAssoc) && existingAssoc.length > 0)) {
            await connection.execute(
              `INSERT INTO WordsInTask 
               (TaskId, WordId, IsCompleted, Score, Attempts, CreatedAt, UpdatedAt)
               VALUES (?, ?, TRUE, 100, 1, NOW(), NOW())`,
              [taskId, wordId]
            );
          }
        }
      }
      
      // Mark the task as completed
      await connection.execute(
        `UPDATE Tasks 
         SET TaskScore = ?, CompletionDate = ?, UpdatedAt = NOW() 
         WHERE TaskId = ?`,
        [TaskScore || 100, CompletionDate || new Date(), taskId]
      );
      
      // Commit the transaction
      await connection.commit();
      
      // Return success response
      return res.status(200).json({
        message: 'Task completed successfully',
        taskId
      });
    } catch (error) {
      // Rollback the transaction if an error occurs
      await connection.rollback();
      throw error;
    } finally {
      // Release the connection
      connection.release();
    }
  } catch (error) {
    console.error('Error completing task:', error);
    return res.status(500).json({
      message: 'Failed to complete task',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;