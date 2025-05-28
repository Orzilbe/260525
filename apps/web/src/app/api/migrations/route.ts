import { NextRequest, NextResponse } from 'next/server';
import { applyMigrations } from './apply_migrations';
import jwt from 'jsonwebtoken';

// Function to verify admin token
function verifyAdminToken(token: string): boolean {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as any;
    return decoded.isAdmin === true;
  } catch (error) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await applyMigrations();
    return NextResponse.json({ success: true, message: 'Migrations applied successfully' });
  } catch (error) {
    console.error('Error applying migrations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to apply migrations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 