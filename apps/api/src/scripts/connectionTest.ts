// apps/api/src/scripts/connectionTest.ts
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function testAzureConnection() {
  try {
    console.log('Attempting to connect to Azure MySQL...');
    console.log('Host:', process.env.MYSQL_HOST);
    console.log('User:', process.env.MYSQL_USER);
    console.log('Database:', process.env.MYSQL_DATABASE);

    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      ssl: {
        rejectUnauthorized: true
      }
    });

    console.log('✅ Connection Successful');
    
    // Test query
    const [rows] = await connection.query('SELECT 1 as test');
    console.log('Test Query Result:', rows);

    await connection.end();
  } catch (error) {
    console.error('❌ Connection Failed:', error);
  }
  async function checkPermissions() {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      ssl: { rejectUnauthorized: true }
    });
    
    try {
      console.log('Checking permissions...');
      // בדיקת הרשאות קריאה
      await connection.query('SELECT 1 FROM users LIMIT 1');
      console.log('Read permission: OK');
      
      // בדיקת הרשאות כתיבה
      await connection.query(`
        INSERT INTO users (UserId, Email, FirstName, LastName, Password, PhoneNumber, AgeRange, 
                          EnglishLevel, Score, CreationDate, UserRole, IsActive) 
        VALUES ('test_perm_${Date.now()}', 'test_perm@example.com', 'Test', 'User', 
                'TestPassword123', '1234567890', 'AGE_25_34', 'intermediate', 
                0, NOW(), 'user', true)
      `);
      console.log('Write permission: OK');
      
      // מחיקת הרשומה הזמנית
      await connection.query(`DELETE FROM users WHERE Email = 'test_perm@example.com'`);
      console.log('Delete permission: OK');
    } catch (error) {
      console.error('Permission error:', error);
    } finally {
      await connection.end();
    }
  }
  
  checkPermissions();
}

testAzureConnection();