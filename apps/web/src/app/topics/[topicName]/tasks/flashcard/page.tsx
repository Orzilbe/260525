//apps/web/src/app/topics/[topicName]/tasks/flashcard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FaVolumeUp } from 'react-icons/fa';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken } from '../../../../../lib/auth';
import { useAuth } from '../../../../../hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';
import { formatTopicNameForDb, formatTopicNameForUrl, areTopicNamesEquivalent } from '../../../../lib/topicUtils';

interface Flashcard {
  WordId: string;
  Word: string;
  Translation: string;
  ExampleUsage: string;
  TopicName: string;
  StartDate?: string;
}

export default function FlashcardTask() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const topicName = params.topicName as string;
  const providedLevel = searchParams.get('level') || '1';
  
  const [userLevel, setUserLevel] = useState<number>(parseInt(providedLevel, 10) || 1);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isLoadingUserLevel, setIsLoadingUserLevel] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [reviewedWords, setReviewedWords] = useState<string[]>([]);
  const [pageLoadTimeMs] = useState(Date.now());
  const [showTranslation, setShowTranslation] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<'normal' | 'slow'>('normal');
  const [showReviewedWordsModal, setShowReviewedWordsModal] = useState(false);
  const [allWordsReviewed, setAllWordsReviewed] = useState(false);
  const [currentWordReviewed, setCurrentWordReviewed] = useState(false);

  // NEW: Fetch the user's actual level for this topic
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    
    const fetchUserLevel = async () => {
      try {
        setIsLoadingUserLevel(true);
        
        // Get auth token
        const token = getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }
        
        // Extract user ID directly from the auth token for debugging
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('Token payload for debugging:', { 
              id: payload.id,
              userId: payload.userId,
              email: payload.email
            });
          }
        } catch (err) {
          console.error('Error parsing token for debug:', err);
        }
        
        // Format topic name for DB
        const formattedTopicName = formatTopicNameForDb(topicName);
        console.log(`Fetching user level for topic: "${formattedTopicName}"`);
        
        // Log the token for debugging (without showing the full token)
        console.log(`Auth token for debug (first 10 chars): ${token.substring(0, 10)}...`);
        
        // Log the request URL
        const requestUrl = `/api/user/level?topicName=${encodeURIComponent(formattedTopicName)}`;
        console.log(`Making request to: ${requestUrl}`);
        
        // Query the new API endpoint to get the user's current level
        const response = await fetch(requestUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Log the response status
        console.log(`Level API response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Level API response data:', data);
          
          const userCurrentLevel = data.level || 1;
          
          console.log(`User's current level for topic "${formattedTopicName}": ${userCurrentLevel}`);
          setUserLevel(userCurrentLevel);
          
          // If URL has a different level than user's current level, redirect to the correct level
          if (providedLevel && parseInt(providedLevel, 10) !== userCurrentLevel) {
            console.log(`Redirecting user from level ${providedLevel} to their current level ${userCurrentLevel}`);
            
            // Construct the URL with the correct level
            const urlTopicName = formatTopicNameForUrl(topicName);
            router.replace(`/topics/${urlTopicName}/tasks/flashcard?level=${userCurrentLevel}`);
          }
        } else {
          console.warn('Failed to fetch user level, using provided level:', providedLevel);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          // Keep using the level from the URL if API fails
        }
      } catch (err) {
        console.error('Error fetching user level:', err);
        // Fall back to using the provided level
      } finally {
        setIsLoadingUserLevel(false);
      }
    };
    
    fetchUserLevel();
  }, [isAuthenticated, isLoading, topicName, providedLevel, router]);

  // Load flashcards on component mount - Updated to use userLevel instead of level from URL
  useEffect(() => {
    if (!isAuthenticated || isLoading || isLoadingUserLevel) return;

    // קביעת מספר אקראי בין 5 ל-7 של מילים להצגה
    const getRandomFlashcardCount = () => {
      return Math.floor(Math.random() * 3) + 5; // יחזיר 5, 6, או 7
    };
    
    const loadFlashcards = async () => {
      try {
        setIsLoadingCards(true);
        setError(null);
        
        // Get auth token
        const token = getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }
        
        // Extract user ID directly from the auth token for debugging
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('Token payload in loadFlashcards:', { 
              id: payload.id,
              userId: payload.userId,
              email: payload.email
            });
          }
        } catch (err) {
          console.error('Error parsing token for debug:', err);
        }
        
        // Format topic name consistently - IMPORTANT: Use the DB format (with spaces)
        const formattedTopicName = formatTopicNameForDb(topicName);
        
        console.log(`Loading flashcards for topic: "${formattedTopicName}", user level: ${userLevel}`);
        
        // Create task if needed - Use the user's current level instead of URL level
        if (!taskId) {
          try {
            const taskResponse = await fetch('/api/tasks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                TopicName: formattedTopicName, // Use the properly formatted topic name with spaces
                Level: userLevel, // Use the current user level
                TaskType: 'flashcard',
                StartDate: new Date().toISOString()
              })
            });
            
            console.log(`Task creation response status: ${taskResponse.status}`);
            
            if (!taskResponse.ok) {
              console.warn('Warning: Task creation failed, using temporary task ID');
              // Use temporary task ID if API fails
              const tempTaskId = `client_${uuidv4()}`;
              setTaskId(tempTaskId);
            } else {
              const taskData = await taskResponse.json();
              setTaskId(taskData.TaskId);
              console.log('Task created successfully with ID:', taskData.TaskId);
            }
          } catch (err) {
            console.error('Task creation error:', err);
            // Use temporary task ID if API fails
            const tempTaskId = `client_${uuidv4()}`;
            setTaskId(tempTaskId);
          }
        }
        
        // Fetch all completed tasks for this topic to get words from previous levels
        let previousLevelWords: string[] = [];
        try {
          // Log the request URL
          const userTasksUrl = `/api/user-tasks?topicName=${encodeURIComponent(formattedTopicName)}`;
          console.log(`Making request to: ${userTasksUrl}`);
          
          const tasksResponse = await fetch(userTasksUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log(`User tasks API response status: ${tasksResponse.status}`);
          
          if (tasksResponse.ok) {
            const completedTasks = await tasksResponse.json();
            console.log(`Retrieved ${completedTasks.length} completed tasks for topic`);
            
            if (completedTasks.length > 0) {
              console.log('Sample task data:', completedTasks[0]);
            }
            
            // Filter completed tasks with completed date and level less than current user level
            const relevantTasks = completedTasks.filter((task: any) => 
              task.CompletionDate && parseInt(task.Level) < userLevel
            );
            
            if (relevantTasks.length > 0) {
              console.log(`Found ${relevantTasks.length} completed tasks from previous levels`);
              
              // Get words from each relevant task
              for (const task of relevantTasks) {
                try {
                  const wordsResponse = await fetch(`/api/words-in-task?taskId=${task.TaskId}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  
                  if (wordsResponse.ok) {
                    const wordsData = await wordsResponse.json();
                    if (wordsData.data && Array.isArray(wordsData.data)) {
                      // Add WordIds to the list of words from previous levels
                      const taskWordIds = wordsData.data.map((word: any) => word.WordId);
                      previousLevelWords = [...previousLevelWords, ...taskWordIds];
                      console.log(`Added ${taskWordIds.length} words from task ${task.TaskId} at level ${task.Level}`);
                    }
                  }
                } catch (err) {
                  console.error(`Error fetching words for task ${task.TaskId}:`, err);
                }
              }
            }
          } else {
            console.warn('Failed to fetch completed tasks');
            const errorText = await tasksResponse.text();
            console.error('Error response:', errorText);
          }
        } catch (err) {
          console.error('Error fetching completed tasks:', err);
        }
        
        // Remove duplicates from previousLevelWords
        previousLevelWords = Array.from(new Set(previousLevelWords));
        console.log(`Total unique words from previous levels: ${previousLevelWords.length}`);
        
        // Map level number to appropriate EnglishLevel if necessary
        let englishLevel = String(userLevel);
        if ((typeof userLevel === 'number' || typeof userLevel === 'string') && 
            /^\d+$/.test(String(userLevel))) {
          const levelNum = typeof userLevel === 'number' ? userLevel : parseInt(String(userLevel), 10);
          switch (levelNum) {
            case 1:
              englishLevel = 'beginner';
              break;
            case 2:
              englishLevel = 'intermediate';
              break;
            case 3:
            default:
              englishLevel = 'advanced';
              break;
          }
          console.log(`Mapped level parameter "${userLevel}" to EnglishLevel value: "${englishLevel}"`);
        }
        
        // Use randomLimit parameter to get a random subset of words directly from the server
        const randomCount = getRandomFlashcardCount();
        console.log(`Using randomLimit=${randomCount} to get a random subset of flashcards`);
        
        // Fetch flashcards - use filterLearned=true to get new words the user hasn't learned yet
        try {
          // Log the request URL
          const wordsUrl = `/api/words?topic=${encodeURIComponent(formattedTopicName)}&level=${englishLevel}&filterLearned=true&randomLimit=${randomCount}`;
          console.log(`Making request to: ${wordsUrl}`);
          
          const response = await fetch(
            wordsUrl, 
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          console.log(`Words API response status: ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log(`Words API returned ${data.length} words`);
            
            if (Array.isArray(data) && data.length > 0) {
              // Filter out words from previous levels if any
              let filteredData = data;
              if (previousLevelWords.length > 0) {
                filteredData = data.filter((card: any) => !previousLevelWords.includes(card.WordId));
                console.log(`Filtered out ${data.length - filteredData.length} words from previous levels`);
              }
              
              // If we have too few words after filtering, try to get more
              if (filteredData.length < 3 && previousLevelWords.length > 0) {
                console.log(`Too few words remain after filtering (${filteredData.length}), fetching more words`);
                
                // Try to get more words without filtering for previous tasks
                const additionalResponse = await fetch(
                  `/api/words?topic=${encodeURIComponent(formattedTopicName)}&level=${englishLevel}&filterLearned=true&randomLimit=${randomCount + 5}`, 
                  {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  }
                );
                
                if (additionalResponse.ok) {
                  const additionalData = await additionalResponse.json();
                  if (Array.isArray(additionalData) && additionalData.length > 0) {
                    // Filter out words from previous levels
                    const additionalFiltered = additionalData.filter(
                      (card: any) => !previousLevelWords.includes(card.WordId)
                    );
                    
                    // Merge with existing data, avoiding duplicates
                    const existingWordIds = new Set(filteredData.map((card: any) => card.WordId));
                    const uniqueAdditional = additionalFiltered.filter(
                      (card: any) => !existingWordIds.has(card.WordId)
                    );
                    
                    filteredData = [...filteredData, ...uniqueAdditional];
                    console.log(`Added ${uniqueAdditional.length} additional words, total now: ${filteredData.length}`);
                  }
                }
              }
              
              // If we still have too few words, include some words from previous levels
              if (filteredData.length < 3) {
                console.log(`Still too few words (${filteredData.length}), adding some from previous levels`);
                filteredData = data;
              }
              
              // Normalize the topic name in each card to ensure consistency
              const cardsWithConsistentTopicName = filteredData.map((card: any) => ({
                ...card,
                TopicName: formattedTopicName, // Ensure consistent topic name format
                StartDate: new Date().toISOString()
              }));
              
              setFlashcards(cardsWithConsistentTopicName);
              console.log(`Successfully loaded ${cardsWithConsistentTopicName.length} filtered flashcards`);
            } else {
              // If no cards found, try without filtering as fallback
              console.log('No filtered cards found, trying without filtering');
              
              const fallbackResponse = await fetch(
                `/api/words?topic=${encodeURIComponent(formattedTopicName)}&level=${englishLevel}&filterLearned=false&randomLimit=${randomCount}`, 
                {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                }
              );
              
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (Array.isArray(fallbackData) && fallbackData.length > 0) {
                  // Filter out words from previous levels
                  let filteredFallback = fallbackData;
                  if (previousLevelWords.length > 0) {
                    filteredFallback = fallbackData.filter((card: any) => !previousLevelWords.includes(card.WordId));
                    console.log(`Filtered out ${fallbackData.length - filteredFallback.length} words from previous levels`);
                  }
                  
                  // If too few words remain, use original set
                  if (filteredFallback.length < 3) {
                    console.log(`Too few words remain after filtering (${filteredFallback.length}), using original set`);
                    filteredFallback = fallbackData;
                  }
                  
                  // Normalize the topic name to the DB format
                  const normalizedCards = filteredFallback.map((card: any) => ({
                    ...card,
                    TopicName: formattedTopicName, // Convert to DB format
                    StartDate: new Date().toISOString()
                  }));
                  
                  setFlashcards(normalizedCards);
                  console.log(`Successfully loaded ${normalizedCards.length} fallback flashcards`);
                } else {
                  throw new Error('No flashcards found for this topic');
                }
              } else {
                throw new Error('Failed to fetch flashcards');
              }
            }
          } else {
            throw new Error('Failed to fetch flashcards');
          }
        } catch (fetchError) {
          console.error('Error fetching flashcards:', fetchError);
          throw fetchError;
        }
      } catch (err) {
        console.error('Error in flashcard loading process:', err);
        setError(err instanceof Error ? err.message : 'Failed to load flashcards');
        setFlashcards([]);
      } finally {
        setIsLoadingCards(false);
      }
    };
    
    loadFlashcards();
  }, [isAuthenticated, isLoading, topicName, userLevel, isLoadingUserLevel]);
  
  // Save all words to the task when flashcards are loaded and taskId is available
  useEffect(() => {
    const saveAllWordsToTask = async () => {
      if (flashcards.length > 0 && taskId) {
        try {
          // Skip API call for temporary task IDs
          if (taskId.startsWith('client_')) {
            console.log(`Using temporary task ID ${taskId}, skipping server update`);
            return;
          }
          
          const token = getAuthToken();
          if (!token) {
            console.error('No authentication token available');
            return;
          }
          
          const wordIds = flashcards.map(card => card.WordId);
          console.log(`Saving ${wordIds.length} flashcard words to task ${taskId}`);
          
          try {
            // Use the words-in-task API to save all flashcard words
            const response = await fetch('/api/words-in-task', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                taskId,
                wordIds
              })
            });
            
            console.log(`Words-in-task API response status: ${response.status}`);
            
            if (!response.ok) {
              console.error('Failed to save flashcard words to task');
            } else {
              console.log('Successfully saved all flashcard words to task');
            }
          } catch (apiError) {
            console.error('API error when saving words to task:', apiError);
          }
        } catch (error) {
          console.error('Error in saveAllWordsToTask:', error);
        }
      }
    };
    
    if (taskId && flashcards.length > 0) {
      saveAllWordsToTask();
    }
  }, [flashcards, taskId]);
 
  // Effect to check if all words have been reviewed and update the state
  useEffect(() => {
    if (flashcards.length > 0 && reviewedWords.length >= flashcards.length) {
      console.log('All words have been reviewed! Setting allWordsReviewed to true');
      setAllWordsReviewed(true);
    } else {
      console.log(`Words reviewed: ${reviewedWords.length}/${flashcards.length} - Setting allWordsReviewed to false`);
      setAllWordsReviewed(false);
    }
  }, [reviewedWords, flashcards]);
  const isCurrentWordReviewed = useCallback(() => {
    const currentWord = flashcards[currentIndex];
    if (!currentWord) return false;
    
    return reviewedWords.includes(currentWord.WordId);
  }, [currentIndex, flashcards, reviewedWords]);
  // Handle word review - add to local state
  const markAsReviewed = useCallback(() => {
    const currentWord = flashcards[currentIndex];
    if (!currentWord) return;
    
    const wordId = currentWord.WordId;
    
    // If word not already marked as reviewed
    if (!reviewedWords.includes(wordId)) {
      console.log(`Adding word ${wordId} to reviewedWords`);
      setReviewedWords(prev => {
        const newReviewed = [...prev, wordId];
        console.log('Updated reviewedWords:', newReviewed);
        return newReviewed;
      });
      
      // Move to next card after a short delay so user can see the button change
      if (currentIndex < flashcards.length - 1) {
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
          setShowTranslation(false);
        }, 300); // 300ms delay - gives user time to see the button change
      }
    }
  }, [currentIndex, flashcards, reviewedWords]);
  
  // Start quiz with error handling - updated to use userLevel instead of level from URL
  const startQuiz = async () => {
    try {
      console.group('Starting Quiz Flow');
      
      // Check if all words are reviewed
      if (reviewedWords.length < flashcards.length) {
        console.warn('Not all words reviewed');
        alert('נא לעבור על כל המילים לפני המעבר למבחן');
        console.groupEnd();
        return;
      }
      
      // Calculate task duration
      const durationSeconds = Math.floor((Date.now() - pageLoadTimeMs) / 1000);
      console.log(`Task duration: ${durationSeconds} seconds (${Math.floor(durationSeconds / 60)} minutes)`);
      
      // Get auth token
      const token = getAuthToken();
      if (!token) {
        console.error('No authentication token available');
        throw new Error('Authentication required');
      }
      
      // 1. Complete flashcard task if it exists and isn't a client-side temporary ID
      if (taskId && !taskId.startsWith('client_')) {
        try {
          // Update task completion status
          const completeResponse = await fetch('/api/tasks', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              taskId: taskId,
              TaskScore: 100,
              DurationTask: durationSeconds,
              CompletionDate: new Date().toISOString()
            })
          });
          
          console.log(`Task completion API response status: ${completeResponse.status}`);
          
          if (!completeResponse.ok) {
            console.error('API error when completing flashcard task:', await completeResponse.text());
            // Continue anyway
          } else {
            console.log('Successfully completed flashcard task');
          }
        } catch (apiError) {
          console.error('Error calling task completion API:', apiError);
          // Continue anyway
        }
      } else {
        console.log('Using temporary task ID, skipping flashcard task completion');
      }
      
      // 2. Create a new quiz task with properly formatted topic name
      let quizTaskId = null;
      try {
        // Format topic name consistently for DB (with spaces)
        const formattedTopicName = formatTopicNameForDb(topicName);
        console.log(`Creating quiz task with formatted topic name: "${formattedTopicName}"`);
        
        const createTaskResponse = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            TopicName: formattedTopicName, // Use the properly formatted DB topic name
            Level: userLevel, // Use current user level instead of level from URL
            TaskType: 'quiz',
            StartDate: new Date().toISOString()
          })
        });
        
        console.log(`Quiz task creation API response status: ${createTaskResponse.status}`);
        
        if (createTaskResponse.ok) {
          const taskData = await createTaskResponse.json();
          quizTaskId = taskData.TaskId;
          console.log('Quiz task created successfully with ID:', quizTaskId);
          
          // 3. Add words to the new quiz task
          if (reviewedWords.length > 0) {
            try {
              const addWordsResponse = await fetch('/api/words-in-task', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  taskId: quizTaskId,
                  wordIds: reviewedWords
                })
              });
              
              console.log(`Add words to quiz task API response status: ${addWordsResponse.status}`);
              
              if (addWordsResponse.ok) {
                console.log(`Successfully added ${reviewedWords.length} words to quiz task`);
              } else {
                console.warn('Failed to add words to quiz task');
              }
            } catch (wordsError) {
              console.error('Error adding words to quiz task:', wordsError);
            }
          }
        } else {
          console.error('Failed to create quiz task:', await createTaskResponse.text());
          // Generate a client-side ID as fallback
          quizTaskId = `client_${uuidv4()}`;
        }
      } catch (error) {
        console.error('Error creating quiz task:', error);
        // Generate a client-side ID as fallback
        quizTaskId = `client_${uuidv4()}`;
      }
      
      // Navigate to quiz with the new task ID - use original topic name for URL
      const urlTopicName = topicName; // Keep hyphenated format for URL
      const quizParams = new URLSearchParams({
        level: userLevel.toString() // Use current user level instead of level from URL
      });
      
      // Add the quiz task ID if we have one
      if (quizTaskId) {
        quizParams.append('taskId', quizTaskId);
      }
      
      const quizUrl = `/topics/${urlTopicName}/tasks/quiz?${quizParams.toString()}`;
      console.log(`Navigating to quiz URL: ${quizUrl}`);
      
      router.push(quizUrl);
      
    } catch (error) {
      console.error('Error starting quiz:', error);
      setError('אירעה שגיאה במעבר למבחן. אנא נסו שנית.');
    } finally {
      console.groupEnd();
    }
  };
  
  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowTranslation(false);
    }
  };
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowTranslation(false);
    }
  };
  
  const handlePlayPronunciation = useCallback(() => {
    const word = flashcards[currentIndex]?.Word;
    if (!word) return;
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = playbackSpeed === 'slow' ? 0.7 : 1;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, [currentIndex, flashcards, playbackSpeed]);
  
  // Format the topic name for display
  const formatTopicName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const pageTitle = `${formatTopicName(topicName)} - level ${userLevel}`;

  // Debug rendering
  console.log('Rendering FlashcardTask. allWordsReviewed:', allWordsReviewed);
  console.log(`Reviewed ${reviewedWords.length}/${flashcards.length} words`);

  // Loading state
  if (isLoading || isLoadingCards || isLoadingUserLevel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 flex justify-center items-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-medium text-gray-700">טוען כרטיסיות...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 flex justify-center items-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{error}</h2>
          <p className="text-gray-600 mb-6">לא ניתן לטעון את הכרטיסיות כרגע. נא לנסות שוב מאוחר יותר.</p>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-300"
            >
              נסה שוב
            </button>
            <Link 
              href="#" 
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-300"
            >
              חזרה לנושאים
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No flashcards state
  if (flashcards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 flex justify-center items-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="text-orange-500 text-5xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">אין מילים זמינות</h2>
          <p className="text-gray-600 mb-6">אין מילים זמינות לנושא זה ברמה הנוכחית.</p>
          <Link 
            href="#" 
            className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-300 inline-block"
          >
            חזרה לנושאים
          </Link>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 relative" dir="rtl">
      {/* Google Font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Rubik', sans-serif;
        }
      `}</style>

      <h1 className="text-3xl font-bold text-center text-gray-800 mb-6 mt-2">{pageTitle}</h1>

      <main className="max-w-4xl mx-auto mt-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-500">
              כרטיסיה {currentIndex + 1} מתוך {flashcards.length}
            </span>
            <span className="text-sm font-medium text-gray-500">
              נסקרו: {reviewedWords.length} מתוך {flashcards.length}
            </span>
          </div>

          <div
            className="relative h-72 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl flex flex-col justify-center items-center mb-8 cursor-pointer transform hover:scale-[1.02] transition-all duration-300 shadow-md"
            onClick={() => setShowTranslation(!showTranslation)}
          >
            <h2 className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent text-center px-4">
              {showTranslation
                ? flashcards[currentIndex]?.Translation
                : flashcards[currentIndex]?.Word}
            </h2>
            {!showTranslation && flashcards[currentIndex]?.ExampleUsage && (
              <p className="text-gray-600 text-xl italic mt-6 px-12 text-center">
                {flashcards[currentIndex].ExampleUsage}
              </p>
            )}
          </div>

          <div className="flex justify-between items-center gap-6 mb-8">
            <button
              onClick={handlePrevious}
              className="px-8 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:hover:transform-none"
              disabled={currentIndex === 0}
            >
              הקודם
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPronunciation}
                className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 hover:bg-orange-200 transition-colors"
                title="השמע הגייה"
              >
                <FaVolumeUp size={24} />
              </button>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(e.target.value as 'normal' | 'slow')}
                className="border-2 border-orange-200 text-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-400"
              >
                <option value="normal">מהירות רגילה</option>
                <option value="slow">מהירות איטית</option>
              </select>
            </div>
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:hover:transform-none"
              disabled={currentIndex === flashcards.length - 1}
            >
              הבא
            </button>
          </div>

          <div className="flex justify-center gap-4">
          <button
  onClick={markAsReviewed}
  className={`px-8 py-3 ${isCurrentWordReviewed() 
    ? 'bg-gray-400 hover:bg-gray-500' 
    : 'bg-green-500 hover:bg-green-600'} 
    text-white rounded-xl transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg`}
  disabled={isCurrentWordReviewed()}
>
  {isCurrentWordReviewed() 
    ? '✓ מילה סומנה כנלמדה' 
    : 'סמן מילה כמילה שלמדתי ✓'}
</button>
            <button
              onClick={() => setShowReviewedWordsModal(true)}
              className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg"
            >
              צפה במילים שנסקרו 📚
            </button>
          </div>

          {/* Quiz start button */}
          {(allWordsReviewed || reviewedWords.length >= flashcards.length) && (
            <div className="flex justify-center mt-8">
              <button
                onClick={startQuiz}
                className="px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-lg text-lg"
              >
                סיימתי ללמוד - התחל מבחן! 🎯
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Reviewed Words Modal */}
      {showReviewedWordsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">מילים שנסקרו 🌟</h2>
            {reviewedWords.length > 0 ? (
              <ul className="space-y-4">
                {reviewedWords.map((wordId) => {
                  const word = flashcards.find((card) => card.WordId === wordId);
                  return word && (
                    <li key={wordId} className="flex justify-between items-center p-3 bg-orange-50 rounded-xl">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-700">{word.Word}</span>
                        <span className="text-sm text-gray-500">{word.Translation}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">אין עדיין מילים שנסקרו.</p>
            )}
            <button
              onClick={() => setShowReviewedWordsModal(false)}
              className="mt-6 w-full py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-300 transform hover:-translate-y-1"
            >
              סגור
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      
    </div>
  );
}