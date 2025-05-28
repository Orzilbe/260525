// apps/web/src/app/api/analyze-conversation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AzureOpenAI } from 'openai';
import jwt from 'jsonwebtoken';

// Initialize Azure OpenAI
const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiVersion: "2024-04-01-preview"
});

// API URL for the backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface MessageInput {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationInput {
  text: string;
  topic: string;
  formattedTopic: string;
  level: string; // Changed from englishLevel to level
  learnedWords: string[];
  requiredWords: string[];
  postContent: string;
  previousMessages: MessageInput[];
}

interface WordUsage {
  word: string;
  used: boolean;
  context?: string;
}

interface ConversationResponse {
  text: string;
  feedback: string;
  usedWords: WordUsage[];
  nextQuestion: string;
  score: number;
}

// Function to validate auth token
function validateToken(token: string): { isValid: boolean; userId: string } {
  try {
    const secret = process.env.JWT_SECRET || 'default_secret';
    const decoded = jwt.verify(token, secret) as any;
    const userId = decoded.id || decoded.userId || decoded.sub;
    
    return { isValid: !!userId, userId: userId || '' };
  } catch (error) {
    console.error('Error validating token:', error);
    return { isValid: false, userId: '' };
  }
}

export async function POST(request: NextRequest) {
  // Check if API key is available
  if (!process.env.AZURE_OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Azure OpenAI API key is missing" },
      { status: 500 }
    );
  }
  
  try {
    // Get authorization token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const authResult = validateToken(token);
    
    if (!authResult.isValid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    // Parse the request body
    const body: ConversationInput = await request.json();
    const { 
      text, 
      topic, 
      formattedTopic, 
      level, 
      learnedWords, 
      requiredWords, 
      postContent, 
      previousMessages 
    } = body;
    
    // Validate inputs
    if (!text) {
      return NextResponse.json(
        { error: "No text provided for analysis" },
        { status: 400 }
      );
    }
    
    // Try to use the backend API first
    try {
      const apiResponse = await fetch(`${API_URL}/api/conversation/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        return NextResponse.json(data);
      }
    } catch (apiError) {
      console.error("Error connecting to backend API:", apiError);
      // Continue to OpenAI generation if API fails
    }
    
    // If API call failed, use Azure OpenAI directly
    // Format conversation history for the Azure OpenAI call
    const messages = [
      {
        role: "system",
        content: generateSystemPrompt(level, topic, formattedTopic, learnedWords, requiredWords, postContent)
      },
      // Include previous conversation
      ...previousMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      // Add the current user message
      {
        role: "user",
        content: text
      }
    ];

    // Make the Azure OpenAI API call
    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
      messages: messages as any[],
      temperature: 0.7,
      max_tokens: 650,
      response_format: { type: "json_object" }
    });

    // Parse the response
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("Empty response from Azure OpenAI");
    }

    // Parse JSON from the response
    let responseData: ConversationResponse;
    try {
      responseData = JSON.parse(responseContent);
      
      // Ensure all required fields are present
      responseData.text = responseData.text || "I understand what you're saying.";
      responseData.feedback = responseData.feedback || "Good effort! Keep practicing.";
      responseData.nextQuestion = responseData.nextQuestion || `Can you tell me more about ${formattedTopic}?`;
      responseData.score = responseData.score || 70;
      responseData.usedWords = responseData.usedWords || [];

      // Make sure usedWords contains all requiredWords
      const includedWords = new Set(responseData.usedWords.map(w => w.word));
      for (const word of requiredWords) {
        if (!includedWords.has(word)) {
          responseData.usedWords.push({
            word,
            used: text.toLowerCase().includes(word.toLowerCase()),
            context: text.toLowerCase().includes(word.toLowerCase()) ? 
              `Found "${word}" in your response` : undefined
          });
        }
      }
    } catch (error) {
      console.error("Error parsing Azure OpenAI JSON response:", error);
      // Fallback response if JSON parsing fails
      responseData = {
        text: "I understand what you're saying.",
        feedback: "Good effort! Keep practicing your English.",
        usedWords: requiredWords.map(word => ({
          word,
          used: text.toLowerCase().includes(word.toLowerCase()),
          context: text.toLowerCase().includes(word.toLowerCase()) ? 
            `Found "${word}" in your response` : undefined
        })),
        nextQuestion: `Can you tell me more about your thoughts on ${formattedTopic}?`,
        score: 70
      };
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("Error in analyze-conversation API:", error);
    return NextResponse.json(
      { 
        error: "Failed to analyze conversation",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Generate system prompt based on user context
function generateSystemPrompt(
  englishLevel: string, 
  topic: string, 
  formattedTopic: string,
  learnedWords: string[], 
  requiredWords: string[],
  postContent: string
): string {
  // Adjust difficulty based on English level
  let difficultyLevel = "";
  switch(englishLevel.toLowerCase()) {
    case "beginner":
      difficultyLevel = "Use simple vocabulary and short sentences. Speak slowly and clearly. Provide basic feedback focusing on encouragement.";
      break;
    case "advanced":
      difficultyLevel = "Use advanced vocabulary and complex sentence structures. Provide detailed language feedback including grammar and pronunciation suggestions.";
      break;
    case "intermediate":
    default:
      difficultyLevel = "Balance vocabulary difficulty. Mix simple and more complex sentences. Provide moderate feedback on language use.";
      break;
  }

  // Create topic-specific content guidance
  let topicGuidance = "";
  if (topic.includes('diplomacy')) {
    topicGuidance = "Focus on international relations, diplomatic achievements, peace processes, and Israeli foreign policy.";
  } else if (topic.includes('economy')) {
    topicGuidance = "Focus on Israeli economic innovations, startup ecosystem, financial development, and entrepreneurship.";
  } else if (topic.includes('innovation')) {
    topicGuidance = "Focus on technological breakthroughs, scientific research, Israeli innovations, and startup success stories.";
  } else if (topic.includes('history')) {
    topicGuidance = "Focus on significant historical events, Israeli heritage, archaeological discoveries, and cultural development.";
  } else if (topic.includes('holocaust')) {
    topicGuidance = "Focus on remembrance, resilience, survival stories, and the establishment of Israel after the Holocaust.";
  } else if (topic.includes('iron') || topic.includes('sword')) {
    topicGuidance = "Focus on security challenges, defense strategies, and Israel's efforts to protect its citizens.";
  } else if (topic.includes('society')) {
    topicGuidance = "Focus on Israel's diverse society, cultural integration, community values, and social developments.";
  } else {
    topicGuidance = `Focus on aspects of ${formattedTopic} that are relevant to Israel and its people.`;
  }

  // Words to encourage usage
  const wordsList = Array.from(new Set([...requiredWords, ...learnedWords.slice(0, 5)])).join(", ");

  // Build the complete prompt
  return `You are an AI English conversation partner specializing in helping users practice English speaking about Israeli topics.
  
Current topic: ${formattedTopic}

User English level: ${englishLevel}
${difficultyLevel}

Topic guidance: ${topicGuidance}

The user recently read this social media post:
"""
${postContent}
"""

Please encourage the use of these words in the conversation: ${wordsList}

When responding to the user:
1. Provide a natural conversational response (text)
2. Give concise, helpful feedback on their English (feedback)
3. Check if they used any of the required words (usedWords)
4. Generate a follow-up question to continue the conversation (nextQuestion)
5. Score their response from 0-100 based on:
   - Relevance to the topic (30%)
   - Grammatical accuracy (30%)
   - Vocabulary usage, especially required words (40%)

Your response must be in JSON format with these fields:
{
  "text": "Your natural conversational response",
  "feedback": "Brief language feedback focusing on positive aspects and one area to improve",
  "usedWords": [
    {
      "word": "required word",
      "used": true/false,
      "context": "sentence excerpt showing how the word was used (if used)"
    }
  ],
  "nextQuestion": "Follow-up question to continue the conversation",
  "score": 75
}

Keep your responses conversational, encouraging, and focused on helping the user improve their English speaking skills.`;
}