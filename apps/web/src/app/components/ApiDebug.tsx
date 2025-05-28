// apps/web/src/app/components/ApiDebug.tsx
'use client';

import { useState } from 'react';
import { checkApiHealth } from '../lib/auth';

export default function ApiDebug() {
  const [apiStatus, setApiStatus] = useState<null | {
    isReachable: boolean;
    details: any;
  }>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCheckHealth = async () => {
    setIsLoading(true);
    try {
      const result = await checkApiHealth();
      setApiStatus(result);
    } catch (error) {
      console.error('Error checking API health:', error);
      setApiStatus({
        isReachable: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gray-800 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-gray-700"
        aria-label="Toggle API debug panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>

      {isExpanded && (
        <div className="absolute bottom-14 right-0 bg-white rounded-lg shadow-xl p-4 w-80 border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-800">API Debug</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-3">
            <button
              onClick={handleCheckHealth}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              {isLoading ? 'Checking...' : 'Check API Connection'}
            </button>
          </div>

          {apiStatus && (
            <div className={`p-3 rounded ${apiStatus.isReachable ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center mb-2">
                <div className={`w-3 h-3 rounded-full mr-2 ${apiStatus.isReachable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`font-medium ${apiStatus.isReachable ? 'text-green-800' : 'text-red-800'}`}>
                  {apiStatus.isReachable ? 'API Reachable' : 'API Unreachable'}
                </span>
              </div>
              
              <div className="bg-white rounded border border-gray-200 p-2 mt-2 text-xs font-mono overflow-auto max-h-40">
                <pre>{JSON.stringify(apiStatus.details, null, 2)}</pre>
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500">
            API URL: {process.env.NEXT_PUBLIC_API_URL || 'Not set'}
          </div>
        </div>
      )}
    </div>
  );
}