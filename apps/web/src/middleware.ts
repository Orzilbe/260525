// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuth } from './lib/auth';

// Define protected and auth routes
const protectedRoutes = ['/topics', '/profile', '/dashboard'];
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Get the token from the request
  const token = request.cookies.get('auth-token')?.value;

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isAuthRoute = authRoutes.some(route => path.startsWith(route));

  // If no token and trying to access protected route, redirect to login
  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If has token and trying to access auth route, redirect to topics
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/topics', request.url));
  }

  // Special handling for dashboard route
  if (path === '/dashboard') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      const user = await verifyAuth(token);
      if (!user || user.role !== 'admin') {
        return NextResponse.redirect(new URL('/topics', request.url));
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/topics/:path*',
    '/profile/:path*',
    '/dashboard/:path*',
    '/login',
    '/register'
  ]
};