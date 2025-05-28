// apps/web/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: body.email
      }
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await compare(body.password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-fallback-secret',
      { expiresIn: '24h' }
    );

    // Return success response with token and user data
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Login failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}