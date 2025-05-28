// apps/web/src/components/Dashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Activity, BookOpen, TrendingUp, Calendar, BarChart3, RefreshCw, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  averageScore: number;
  userGrowth: number;
  activityChange: number;
  newUserGrowth: number;
  scoreChange: number;
}

interface DashboardData {
  userStats: UserStats;
  usersByLevel: Array<{ name: string; value: number; users: number }>;
  topicPopularity: Array<{ TopicName: string; TopicHe: string; total_tasks: number; completed_tasks: number; avg_score: number }>;
  userActivity: Array<{ date: string; activities: number; active_users: number }>;
  completionRates: Array<{ name: string; rate: number; color: string }>;
  weeklyActivity: Array<{ day_name: string; activities: number; avg_score: number }>;
  trendForecast: Array<{ activity_date: string; daily_activities: number; unique_users: number }>;
}

// קומפוננטה לכרטיס סטטיסטיקה
const StatCard = ({ title, value, icon: Icon, change, changeType }: { title: string, value: string, icon: React.ElementType, change: number, changeType: string }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      <Icon className="h-6 w-6 text-blue-500" />
    </div>
    <div className="flex items-baseline">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <p className={`ml-2 text-sm font-medium ${
          changeType === 'positive' ? 'text-green-600' : 'text-red-600'
        }`}>
          {changeType === 'positive' ? '+' : ''}{change}%
        </p>
      )}
    </div>
  </div>
);

// קומפוננטת שגיאה
const ErrorMessage = ({ message }: { message: string }) => (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
    <div className="flex items-center">
      <AlertCircle className="h-5 w-5 mr-2" />
      <span>{message}</span>
    </div>
  </div>
);

const Dashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [timeRange, setTimeRange] = useState('30d');
  
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      }
      // הסרנו את הבדיקה לאדמין - כעת כל משתמש יכול לגשת
    }
  }, [isAuthenticated, isLoading, user, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // Fetch all dashboard data in parallel
        const [userStatsRes, usersByLevelRes, topicPopularityRes, userActivityRes, completionRatesRes, advancedStatsRes] = 
          await Promise.all([
            fetch('/api/dashboard/user-stats', { headers }),
            fetch('/api/dashboard/users-by-level', { headers }),
            fetch(`/api/dashboard/topic-popularity?topic=${selectedTopic}`, { headers }),
            fetch(`/api/dashboard/user-activity?range=${timeRange}`, { headers }),
            fetch('/api/dashboard/completion-rates', { headers }),
            fetch('/api/dashboard/advanced-stats', { headers })
          ]);

        // Check if all requests were successful
        if (!userStatsRes.ok || !usersByLevelRes.ok || !topicPopularityRes.ok || 
            !userActivityRes.ok || !completionRatesRes.ok || !advancedStatsRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        // Parse all responses
        const [userStats, usersByLevel, topicPopularity, userActivity, completionRates, advancedStats] = 
          await Promise.all([
            userStatsRes.json(),
            usersByLevelRes.json(),
            topicPopularityRes.json(),
            userActivityRes.json(),
            completionRatesRes.json(),
            advancedStatsRes.json()
          ]);

        // עדכון נתוני השינוי מ-advancedStats
        const updatedUserStats = {
          ...userStats,
          userGrowth: advancedStats.userGrowth,
          activityChange: advancedStats.activityChange,
          scoreChange: advancedStats.scoreChange
        };

        setData({
          userStats: updatedUserStats,
          usersByLevel,
          topicPopularity,
          userActivity,
          completionRates,
          weeklyActivity: advancedStats.weeklyActivity,
          trendForecast: advancedStats.trendForecast
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('שגיאה בטעינת נתוני הדשבורד. אנא נסה שוב מאוחר יותר.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, selectedTopic, timeRange]);

  // פונקציה לייצוא נתונים
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch(`/api/dashboard/export?format=${format}`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      if (format === 'csv') {
        // הורדת קובץ CSV
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // הורדת קובץ JSON
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('שגיאה בייצוא הנתונים. אנא נסה שוב.');
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8B5CF6'];

  return (
    <div className="min-h-screen bg-gray-100 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* כותרת ופילטרים */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">דשבורד ניתוח משתמשים</h1>
            <p className="text-sm text-gray-600 mt-2">ניתוח מקיף של פעילות המשתמשים במערכת</p>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/topics" className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-300">
              חזור לעמוד הראשי
            </Link>
          </div>
        </div>

        {/* פילטרים וכפתורי ייצוא */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <select 
                value={selectedTopic} 
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">כל הנושאים</option>
                <option value="Diplomacy and International Relations">Diplomacy and International Relations</option>
                <option value="Economy and Entrepreneurship">Economy and Entrepreneurship</option>
                <option value="Environment and Sustainability">Environment and Sustainability</option>
                <option value="History and Heritage">History and Heritage</option>
                <option value="Holocaust and Revival">Holocaust and Revival</option>
                <option value="Innovation and Technology">Innovation and Technology</option>
                <option value="Iron Swords War">Iron Swords War</option>
                <option value="Science and Technology">Science and Technology</option>
                <option value="Society and Multiculturalism">Society and Multiculturalism</option>
              </select>
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">7 ימים</option>
                <option value="30d">30 ימים</option>
                <option value="90d">90 ימים</option>
                <option value="1y">שנה</option>
              </select>
            </div>
            
            {/* כפתורי ייצוא */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('json')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                ייצוא JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-300 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                ייצוא CSV
              </button>
            </div>
          </div>
        </div>

        {/* כרטיסי סטטיסטיקות כלליות */}
        {data?.userStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard 
              title="סה״כ משתמשים" 
              value={data.userStats.totalUsers?.toLocaleString() || '0'} 
              icon={Users}
              change={data.userStats.userGrowth}
              changeType={data.userStats.userGrowth >= 0 ? 'positive' : 'negative'}
            />
            <StatCard 
              title="משתמשים פעילים" 
              value={data.userStats.activeUsers?.toLocaleString() || '0'} 
              icon={Activity}
              change={data.userStats.activityChange}
              changeType={data.userStats.activityChange >= 0 ? 'positive' : 'negative'}
            />
            <StatCard 
              title="משתמשים חדשים החודש" 
              value={String(data.userStats.newUsersThisMonth || 0)} 
              icon={Calendar}
              change={data.userStats.newUserGrowth}
              changeType={data.userStats.newUserGrowth >= 0 ? 'positive' : 'negative'}
            />
            <StatCard 
              title="ציון ממוצע" 
              value={String(data.userStats.averageScore || 0)} 
              icon={TrendingUp}
              change={data.userStats.scoreChange}
              changeType={data.userStats.scoreChange >= 0 ? 'positive' : 'negative'}
            />
          </div>
        )}

        {/* גרפים ראשונים */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* הפלגת משתמשים לפי רמה */}
          {data?.usersByLevel && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">הפלגת משתמשים לפי רמה</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.usersByLevel}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, value}: {name: string; value: number}) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.usersByLevel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* פופולריות נושאים */}
          {data?.topicPopularity && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">פופולריות נושאים</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topicPopularity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="TopicHe" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [value, name === 'total_tasks' ? 'משימות' : 'השלמות']} />
                    <Legend formatter={(value) => value === 'total_tasks' ? 'משימות' : 'השלמות'} />
                    <Bar dataKey="total_tasks" fill="#8884d8" />
                    <Bar dataKey="completed_tasks" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* פעילות לאורך זמן */}
        {data?.userActivity && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">פעילות משתמשים לאורך זמן</h2>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.userActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend formatter={(value) => value === 'activities' ? 'פעילויות' : 'משתמשים פעילים'} />
                  <Line 
                    type="monotone" 
                    dataKey="activities" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="active_users" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* פעילות שבועית */}
        {data?.weeklyActivity && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">פעילות שבועית</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend formatter={(value) => value === 'activities' ? 'פעילויות' : 'ציון ממוצע'} />
                  <Bar dataKey="activities" fill="#8884d8" />
                  <Bar dataKey="avg_score" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* שיעור השלמה */}
        {data?.completionRates && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">שיעור השלמה לפי סוג פעילות</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.completionRates.map((item, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className="relative w-24 h-24 mb-2">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="#E5E7EB"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - item.rate / 100)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                      {item.rate}%
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-700">{item.name}</h3>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* רשימת נושאים מובילים */}
        {data?.topicPopularity && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">נושאים מובילים לפי ציון ממוצע</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      נושא
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      משימות
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      השלמות
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ציון ממוצע
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.topicPopularity
                    .sort((a, b) => b.avg_score - a.avg_score)
                    .map((topic, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {topic.TopicHe || topic.TopicName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {topic.total_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {topic.completed_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            topic.avg_score >= 80 ? 'bg-green-100 text-green-800' :
                            topic.avg_score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {typeof topic.avg_score === 'number' ? topic.avg_score.toFixed(1) : '0'}                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* גרף מגמות תחזית */}
        {data?.trendForecast && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">מגמות פעילות - 30 ימים אחרונים</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trendForecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="activity_date" />
                  <YAxis />
                  <Tooltip />
                  <Legend formatter={(value) => value === 'daily_activities' ? 'פעילויות יומיות' : 'משתמשים ייחודיים'} />
                  <Line 
                    type="monotone" 
                    dataKey="daily_activities" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="unique_users" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;