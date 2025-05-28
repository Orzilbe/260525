// apps/web/src/app/api/words/route.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSafeDbPool } from '../../lib/db';
import { generateWords } from '../services/openai';
import { saveWords } from '../services/wordService';
import { formatTopicNameForDb, formatTopicNameForUrl, areTopicNamesEquivalent } from '../../lib/topicUtils';
import { getSmartFilteredWords } from '../../services/getFilteredWords';

/**
 * Function to extract user ID from token
 */
function getUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as any;
    return decoded.userId || decoded.id || null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Function to get a random subset of words
 * @param words Array of words to sample from
 * @param randomLimit Number of words to return or null for default behavior (5-7 words)
 * @returns A random subset of words
 */
function getRandomSubset(words: any[], randomLimit: number | null = null): any[] {
  if (!words || words.length === 0) return [];
  
  // If no randomLimit specified, use a random number between 5-7
  const limit = randomLimit ?? (Math.floor(Math.random() * 3) + 5);
  
  // If we have fewer words than the limit, return all words
  if (words.length <= limit) return words;
  
  // Shuffle the array using Fisher-Yates algorithm
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Return the first 'limit' elements
  return shuffled.slice(0, limit);
}

/**
 * Function to verify the user from request
 */
async function verifyAuth(request: NextRequest): Promise<{ isValid: boolean; userId: string; englishLevel: string }> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  
  if (!token) {
    return { isValid: false, userId: '', englishLevel: 'intermediate' };
  }
  
  const userId = getUserIdFromToken(token);
  
  // Get user's English level
  let englishLevel = 'intermediate'; // Default
  
  if (userId) {
    try {
      const pool = await getSafeDbPool();
      if (pool) {
        const [rows] = await pool.query(
          'SELECT EnglishLevel FROM Users WHERE UserId = ?',
          [userId]
        );
        
        if (Array.isArray(rows) && rows.length > 0 && (rows[0] as any).EnglishLevel) {
          englishLevel = (rows[0] as any).EnglishLevel;
        }
      }
    } catch (error) {
      console.error('Error getting user English level:', error);
    }
  }
  
  return { isValid: !!userId, userId: userId || '', englishLevel };
}

/**
 * GET /api/words - Get words by topic and English level
 */
// /api/words/route.ts handler for GET
export async function GET(request: NextRequest) {
  console.log("[Request timestamp] GET /api/words request received");
  
  try {
    // Authenticate user and get English level
    const authResult = await verifyAuth(request);
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    let topic = searchParams.get('topic');
    
    // Get level from query params as a fallback
    const rawLevel = searchParams.get('level') || 'advanced';
    let level: string;
    
    // Prioritize the user's English level from the database if they are authenticated
    if (authResult.isValid) {
      level = authResult.englishLevel;
      console.log(`Using authenticated user's English level from database: ${level}`);
    } else {
      // User is not authenticated or no level in database, use the query parameter
      console.error('Authentication failed or no level in database, using query parameter');
      
      // Map numeric level to appropriate EnglishLevel
      if (/^\d+$/.test(rawLevel)) {
        const levelNum = parseInt(rawLevel, 10);
        switch (levelNum) {
          case 1:
            level = 'beginner';
            break;
          case 2:
            level = 'intermediate';
            break;
          case 3:
          default:
            level = 'advanced';
            break;
        }
      } else {
        // Normalize string level
        const normalizedLevel = rawLevel.toLowerCase();
        if (['beginner', 'intermediate', 'advanced'].includes(normalizedLevel)) {
          level = normalizedLevel;
        } else {
          level = 'intermediate'; // Default for invalid strings
        }
      }
      
      console.log(`Mapped level parameter "${rawLevel}" to EnglishLevel value: "${level}"`);
    }
    
    // Get randomLimit parameter if provided
    let randomLimit: number | null = null;
    const rawRandomLimit = searchParams.get('randomLimit');
    if (rawRandomLimit) {
      const parsedLimit = parseInt(rawRandomLimit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        randomLimit = parsedLimit;
        console.log(`Using specified randomLimit: ${randomLimit}`);
      } else {
        console.warn(`Invalid randomLimit value: ${rawRandomLimit}, using default random range (5-7)`);
      }
    }
    
    const filterLearned = searchParams.has('filterLearned') ? searchParams.get('filterLearned') === 'true' : true; // Default to true
    
    console.log(`User authenticated: ${authResult.userId}, English level: ${level}, Filter learned: ${filterLearned}`);
    
    if (topic) {
      // Format the topic name consistently for the database
      const urlTopicName = topic;
      const dbTopicName = formatTopicNameForDb(topic);
      
      console.log(`Topic name formats - URL: "${urlTopicName}", DB: "${dbTopicName}"`);
      
      try {
        // If filtering is enabled, use our smart filtering function
        if (filterLearned) {
          console.log('Using smart filtering to get words the user has not learned yet');
          
          const filteredWords = await getSmartFilteredWords(
            authResult.userId,
            dbTopicName,
            level,
            randomLimit ? Math.max(randomLimit * 2, 20) : 20 // Get more words than needed for random selection
          );
          
          if (filteredWords.length > 0) {
            console.log(`Retrieved ${filteredWords.length} filtered words for the user`);
            
            // Ensure all words have consistent topic name format
            const normalizedWords = filteredWords.map(word => ({
              ...word,
              TopicName: dbTopicName // Ensure consistent format
            }));
            
            // Apply random selection if randomLimit is specified
            const selectedWords = randomLimit || randomLimit === 0 ? 
              getRandomSubset(normalizedWords, randomLimit) : normalizedWords;
            
            console.log(`Returning ${selectedWords.length} randomly selected words from ${normalizedWords.length} available`);
            return NextResponse.json(selectedWords);
          }
          
          // If no filtered words were found, fall back to generating new words
          console.log('No filtered words found, falling back to word generation');
        } else {
          console.log('Filtering disabled, attempting to fetch all words from backend API...');
          
          // First try with DB format topic name
          const pool = await getSafeDbPool();
          if (!pool) {
            console.error('Database connection not available');
            return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
          }
          
          // Fetch more words than needed for random selection
          const fetchLimit = randomLimit ? Math.max(randomLimit * 2, 20) : 20;
          
          // Query for words with DB format topic name
          const [dbTopicRows] = await pool.query(
            `SELECT * FROM Words 
             WHERE TopicName = ? AND EnglishLevel = ?
             ORDER BY RAND() LIMIT ?`,
            [dbTopicName, level, fetchLimit]
          );
          
          if (Array.isArray(dbTopicRows) && dbTopicRows.length > 0) {
            console.log(`Retrieved ${dbTopicRows.length} words using DB format topic name`);
            
            // Ensure all words have consistent topic name format
            const normalizedWords = (dbTopicRows as any[]).map(word => ({
              ...word,
              TopicName: dbTopicName // Ensure consistent format
            }));
            
            // Apply random selection if randomLimit is specified
            const selectedWords = randomLimit || randomLimit === 0 ? 
              getRandomSubset(normalizedWords, randomLimit) : normalizedWords;
            
            console.log(`Returning ${selectedWords.length} randomly selected words from ${normalizedWords.length} available`);
            return NextResponse.json(selectedWords);
          }
          
          // If no words found with DB format, try URL format
          console.log('No words found with DB format, trying URL format');
          const [urlTopicRows] = await pool.query(
            `SELECT * FROM Words 
             WHERE TopicName = ? AND EnglishLevel = ?
             ORDER BY RAND() LIMIT ?`,
            [urlTopicName, level, fetchLimit]
          );
          
          if (Array.isArray(urlTopicRows) && urlTopicRows.length > 0) {
            console.log(`Retrieved ${urlTopicRows.length} words using URL format topic name`);
            
            // Normalize to DB format
            const normalizedWords = (urlTopicRows as any[]).map(word => ({
              ...word,
              TopicName: dbTopicName // Ensure consistent format
            }));
            
            // Apply random selection if randomLimit is specified
            const selectedWords = randomLimit || randomLimit === 0 ? 
              getRandomSubset(normalizedWords, randomLimit) : normalizedWords;
            
            console.log(`Returning ${selectedWords.length} randomly selected words from ${normalizedWords.length} available`);
            return NextResponse.json(selectedWords);
          }
          
          // Try to find topic by normalized name
          console.log('No words found with specific formats, trying with normalized comparison');
          const [allTopicRows] = await pool.query(
            `SELECT * FROM Words WHERE EnglishLevel = ? ORDER BY RAND() LIMIT ?`,
            [level, 50] // Get more for matching
          );
          
          if (Array.isArray(allTopicRows)) {
            // Filter for words with equivalent topic names
            const matchingWords = (allTopicRows as any[]).filter(word => 
              word.TopicName && areTopicNamesEquivalent(word.TopicName, topic || '')
            );
            
            if (matchingWords.length > 0) {
              console.log(`Found ${matchingWords.length} words with equivalent topic names`);
              
              // Normalize to DB format
              const normalizedWords = matchingWords.map(word => ({
                ...word,
                TopicName: dbTopicName // Ensure consistent format
              }));
              
              // Apply random selection if randomLimit is specified
              const selectedWords = randomLimit || randomLimit === 0 ? 
                getRandomSubset(normalizedWords, randomLimit) : normalizedWords;
              
              console.log(`Returning ${selectedWords.length} randomly selected words from ${normalizedWords.length} available`);
              return NextResponse.json(selectedWords);
            }
          }
        }
        
        // If still no words found, generate new ones
        console.log('No words found in database, generating new words');
        console.log(`Generating words for topic: ${dbTopicName}, level: ${level}`);
        
        // Use your existing word generation logic here
        const generatedWords = await generateWords(level, dbTopicName);
        
        if (generatedWords && generatedWords.length > 0) {
          console.log(`Successfully generated ${generatedWords.length} words`);
          
          // Save the generated words with consistent topic name format
          const wordsToSave = generatedWords.map(word => ({
            ...word,
            TopicName: dbTopicName, // Use DB format for consistency
            EnglishLevel: level
          }));
          
          await saveWords(wordsToSave);
          console.log(`Saved ${wordsToSave.length} generated words to database`);
          
          // Apply random selection if randomLimit is specified
          const selectedWords = randomLimit || randomLimit === 0 ? 
            getRandomSubset(wordsToSave, randomLimit) : wordsToSave;
          
          console.log(`Returning ${selectedWords.length} randomly selected words from ${wordsToSave.length} available`);
          return NextResponse.json(selectedWords);
        } else {
          console.error('Failed to generate words');
          return NextResponse.json({ error: 'Failed to generate words' }, { status: 500 });
        }
      } catch (error) {
        console.error('Error fetching or generating words:', error);
        return NextResponse.json({ error: 'Failed to fetch words' }, { status: 500 });
      }
    } else {
      // If no topic specified, return all words for the user
      console.log('No topic specified, returning all words for user');
      
      const pool = await getSafeDbPool();
      if (!pool) {
        console.error('Database connection not available');
        return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
      }
      
      const fetchLimit = randomLimit ? Math.max(randomLimit * 2, 50) : 50;
      
      const [allWords] = await pool.query(
        `SELECT * FROM Words WHERE EnglishLevel = ? ORDER BY RAND() LIMIT ?`,
        [level, fetchLimit]
      );
      
      // Apply random selection if randomLimit is specified
      if (Array.isArray(allWords)) {
        const selectedWords = randomLimit || randomLimit === 0 ? 
          getRandomSubset(allWords as any[], randomLimit) : allWords;
        
        console.log(`Returning ${selectedWords.length} randomly selected words from ${(allWords as any[]).length} available`);
        return NextResponse.json(selectedWords);
      }
      
      return NextResponse.json(allWords);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}