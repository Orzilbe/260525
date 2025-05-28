/**
 * Utility functions for consistent topic name formatting
 */

/**
 * Convert a URL-style topic name (with hyphens) to database format (with spaces and capitalization)
 * Example: "holocaust-and-revival" -> "Holocaust And Revival"
 * @param urlTopicName Topic name in URL format
 * @returns Topic name in database format
 */
export function formatTopicNameForDb(urlTopicName: string): string {
    // Handle case where the input is already in DB format
    if (urlTopicName.includes(' ') && /[A-Z]/.test(urlTopicName)) {
      return urlTopicName;
    }
    
    return urlTopicName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Convert a database-style topic name (with spaces) to URL format (with hyphens)
   * Example: "Holocaust And Revival" -> "holocaust-and-revival"
   * @param dbTopicName Topic name in database format
   * @returns Topic name in URL format
   */
  export function formatTopicNameForUrl(dbTopicName: string): string {
    // Handle case where the input is already in URL format
    if (dbTopicName.includes('-') && !/[A-Z]/.test(dbTopicName)) {
      return dbTopicName;
    }
    
    return dbTopicName
      .toLowerCase()
      .replace(/\s+/g, '-');
  }
  
  /**
   * Normalize topic name to a consistent format for comparison
   * @param topicName Any format of topic name
   * @returns Normalized topic name (lowercase, no spaces or hyphens)
   */
  export function normalizeTopicName(topicName: string): string {
    return topicName
      .toLowerCase()
      .replace(/[\s-]+/g, '');
  }
  
  /**
   * Determine whether two topic names refer to the same topic, regardless of format
   * @param topicName1 First topic name
   * @param topicName2 Second topic name
   * @returns Whether the topic names are equivalent
   */
  export function areTopicNamesEquivalent(topicName1: string, topicName2: string): boolean {
    return normalizeTopicName(topicName1) === normalizeTopicName(topicName2);
  }