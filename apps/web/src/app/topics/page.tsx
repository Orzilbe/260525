// apps/web/src/app/topics/page.tsx
'use client';

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import UserProfile from '../components/UserProfile';
import TopicCard from '../components/TopicCard';
import { useAuth } from '../../hooks/useAuth';
import { clearAuthToken } from '../lib/auth';
import Link from 'next/link';

interface Topic {
  TopicName: string;
  TopicHe: string;
  Icon: string;
}

interface UserData {
  level: string;
  points: number;
  totalScore: number;
  completedTasks: number;
  activeSince: string;
  nextLevel: string;
  pointsToNextLevel: number;
}

export default function Topics() {
  // הגדרת state
  const [topics, setTopics] = useState<Topic[]>([]);
  const [userData, setUserData] = useState<UserData>({
    level: "",
    points: 0,
    totalScore: 0,
    completedTasks: 0,
    activeSince: "",
    nextLevel: "",
    pointsToNextLevel: 100
  });
  const [showProfile, setShowProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  
  // Add detailed logging for user role check
  console.log('User data for admin check:', {
    user,
    role: user?.role,
    UserRole: user?.UserRole,
    rawUser: JSON.stringify(user)
  });
  
  // Check both role and UserRole fields, and handle case-insensitive comparison
  const isAdmin = Boolean(
    user?.role?.toLowerCase() === 'admin' || 
    user?.UserRole?.toLowerCase() === 'admin'
  );
  
  console.log('Admin check result:', {
    isAdmin,
    roleCheck: user?.role?.toLowerCase() === 'admin',
    UserRoleCheck: user?.UserRole?.toLowerCase() === 'admin',
    roleValue: user?.role,
    UserRoleValue: user?.UserRole
  });

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };
  
  // בדיקת אימות
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log("המשתמש אינו מחובר, מעביר לדף התחברות");
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // טעינת נתונים
  useEffect(() => {
    if (isAuthenticated) {
      // טעינת נושאים
      const fetchTopics = async () => {
        try {
          const response = await fetch('/api/topics', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setTopics(data);
          }
        } catch (error) {
          console.error('Error fetching topics:', error);
        }
      };

      // טעינת נתוני משתמש
      const fetchUserData = async () => {
        try {
          const response = await fetch('/api/user-data', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            console.log('User data from API (full response):', data);
            
            // בדוק ספציפית את השדה של הציון
            console.log('Score field specifically:', {
              score: data.score,
              Score: data.Score,
              totalScore: data.totalScore,
              TotalScore: data.TotalScore,
              total_score: data.total_score,
              scoreValue: data.scoreValue
            });
            
            setUserData({
              level: data.currentLevel || "Beginner",
              points: data.currentLevelPoints || 0,
              totalScore: data.score || data.Score || data.totalScore || data.TotalScore || data.total_score || data.scoreValue || 0,
              completedTasks: data.completedTasksCount || 0,
              activeSince: data.CreationDate ? new Date(data.CreationDate).toLocaleDateString() : "Today",
              nextLevel: data.nextLevel || "Intermediate",
              pointsToNextLevel: data.pointsToNextLevel || 100
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };

      fetchTopics();
      fetchUserData();
    }
  }, [isAuthenticated]);

  const toggleProfile = () => setShowProfile(!showProfile);
  
  // פונקציה לטיפול בשגיאות מהקומפוננטה
  const handleTopicError = (message: string) => {
    setErrorMessage(message);
    // הסרת ההודעה אחרי 5 שניות
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // תצוגת טעינה
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // אם לא מחובר, החזר null
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-6 relative">
      {/* Google Font Import */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Poppins', sans-serif;
        }
      `}</style>

      {/* User Profile Component */}
      <UserProfile isVisible={showProfile} onClose={toggleProfile} showIcon={true} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold mb-8 text-center bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
          Choose Your Topic
        </h1>

        {/* Gamification Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-xl">🎯</span>
            </div>
            <p className="text-sm text-gray-500">Total Score</p>
            <p className="text-2xl font-bold text-orange-600">{userData.totalScore}</p>
            <p className="text-xs text-gray-400">points</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-xl">✅</span>
            </div>
            <p className="text-sm text-gray-500">Completed Tasks</p>
            <p className="text-2xl font-bold text-orange-600">{userData.completedTasks}</p>
            <p className="text-xs text-gray-400">activities</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-xl">⏱️</span>
            </div>
            <p className="text-sm text-gray-500">Active Since</p>
            <p className="text-2xl font-bold text-orange-600">{userData.activeSince}</p>
          </div>
        </div>

        {/* Dashboard Button - מוצג רק למנהלים */}
        {isAdmin && (
          <div className="flex justify-center mb-4">
            <Link 
              href="/dashboard"
              onClick={(e) => {
                console.log('Dashboard link clicked');
                const token = localStorage.getItem('token');
                if (!token) {
                  e.preventDefault();
                  console.error('No token found in localStorage');
                  return;
                }
                // Add token to headers for the next request
                const headers = new Headers();
                headers.append('Authorization', `Bearer ${token}`);
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center cursor-pointer"
            >
              <span className="mr-2 text-xl">📊</span>
              <span>Dashboard</span>
            </Link>
          </div>
        )}

        {/* Hall of Fame Button */}
        <div className="flex justify-center mb-8">
          <Link href="/hall-of-fame">
            <div className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center">
              <span className="mr-2 text-xl">👑</span>
              <span>Hall of Fame</span>
            </div>
          </Link>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 text-center">
            {errorMessage}
          </div>
        )}

        {/* Topics Grid - שימוש בקומפוננטת TopicCard המעודכנת */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {topics.map((topic) => (
            <TopicCard 
              key={topic.TopicName} 
              topic={topic} 
              userId={user?.UserId || user?.userId || ''}
              onError={handleTopicError}
            />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="absolute top-4 left-4 flex space-x-3">
        <button 
          onClick={handleLogout}
          className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transform hover:scale-105 transition-all duration-300"
        >
          <span className="text-2xl">👋</span>
        </button>
      </div>
    </div>
  );
}