// apps/web/src/app/api/top-users/route.ts
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

type TimeFrame = 'week' | 'month' | 'all-time';

interface UserProgress {
  score: number | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  UserProgress: UserProgress[];
}

interface LeaderboardEntryBase {
  userId: string;
  firstName: string;
  lastName: string;
  score: number;
  isCurrentUser: boolean;
}

interface LeaderboardEntry extends LeaderboardEntryBase {
  rank: number;
}

interface UserRank {
  rank: number;
  score: number;
  pointsToNextRank: number;
}

export async function GET(request: Request) {
  try {
    // Check if Prisma is properly initialized
    if (!prisma) {
      console.error('Prisma client is not initialized');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    // Get token from request headers
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await verifyAuth(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userEmail = user.email;
    const { searchParams } = new URL(request.url);
    const timeFrame = searchParams.get('timeFrame') || 'week';

    // Calculate date range based on time frame
    const now = new Date();
    let startDate: Date;
    switch (timeFrame) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'all-time':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    try {
      // Test database connection
      await prisma.$connect();
      
      // Get all users with their scores
      const users = await prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          UserProgress: {
            where: {
              completedAt: {
                gte: startDate
              }
            },
            select: {
              score: true
            }
          }
        }
      });

      if (!users || users.length === 0) {
        return NextResponse.json({
          leaderboard: [],
          userRank: null
        });
      }

      // Calculate total scores and create leaderboard entries
      const leaderboardEntries: LeaderboardEntryBase[] = users.map((user: User) => ({
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        score: user.UserProgress.reduce((sum: number, progress: UserProgress) => 
          sum + (progress.score || 0), 0),
        isCurrentUser: user.email === userEmail
      }));

      // Sort by score in descending order
      leaderboardEntries.sort((a: LeaderboardEntryBase, b: LeaderboardEntryBase) => b.score - a.score);

      // Add ranks
      const leaderboard: LeaderboardEntry[] = leaderboardEntries.map((entry: LeaderboardEntryBase, index: number) => ({
        ...entry,
        rank: index + 1
      }));

      // Find current user's rank and points to next rank
      const currentUserEntry = leaderboard.find((entry: LeaderboardEntry) => entry.isCurrentUser);
      const userRank = currentUserEntry ? {
        rank: currentUserEntry.rank,
        score: currentUserEntry.score,
        pointsToNextRank: currentUserEntry.rank > 1 
          ? leaderboard[currentUserEntry.rank - 2].score - currentUserEntry.score
          : 0
      } : null;

      return NextResponse.json({
        leaderboard,
        userRank
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { 
          error: 'Database error',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        },
        { status: 500 }
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}