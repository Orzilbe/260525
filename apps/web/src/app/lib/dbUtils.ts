// apps/web/src/app/lib/dbUtils.ts
import mysql from 'mysql2/promise';

/**
 * Create a direct database connection that bypasses any pooling issues
 */
export async function createDirectConnection() {
  try {
    // Load environment variables
    const host = process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost';
    const user = process.env.DB_USER || process.env.MYSQL_USER || 'root';
    const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
    const database = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'unityvoice';
    const ssl = process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true';
    
    // Log connection attempt
    console.log(`Attempting to connect to MySQL database: ${user}@${host}/${database}`);
    
    // Create connection
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
      ssl: ssl ? {
        rejectUnauthorized: false
      } : undefined
    });
    
    // Test connection
    const [result] = await connection.execute('SELECT 1 as test');
    console.log('Database connection successful, test query result:', result);
    
    return connection;
  } catch (error) {
    console.error('Error creating direct database connection:', error);
    return null;
  }
}

/**
 * Execute a database query with error handling and logging
 */
export async function executeQuery(
  query: string,
  params: any[],
  operationName: string
) {
  let connection = null;
  try {
    // Get connection
    connection = await createDirectConnection();
    if (!connection) {
      throw new Error('Failed to establish database connection');
    }
    
    // Log query
    console.log(`Executing ${operationName} query:`, query);
    console.log(`Query parameters:`, params);
    
    // Execute query
    const [result] = await connection.execute(query, params);
    console.log(`${operationName} query result:`, JSON.stringify(result));
    
    return { success: true, result };
  } catch (error) {
    console.error(`Error executing ${operationName} query:`, error);
    return { success: false, error };
  } finally {
    // Clean up connection
    if (connection) {
      try {
        await connection.end();
        console.log('Database connection closed successfully');
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
}

/**
 * Check if a record exists in the database
 */
export async function recordExists(
  table: string,
  field: string,
  value: string
): Promise<boolean> {
  const query = `SELECT 1 FROM ${table} WHERE ${field} = ? LIMIT 1`;
  const { success, result } = await executeQuery(query, [value], `Check ${table} existence`);
  
  if (!success || !result) {
    return false;
  }
  
  return Array.isArray(result) && result.length > 0;
}

/**
 * Create a new interactive session in the database
 */
export async function createInteractiveSession(
  sessionId: string,
  taskId: string,
  sessionType: string = 'conversation'
): Promise<boolean> {
  // Check if session already exists
  const sessionExists = await recordExists('InteractiveSessions', 'SessionId', sessionId);
  if (sessionExists) {
    console.log(`Interactive session ${sessionId} already exists`);
    return true;
  }
  
  const taskExists = await recordExists('Tasks', 'TaskId', taskId);
  if (!taskExists) {
    console.warn(`Task ${taskId} does not exist in the database`);
    // Continue anyway to ensure session is created
  }
  
  // Format current timestamp for MySQL
  const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS
  
  // Insert query
  const query = `
    INSERT INTO InteractiveSessions 
    (SessionId, TaskId, SessionType, CreatedAt, UpdatedAt) 
    VALUES (?, ?, ?, ?, ?)
  `;
  
  const { success } = await executeQuery(
    query, 
    [sessionId, taskId, sessionType, now, now], 
    'Create interactive session'
  );
  
  return success;
}

/**
 * Create a new question in the database
 */
export async function createQuestion(
  questionId: string,
  sessionId: string,
  questionText: string
): Promise<boolean> {
  // Check if question already exists
  const questionExists = await recordExists('Questions', 'QuestionId', questionId);
  if (questionExists) {
    console.log(`Question ${questionId} already exists`);
    return true;
  }
  
  const sessionExists = await recordExists('InteractiveSessions', 'SessionId', sessionId);
  if (!sessionExists) {
    console.warn(`Session ${sessionId} does not exist in the database`);
    // Continue anyway to ensure question is created
  }
  
  // Format current timestamp for MySQL
  const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS
  
  // Insert query
  const query = `
    INSERT INTO Questions 
    (QuestionId, SessionId, QuestionText, CreatedAt, UpdatedAt) 
    VALUES (?, ?, ?, ?, ?)
  `;
  
  const { success } = await executeQuery(
    query, 
    [questionId, sessionId, questionText, now, now], 
    'Create question'
  );
  
  return success;
}

/**
 * Update a question with answer and feedback
 */
export async function updateQuestion(
  questionId: string,
  answerText?: string,
  feedback?: string
): Promise<boolean> {
  // Check if question exists
  const questionExists = await recordExists('Questions', 'QuestionId', questionId);
  if (!questionExists) {
    console.warn(`Question ${questionId} does not exist in the database`);
    return false;
  }
  
  // Format current timestamp for MySQL
  const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:MM:SS
  
  // Build update query
  let query = 'UPDATE Questions SET UpdatedAt = ?';
  const params: any[] = [now];
  
  if (answerText !== undefined) {
    query += ', AnswerText = ?';
    params.push(answerText);
  }
  
  if (feedback !== undefined) {
    query += ', Feedback = ?';
    params.push(feedback);
  }
  
  query += ' WHERE QuestionId = ?';
  params.push(questionId);
  
  const { success } = await executeQuery(
    query, 
    params, 
    'Update question'
  );
  
  return success;
}
