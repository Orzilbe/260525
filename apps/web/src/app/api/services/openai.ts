// apps/web/src/app/services/openai.ts

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Log environment variables for debugging (redacted for security)
console.log('AZURE_OPENAI_ENDPOINT config:', process.env.AZURE_OPENAI_ENDPOINT ? 'Set (value hidden)' : 'Not set');
console.log('AZURE_OPENAI_API_KEY config:', process.env.AZURE_OPENAI_API_KEY ? 'Set (value hidden)' : 'Not set');
console.log('AZURE_OPENAI_DEPLOYMENT_NAME config:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);

// Create OpenAI client with Azure configuration
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || '',
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': '2023-12-01-preview' }, // גרסה עדכנית שתומכת ב-GPT-4o
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY || '' }
});

export interface GeneratedWord {
  WordId?: string;
  Word: string;
  Translation: string;
  ExampleUsage: string;
  TopicName?: string;
  EnglishLevel?: string;
}

/**
 * Generate words using OpenAI based on topic and English level
 */
export async function generateWords(englishLevel: string, topicName: string): Promise<GeneratedWord[]> {
  console.log(`Generating words for topic: ${topicName}, level: ${englishLevel}`);
  
  // Create a prompt based on the topic and level
  const prompt = createPromptForTopic(topicName, englishLevel);
  
  try {
    console.log('Making Azure OpenAI API request:');
    console.log('- Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('- Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
    
    // Send request to OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-35-turbo",
      messages: [
        { role: "system", content: "You are a precise language learning assistant creating vocabulary words." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    // Process the response
    const responseText = completion.choices[0].message?.content?.trim() || '';
    console.log('Azure OpenAI API response received successfully');
    
    // Parse the JSON response
    let wordsData;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      wordsData = JSON.parse(jsonString);
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      console.error('Raw response text:', responseText);
      return [];
    }
    
    // Convert to GeneratedWord format
    const generatedWords: GeneratedWord[] = wordsData.map((item: any) => ({
      WordId: uuidv4(),
      Word: item.word,
      Translation: item.translation,
      ExampleUsage: item.example || '',
      TopicName: topicName,
      EnglishLevel: englishLevel
    }));
    
    console.log(`Successfully generated ${generatedWords.length} words`);
    return generatedWords;
  } catch (error) {
    console.error('==== Error generating words with Azure OpenAI ====');
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Handle specific OpenAI errors
      if ('status' in (error as any)) {
        console.error('Status code:', (error as any).status);
      }
      
      if ('response' in (error as any) && (error as any).response) {
        const response = (error as any).response;
        console.error('Response status:', response.status);
        console.error('Response headers:', response.headers);
        console.error('Response data:', response.data);
      }
      
      // Check for common Azure OpenAI issues
      if (error.message.includes('Resource not found')) {
        console.error('DIAGNOSIS: The Azure OpenAI deployment name or endpoint may be incorrect');
        console.error('Check that the deployment name matches exactly what is in the Azure portal');
      } else if (error.message.includes('401')) {
        console.error('DIAGNOSIS: Authentication failed, check your API key');
      } else if (error.message.includes('429')) {
        console.error('DIAGNOSIS: Rate limit exceeded, consider implementing retry logic');
      }
    } else {
      console.error('Unknown error type:', error);
    }
    
    console.error('============================================');
    return [];
  }
}

/**
 * Create topic-specific prompt for OpenAI
 */
function createPromptForTopic(topicName: string, englishLevel: string): string {
  
  const basePrompt = `Generate 7 unique words related to ${topicName}, appropriate for ${englishLevel} level English learners.
    For each word, provide:
    1. An English word appropriate for ${englishLevel} level
    2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context
    3. A clear example sentence showing usage
     
    Respond as a JSON array with these fields:
    [{
      "word": "English word",
      "translation": "Hebrew translation",
      "example": "A clear example sentence using the word"
    }, ...]
    
    IMPORTANT: 
    - Ensure the difficulty matches ${englishLevel} level English learners
    - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context
    - Use natural, conversational example sentences
    - Use real, precise words (not phrases)`;
  
  // Add topic-specific guidance
  switch (topicName) {
    case "Society and Multiculturalism":
    case "Society And Multiculturalism":
      return `${basePrompt}
        
        Focus on:
        - Cultural diversity terms
        - Social integration concepts
        - Community and identity words
        - Collective living vocabulary
        - Cross-cultural communication`;
        
    case "Diplomacy and International Relations":
    case "Diplomacy And International Relations":
      return `${basePrompt}
        
        Focus on:
        - Diplomatic negotiations
        - International conflict resolution
        - Geopolitical strategies
        - Cross-cultural communication
        - Israeli diplomatic roles`;
        
    case "Economy and Entrepreneurship":
    case "Economy And Entrepreneurship":
      return `${basePrompt}
        
        Focus on:
        - Startup ecosystem
        - Economic innovation
        - Financial technologies
        - Entrepreneurial strategies
        - Business development`;
        
    case "Environment and Sustainability":
    case "Environment And Sustainability":
      return `${basePrompt}
        
        Focus on:
        - Environmental conservation
        - Climate change
        - Sustainable development
        - Environmental policies
        - Renewable energy`;
        
    case "Innovation and Technology":
    case "Innovation And Technology":
      return `${basePrompt}
        
        Focus on:
        - Technological breakthroughs
        - Digital innovation
        - AI and computing
        - Tech startups
        - Israeli innovation ecosystem`;
        
    case "History and Heritage":
    case "History And Heritage":
      return `${basePrompt}
        
        Focus on:
        - Historical events
        - Cultural heritage
        - Historical places
        - Historical figures
        - Jewish and Israeli history`;
        
    default:
      return basePrompt;
  }
}

export default {
  generateWords
};