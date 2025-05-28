// apps/web/src/hooks/useAuth.ts
import { useState, useEffect } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id?: string;
    userId?: string;
    role?: string;
    UserRole?: string;
    [key: string]: any;
  } | null;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null
  });

  useEffect(() => {
    const validateAuth = async () => {
      // If no token exists, user is not authenticated
      const token = localStorage.getItem('token');
      if (!token) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
        return;
      }

      try {
        // Validate token with API
        const response = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.valid) {
          // Get user data from API response
          let userData = data.user;
          
          // Ensure role is properly set
          if (userData) {
            userData.role = userData.role || userData.UserRole;
          }

          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: userData,
            error: null
          });
        } else {
          // Invalid token
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: data.message || 'Authentication failed'
          });
        }
      } catch (error) {
        console.error('Auth validation error:', error);
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: error instanceof Error ? error.message : 'Authentication error'
        });
      }
    };

    validateAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: data.user,
          error: null
        });
        
        return { success: true };
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: data.message || 'Login failed'
        });
        
        return { 
          success: false, 
          message: data.message || 'Login failed' 
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage
      });
      
      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null
    });
  };

  return {
    ...authState,
    login,
    logout
  };
};