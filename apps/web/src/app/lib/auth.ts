// apps/web/src/lib/auth.ts

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: any;
  message?: string;
  details?: any;
}

/**
 * Login user with email and password
 */
export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    // Ensure response follows consistent format
    return {
      success: response.ok,
      token: data.token,
      user: data.user,
      message: data.message,
      details: data.details
    };
  } catch (error) {
    console.error('Login service error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

/**
 * Check if the API is reachable
 */
export async function checkApiHealth(): Promise<{
  isReachable: boolean;
  details: any;
}> {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    
    return {
      isReachable: data.status === 'online',
      details: data
    };
  } catch (error) {
    return {
      isReachable: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

export async function validateToken(): Promise<{
  isValid: boolean;
  user?: any;
}> {
  try {
    // קבלת הטוקן מה-localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      return { isValid: false };
    }
    
    const response = await fetch('/api/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();
    
    return {
      isValid: data.success,
      user: data.user
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return { isValid: false };
  }
}

/**
 * שמירת טוקן האימות במערכת
 */
export function saveAuthToken(token: string, user: any): void {
  if (typeof window !== 'undefined') {
    // שמירה בלוקל סטורג'
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // שמירה בעוגיות
    document.cookie = `auth_token=${token}; path=/; max-age=604800`; // תוקף של שבוע
  }
}

/**
 * מחיקת טוקן האימות מהמערכת (לוגאאוט)
 */
export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    // מחיקה מלוקל סטורג'
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // מחיקה מעוגיות
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}