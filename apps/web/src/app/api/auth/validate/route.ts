// apps/web/src/app/api/auth/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check for token
    if (!body.token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 400 }
      );
    }
    
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/auth/validate`;
    console.log('Validating token at:', apiUrl);
    
    // Forward validation request to backend
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${body.token}`
      },
      body: JSON.stringify({ token: body.token })
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (response.ok) {
        return NextResponse.json({
          success: true,
          valid: true,
          user: data.user
        });
      } else {
        return NextResponse.json(
          { 
            success: false,
            valid: false,
            message: data.message || 'Token validation failed'
          },
          { status: response.status }
        );
      }
    } else {
      // Handle non-JSON response
      const textResponse = await response.text();
      console.error('Non-JSON response from validate API:', textResponse.substring(0, 200));
      
      return NextResponse.json(
        {
          success: false,
          valid: false,
          message: 'Invalid response from authentication server'
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { 
        success: false,
        valid: false,
        message: 'Failed to validate token',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}