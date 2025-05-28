// apps/api/src/services/db-service.ts
import { getDbPool } from '../lib/db';

export class DatabaseService {
  
  async query(sql: string, params: any[] = []) {
    const pool = await getDbPool();
    const [results] = await pool.execute(sql, params);
    return results;
  }

  async findAll(table: string) {
    return this.query(`SELECT * FROM ${table}`);
  }

  async findById(table: string, id: number) {
    return this.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  }

  async create(table: string, data: Record<string, any>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = await this.query(sql, values);
    return result;
  }

  async update(table: string, id: number, data: Record<string, any>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    const result = await this.query(sql, [...values, id]);
    return result;
  }

  async delete(table: string, id: number) {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    const result = await this.query(sql, [id]);
    return result;
  }
}