// Helper functions for extracting and generating topic words

/**
 * Extract important words from post content
 * @param postContent The post content to analyze
 * @returns Array of important words
 */
const extractImportantWords = (postContent: string): string[] => {
  // Remove emojis, special characters, and convert to lowercase
  const cleanedText = postContent
    .replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, ' ')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase();
  
  // Split into words
  const words = cleanedText.split(/\s+/).filter(word => word.length > 0);
  
  // Remove common stop words
  const stopWords = new Set([
    'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may',
    'might', 'must', 'about', 'you', 'your', 'i', 'me', 'my', 'we', 'our',
    'they', 'their', 'it', 'its', 'this', 'that', 'these', 'those',
    'from', 'as', 'if', 'then', 'than', 'so', 'what', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'too', 'very'
  ]);
  
  // Filter out stop words and count word frequencies
  const wordCounts = words
    .filter(word => !stopWords.has(word) && word.length > 3)
    .reduce((counts, word) => {
      counts[word] = (counts[word] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  
  // Sort words by frequency (most frequent first)
  const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
  
  // Return up to 10 most frequent words
  return sortedWords.slice(0, 10);
};

/**
 * Generate topic-specific words
 * @param topicName The topic name
 * @returns Array of topic-specific words
 */
const generateTopicWords = (topicName: string): string[] => {
  const lowerTopic = topicName.toLowerCase();
  
  if (lowerTopic.includes('diplomacy')) {
    return ['diplomacy', 'peace', 'negotiation', 'agreement', 'international'];
  } else if (lowerTopic.includes('economy')) {
    return ['startup', 'innovation', 'entrepreneur', 'investment', 'technology'];
  } else if (lowerTopic.includes('innovation')) {
    return ['technology', 'startup', 'innovation', 'research', 'development'];
  } else if (lowerTopic.includes('history')) {
    return ['heritage', 'tradition', 'ancient', 'archaeological', 'civilization'];
  } else if (lowerTopic.includes('holocaust')) {
    return ['remembrance', 'survivor', 'memorial', 'testimony', 'resilience'];
  } else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
    return ['security', 'defense', 'protection', 'resilience', 'strength'];
  } else if (lowerTopic.includes('society')) {
    return ['diversity', 'culture', 'community', 'tradition', 'integration'];
  }
  
  // Default words
  return ['culture', 'heritage', 'innovation', 'community', 'tradition'];
};

/**
 * Create a fallback post for a topic
 * @param topicName The topic name
 * @returns Fallback post content
 */
const createFallbackPost = (topicName: string): string => {
  const formattedTopic = topicName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  if (topicName.includes('society')) {
    return `🌍 🕊️ 🏙️ 🎭\n\nIsraeli society celebrates diversity while honoring traditions. Our communities blend various cultural identities into a vibrant national character. The integration of multiple perspectives makes Israel unique.\n\nWhat aspects of Israeli society do you find most fascinating? Have you experienced the cultural diversity of Israel firsthand?`;
  } else if (topicName.includes('innovation')) {
    return `💡 🔬 🚀 💻\n\nIsraeli innovation is changing the world! Research centers across the country develop solutions for global challenges. The future of technology is being shaped by Israeli minds working on everything from cybersecurity to medical breakthroughs.\n\nWhat Israeli innovation has impacted your life? Which area of technology do you think will see the next big Israeli breakthrough?`;
  } else if (topicName.includes('history')) {
    return `🏛️ 📜 🕍 🏺\n\nIsrael's rich heritage spans thousands of years, connecting ancient traditions with modern life. Archaeological discoveries continue to reveal fascinating insights about our past. Each historic site tells a story of resilience and cultural preservation.\n\nWhat period of Israeli history interests you most? Have you visited any historical sites in Israel?`;
  } else {
    return `🌟 🔍 🌐 ✨\n\n${formattedTopic} represents an important aspect of Israel's development. Our community continues to explore new perspectives on this topic as we build toward the future.\n\nWhat are your thoughts about ${formattedTopic} in Israel today? How do you see it evolving in the coming years?`;
  }
};

export { extractImportantWords, generateTopicWords, createFallbackPost }; 