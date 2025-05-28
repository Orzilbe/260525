// apps/web/src/app/api/auth/register/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Starting registration process...');
  
  try {
    const body = await request.json();
    console.log('Registration request body:', JSON.stringify(body, null, 2));
    
    // פנה לשרת API האמיתי
    console.log('Sending request to API server...');
    const apiResponse = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    console.log('API response status:', apiResponse.status);
    const data = await apiResponse.json();
    console.log('API response data:', JSON.stringify(data, null, 2));
    
    if (!apiResponse.ok) {
      console.error('API returned an error:', data.message || 'Registration failed');
      return NextResponse.json(
        { message: data.message || 'Registration failed', details: data.errors || data.details }, 
        { status: apiResponse.status }
      );
    }
    
    console.log('Registration successful');
    return NextResponse.json(data, { status: apiResponse.status });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // בדיקה לבעיות CORS או קישוריות לשרת
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - likely CORS issue or API server not running');
      return NextResponse.json(
        { message: 'Cannot connect to authentication server', error: 'Network error' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { message: 'Registration failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}