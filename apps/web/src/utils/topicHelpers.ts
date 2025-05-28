// Helper functions for extracting and generating topic words
//apps/web/src/utils/topicHelpers.ts
/**
 * Extract important words from post content
 * @param text The post content to analyze
 * @returns Array of important words
 */
export const extractImportantWords = (text: string): string[] => {
  // Remove common words and articles
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 
                    'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 
                    'did', 'will', 'would', 'should', 'can', 'could', 'of', 'from', 'this', 'that', 'these', 'those'];
  
  // Split into words, convert to lowercase, and filter
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && // Only words longer than 3 characters
      !stopWords.includes(word) // Not a stop word
    );
  
  // Count occurrences of each word
  const wordCounts: Record<string, number> = {};
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }
  
  // Sort by frequency
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
};

/**
 * Generate topic-related words
 * @param topicName The name of the topic
 * @returns Array of topic-related words
 */
export const generateTopicWords = (topicName: string): string[] => {
  const cleanTopicName = topicName.replace(/-/g, ' ');
  const topicWords = cleanTopicName.split(' ').filter(word => word.length > 2);
  
  // Add related words based on the topic
  let relatedWords: string[] = [];
  
  // Add topic-specific words
  if (cleanTopicName.includes('diplomacy') || cleanTopicName.includes('relation')) {
    relatedWords = ['international', 'negotiation', 'treaty', 'agreement', 'peace', 'allies', 'cooperation', 'mediation'];
  } else if (cleanTopicName.includes('economy') || cleanTopicName.includes('entrepreneur')) {
    relatedWords = ['business', 'market', 'innovation', 'startup', 'investment', 'growth', 'industry', 'commerce'];
  } else if (cleanTopicName.includes('innovation') || cleanTopicName.includes('technology')) {
    relatedWords = ['digital', 'research', 'development', 'startup', 'advancement', 'science', 'progress', 'future'];
  } else if (cleanTopicName.includes('history') || cleanTopicName.includes('heritage')) {
    relatedWords = ['legacy', 'tradition', 'culture', 'ancient', 'historic', 'civilization', 'preservation', 'roots'];
  } else if (cleanTopicName.includes('holocaust') || cleanTopicName.includes('revival')) {
    relatedWords = ['memory', 'survival', 'resilience', 'commemoration', 'trauma', 'healing', 'testimony', 'legacy'];
  } else if (cleanTopicName.includes('society') || cleanTopicName.includes('culture')) {
    relatedWords = ['community', 'traditions', 'values', 'heritage', 'diversity', 'identity', 'customs', 'practices'];
  } else {
    // Default words for any topic
    relatedWords = ['israel', 'israeli', 'jewish', 'society', 'community', 'culture', 'development', 'perspective'];
  }
  
  // Combine topic words with related words, removing duplicates
  return Array.from(new Set([...topicWords, ...relatedWords]));
};

/**
 * Create a default post for a given topic
 * @param topicName The name of the topic
 * @returns A default post text
 */
export const createFallbackPost = (topicName: string): string => {
  const cleanTopicName = topicName.replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return `Today I want to discuss ${cleanTopicName}, which is a fascinating aspect of Israeli society and culture.

What do you find most interesting about ${cleanTopicName}? 

How has ${cleanTopicName} evolved over the years in Israel?`;
}; 