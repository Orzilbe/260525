// apps/web/src/app/api/topics/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Mock data to use when API is unavailable
const mockTopics = [
  {
    TopicName: "Travel",
    TopicHe: "נסיעות",
    Icon: "✈️"
  },
  {
    TopicName: "Food",
    TopicHe: "אוכל",
    Icon: "🍔"
  },
  {
    TopicName: "Business",
    TopicHe: "עסקים",
    Icon: "💼"
  },
  {
    TopicName: "Health",
    TopicHe: "בריאות",
    Icon: "🏥"
  },
  {
    TopicName: "Technology",
    TopicHe: "טכנולוגיה",
    Icon: "💻"
  },
  {
    TopicName: "Sports",
    TopicHe: "ספורט",
    Icon: "⚽"
  },
  {
    TopicName: "Education",
    TopicHe: "חינוך",
    Icon: "📚"
  },
  {
    TopicName: "Entertainment",
    TopicHe: "בידור",
    Icon: "🎬"
  }
];

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Fetch topics from backend API
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/topics`;
    console.log('Fetching topics from:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.log('Failed to fetch topics from backend, using mock data');
        throw new Error('Failed to fetch topics from backend');
      }
      
      const topics = await response.json();
      return NextResponse.json(topics);
    } catch (error) {
      // Use mock data for development or when backend fails
      console.log('Using mock topic data');
      return NextResponse.json(mockTopics);
    }
  } catch (error) {
    console.error('Error in /api/topics route:', error);
    // Return mock data even in case of error to prevent UI failures
    return NextResponse.json(mockTopics);
  }
}