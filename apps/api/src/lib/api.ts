// apps/api/src/lib/api.ts
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token'); // Get token from storage
  
    const defaultOptions: RequestInit = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
  
    const mergedOptions = { ...defaultOptions, ...options };
  
    const response = await fetch(url, mergedOptions);
  
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Something went wrong');
    }
  
    return response.json();
  }