// apps/web/src/app/components/AuthCheck.tsx
'use client';

import { useState, useEffect } from 'react';

/**
 * רכיב פשוט לבדיקת מצב האימות
 */
const AuthCheck = () => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [message, setMessage] = useState('בודק אימות...');
  const [token, setToken] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<any>(null);

  // פונקציה לבדיקת קריאה פשוטה ל-API
  const testApiCall = async () => {
    try {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken ? storedToken.substring(0, 15) + '...' : 'לא נמצא');
      
      if (!storedToken) {
        setStatus('error');
        setMessage('לא נמצא טוקן בלוקל סטוראג\'');
        return;
      }
      
      // בדיקת מידע בסיסי של המשתמש
      const response = await fetch('/api/user-check', {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        }
      });
      
      if (!response.ok) {
        setStatus('error');
        setMessage(`בדיקת אימות נכשלה: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      setStatus('success');
      setMessage('אימות הצליח!');
      setDecoded(data);
    } catch (error) {
      setStatus('error');
      setMessage(`שגיאה בבדיקת אימות: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
    }
  };

  useEffect(() => {
    testApiCall();
  }, []);

  // פונקציה להתחברות מחדש
  const handleRelogin = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="p-4 m-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2">מצב אימות:</h3>
      
      {status === 'loading' && (
        <div className="flex items-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          <p>{message}</p>
        </div>
      )}
      
      {status === 'success' && (
        <div className="text-green-600">
          <p className="font-semibold">✓ {message}</p>
          <div className="mt-2 text-sm text-gray-700">
            <p><strong>טוקן:</strong> {token}</p>
            {decoded && (
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <p><strong>מזהה משתמש:</strong> {decoded.userId || decoded.sub || 'לא נמצא'}</p>
                <p><strong>אימייל:</strong> {decoded.email || 'לא נמצא'}</p>
                <p><strong>שם:</strong> {decoded.name || 'לא נמצא'}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="text-red-600">
          <p className="font-semibold">✗ {message}</p>
          <div className="mt-2 text-sm">
            <p><strong>טוקן:</strong> {token}</p>
          </div>
          <button 
            onClick={handleRelogin}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            התחבר מחדש
          </button>
        </div>
      )}
      
      <div className="mt-3">
        <button 
          onClick={testApiCall}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
        >
          בדוק שוב
        </button>
      </div>
    </div>
  );
};

export default AuthCheck;