// apps/api/src/models/User.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import crypto from 'crypto';
import pool from './db';

export enum EnglishLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced"
}

export enum AgeRange {
  AGE_0_17 = "0-17",
  AGE_18_24 = "18-24",
  AGE_25_34 = "25-34",
  AGE_35_44 = "35-44",
  AGE_45_54 = "45-54",
  AGE_55_PLUS = "55+"
}

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}
export interface IUser extends RowDataPacket {
  UserId: string;
  Email: string;
  FirstName: string;
  LastName: string;
  Password: string;
  PhoneNumber: string;
  AgeRange: AgeRange;
  EnglishLevel: EnglishLevel;
  ProfilePicture?: string;
  Score: number;
  CreationDate: Date;
  LastLogin?: Date;
  UserRole: UserRole;
  IsActive: boolean;
}


class User {
   private static validateUserInput(userData: Partial<IUser>): void {
    // Email validation
    if (userData.Email && !validator.isEmail(userData.Email)) {
      throw new Error('Invalid email address');
    }

    // Phone number validation (optional, adjust regex as needed)
    if (userData.PhoneNumber && !validator.isMobilePhone(userData.PhoneNumber, 'any')) {
      throw new Error('Invalid phone number');
    }

    // Password strength validation (when creating/updating password)
    if (userData.Password && !validator.isStrongPassword(userData.Password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      throw new Error('Password does not meet strength requirements');
    }

    // Validate enum values
    if (userData.UserRole && !Object.values(UserRole).includes(userData.UserRole)) {
      throw new Error('Invalid user role');
    }

    if (userData.AgeRange && !Object.values(AgeRange).includes(userData.AgeRange)) {
      throw new Error('Invalid age range');
    }

    if (userData.EnglishLevel && !Object.values(EnglishLevel).includes(userData.EnglishLevel)) {
      throw new Error('Invalid English level');
    }
  }

  // Generate a more robust unique user ID
  private static generateUserId(): string {
    return `usr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  }
  // Find user by ID
  static async findById(userId: string): Promise<IUser | null> {
    try {
      const [rows] = await pool.execute<IUser[]>(
        'SELECT * FROM Users WHERE UserId = ?',
        [userId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email: string): Promise<IUser | null> {
    try {
      const [rows] = await pool.execute<IUser[]>(
        'SELECT * FROM Users WHERE Email = ?',
        [email]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Create a new user
// Create a new user
static async create(userData: {
  Email: string;
  FirstName: string;
  LastName: string;
  Password: string;
  PhoneNumber: string;
  AgeRange: AgeRange;
  EnglishLevel: EnglishLevel;
  ProfilePicture?: string;
  UserRole?: UserRole;
}): Promise<string> {
  try {
    console.log('Starting user creation with data:', {
      ...userData,
      Password: '***HIDDEN***' // מסתיר את הסיסמה מהלוג
    });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.Password, salt);
    
    // Generate unique ID for user
    const userId = this.generateUserId(); // השתמש בפונקציה הקיימת
    
    // Set default values
    const userRole = userData.UserRole || UserRole.USER;
    const creationDate = new Date();
    
    console.log('Executing SQL query for user creation');
    console.log('UserId:', userId);
    
    // בדוק את המבנה המדויק של הטבלה - ללא שדה Badge
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO Users 
       (UserId, Email, FirstName, LastName, Password, PhoneNumber, AgeRange, 
        EnglishLevel, ProfilePicture, Score, CreationDate, UserRole, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userData.Email,
        userData.FirstName, 
        userData.LastName,
        hashedPassword,
        userData.PhoneNumber,
        userData.AgeRange,
        userData.EnglishLevel,
        userData.ProfilePicture || null,
        0, // Initial score
        creationDate,
        userRole,
        true // IsActive
      ]
    );
    
    console.log('SQL execution result:', result);
    
    if (result.affectedRows !== 1) {
      throw new Error('Failed to create user');
    }
    
    return userId;
  } catch (error) {
    console.error('Detailed error in user creation:', error);
    // פירוט נוסף על השגיאה
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if ('code' in error) {
        console.error('SQL error code:', (error as any).code);
      }
      if ('errno' in error) {
        console.error('SQL error number:', (error as any).errno);
      }
      if ('sqlMessage' in error) {
        console.error('SQL message:', (error as any).sqlMessage);
      }
    }
    throw error;
  }
}

  // Update password
  static async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE Users SET Password = ? WHERE UserId = ?',
        [hashedPassword, userId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(userId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE Users SET LastLogin = NOW() WHERE UserId = ?',
        [userId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  // Compare password for authentication
  static async comparePassword(user: IUser, candidatePassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(candidatePassword, user.Password);
    } catch (error) {
      console.error('Error comparing password:', error);
      throw error;
    }
  }

  // Delete user (soft delete)
  static async delete(userId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE Users SET IsActive = false WHERE UserId = ?',
        [userId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

export default User;
