// apps/web/src/app/api/user-data/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Unauthorized - No token found' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Fetch user data from backend API
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/user/data`;
    console.log('Fetching user data from:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.log('Failed to fetch user data from backend');
        throw new Error('Failed to fetch user data from backend');
      }
      
      const userData = await response.json();
      return NextResponse.json(userData);
    } catch (error) {
      // Use mock data for development or when backend fails
      console.log('Using mock user data');
      
      const mockUserData = {
        currentLevel: "Beginner",
        currentLevelPoints: 0,
        Score: 0,
        completedTasksCount: 0,
        CreationDate: new Date().toISOString(),
        nextLevel: "Intermediate",
        pointsToNextLevel: 100
      };
      
      return NextResponse.json(mockUserData);
    }
  } catch (error) {
    console.error('Error in /api/user-data route:', error);
    return NextResponse.json(
      { message: 'Failed to fetch user data', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}