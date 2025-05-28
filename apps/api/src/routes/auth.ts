import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { UserRole, AgeRange, EnglishLevel } from '../models/User';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import DatabaseConnection from '../config/database';  
import { errorHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/authMiddleware';
import { initializeUserLevels } from '../services/userLevelService';

// Create router
const router = express.Router();

router.post('/validate', authMiddleware, async (req, res) => {
  try {
    console.log('Validate endpoint - Request user:', req.user);
    
    const pool = DatabaseConnection.getPool();
    
    // Get full user data from database
    const [users] = await pool.query(
      'SELECT UserId, Email, UserRole FROM Users WHERE UserId = ?',
      [req.user?.id]
    );

    const user = (users as any[])[0];
    console.log('Validate endpoint - Database user:', user);

    // If the middleware passes, the token is valid
    const response = { 
      valid: true, 
      user: {
        id: user.UserId,
        email: user.Email,
        role: user.UserRole
      }
    };
    
    console.log('Validate endpoint - Response:', response);
    res.json(response);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      valid: false,
      message: 'Error validating user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = DatabaseConnection.getPool();
    
    // Find user by email
    const [users] = await pool.query(
      'SELECT UserId, Email, Password, UserRole FROM Users WHERE Email = ?', 
      [email]
    );

    // Check if user exists
    if (!users || (users as any[]).length === 0) {
      return res.status(401).json({ 
        message: 'User not found',
        details: `No user found with email: ${email}`
      });
    }

    const user = (users as any[])[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid password',
        details: 'The provided password does not match our records'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.UserId, 
        email: user.Email,
        role: user.UserRole
      }, 
      process.env.JWT_SECRET!, 
      { expiresIn: '24h' }
    );

    // Update last login
    await pool.query(
      'UPDATE Users SET LastLogin = NOW() WHERE UserId = ?', 
      [user.UserId]
    );

    res.json({
      token,
      user: {
        id: user.UserId,
        email: user.Email,
        UserRole: user.UserRole
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      email,
      firstName,
      lastName,
      phoneNumber,
      password,
      englishLevel,
      ageRange
    } = req.body;

    // Manual validation
    const errors = [];
    
    if (!email || !validator.isEmail(email)) {
      errors.push({ param: 'email', msg: 'Invalid email address' });
    }
    
    if (!firstName || !validator.isLength(firstName, { min: 2 })) {
      errors.push({ param: 'firstName', msg: 'First name must be at least 2 characters' });
    }
    
    if (!lastName || !validator.isLength(lastName, { min: 2 })) {
      errors.push({ param: 'lastName', msg: 'Last name must be at least 2 characters' });
    }
    
    if (!password || !validator.isLength(password, { min: 8 }) || 
        !password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
      errors.push({ param: 'password', msg: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character' });
    }
    
    if (!phoneNumber || !validator.isMobilePhone(phoneNumber, 'any')) {
      errors.push({ param: 'phoneNumber', msg: 'Invalid phone number' });
    }
    
    if (!englishLevel || !Object.values(EnglishLevel).includes(englishLevel as EnglishLevel)) {
      errors.push({ param: 'englishLevel', msg: 'Invalid English level' });
    }
    
    if (!ageRange || !Object.values(AgeRange).includes(ageRange as AgeRange)) {
      errors.push({ param: 'ageRange', msg: 'Invalid age range' });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Create user
    const userId = await User.create({
      Email: email,
      FirstName: firstName,
      LastName: lastName,
      Password: password,
      PhoneNumber: phoneNumber,
      AgeRange: ageRange,
      EnglishLevel: englishLevel,
      UserRole: UserRole.USER
    });

    // Initialize user levels across all topics
    await initializeUserLevels(userId);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId, 
        email,
        role: UserRole.USER
      }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '7d' }
    );

    return res.status(201).json({ 
      message: 'User registered successfully', 
      token,
      user: {
        userId,
        email,
        firstName,
        lastName,
        englishLevel
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
});

router.get('/debug-user', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const pool = DatabaseConnection.getPool();
    
    const [users] = await pool.query(
      'SELECT UserId, Email, Password FROM Users WHERE Email = ?', 
      [email as string]
    );

    if (!users || (users as any[]).length === 0) {
      return res.status(404).json({ 
        message: 'User not found',
        details: `No user found with email: ${email}`
      });
    }

    const user = (users as any[])[0];

    res.json({
      userId: user.UserId,
      email: user.Email,
      passwordHashLength: user.Password.length
    });
  } catch (error) {
    console.error('Debug user error:', error);
    res.status(500).json({ 
      message: 'Server error during user lookup',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;