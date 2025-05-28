// apps/web/src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    console.log('Checking API health at:', apiUrl);
    
    if (!apiUrl) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'API URL environment variable is not set' 
        },
        { status: 500 }
      );
    }
    
    // Try to connect to the API's health endpoint, or just the base URL
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json'
      }
    });

    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      return NextResponse.json({
        status: response.ok ? 'online' : 'error',
        apiUrl: apiUrl,
        statusCode: response.status,
        contentType: contentType,
        data: data
      });
    } else {
      const textResponse = await response.text();
      return NextResponse.json({
        status: 'error',
        apiUrl: apiUrl,
        statusCode: response.status,
        contentType: contentType || 'unknown',
        responsePreview: textResponse.substring(0, 200)
      });
    }
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'not set'
      },
      { status: 500 }
    );
  }
}