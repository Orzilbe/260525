// apps/web/src/app/api/create-post/[topicName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../auth/verifyAuth';
import { AzureOpenAI  } from 'openai';

// יצירת לקוח OpenAI
const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
});

// בדיקת מפתח OpenAI API
console.log(`Azure OpenAI API Key status: ${process.env.AZURE_OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);

// API URL לשרת הבקנד
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// יצירת מילים ספציפיות לנושאים שונים
function getTopicSpecificWords(topicName: string): string[] {
  const lowerTopic = topicName.toLowerCase();
  
  if (lowerTopic.includes('diplomacy')) {
    return ['diplomacy', 'peace', 'negotiation', 'agreement', 'international', 'ambassador', 'relations', 'alliance', 'dialogue', 'treaty'];
  } else if (lowerTopic.includes('economy')) {
    return ['startup', 'innovation', 'entrepreneur', 'investment', 'technology', 'venture', 'finance', 'growth', 'market', 'business'];
  } else if (lowerTopic.includes('innovation')) {
    return ['technology', 'startup', 'innovation', 'research', 'development', 'solution', 'breakthrough', 'pioneer', 'advancement', 'discovery'];
  } else if (lowerTopic.includes('history')) {
    return ['heritage', 'tradition', 'ancient', 'archaeological', 'civilization', 'historic', 'legacy', 'monument', 'preservation', 'artifact'];
  } else if (lowerTopic.includes('holocaust')) {
    return ['remembrance', 'survivor', 'memorial', 'testimony', 'resilience', 'resistance', 'liberation', 'commemoration', 'heritage', 'revival'];
  } else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
    return ['security', 'defense', 'protection', 'resilience', 'strength', 'determination', 'innovation', 'technology', 'strategy', 'capability'];
  } else if (lowerTopic.includes('society')) {
    return ['diversity', 'culture', 'community', 'tradition', 'integration', 'coexistence', 'heritage', 'identity', 'pluralism', 'inclusion'];
  }
  
  // מילים כלליות כברירת מחדל
  return ['culture', 'heritage', 'history', 'innovation', 'community', 'tradition', 'diversity', 'development', 'future', 'perspective'];
}

// יצירת מילה כללית רנדומלית (במקרה של צורך)
function getRandomWord(): string {
  const generalWords = [
    'culture', 'heritage', 'innovation', 'community', 'tradition', 
    'diversity', 'development', 'progress', 'future', 'experience',
    'perspective', 'knowledge', 'understanding', 'discovery', 'connection'
  ];
  
  return generalWords[Math.floor(Math.random() * generalWords.length)];
}

// קבלת רמת האנגלית של המשתמש
async function getUserEnglishLevel(token: string): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/user/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error(`Failed to get user profile: ${response.status}`);
      return 'intermediate'; // ברירת מחדל
    }

    const data = await response.json();
    return data.englishLevel || 'intermediate';
  } catch (error) {
    console.error('Error fetching user English level:', error);
    return 'intermediate'; // ברירת מחדל
  }
}

// קבלת מילים שהמשתמש למד
async function getUserLearnedWords(token: string, topicName: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/api/words/learned?topic=${encodeURIComponent(topicName)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error(`Failed to get learned words: ${response.status}`);
      return []; // מערך ריק במקרה של כישלון
    }

    const data = await response.json();
    
    // שליפת המילים מתוך התשובה
    if (data.success && Array.isArray(data.data)) {
      return data.data.map((item: any) => item.Word);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching user learned words:', error);
    return []; // מערך ריק במקרה של כישלון
  }
}

// יצירת פוסט באמצעות OpenAI
async function generatePost(topicName: string, englishLevel: string, learnedWords: string[] = []): Promise<{text: string, requiredWords: string[]}> {
  // יצירת רשימת מילים שצריכות להופיע בפוסט
  let requiredWords: string[] = [];
  
  // הוספת מילים שהמשתמש למד (עד 3)
  if (learnedWords.length > 0) {
    const shuffled = [...learnedWords].sort(() => 0.5 - Math.random());
    requiredWords = shuffled.slice(0, Math.min(3, shuffled.length));
  }
  
  // הוספת מילים ספציפיות לנושא
  const topicWords = getTopicSpecificWords(topicName);
  
  // אם אין מספיק מילים ממילות המשתמש, הוסף ממילות הנושא
  const wordsNeeded = 5 - requiredWords.length;
  if (wordsNeeded > 0 && topicWords.length > 0) {
    const shuffled = [...topicWords].sort(() => 0.5 - Math.random());
    requiredWords = [...requiredWords, ...shuffled.slice(0, wordsNeeded)];
  }
  
  // ודא שיש לפחות 5 מילים
  while (requiredWords.length < 5) {
    requiredWords.push(getRandomWord());
  }
  
  try {
    // יצירת הפרומפט בהתאם לנושא ורמת האנגלית
    const prompt = createTopicPrompt(topicName, englishLevel, requiredWords);
    
    console.log('Sending request to OpenAI API');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // אפשר להשתמש ב-"gpt-4" אם זמין
      messages: [
        {
          role: "system",
          content: `You are an educational assistant specializing in creating engaging social media content about Israel, 
                   tailored for ${englishLevel} English level learners. Create content that is informative, engaging, 
                   and helps practice English vocabulary.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const generatedText = completion.choices[0]?.message?.content?.trim() || '';
    console.log('Successfully generated post with OpenAI');
    
    return {
      text: generatedText,
      requiredWords: requiredWords
    };
  } catch (error) {
    console.error('Error generating post with OpenAI:', error);
    throw error; // זריקת השגיאה כדי שתטופל למעלה
  }
}

// יצירת פרומפט בהתאם לנושא ורמת האנגלית
function createTopicPrompt(topicName: string, englishLevel: string, requiredWords: string[]): string {
  const formattedTopic = topicName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  let difficultyAdjustment = '';
  
  switch (englishLevel.toLowerCase()) {
    case 'beginner':
      difficultyAdjustment = 'Use simple sentence structures and common vocabulary. Avoid complex grammar, and use simple sentences, use up to 20 words';
      break;
    case 'intermediate':
      difficultyAdjustment = 'Balance simple and complex sentences. Introduce some advanced vocabulary with context, use up to 50 words.';
      break;
    case 'advanced':
      difficultyAdjustment = 'Use sophisticated vocabulary and varied sentence structures. Include idiomatic expressions, use up to 100 words.';
      break;
    default:
      difficultyAdjustment = 'Balance simple and complex sentences. Introduce some advanced vocabulary with context.';
  }
  
  // פרומפט בסיסי
  let prompt = `Create a social media style post about a specific significant event, achievement, or milestone related to ${formattedTopic} in Israel.
               The post should:
               - Be written in a social media-friendly tone (like Facebook)
               - Focus on ONE specific event, achievement, or milestone
               - Include specific dates, names, and factual details about this event/achievement
               - Include no more than 4 relevant emojis
               - Keep it concise (up to 100 words)
               - Provide at least one surprising or lesser-known fact that most people wouldn't know
               - ${difficultyAdjustment}
               - Naturally incorporate these words: ${requiredWords.join(', ')}
               - End with 1-2 engaging questions to spark conversation
               - Be factually accurate and educational
               - Avoid controversial political statements or hashtags
               - Keep it pro-Israeli and pro-Jewish
               Follow this structure:
               1. Start with a brief attention-grabbing introduction and relevant emojis
               2. Share valuable information about ${formattedTopic} in 2-3 short paragraphs
               3. End with engaging questions`;
  
  // הוספת הוראות ספציפיות לנושא
  if (topicName.includes('diplomacy')) {
    prompt += `\n\nFocus on Israeli diplomatic achievements, peace agreements, or international relations.`;
  } else if (topicName.includes('economy')) {
    prompt += `\n\nFocus on Israel's startup ecosystem, economic innovations, or entrepreneurial success stories.`;
  } else if (topicName.includes('innovation')) {
    prompt += `\n\nFocus on Israeli technological breakthroughs, scientific achievements, or innovative solutions.`;
  } else if (topicName.includes('history')) {
    prompt += `\n\nFocus on significant historical events, cultural heritage, or archaeological discoveries in Israel.`;
  } else if (topicName.includes('holocaust')) {
    prompt += `\n\nFocus on Holocaust remembrance, survival stories, or the journey toward establishing Israel.`;
  } else if (topicName.includes('iron') || topicName.includes('sword')) {
    prompt += `\n\nFocus on Israel's security challenges, defense innovations, or resilience in times of conflict.`;
  } else if (topicName.includes('society')) {
    prompt += `\n\nFocus on Israel's diverse society, multiculturalism, or unique social phenomena.`;
  } else if (topicName.includes('environment ') || topicName.includes('sword')) {
    prompt += `\n\nFocus on Israel's environment or sustainability challenges, Israeli innovations in sustainability.`;
  }
  
  return prompt;
}

// פונקציה להחזרת פוסט גנרי במקרה של כישלון מוחלט
function getFallbackPost(topicName: string): {text: string, requiredWords: string[]} {
  const formattedTopic = topicName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  const requiredWords = generateRequiredWords(topicName);
  
  return {
    text: `Let's discuss ${formattedTopic}! This is an important topic that affects many aspects of Israeli society and culture. What are your thoughts on this subject? I'd love to hear different perspectives on this.`,
    requiredWords: requiredWords
  };
}

// Helper function to generate required words based on topic
function generateRequiredWords(topicName: string): string[] {
  const commonWords = ["culture", "perspective", "community", "society", "tradition"];
  const topicWords = topicName.split('-').filter(word => word.length > 3);
  
  // Combine topic-specific words with common words
  const combinedWords = [...topicWords, ...commonWords];
  
  // Shuffle and select 5 words
  return shuffleArray(combinedWords).slice(0, 5);
}

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { topicName: string } }
) {
  console.log('POST /api/create-post - Request received');
  
  try {
    // קבלת שם הנושא מפרמטרי ה-URL
    const topicName = decodeURIComponent(params.topicName);
    console.log(`Creating post for topic: ${topicName}`);
    
    // אימות המשתמש
    const authResult = await verifyAuth(request);
    if (!authResult.isValid) {
      console.log('POST /api/create-post - Unauthorized request');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // קבלת טוקן האימות מההדר
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      console.error('No token found in Authorization header');
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }
    
    // קבלת רמת האנגלית של המשתמש
    let englishLevel = 'intermediate'; // ברירת מחדל
    try {
      englishLevel = await getUserEnglishLevel(token);
    } catch (error) {
      console.error('Error getting user English level:', error);
      // המשך עם ברירת המחדל במקרה של שגיאה
    }
    
    // קבלת המילים שהמשתמש למד
    let learnedWords: string[] = [];
    try {
      learnedWords = await getUserLearnedWords(token, topicName);
    } catch (error) {
      console.error('Error getting learned words:', error);
      // המשך עם מערך ריק במקרה של שגיאה
    }
    
    // נסיון לקבל פוסט מה-API של הבקנד
    const shouldTryBackendAPI = API_URL && API_URL !== 'http://localhost:5000';
    
    if (shouldTryBackendAPI) {
      try {
        console.log(`Attempting to get post from backend API at: ${API_URL}`);
        
        // ניתוח גוף הבקשה או שימוש באובייקט ריק במקרה של כישלון
        const body = await request.json().catch(() => ({}));
        
        // העברת הבקשה ל-API של הבקנד
        const response = await fetch(`${API_URL}/api/post/create/${encodeURIComponent(topicName)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...body,
            englishLevel,
            learnedWords
          })
        });
        
        // אם התגובה מה-API הצליחה, החזר את הנתונים
        if (response.ok) {
          const data = await response.json();
          console.log('Successfully retrieved post from API');
          return NextResponse.json(data);
        } else {
          console.log(`API responded with status ${response.status}, trying OpenAI instead`);
        }
      } catch (apiError) {
        console.error("Error connecting to backend API:", apiError);
        // המשך ליצירת פוסט עם OpenAI אם ה-API נכשל
      }
    }
    
    // בדיקה אם OpenAI API מוגדר
    if (!process.env.AZURE_OPENAI_API_KEY) {
      console.error('AZURE_OPENAI_API_KEY environment variable is not set');
      return NextResponse.json({ error: "Azure OpenAI API key is not configured" }, { status: 500 });
    }
    
    
    // יצירת פוסט באמצעות OpenAI
try {
  console.log('Generating post using OpenAI');
  const generatedPost = await generatePost(topicName, englishLevel, learnedWords);
  return NextResponse.json(generatedPost);
} catch (openaiError) {
  console.error("OpenAI generation error:", openaiError);
  
  // Return a fallback post instead of an error
  return NextResponse.json(getFallbackPost(params.topicName));
}
    
  } catch (error: any) {
    console.error("Error in create-post API route:", error);
    
    // במקרה של שגיאה כללית, החזר פוסט גנרי
    return NextResponse.json(
      getFallbackPost(params.topicName), 
      { status: 200 }
    );
  }
}