// apps/api/src/models/BaseModel.ts
import { RowDataPacket, ResultSetHeader, Pool, PoolConnection } from 'mysql2/promise';
import pool from './db';

export interface QueryResult {
  results: any;
  fields?: any;
}

export default abstract class BaseModel {
  protected static pool: Pool = pool;
  protected tableName: string;
  
  constructor(tableName: string) {
    this.tableName = tableName;
  }
  
  // Get a connection from the pool
  protected async getConnection(): Promise<PoolConnection> {
    return await BaseModel.pool.getConnection();
  }
  
  // Execute a query with transaction support
  protected async executeQuery(
    query: string, 
    params: any[] = [], 
    useTransaction: boolean = false
  ): Promise<QueryResult> {
    let connection: PoolConnection | null = null;
    
    try {
      if (useTransaction) {
        connection = await this.getConnection();
        await connection.beginTransaction();
        const [results, fields] = await connection.execute(query, params);
        await connection.commit();
        return { results, fields };
      } else {
        const [results, fields] = await BaseModel.pool.execute(query, params);
        return { results, fields };
      }
    } catch (error) {
      if (connection && useTransaction) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
  
  // Find one record by id
  async findById(id: string): Promise<any> {
    const primaryKey = this.getPrimaryKeyColumn();
    const query = `SELECT * FROM ${this.tableName} WHERE ${primaryKey} = ?`;
    const { results } = await this.executeQuery(query, [id]);
    
    if (Array.isArray(results) && results.length > 0) {
      return results[0];
    }
    
    return null;
  }
  
  // Find all records
  async findAll(limit?: number, offset?: number): Promise<any[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    
    if (limit !== undefined && offset !== undefined) {
      query += ` LIMIT ? OFFSET ?`;
      const { results } = await this.executeQuery(query, [limit, offset]);
      return results as any[];
    } else {
      const { results } = await this.executeQuery(query);
      return results as any[];
    }
  }
  
  // Find records by a condition
  async findBy(fieldName: string, value: any): Promise<any[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${fieldName} = ?`;
    const { results } = await this.executeQuery(query, [value]);
    return results as any[];
  }
  
  // Create a new record
  async create(data: Record<string, any>): Promise<ResultSetHeader> {
    const fields = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    const query = `INSERT INTO ${this.tableName} (${fields}) VALUES (${placeholders})`;
    const { results } = await this.executeQuery(query, values, true);
    
    return results as ResultSetHeader;
  }
  
  // Update a record by id
  async updateById(id: string, data: Record<string, any>): Promise<ResultSetHeader> {
    const primaryKey = this.getPrimaryKeyColumn();
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    
    const query = `UPDATE ${this.tableName} SET ${fields} WHERE ${primaryKey} = ?`;
    const { results } = await this.executeQuery(query, values, true);
    
    return results as ResultSetHeader;
  }
  
  // Delete a record by id
  async deleteById(id: string): Promise<ResultSetHeader> {
    const primaryKey = this.getPrimaryKeyColumn();
    const query = `DELETE FROM ${this.tableName} WHERE ${primaryKey} = ?`;
    const { results } = await this.executeQuery(query, [id], true);
    
    return results as ResultSetHeader;
  }
  
  // Count records
  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const { results } = await this.executeQuery(query);
    
    if (Array.isArray(results) && results.length > 0) {
      return results[0].count;
    }
    
    return 0;
  }
  
  // Custom query execution
  async query(query: string, params: any[] = []): Promise<QueryResult> {
    return await this.executeQuery(query, params);
  }
  
  // Get the primary key column name (override in specific model classes)
  protected getPrimaryKeyColumn(): string {
    return 'id';
  }
} 