//apps/web/src/app/topics/[topicName]/tasks/conversation/page.tsx
'use client';

import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { getAuthToken } from '../../../../../lib/auth';
import { useAuth } from '../../../../../hooks/useAuth';

// Polyfill AbortSignal.timeout for browsers that don't support it
if (!AbortSignal.timeout) {
  AbortSignal.timeout = function timeout(ms: number) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("TimeoutError", "TimeoutError")), ms);
    return controller.signal;
  };
}

// Add Web Speech API type declarations
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: any) => void;
  onend: () => void;
  onstart: () => void;
  onerror: (event: any) => void;
  onspeechstart: () => void;
  onspeechend: () => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface ConversationMessage {
  type: 'user' | 'ai' | 'feedback';
  content: string;
  feedback?: string;
  score?: number;
  corrections?: {
    pronunciation?: string[];
    grammar?: string[];
    suggestions?: string[];
  };
  isTemporary?: boolean;
}

interface WordUsage {
  word: string;
  used: boolean;
  context?: string;
}

interface FeedbackResponse {
  text: string;
  feedback: string;
  usedWords: WordUsage[];
  nextQuestion: string;
  score: number;
  corrections?: {
    pronunciation?: string[];
    grammar?: string[];
    suggestions?: string[];
  };
}

// הגדרה של פרופיל ברירת מחדל
const defaultUserProfile = {
  name: '',
  level: '',
  score: 0,
  completedTasks: 0
};

// Topic-specific response templates
const topicResponses: Record<string, { 
  phrases: string[],
  questions: string[],
  feedback: string[] 
}> = {
  'innovation': {
    phrases: [
      "That's an interesting perspective on technology innovation!",
      "I appreciate your thoughts on tech development.",
      "Your ideas about innovation are quite thought-provoking.",
      "That's a fascinating take on technological advancement!"
    ],
    questions: [
      "What specific technologies do you think will have the biggest impact in the next decade?",
      "How do you think Israeli innovations have changed everyday life?",
      "Can you think of any technological challenges we still need to solve?",
      "Do you believe AI will fundamentally change how we approach innovation?"
    ],
    feedback: [
      "Good use of technical vocabulary! Try expanding your answer with more details.",
      "You're expressing your ideas well. Try using more complex sentence structures.",
      "Nice job! Try incorporating more specific examples in your responses.",
      "Well articulated! Consider using more transition words to connect your ideas."
    ]
  },
  'economy': {
    phrases: [
      "That's an insightful analysis of economic factors!",
      "Your thoughts on business development are valuable.",
      "I appreciate your perspective on economic growth.",
      "That's a nuanced view of entrepreneurship!"
    ],
    questions: [
      "What do you think makes Israel's economy unique compared to other countries?",
      "How important do you think startups are to a country's economic growth?",
      "What economic challenges do you think Israel will face in the coming years?",
      "Do you believe digital currency will transform how we think about money?"
    ],
    feedback: [
      "Good use of economic terminology! Try expanding your ideas with examples.",
      "You're expressing complex ideas well. Consider using more comparative language.",
      "Nice explanation! Try incorporating more financial vocabulary in your responses.",
      "Well structured! Try using more cause-and-effect language in your analysis."
    ]
  },
  'diplomacy': {
    phrases: [
      "That's a thoughtful analysis of international relations!",
      "Your perspective on diplomacy is quite interesting.",
      "I appreciate your nuanced view on foreign policy.",
      "That's a compelling point about diplomatic strategies!"
    ],
    questions: [
      "How do you think Israel's diplomatic relationships have evolved over time?",
      "What role do you think technology plays in modern diplomacy?",
      "Which countries do you think Israel has the strongest relationships with?",
      "How important is cultural exchange in building international relationships?"
    ],
    feedback: [
      "Good use of diplomatic terminology! Try developing your ideas with specific examples.",
      "You're expressing complex ideas clearly. Consider exploring multiple perspectives.",
      "Nice analysis! Try using more formal language when discussing international relations.",
      "Well articulated! Consider the historical context in your diplomatic analysis."
    ]
  },
  'default': {
    phrases: [
      "That's an interesting perspective!",
      "I appreciate your thoughtful response.",
      "You've made some good points there.",
      "That's a fascinating take on the topic!"
    ],
    questions: [
      "Could you elaborate more on your thoughts about this topic?",
      "What aspects of this subject interest you the most?",
      "How do you think this topic relates to everyday life?",
      "Do you have any personal experiences related to this topic?"
    ],
    feedback: [
      "Good effort! Try expanding your vocabulary with more topic-specific terms.",
      "You're expressing your ideas well. Try using more complex sentence structures.",
      "Nice job! Try incorporating more specific examples in your responses.",
      "Well done! Consider organizing your thoughts with transition words."
    ]
  }
};

// Enhanced feedback generator with corrections and suggestions
const generateFeedbackResponse = (userInput: string, topicName: string, requiredWords: string[]): FeedbackResponse => {
  // Determine which topic template to use
  const topicKey = Object.keys(topicResponses).find(key => 
    topicName.toLowerCase().includes(key)
  ) || 'default';
  
  const templates = topicResponses[topicKey];
  
  // Generate response components
  const randomPhrase = templates.phrases[Math.floor(Math.random() * templates.phrases.length)];
  const randomQuestion = templates.questions[Math.floor(Math.random() * templates.questions.length)];
  const randomFeedback = templates.feedback[Math.floor(Math.random() * templates.feedback.length)];
  
  // Analyze user input for corrections
  const corrections = analyzeUserSpeech(userInput);
  
  // Create supportive feedback with corrections
  const lowerInput = userInput.toLowerCase();
  let customResponse = randomPhrase;
  
  // Make response more contextual
  if (lowerInput.includes('future') || lowerInput.includes('next') || lowerInput.includes('coming')) {
    customResponse = "Your thoughts about future developments are interesting! " + randomPhrase;
  } else if (lowerInput.includes('problem') || lowerInput.includes('challenge') || lowerInput.includes('difficult')) {
    customResponse = "You've highlighted some important challenges. " + randomPhrase;
  } else if (lowerInput.includes('benefit') || lowerInput.includes('advantage') || lowerInput.includes('positive')) {
    customResponse = "You've noted some significant benefits. " + randomPhrase;
  }
  
  // Include corrections in feedback in a supportive way
  let correctionsFeedback = '';
  if (corrections.pronunciation.length > 0) {
    correctionsFeedback += `Quick tip: ${corrections.pronunciation[0]} `;
  }
  if (corrections.grammar.length > 0) {
    correctionsFeedback += `You might also try: "${corrections.grammar[0]}" `;
  }
  if (corrections.suggestions.length > 0) {
    correctionsFeedback += `Consider using: ${corrections.suggestions[0]}. `;
  }
  
  // Include used word analysis in feedback
  const requiredWordsAnalysis = requiredWords
    .filter(word => lowerInput.includes(word.toLowerCase()))
    .map(word => `Great use of "${word}"!`)
    .join(' ');
  
  const enhancedFeedback = [
    correctionsFeedback,
    requiredWordsAnalysis,
    randomFeedback
  ].filter(Boolean).join(' ');
  
  // Calculate score with corrections impact
  let score = 70; // Base score
  
  // Adjust score based on response length
  if (userInput.length > 100) score += 10;
  if (userInput.length > 200) score += 5;
  
  // Adjust score based on correctness
  const errorCount = corrections.pronunciation.length + corrections.grammar.length;
  if (errorCount === 0) score += 15;
  else if (errorCount <= 2) score += 10;
  else if (errorCount <= 4) score += 5;
  
  // Adjust score based on required words usage
  const usedWordCount = requiredWords.filter(word => 
    lowerInput.includes(word.toLowerCase())
  ).length;
  
  if (usedWordCount > 0) {
    score += Math.min(15, usedWordCount * 5);
  }
  
  return {
    text: customResponse,
    feedback: enhancedFeedback,
    usedWords: requiredWords.map(word => ({
      word,
      used: lowerInput.includes(word.toLowerCase()),
      context: lowerInput.includes(word.toLowerCase()) 
        ? `Found "${word}" in your response` 
        : undefined
    })),
    nextQuestion: randomQuestion,
    score: Math.min(100, score),
    corrections: corrections
  };
};

// Enhanced speech analysis function
const analyzeUserSpeech = (userInput: string): {
  pronunciation: string[],
  grammar: string[],
  suggestions: string[]
} => {
  const corrections = {
    pronunciation: [] as string[],
    grammar: [] as string[],
    suggestions: [] as string[]
  };
  
  // Common pronunciation mistakes
  const pronunciationPatterns = [
    { pattern: /\bfink\b/gi, correction: 'fink → think (use "th" sound)' },
    { pattern: /\bdat\b/gi, correction: 'dat → that (use "th" sound)' },
    { pattern: /\bdey\b/gi, correction: 'dey → they (use "th" sound)' },
    { pattern: /\bdere\b/gi, correction: 'dere → there (use "th" sound)' },
    { pattern: /\bcant\b/gi, correction: 'cant → can\'t (don\'t forget the apostrophe)' },
    { pattern: /\bdont\b/gi, correction: 'dont → don\'t (don\'t forget the apostrophe)' },
  ];
  
  for (const { pattern, correction } of pronunciationPatterns) {
    if (pattern.test(userInput)) {
      corrections.pronunciation.push(correction);
    }
  }
  
  // Grammar checks
  const grammarPatterns = [
    { pattern: /\bi is\b/gi, correction: 'Consider "I am" instead of "I is"' },
    { pattern: /\bhe are\b|\bshe are\b|\bit are\b/gi, correction: 'Use "is" with he/she/it' },
    { pattern: /\bthey is\b|\bwe is\b|\byou is\b/gi, correction: 'Use "are" with they/we/you' },
    { pattern: /\bdid went\b|\bwas went\b/gi, correction: 'Use "went" without did/was' },
    { pattern: /\bmore better\b|\bmore good\b/gi, correction: 'Use "better" instead of "more good"' },
    { pattern: /\bvery much\b.*(?:like|love)\b/gi, correction: 'Consider "really like" or "love a lot"' },
  ];
  
  for (const { pattern, correction } of grammarPatterns) {
    if (pattern.test(userInput)) {
      corrections.grammar.push(correction);
    }
  }
  
  // Suggestions for better expression
  const words = userInput.toLowerCase().split(/\s+/);
  if (words.length < 5) {
    corrections.suggestions.push('Try expanding your answer with more details');
  }
  
  if (!userInput.match(/because|since|due to|therefore|however|although/i)) {
    corrections.suggestions.push('Consider using connecting words like "because" or "however"');
  }
  
  if (!userInput.match(/\?|!/)) {
    corrections.suggestions.push('You could add a question or exclamation to make it more engaging');
  }
  
  return corrections;
};

// Enhanced feedback rendering component
const FeedbackMessage: React.FC<{ corrections: any }> = ({ corrections }) => {
  if (!corrections || (!corrections.pronunciation?.length && !corrections.grammar?.length && !corrections.suggestions?.length)) {
    return null;
  }

  return (
    <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
      <p className="text-xs font-medium text-blue-800 mb-1">Learning Tip:</p>
      {corrections.pronunciation?.map((tip: string, idx: number) => (
        <p key={`p-${idx}`} className="text-xs text-blue-700">• {tip}</p>
      ))}
      {corrections.grammar?.map((tip: string, idx: number) => (
        <p key={`g-${idx}`} className="text-xs text-blue-700">• {tip}</p>
      ))}
      {corrections.suggestions?.map((tip: string, idx: number) => (
        <p key={`s-${idx}`} className="text-xs text-blue-700">• {tip}</p>
      ))}
    </div>
  );
};

// Helper function to apply corrections inline
const applyCorrectionHighlights = (text: string, corrections: any) => {
  if (!corrections || !corrections.pronunciation?.length) return text;
  
  let highlightedText = text;
  const patterns = [
    { pattern: /\bfink\b/gi, replacement: '<span class="bg-yellow-100">fink</span>' },
    { pattern: /\bdat\b/gi, replacement: '<span class="bg-yellow-100">dat</span>' },
    { pattern: /\bdey\b/gi, replacement: '<span class="bg-yellow-100">dey</span>' },
    { pattern: /\bdere\b/gi, replacement: '<span class="bg-yellow-100">dere</span>' },
  ];
  
  patterns.forEach(({ pattern, replacement }) => {
    highlightedText = highlightedText.replace(pattern, replacement);
  });
  
  return highlightedText;
};

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const topicName = params?.topicName as string;
  const level = searchParams?.get('level') || '1';
  const taskId = searchParams?.get('taskId');
  
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [learnedWords, setLearnedWords] = useState<string[]>([]);
  const [postContent, setPostContent] = useState('');
  const [requiredWords, setRequiredWords] = useState<string[]>([]);
  const [userProgress, setUserProgress] = useState({
    messagesExchanged: 0,
    correctWords: 0,
    averageScore: 0,
    totalScore: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // State variables for speech and conversation tracking
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [userTurn, setUserTurn] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  
  // State for session tracking
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [questionsCount, setQuestionsCount] = useState<number>(0);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const microphoneTimeoutRef = useRef<number | null>(null);
  const speechEndTimeoutRef = useRef<number | null>(null);
  const speakingUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);
  const inactivityTimeoutRef = useRef<number | null>(null);
  
  // New state for voice selection
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  
  // Initialize task when component mounts
  useEffect(() => {
    const initializeTask = async () => {
      if (!isAuthenticated) return;
      
      if (!taskId && topicName && level) {
        try {
          const token = getAuthToken();
          if (!token) {
            throw new Error('Authentication required');
          }

          // Check if we were redirected from a post task
          const previousTaskId = sessionStorage.getItem(`post_task_${topicName}_${level}`);
          
          console.log('Creating new conversation task, previous task ID:', previousTaskId);
          
          // Create a new conversation task
          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              TopicName: topicName,
              Level: level,
              TaskType: 'conversation'
            })
          });

          if (!response.ok) {
            throw new Error('Failed to create conversation task');
          }

          const data = await response.json();
          console.log('Created conversation task:', data);
          
          if (data.TaskId) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('taskId', data.TaskId);
            window.history.replaceState({}, '', newUrl.toString());
            
            sessionStorage.setItem(`task_start_${data.TaskId}`, Date.now().toString());
          }
        } catch (error) {
          console.error('Error creating conversation task:', error);
          setError('Failed to initialize conversation task');
        }
      } else if (taskId) {
        sessionStorage.setItem(`task_start_${taskId}`, Date.now().toString());
      }
    };

    initializeTask();
  }, [isAuthenticated, taskId, topicName, level]);

  // אתחול זיהוי דיבור וסינתזה קולית
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // אתחול זיהוי דיבור
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = false;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.lang = 'en-US';
          
          // כשזוהה דיבור סופי
          recognitionRef.current.onresult = (event: any) => {
            const lastResult = event.results[event.results.length - 1];
            if (lastResult.isFinal) {
              const transcript = lastResult[0].transcript.trim();
              
              // ADDED: Check if this might be the AI's own speech being detected
              if (transcript.length > 1) {
                // Check if this text closely matches what the AI just said
                const lastAIMessage = messages.find(m => m.type === 'ai')?.content || '';
                const similarity = calculateTextSimilarity(transcript, lastAIMessage);
                
                if (similarity > 0.7) {
                  console.log("Detected echo of AI's own speech, ignoring");
                  return; // Ignore this speech recognition result
                }
                
                console.log("Final transcript:", transcript);
                handleUserResponse(transcript);
              }
            }
          };
          
          const calculateTextSimilarity = (str1: string, str2: string): number => {
            // Convert texts to lowercase and remove punctuation
            const cleanStr1 = str1.toLowerCase().replace(/[^\w\s]/g, '');
            const cleanStr2 = str2.toLowerCase().replace(/[^\w\s]/g, '');
            
            // Get words (filtering out short words which might be common)
            const words1 = cleanStr1.split(/\s+/).filter(word => word.length > 2);
            const words2 = cleanStr2.split(/\s+/).filter(word => word.length > 2);
            
            if (words1.length === 0 || words2.length === 0) return 0;
            
            // Count matching substantial words
            let matchCount = 0;
            const shortestLength = Math.min(words1.length, words2.length);
            
            // If majority of the first N words match, it's likely an echo
            const checkLength = Math.min(6, shortestLength);
            let startingMatches = 0;
            
            for (let i = 0; i < checkLength; i++) {
              if (i < words1.length && i < words2.length && words1[i] === words2[i]) {
                startingMatches++;
              }
            }
            
            // If the beginning phrases match closely, it's an echo
            if (startingMatches >= 3 || (checkLength > 0 && startingMatches / checkLength >= 0.5)) {
              return 0.9; // High similarity for matching phrase starts
            }
            
            // Count overall matching words
            for (const word of words1) {
              if (words2.includes(word) && word.length > 3) {
                matchCount++;
              }
            }
            
            return matchCount / Math.max(words1.length, 1);
          };
          // התחלת האזנה
          recognitionRef.current.onstart = () => {
            console.log("Recognition started");
            setUserSpeaking(false);
          };
          
          // כשזוהה קול
          recognitionRef.current.onspeechstart = () => {
            console.log("Speech detected");
            setUserSpeaking(true);
            
            // Start tracking speech energy
            let speechEnergy = 0;
            let sampleCount = 0;
            
            // Simple energy calculation interval
            const energyInterval = setInterval(() => {
              // In a real implementation, this would access audio levels
              // For now, we'll use a timeout as a proxy
              sampleCount++;
              
              // After enough samples, decide if this is real speech
              if (sampleCount > 5) {
                clearInterval(energyInterval);
                
                // If this were a real implementation, we'd check if speechEnergy > threshold
                const isTrueSpeech = true; // Replace with actual logic
                
                if (!isTrueSpeech) {
                  console.log("False speech detection - likely echo");
                  setUserSpeaking(false);
                }
              }
            }, 100);
            
            // Clear any existing timeout
            if (speechEndTimeoutRef.current) {
              clearTimeout(speechEndTimeoutRef.current);
              speechEndTimeoutRef.current = null;
            }
          };
          // כשהקול נעלם
          recognitionRef.current.onspeechend = () => {
            console.log("Speech ended");
            
            // טיימר השהיה לפני קביעה סופית
            speechEndTimeoutRef.current = window.setTimeout(() => {
              setUserSpeaking(false);
              try {
                recognitionRef.current.stop();
              } catch (e) {
                console.log("Error stopping recognition", e);
              }
            }, 1000) as unknown as number;
          };
          
          // כשמנוע הזיהוי מסיים
          recognitionRef.current.onend = () => {
            console.log("Recognition ended");
            
            // אם עדיין תור המשתמש לדבר והוא לא אמר כלום, נפעיל מחדש
            if (userTurn && !userSpeaking) {
              console.log("Restarting recognition");
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.log("Error restarting recognition", e);
                
                // במקרה של שגיאה בהפעלה מחדש, ננסה שוב אחרי רגע
                setTimeout(() => {
                  if (userTurn) {
                    try {
                      recognitionRef.current.start();
                    } catch (err) {
                      console.log("Failed to restart recognition again", err);
                    }
                  }
                }, 500);
              }
            }
          };
          
          // טיפול בשגיאות
          recognitionRef.current.onerror = (event: any) => {
            console.error("Recognition error:", event.error);
            
            if (event.error === 'no-speech' && userTurn) {
              // אם לא זוהה דיבור והמיקרופון פעיל, נמשיך להאזין
              try {
                recognitionRef.current.stop();
                setTimeout(() => {
                  if (userTurn) {
                    try {
                      recognitionRef.current.start();
                      setMessages(prev => {
                        // נבדוק אם כבר יש תזכורת להתחיל לדבר
                        const hasReminder = prev.some(m => 
                          m.type === 'ai' && m.content.includes('waiting for your response')
                        );
                        
                        if (!hasReminder) {
                          return [...prev, {
                            type: 'ai',
                            content: "I'm waiting for your response. Please speak clearly when the microphone is active.",
                            feedback: "Microphone is listening"
                          }];
                        }
                        return prev;
                      });
                    } catch (err) {
                      console.log("Error restarting after no-speech", err);
                    }
                  }
                }, 300);
              } catch (e) {
                console.log("Error handling no-speech", e);
              }
            }
          };
        }
        
        // אתחול סינתזה קולית
        synthRef.current = window.speechSynthesis;
      } catch (err) {
        console.error("Error initializing speech APIs:", err);
        setError("Speech recognition not available in your browser");
      }
    }
    
    // ניקוי משאבים בסיום
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log("Error stopping recognition on cleanup", e);
        }
      }
      
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      
      // Clean up all timeouts
      [microphoneTimeoutRef.current, speechEndTimeoutRef.current, inactivityTimeoutRef.current].forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
    };
  }, []);

  // גלילה לתחתית ההודעות
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // מעקב ועיבוד הודעות ממתינות
  useEffect(() => {
    const processNextMessage = () => {
      if (pendingMessages.length > 0 && !aiSpeaking && isActive) {
        const nextMessage = pendingMessages[0];
        
        // הסרת ההודעה הנוכחית מהתור
        setPendingMessages(prev => prev.slice(1));
        
        // הפעלת הדיבור
        speakTextWithTracking(nextMessage, () => {
          // בסיום הדיבור, אם אין עוד הודעות בתור, נפעיל את המיקרופון
          if (pendingMessages.length <= 1 && isActive) {
            setTimeout(() => {
              setUserTurn(true);
              activateMicrophone();
            }, 500);
          }
        });
      }
    };

    processNextMessage();
  }, [pendingMessages, aiSpeaking, isActive]);

  // טעינת נתונים ראשוניים
  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAuthenticated || !topicName) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const token = getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }
        
        // Fetch learned words for this topic
        try {
          const learnedWordsResponse = await fetch(`/api/words/learned?topic=${encodeURIComponent(topicName)}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (learnedWordsResponse.ok) {
            const learnedData = await learnedWordsResponse.json();
            if (learnedData.data && Array.isArray(learnedData.data)) {
              const words = learnedData.data.map((word: any) => word.Word);
              setLearnedWords(words);
              console.log(`Found ${words.length} learned words for topic ${topicName}`);
              
              // Use learned words as required words if available
              if (words.length > 0) {
                const shuffled = [...words].sort(() => 0.5 - Math.random());
                setRequiredWords(shuffled.slice(0, Math.min(5, shuffled.length)));
              }
            }
          }
        } catch (learnedError) {
          console.error('Error fetching learned words:', learnedError);
        }
        
        // Load post content
        try {
          const postResponse = await fetch(`/api/create-post/${encodeURIComponent(topicName)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({})
          });
          
          if (postResponse.ok) {
            const postData = await postResponse.json();
            if (postData.text) {
              setPostContent(postData.text);
            }
            // Only set required words from post if we don't have learned words
            if (postData.requiredWords && Array.isArray(postData.requiredWords) && learnedWords.length === 0) {
              setRequiredWords(postData.requiredWords);
            }
          }
        } catch (err) {
          console.error('Error loading post content:', err);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error in loadInitialData:', err);
        setError('Failed to load initial data. Please try again.');
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, [isAuthenticated, topicName]);

  // פורמט שם הנושא להצגה
  const formatTopicName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // הדגשת מילים נדרשות בטקסט
  const highlightRequiredWords = (text: string) => {
    if (!text) return '';
    
    let highlightedText = text;
    requiredWords.forEach(word => {
      if (!word) return;
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `<span class="font-bold text-orange-600">${word}</span>`);
    });
    return highlightedText;
  };

  // פונקציה להפעלת המיקרופון עם חיווי ויזואלי
  const activateMicrophone = () => {
    if (!recognitionRef.current) return;
    
    // הפעלת האזנה
    try {
      console.log("Activating microphone");
      recognitionRef.current.start();
      
      // הוספת חיווי ויזואלי
      setMessages(prev => {
        // בדיקה אם כבר יש חיווי מיקרופון פעיל
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.type === 'ai' && lastMessage.content.includes('Microphone is active')) {
          return prev;
        }
        
        return [...prev, {
          type: 'ai',
          content: "🎤 Microphone is active. Please speak now.",
          feedback: "Your turn to speak"
        }];
      });
      
      // הגדרת טיימר לסגירת האזנה אם המשתמש לא מדבר
      if (microphoneTimeoutRef.current) {
        clearTimeout(microphoneTimeoutRef.current);
      }
      
      microphoneTimeoutRef.current = window.setTimeout(() => {
        if (userTurn && !userSpeaking) {
          // אם המשתמש לא התחיל לדבר תוך 20 שניות
          try {
            recognitionRef.current?.stop();
            setUserTurn(false);
          } catch (e) {
            console.log("Error stopping recognition on timeout", e);
          }
          
          const timeoutMessage = "I didn't hear your response. Let's move on to the next question.";
          
          setMessages(prev => [...prev, {
            type: 'ai',
            content: timeoutMessage
          }]);
          
          // הוספת הודעות לתור
          setPendingMessages(prev => [
            ...prev, 
            timeoutMessage, 
            "Let's try again. " + generateFirstQuestion()
          ]);
        }
      }, 20000) as unknown as number;
    } catch (e) {
      console.error("Could not start speech recognition:", e);
      setMessages(prev => [...prev, {
        type: 'ai',
        content: "I'm having trouble with the microphone. Please try refreshing the page.",
        feedback: "Microphone error"
      }]);
    }
  };

  // טיפול בתגובת המשתמש
  const handleUserResponse = async (transcript: string) => {
    setUserTurn(false);
    setUserSpeaking(false);
    
    // Reset the inactivity timer whenever user responds
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    // Set a new inactivity timer
    inactivityTimeoutRef.current = window.setTimeout(() => {
      // If user hasn't spoken for a while
      if (userTurn && isActive) {
        // Prompt the user
        const reminderMessage = "Are you still there? I'm waiting for your response.";
        setMessages(prev => [...prev, {
          type: 'ai',
          content: reminderMessage
        }]);
        
        // Add the reminder to speech queue
        setPendingMessages(prev => [...prev, reminderMessage]);
      }
    }, 30000) as unknown as number; // 30 seconds
    
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch (e) {
      console.log("Error stopping recognition after response", e);
    }
    
    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', content: transcript }]);

    try {
      // Show loading indicator
      setMessages(prev => [
        ...prev,
        { type: 'ai', content: '...', feedback: 'Analyzing your response...' }
      ]);

      // Process the response with the API
      const response = await analyzeResponse(transcript);
      
      // Add corrections as a temporary message if there are any
      if (response.corrections && 
        (Array.isArray(response.corrections.pronunciation) && response.corrections.pronunciation.length > 0 || 
         Array.isArray(response.corrections.grammar) && response.corrections.grammar.length > 0 || 
         Array.isArray(response.corrections.suggestions) && response.corrections.suggestions.length > 0)) {
      
      let correctionsText = "";
      if (Array.isArray(response.corrections.pronunciation) && response.corrections.pronunciation.length > 0) {
        correctionsText += `💡 Pronunciation: ${response.corrections.pronunciation[0]}\n`;
      }
      if (Array.isArray(response.corrections.grammar) && response.corrections.grammar.length > 0) {
        correctionsText += `✍️ Grammar: ${response.corrections.grammar[0]}\n`;
      }
      if (Array.isArray(response.corrections.suggestions) && response.corrections.suggestions.length > 0) {
        correctionsText += `💭 Suggestion: ${response.corrections.suggestions[0]}`;
      }
        
        // Add temporary corrections message
        setMessages(prev => {
          const newMessages = [...prev];
          const loadingIndex = newMessages.findIndex(m => 
            m.type === 'ai' && m.content === '...' && m.feedback === 'Analyzing your response...'
          );
          
          if (loadingIndex !== -1) {
            newMessages.splice(loadingIndex, 1);
          }
          
          return [
            ...newMessages, 
            { 
              type: 'feedback', 
              content: correctionsText,
              feedback: 'Quick learning tip',
              isTemporary: true
            }
          ];
        });
        
        // Remove corrections message after 5 seconds
        setTimeout(() => {
          setMessages(prev => prev.filter(m => !m.isTemporary));
        }, 5000);
      }

      const combinedResponse = `${response.text}\n\n${response.nextQuestion}`;

      // Remove loading indicator and add real response  
      setMessages(prev => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex(m => 
          m.type === 'ai' && m.content === '...' && m.feedback === 'Analyzing your response...'
        );
        
        if (loadingIndex !== -1) {
          newMessages.splice(loadingIndex, 1);
        }
        
        return [
          ...newMessages, 
          { 
            type: 'ai', 
            content: combinedResponse, 
            feedback: response.feedback,
            score: response.score,
            corrections: response.corrections
          }
        ];
      });
      
      // Only add to speech queue once
      setPendingMessages(prev => {
        // Check if this message is already in the queue
        if (!prev.some(msg => msg.includes(response.text.substring(0, 20)))) {
          return [...prev, combinedResponse];
        }
        return prev;
      });

      // Record the answer in the database
      if (currentQuestionId) {
        await recordAnswer(
          currentQuestionId, 
          transcript, 
          JSON.stringify({
            feedback: response.feedback,
            score: response.score,
            usedWords: response.usedWords,
            corrections: response.corrections
          })
        );
      }
      
      recordQuestion(response.nextQuestion);
      
      // Update user progress
      setUserProgress(prev => {
        const newTotal = prev.totalScore + response.score;
        const newCount = prev.messagesExchanged + 1;
        return {
          messagesExchanged: newCount,
          correctWords: prev.correctWords + response.usedWords.filter(w => w.used).length,
          totalScore: newTotal,
          averageScore: Math.round(newTotal / newCount)
        };
      });

      // Don't add completion prompts to the speech queue if we already have one
      if (userProgress.messagesExchanged >= 3 && 
          !messages.some(m => m.content.includes('complete this exercise')) &&
          !pendingMessages.some(m => m.includes('complete this exercise'))) {
        setTimeout(() => {
          const completionMessage = 'You\'re doing great! Would you like to continue practicing or complete this exercise?';
          
          setMessages(prev => [
            ...prev,
            { 
              type: 'ai', 
              content: completionMessage,
              feedback: 'You can say "complete" to finish or continue responding to practice more.'
            }
          ]);
          
          // Record this prompt as a question too
          recordQuestion(completionMessage);
          
          setPendingMessages(prev => [...prev, completionMessage]);
        }, 7000);
      }

    } catch (error) {
      console.error('Error processing response:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex(m => 
          m.type === 'ai' && m.content === '...' && m.feedback === 'Analyzing your response...'
        );
        
        if (loadingIndex !== -1) {
          newMessages.splice(loadingIndex, 1);
        }
        
        const errorMessage = "I'm having trouble understanding. Let's try again.";
        
        setPendingMessages(prev => [...prev, errorMessage]);
        
        return [
          ...newMessages,
          { 
            type: 'ai', 
            content: errorMessage, 
            feedback: "Technical issue occurred. Please try responding again."
          }
        ];
      });
    }
  };

  // Improved speakTextWithTracking function to fix long text issues
  const speakTextWithTracking = (text: string, onComplete?: () => void) => {
    if (!synthRef.current) return;
    
    // If we're already speaking, don't start a new utterance for the same text
    if (aiSpeaking && speakingUtteranceRef.current) {
      console.log("Already speaking, not starting new utterance");
      if (onComplete) setTimeout(onComplete, 500);
      return;
    }
    
    setAiSpeaking(true);
    synthRef.current.cancel(); // Cancel previous speech
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log("Error stopping recognition during AI speech", e);
      }
    }
    
    // Set the start time for watchdog timer
    speechStartTimeRef.current = Date.now();
    
    // Create a hash or ID for this speech event to avoid duplicates
    const speechId = Date.now().toString();
    console.log(`Starting speech ID: ${speechId} with text length: ${text.length}`);
    
    // Clean and deduplicate text (remove repeated sentences)
    const processText = (inputText: string): string => {
      // Split into sentences
      const sentences = inputText.match(/[^\.!\?]+[\.!\?]+|\s*$/g) || [];
      const uniqueSentences: string[] = [];
      const seenSentences = new Set<string>();
      
      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        if (trimmed.length > 0) {
          // Normalize sentence for comparison
          const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
          if (!seenSentences.has(normalized)) {
            seenSentences.add(normalized);
            uniqueSentences.push(trimmed);
          }
        }
      });
      
      return uniqueSentences.join(' ');
    };
    
    // Process text to remove duplications
    const cleanedText = processText(text);
    
    // Split text into manageable chunks (sentences)
    const chunks = cleanedText.match(/[^\.!\?]+[\.!\?]+|\s*$/g) || [];
    const cleanedChunks = chunks.filter(chunk => chunk.trim().length > 0);
    
    if (cleanedChunks.length === 0) {
      console.log("No speech chunks to process");
      setAiSpeaking(false);
      if (onComplete) setTimeout(onComplete, 100);
      return;
    }
    
    let currentChunkIndex = 0;
    
    const speakNextChunk = () => {
      if (currentChunkIndex >= cleanedChunks.length) {
        console.log(`Speech ID: ${speechId} completed`);
        setAiSpeaking(false);
        speakingUtteranceRef.current = null;
        
        if (onComplete) {
          setTimeout(onComplete, 300);
        }
        return;
      }
      
      const chunk = cleanedChunks[currentChunkIndex];
      const utterance = new SpeechSynthesisUtterance(chunk);
      
      // Use selected voice
      const voices = synthRef.current?.getVoices() || [];
      const preferredVoice = voices.find(voice => voice.name === selectedVoice) || 
                           voices.find(voice => voice.lang === 'en-US');
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log(`Using voice: ${preferredVoice.name}`);
      }
      
      utterance.lang = 'en-US';
      utterance.rate = 1.0;  // Normal speed
      utterance.pitch = 1.1; // Slightly higher pitch for clarity
      
      utterance.onend = () => {
        currentChunkIndex++;
        speakNextChunk();
      };
      
      utterance.onerror = (event) => {
        console.error(`Speech error in chunk ${currentChunkIndex}:`, event);
        currentChunkIndex++;
        speakNextChunk();
      };
      
      speakingUtteranceRef.current = utterance;
      if (synthRef.current) {
        synthRef.current.speak(utterance);
      }
    };
    
    // Start speaking
    speakNextChunk();
    
    // Setup watchdog timer to catch hanging speech synthesis
    const watchdogTimeout = setTimeout(() => {
      if (aiSpeaking) {
        console.log(`Speech watchdog triggered for speech ID: ${speechId}`);
        setAiSpeaking(false);
        if (synthRef.current) synthRef.current.cancel();
        if (onComplete) onComplete();
      }
    }, 30000); // 30 second maximum for any speech event
    
    // Clean up watchdog on component unmount
    return () => clearTimeout(watchdogTimeout);
  };

  // Analyze response
  const analyzeResponse = async (userInput: string): Promise<FeedbackResponse> => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/analyze-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: userInput,
          topic: topicName,
          formattedTopic: formatTopicName(topicName),
          level: 'intermediate',
          learnedWords: learnedWords,
          requiredWords: requiredWords,
          postContent: postContent,
          previousMessages: messages.map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        })
      });

      // Check for rate limiting or temporary unavailability
      if (response.status === 429) {
        console.warn('Rate limit reached, using fallback response');
        return generateFeedbackResponse(userInput, topicName, requiredWords);
      }

      // Handle general API errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API response error:', response.status, errorData);
        return generateFeedbackResponse(userInput, topicName, requiredWords);
      }

      try {
        const data = await response.json();
        
        // Validate API response format
        if (!data.text || !data.feedback || !data.nextQuestion) {
          console.error('Invalid API response format:', data);
          return generateFeedbackResponse(userInput, topicName, requiredWords);
        }
        
        // Enhance API response with our own corrections if not provided
        if (!data.corrections) {
          const corrections = analyzeUserSpeech(userInput);
          data.corrections = corrections;
        }
        
        return data;
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        return generateFeedbackResponse(userInput, topicName, requiredWords);
      }
    } catch (error) {
      console.error('API request error:', error);
      return generateFeedbackResponse(userInput, topicName, requiredWords);
    }
  };

  // פונקציה מתוקנת להתחלת שיחה - גרסה סופית
  const startConversation = async () => {
    setIsActive(true);
    setMessages([]);
    setAiSpeaking(false);
    setUserSpeaking(false);
    setUserTurn(false);
    setPendingMessages([]);
    
    // Reset user progress
    setUserProgress({
      messagesExchanged: 0,
      correctWords: 0,
      averageScore: 0,
      totalScore: 0
    });
    
    try {
      // Create an interactive session
      const createdSessionId = await createInteractiveSession();
      
      if (!createdSessionId) {
        setError('Failed to create conversation session');
        setIsActive(false);
        return;
      }
      
      // Manual update of sessionId state
      setSessionId(createdSessionId);
      console.log(`Setting sessionId state to: ${createdSessionId}`);
      
      // Greeting message
      const welcomeMessage = `Welcome to our conversation about ${formatTopicName(topicName)}! I'll help you practice English while giving you supportive feedback to improve your speaking skills. Let's begin!`;
      setMessages([{ type: 'ai', content: welcomeMessage }]);
      
      // Create first question
      const firstQuestion = generateFirstQuestion();
      setPendingMessages([welcomeMessage, firstQuestion]);
      
      // IMPORTANT: Use the sessionId directly instead of relying on state update
      const recordFirstQuestion = async () => {
        try {
          // Use createdSessionId directly instead of accessing state
          if (!createdSessionId) {
            console.error('Cannot record first question: sessionId not available');
            return null;
          }
          
          console.log(`Recording first question using direct sessionId: ${createdSessionId}`);
          
          // Call recordQuestion with the sessionId we just got
          const manualRecordQuestion = async (questionText: string, sessionIdParam: string) => {
            if (!sessionIdParam) {
              console.error('Cannot record question: missing sessionId parameter');
              return null;
            }
            
            // יצירת מזהה שאלה ייחודי
            const questionId = uuidv4();
            setCurrentQuestionId(questionId);
            setQuestionsCount(prev => prev + 1);
            
            try {
              const token = getAuthToken();
              if (!token) {
                console.warn('No authentication token available for question recording');
                return questionId;
              }
              
              // קיצור טקסט השאלה אם הוא ארוך מדי
              const truncatedText = questionText.length > 1000 
                ? questionText.substring(0, 997) + '...' 
                : questionText;
              
              console.log(`Recording question for session ${sessionIdParam}:`, truncatedText.substring(0, 30) + '...');
              
              try {
                const response = await fetch('/api/question', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    QuestionId: questionId,
                    SessionId: sessionIdParam,
                    QuestionText: truncatedText
                  }),
                  signal: AbortSignal.timeout(8000)
                });
                
                // טיפול בתשובה
                if (!response.ok) {
                  let errorMessage = 'Failed to record question';
                  try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                  } catch (e) {
                    errorMessage = await response.text() || errorMessage;
                  }
                  
                  console.error(`Question recording failed: ${errorMessage}`);
                  return questionId; // החזרת המזהה שנוצר מראש כגיבוי
                }
                
                const data = await response.json();
                console.log('Question recorded successfully:', data);
                return questionId;
              } catch (fetchError) {
                console.error('Error recording question:', fetchError);
                return questionId;
              }
            } catch (error) {
              console.error('Error in recordQuestion:', error);
              return questionId;
            }
          };
          
          // Call our manual implementation
          const questionId = await manualRecordQuestion(firstQuestion, createdSessionId);
          console.log('Recorded first question with ID:', questionId);
          
          // Add the first question to the messages
          setMessages(prev => [...prev, { type: 'ai', content: firstQuestion }]);
        } catch (recordError) {
          console.error('Error recording first question:', recordError);
          // Still add the first question to messages even if recording fails
          setMessages(prev => [...prev, { type: 'ai', content: firstQuestion }]);
        }
      };
      
      // Start the first question recording process after a delay
      setTimeout(recordFirstQuestion, 500);
      
    } catch (error) {
      console.error('Error in startConversation:', error);
      setError('Failed to start conversation. Please try again.');
      setIsActive(false);
    }
  };

  // יצירת שאלה ראשונה
  const generateFirstQuestion = () => {
    const topic = topicName.toLowerCase();
    
    const questionMap: Record<string, string> = {
      'diplomacy': `What do you think about Israel's diplomatic relations with other countries?`,
      'economy': `What interests you about Israel's economy or startup ecosystem?`,
      'innovation': `What Israeli technological innovations are you familiar with?`,
      'history': `What aspects of Israeli history do you find most interesting?`,
      'holocaust': `Why do you think it's important to remember historical events like the Holocaust?`,
      'iron': `What are your thoughts on how countries should protect their citizens?`,
      'sword': `What are your thoughts on how countries should protect their citizens?`,
      'environment': `What do you think about Israel's focus on renewable energy to protect the environment?`,
      'society': `What do you think is the most important action individuals can take to help protect the environment?`
    };
    
    for (const [key, question] of Object.entries(questionMap)) {
      if (topic.includes(key)) {
        return question;
      }
    }
    
    return `What aspects of ${formatTopicName(topicName)} interest you the most?`;
  };

  // Function to just stop the conversation audio without redirecting
  const stopConversationAudio = () => {
    setUserTurn(false);
    
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log("Error stopping recognition", e);
      }
    }
    
    // Stop speech synthesis
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    
    setAiSpeaking(false);
    
    // Clear timeouts
    if (microphoneTimeoutRef.current) {
      clearTimeout(microphoneTimeoutRef.current);
      microphoneTimeoutRef.current = null;
    }
    
    if (speechEndTimeoutRef.current) {
      clearTimeout(speechEndTimeoutRef.current);
      speechEndTimeoutRef.current = null;
    }
  };

  // Enhanced stopConversation function with level progression
  const stopConversation = async () => {
    setIsActive(false);
    setUserTurn(false);
    
    // Show loading message
    setMessages(prev => [
      ...prev,
      { 
        type: 'ai', 
        content: 'Saving your progress...',
        feedback: 'Please wait while we update your level.'
      }
    ]);
    
    try {
      // Stop all audio and recognition resources
      stopConversationAudio();
      
      // Calculate final score
      let finalScore = userProgress.totalScore;
      if (finalScore <= 0 && userProgress.messagesExchanged > 0) {
        finalScore = Math.round((userProgress.correctWords / userProgress.messagesExchanged) * 100);
      }
      
      // Ensure a minimum score of 60 for ending the conversation
      finalScore = Math.max(60, finalScore);
      
      // Update user level in the database
      const result = await updateUserLevel();
      
      // Mark the task as completed
      if (taskId) {
        const taskStartTime = sessionStorage.getItem(`task_start_${taskId}`);
        let durationTask = 0;
        
        if (taskStartTime) {
          durationTask = Math.floor((Date.now() - parseInt(taskStartTime)) / 1000);
        }
        
        const token = getAuthToken();
        
        if (token) {
          const completeResponse = await fetch(`/api/tasks`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              taskId: taskId,
              TaskScore: finalScore,
              DurationTask: durationTask,
              CompletionDate: new Date().toISOString(),
              SessionId: sessionId,
              QuestionsCount: questionsCount,
              MessagesExchanged: userProgress.messagesExchanged
            })
          });
        }
      }
      
      // Redirect to topics page
      window.location.href = '/topics';
    } catch (error) {
      console.error('Error in stopConversation:', error);
      
      // Error handling and fallback
    }
  };

  // Function to update user level in the database
  const updateUserLevel = async () => {
    if (!taskId || !topicName || !level) {
      console.error('Missing required information to update user level');
      throw new Error('Missing required data');
    }
    
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Calculate final score
    let totalScore = userProgress.totalScore;
    
    // If no score recorded, calculate based on conversation metrics
    if (totalScore <= 0 && userProgress.messagesExchanged > 0) {
      totalScore = Math.round((userProgress.correctWords / userProgress.messagesExchanged) * 100);
    }
    
    // Ensure minimum score of 60 for completing a conversation
    totalScore = Math.max(totalScore, 60);
    
    // Format the topic name properly for database
    const formattedTopicName = topicName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Make API request to update user level
    const response = await fetch('/api/user-level/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        topicName: formattedTopicName, // Use properly formatted topic name
        currentLevel: parseInt(level),
        earnedScore: totalScore,
        taskId,
        isCompleted: true // Always mark as completed when updating level
      })
    });
    
    // Process response...
    const data = JSON.parse(await response.text());
    
    return { ...data, success: true };
  };

  // Modified completeTask function for conversation/page.tsx
  const completeTask = async () => {
    if (isCompleting || !taskId) return;
    
    try {
      setIsCompleting(true);
      stopConversationAudio(); // Only stop audio, not redirect
      
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      
      // Add completion message with summary
      const completionMessage = 'Great job! You\'ve completed the conversation practice.';
      const feedbackMessage = `Your average score: ${userProgress.averageScore}/100. You showed great improvement in your speaking skills!`;
      
      setMessages(prev => [
        ...prev,
        { 
          type: 'ai', 
          content: completionMessage,
          feedback: feedbackMessage
        }
      ]);
      
      // Record final message as a question
      if (sessionId) {
        await recordQuestion(completionMessage);
      }
      
      // Speak completion message
      speakTextWithTracking(completionMessage + " " + feedbackMessage, () => {
        setTimeout(() => {
          console.log('Redirecting to topics page...');
          window.location.href = '/topics';
        }, 2000);
      });
      
      // Calculate task duration
      const taskStartTime = sessionStorage.getItem(`task_start_${taskId}`);
      let durationTask = 0;
      
      if (taskStartTime) {
        durationTask = Math.floor((Date.now() - parseInt(taskStartTime)) / 1000);
      }
      
      // Mark the task as completed
      console.log(`Marking task ${taskId} as completed with score ${userProgress.averageScore} and duration ${durationTask}s`);
      try {
        const completeResponse = await fetch(`/api/tasks`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            taskId: taskId,
            TaskScore: userProgress.averageScore || 60, // Ensure a default score
            DurationTask: durationTask,
            CompletionDate: new Date().toISOString(),
            SessionId: sessionId,
            QuestionsCount: questionsCount,
            MessagesExchanged: userProgress.messagesExchanged
          })
        });
        
        if (!completeResponse.ok) {
          console.error(`Failed to complete task: ${await completeResponse.text()}`);
        } else {
          const completeResult = await completeResponse.json();
          console.log('Task completion result:', completeResult);
        }
      } catch (taskError) {
        console.error('Error completing task:', taskError);
        // Continue with user level update anyway
      }
      
      // Update user level in the database
      try {
        console.log('Updating user level...');
        
        // Format topic name properly (from "topic-name" to "Topic Name")
        const formattedTopicName = topicName
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        const levelUpdateResponse = await fetch('/api/user-level/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            topicName: formattedTopicName,
            currentLevel: parseInt(level || '1'),
            earnedScore: userProgress.averageScore || 60, // Ensure a default score
            taskId: taskId,
            isCompleted: true
          })
        });
        
        if (!levelUpdateResponse.ok) {
          const errorText = await levelUpdateResponse.text();
          console.error(`Level update failed: ${errorText}`);
          throw new Error('Failed to update user level');
        }
        
        const levelResult = await levelUpdateResponse.json();
        console.log('User level update result:', levelResult);
      } catch (levelError) {
        console.error('Error updating user level:', levelError);
        // Continue with completion even if level update fails
      }
      
      // Display success message
      const successMessage = 'Task completed! You can now return to topics or try another activity.';
      
      setMessages(prev => [
        ...prev,
        { 
          type: 'ai', 
          content: successMessage,
          feedback: '✅ Task completion recorded'
        }
      ]);
      
      // Speak success message and redirect after a delay
      speakTextWithTracking(successMessage, () => {
        setTimeout(() => {
          console.log('Redirecting to topics page...');
          window.location.href = '/topics';
        }, 2000);
      });
      
    } catch (err) {
      console.error('Error completing task:', err);
      
      const errorMessage = 'There was an issue saving your progress. Please try again.';
      
      setMessages(prev => [
        ...prev,
        { 
          type: 'ai', 
          content: errorMessage,
          feedback: 'Error completing task'
        }
      ]);
      
      speakTextWithTracking(errorMessage, () => {});
    } finally {
      setIsCompleting(false);
    }
  };

  // Create interactive session when user transitions from post to conversation
  const createInteractiveSession = async () => {
    if (!taskId) {
      console.error('Cannot create session: missing taskId');
      return null;
    }
    
    // יצירת מזהה שיחה ייחודי
    const newSessionId = uuidv4();
    
    // שמירה מיידית ב-ref
    sessionIdRef.current = newSessionId;
    
    // עדכון ה-state (לתצוגה ופונקציות שלא משתמשות ב-ref)
    setSessionId(newSessionId);
    
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No authentication token available for session creation');
        return newSessionId;
      }
      
      console.log(`Creating interactive session for task ${taskId}`);
      
      try {
        const response = await fetch('/api/interactive-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            SessionId: newSessionId,
            taskId,
            sessionType: 'conversation'
          }),
          signal: AbortSignal.timeout(8000)
        });
        
        // טיפול בתשובה
        if (!response.ok) {
          let errorMessage = 'Failed to create interactive session';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = await response.text() || errorMessage;
          }
          
          console.error(`Interactive session creation failed: ${errorMessage}`);
          return newSessionId; // החזרת המזהה שנוצר מראש כגיבוי
        }
        
        const data = await response.json();
        console.log('Interactive session created:', data);
        
        if (data.SessionId && data.SessionId !== newSessionId) {
          // אם ה-API מחזיר מזהה שיחה שונה, השתמשי בו במקום
          sessionIdRef.current = data.SessionId; // עדכון ה-ref
          setSessionId(data.SessionId); // עדכון ה-state
          return data.SessionId;
        }
        
        return newSessionId;
      } catch (fetchError) {
        console.error('Error creating interactive session:', fetchError);
        return newSessionId;
      }
    } catch (error) {
      console.error('Error in createInteractiveSession:', error);
      return newSessionId;
    }
  };
  
  // Record a question in the conversation
  const recordQuestion = async (questionText: string): Promise<string | null> => {
    // בדיקה אם יש לנו sessionId ב-ref או ב-state
    const currentSessionId = sessionIdRef.current || sessionId;
    
    if (!currentSessionId) {
      console.error('Cannot record question: missing sessionId (checked both ref and state)');
      return null;
    }
    
    // יצירת מזהה שאלה ייחודי
    const questionId = uuidv4();
    setCurrentQuestionId(questionId);
    setQuestionsCount(prev => prev + 1);
    
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No authentication token available for question recording');
        return questionId;
      }
      
      // קיצור טקסט השאלה אם הוא ארוך מדי
      const truncatedText = questionText.length > 1000 
        ? questionText.substring(0, 997) + '...' 
        : questionText;
      
      console.log(`Recording question for session ${currentSessionId}:`, truncatedText.substring(0, 30) + '...');
      
      try {
        const response = await fetch('/api/question', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            QuestionId: questionId,
            SessionId: currentSessionId,
            QuestionText: truncatedText
          }),
          signal: AbortSignal.timeout(8000)
        });
        
        // טיפול בתשובה
        if (!response.ok) {
          let errorMessage = 'Failed to record question';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = await response.text() || errorMessage;
          }
          
          console.error(`Question recording failed: ${errorMessage}`);
          return questionId; // החזרת המזהה שנוצר מראש כגיבוי
        }
        
        const data = await response.json();
        console.log('Question recorded successfully:', data);
        return questionId;
      } catch (fetchError) {
        console.error('Error recording question:', fetchError);
        return questionId;
      }
    } catch (error) {
      console.error('Error in recordQuestion:', error);
      return questionId;
    }
  };

  // Record an answer to a question
  const recordAnswer = async (questionId: string, answerText: string, feedback: string | object): Promise<boolean> => {
    // בדיקה אם יש לנו sessionId ב-ref או ב-state (למרות שלא משתמשים בו ישירות)
    const currentSessionId = sessionIdRef.current || sessionId;
    
    if (!currentSessionId || !questionId) {
      console.error('Cannot record answer: missing sessionId or questionId');
      return false;
    }
    
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No authentication token available for answer recording');
        return false;
      }
      
      // קיצור טקסט התשובה אם הוא ארוך מדי
      const truncatedAnswer = answerText.length > 1000 
        ? answerText.substring(0, 997) + '...' 
        : answerText;
      
      // עיבוד המשוב לפורמט מתאים
      let processedFeedback = feedback;
      if (typeof feedback !== 'string') {
        try {
          processedFeedback = JSON.stringify(feedback);
        } catch (e) {
          console.warn('Error stringifying feedback, using empty string:', e);
          processedFeedback = '';
        }
      }
      
      console.log(`Recording answer for question ${questionId} in session ${currentSessionId}`);
      
      try {
        const response = await fetch(`/api/question/${questionId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            AnswerText: truncatedAnswer,
            Feedback: processedFeedback
          }),
          signal: AbortSignal.timeout(8000)
        });
        
        // טיפול בתשובה
        if (!response.ok) {
          let errorMessage = 'Failed to record answer';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = await response.text() || errorMessage;
          }
          
          console.error(`Answer recording failed: ${errorMessage}`);
          return false;
        }
        
        const data = await response.json();
        console.log('Answer recorded successfully:', data);
        return true;
      } catch (fetchError) {
        console.error('Error recording answer:', fetchError);
        return false;
      }
    } catch (error) {
      console.error('Error in recordAnswer:', error);
      return false;
    }
  };

  // Initialize voices when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // Filter to English voices
          const englishVoices = voices.filter(voice => 
            voice.lang.includes('en-')
          );
          setAvailableVoices(englishVoices);
          
          // Set default voice (prefer female voice)
          const defaultVoice = englishVoices.find(v => 
            v.name.includes('Female') || v.name.includes('female')
          );
          if (defaultVoice) {
            setSelectedVoice(defaultVoice.name);
          } else if (englishVoices.length > 0) {
            setSelectedVoice(englishVoices[0].name);
          }
        }
      };
      
      // Chrome loads voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      // Try loading immediately as well (for Firefox)
      loadVoices();
    }
  }, []);

  // מצב טעינה
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 flex justify-center items-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-medium text-gray-700">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // מצב שגיאה
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 flex justify-center items-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{error}</h2>
          <p className="text-gray-600 mb-6">We couldn't load the conversation at this time. Please try again later.</p>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-300"
            >
              Try Again
            </button>
            <Link 
              href="#" 
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-300"
            >
              Back to Topics
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 relative">
      {/* Google Font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Rubik', sans-serif;
        }
      `}</style>

      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6 mt-2">
        {formatTopicName(topicName)} - Conversation Practice
      </h1>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto mt-4">
        {/* Start/Stop Button */}
        {!isActive && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Conversation Practice</h2>
            <p className="text-gray-600 mb-6">
              Practice speaking English about <span className="font-bold">{formatTopicName(topicName)}</span>. 
              Our AI conversation partner will listen to your responses, provide real-time feedback on pronunciation, 
              grammar, and fluency, while helping you improve your speaking skills naturally.
            </p>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">What to expect:</h3>
              <ul className="text-sm text-blue-700 text-left max-w-md mx-auto">
                <li>• Real-time pronunciation hints</li>
                <li>• Grammar suggestions</li>
                <li>• Supportive feedback after each response</li>
                <li>• Natural conversation flow</li>
              </ul>
            </div>
            
            {requiredWords.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Try to use these words:</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {requiredWords.map((word, index) => (
                    <span key={index} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={startConversation}
              className="px-8 py-4 bg-orange-500 text-white text-xl font-bold rounded-full hover:bg-orange-600 transition-colors shadow-lg"
            >
              Start Conversation
            </button>
          </div>
        )}

        {/* Active Conversation */}
        {isActive && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={stopConversation}
                className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg"
              >
                End Conversation
              </button>
              
              {userProgress.messagesExchanged >= 3 && (
                <button
                  onClick={completeTask}
                  disabled={isCompleting}
                  className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-lg disabled:opacity-50"
                >
                  {isCompleting ? 'Completing...' : 'Complete Task'}
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                    aiSpeaking 
                      ? 'bg-green-100 animate-pulse' 
                      : userTurn 
                        ? 'bg-red-100 animate-pulse' 
                        : 'bg-orange-100'
                  }`}>
                    {aiSpeaking 
                      ? '🔊' 
                      : userTurn 
                        ? '🎙️' 
                        : '💬'}
                  </div>
                  <div className="ml-4">
                    <h2 className="text-xl font-bold text-gray-900">AI Conversation Partner</h2>
                    <p className="text-gray-500 text-sm">
                      {aiSpeaking 
                        ? "AI is speaking... Please listen" 
                        : userTurn 
                          ? "Your turn to speak - Microphone active" 
                          : isActive 
                            ? "Processing..." 
                            : "Click Start to begin"}
                    </p>
                  </div>
                </div>
                
                {/* Progress display */}
                {userProgress.messagesExchanged > 0 && (
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <div className="text-sm text-gray-500">Your score</div>
                    <div className="text-2xl font-bold text-orange-600">{userProgress.averageScore}/100</div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-orange-100 ml-12'
                        : message.type === 'feedback'
                          ? 'bg-green-50 border border-green-200'
                          : message.content.includes('Microphone is active')
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-gray-100 mr-12'
                    }`}
                  >
                    {message.type === 'feedback' && (
                      <div className="flex items-start">
                        <div className="text-green-500 mr-2 text-lg">💡</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-700">Learning Feedback:</p>
                          <p className="text-sm text-green-800 whitespace-pre-line">{message.content}</p>
                        </div>
                      </div>
                    )}
                    
                    {message.type === 'ai' && message.content.includes('Microphone is active') ? (
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-red-500 rounded-full animate-pulse mr-2"></div>
                        <p className="text-gray-800 font-medium">{message.content}</p>
                      </div>
                    ) : message.type !== 'feedback' && (
                      <p 
                        className="text-gray-800"
                        dangerouslySetInnerHTML={{ 
                          __html: message.type === 'ai' ? 
                            highlightRequiredWords(message.content) : message.content 
                        }}
                      ></p>
                    )}
                    
                    {message.feedback && message.type !== 'feedback' && (
                      <p className="mt-2 text-sm text-orange-600 italic">
                        {message.feedback}
                      </p>
                    )}
                    {message.score !== undefined && (
                      <div className="mt-2 flex items-center">
                        <span className="text-sm text-gray-500 mr-2">Score:</span>
                        <span className={`text-sm font-medium ${
                          message.score >= 80 ? 'text-green-600' : 
                          message.score >= 60 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {message.score}/100
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Speech Status Indicator */}
              <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Conversation Status:</h3>
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      aiSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                    }`}></div>
                    <span className="text-sm text-gray-600">AI Speaking</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      userTurn ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                    }`}></div>
                    <span className="text-sm text-gray-600">Your Turn to Speak</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      userSpeaking ? 'bg-orange-500 animate-pulse' : 'bg-gray-300'
                    }`}></div>
                    <span className="text-sm text-gray-600">Speech Detected</span>
                  </div>
                </div>
              </div>
              
              {/* Manual Skip Button for AI speech */}
  
              {/* Voice Settings */}
              {isActive && (
                <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Voice Settings:</h3>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">Voice:</span>
                    <select 
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {availableVoices.map(voice => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            {/* Word usage suggestions */}
            {requiredWords.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Try to use these words:</h3>
                <div className="flex flex-wrap gap-2">
                  {requiredWords.map((word, index) => (
                    <span key={index} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}