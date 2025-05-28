import { getSafeDbPool } from '../../lib/db';
import fs from 'fs';
import path from 'path';

export async function applyMigrations() {
  console.log('Starting database migrations...');
  
  const pool = await getSafeDbPool();
  if (!pool) {
    console.error('Failed to get database connection');
    return;
  }

  try {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname);
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get already applied migrations
    const [appliedMigrations] = await pool.query('SELECT id FROM migrations');
    const appliedIds = (appliedMigrations as any[]).map(m => m.id);

    // Apply new migrations
    for (const file of migrationFiles) {
      const migrationId = file.split('.')[0];
      
      if (!appliedIds.includes(migrationId)) {
        console.log(`Applying migration: ${file}`);
        
        const migrationPath = path.join(migrationsDir, file);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        // Start transaction
        await pool.query('START TRANSACTION');
        
        try {
          // Apply migration
          await pool.query(migrationSql);
          
          // Record migration
          await pool.query('INSERT INTO migrations (id) VALUES (?)', [migrationId]);
          
          // Commit transaction
          await pool.query('COMMIT');
          
          console.log(`Successfully applied migration: ${file}`);
        } catch (error) {
          // Rollback on error
          await pool.query('ROLLBACK');
          console.error(`Failed to apply migration ${file}:`, error);
          throw error;
        }
      }
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error applying migrations:', error);
    throw error;
  }
} 