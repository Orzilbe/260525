// apps/web/src/app/dashboard/page.tsx
'use client';

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Dashboard from '../components/Dashboard';

export default function DashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Dashboard Page - Auth State:', {
      isAuthenticated,
      isLoading,
      user,
      role: user?.role,
      UserRole: user?.UserRole
    });

    if (!isLoading) {
      if (!isAuthenticated) {
        console.log('Not authenticated, redirecting to login');
        router.push('/login');
      } else if (user?.role !== 'admin' && user?.UserRole !== 'admin') {
        console.log('Not admin, redirecting to topics');
        router.push('/topics');
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If not authenticated or not admin, don't render anything
  if (!isAuthenticated || (user?.role !== 'admin' && user?.UserRole !== 'admin')) {
    console.log('Not rendering dashboard - Auth check failed:', {
      isAuthenticated,
      role: user?.role,
      UserRole: user?.UserRole
    });
    return null;
  }

  return <Dashboard />;
}