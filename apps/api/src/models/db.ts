// apps/api/src/models/db.ts (או היכן שנמצא קובץ החיבור לבסיס הנתונים)
import mysql, { Pool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// נתיב יחסי לקובץ התעודה
const sslCertPath = path.join(__dirname, '../config/DigiCertGlobalRootCA.crt.pem');

// הגדר אפשרויות SSL
const sslOptions = process.env.MYSQL_SSL === 'true' ? {
  rejectUnauthorized: false
} : undefined;

// יצירת מאגר חיבורים
const pool: Pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  ssl: sslOptions,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('Database pool created with the following configuration:');
console.log(`Host: ${process.env.MYSQL_HOST}`);
console.log(`User: ${process.env.MYSQL_USER}`);
console.log(`Database: ${process.env.MYSQL_DATABASE}`);
console.log(`SSL enabled: ${process.env.MYSQL_SSL === 'true' ? 'Yes' : 'No'}`);

export default pool;