// apps/web/src/app/hall-of-fame/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';

type TimeFrame = 'week' | 'month' | 'all-time';

interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  score: number;
  rank: number;
  isCurrentUser: boolean;
}

interface UserRank {
  rank: number;
  score: number;
  pointsToNextRank: number;
}

export default function HallOfFame() {
  const { user } = useAuth();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<UserRank | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [timeFrame]);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/top-users?timeFrame=${timeFrame}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch leaderboard');
      }

      setLeaderboard(data.leaderboard);
      setUserRank(data.userRank);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load leaderboard. Please try again later.';
      setError(errorMessage);
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeFrameTitle = () => {
    switch (timeFrame) {
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      case 'all-time':
        return 'All Time';
    }
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '👑';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '🎯';
    }
  };

  const getMotivationalMessage = () => {
    if (!userRank) return 'Start your journey to the top!';
    
    if (userRank.rank <= 3) {
      return 'You\'re crushing it! Keep up the amazing work!';
    } else if (userRank.pointsToNextRank <= 100) {
      return `You're only ${userRank.pointsToNextRank} points away from the next rank!`;
    } else {
      return 'Every point counts! Keep pushing forward!';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Hall of Fame</h1>
          <p className="text-xl text-gray-600">{getTimeFrameTitle()}</p>
        </div>

        {/* Time Frame Selector */}
        <div className="flex justify-center space-x-4 mb-8">
          {(['week', 'month', 'all-time'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-6 py-2 rounded-full transition-all transform hover:scale-105 ${
                timeFrame === tf
                  ? 'bg-teal-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-teal-50'
              }`}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>

        {/* User's Current Rank */}
        {userRank && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-lg p-6 mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your Rank</h2>
                <p className="text-4xl font-bold text-teal-600">#{userRank.rank}</p>
                <p className="text-gray-600 mt-2">{getMotivationalMessage()}</p>
              </div>
              {userRank.pointsToNextRank > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Points to next rank</p>
                  <p className="text-2xl font-bold text-teal-600">
                    +{userRank.pointsToNextRank}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Leaderboard */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 flex items-center justify-between ${
                    entry.isCurrentUser ? 'bg-teal-50' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{getMedalEmoji(entry.rank)}</span>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {entry.firstName} {entry.lastName}
                        {entry.isCurrentUser && (
                          <span className="ml-2 text-teal-600">(You)</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">Rank #{entry.rank}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-teal-600">
                      {entry.score}
                    </p>
                    <p className="text-sm text-gray-500">points</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            Want to climb the ranks? Complete more tasks to earn points!
          </p>
          <button
            onClick={() => window.location.href = '/topics'}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all transform hover:scale-105"
          >
            Start Learning Now
            <svg
              className="ml-2 -mr-1 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}