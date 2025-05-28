import fs from 'fs';
import path from 'path';
import pool from '../db';

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Create migrations table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS DatabaseMigrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_filename (filename)
      )
    `);
    
    // Get list of executed migrations
    const [executedMigrations] = await pool.execute('SELECT filename FROM DatabaseMigrations');
    const executedFiles = new Set((executedMigrations as any[]).map(row => row.filename));
    
    // Read migration files
    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Execute new migrations
    for (const file of files) {
      if (!executedFiles.has(file)) {
        console.log(`Executing migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          
          // Execute migration
          await connection.execute(sql);
          
          // Record migration
          await connection.execute(
            'INSERT INTO DatabaseMigrations (filename) VALUES (?)',
            [file]
          );
          
          await connection.commit();
          console.log(`Migration ${file} executed successfully`);
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }
    }
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

export default runMigrations; 