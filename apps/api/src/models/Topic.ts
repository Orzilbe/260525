// apps/api/src/models/Topic.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface ITopic extends RowDataPacket {
  TopicName: string; 
  TopicHe: string;
  Icon: string;
  Order?: number;
  Difficulty?: string;
  Description?: string;
  DescriptionHe?: string;
}

class Topic {
  // Get all topics
  static async findAll(): Promise<ITopic[]> {
    try {
      const [rows] = await pool.execute<ITopic[]>(
        'SELECT * FROM Topics ORDER BY `Order`'
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding all topics:', error);
      throw error;
    }
  }

  // Find topic by name
  static async findByName(topicName: string): Promise<ITopic | null> {
    try {
      const [rows] = await pool.execute<ITopic[]>(
        'SELECT * FROM Topics WHERE TopicName = ?',
        [topicName]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding topic by name:', error);
      throw error;
    }
  }

  // Create a new topic
  static async create(topicData: {
    TopicName: string;
    TopicHe: string;
    Icon: string;
    Order?: number;
    Difficulty?: string;
    Description?: string;
    DescriptionHe?: string;
  }): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO Topics 
         (TopicName, TopicHe, Icon, \`Order\`, Difficulty, Description, DescriptionHe)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          topicData.TopicName,
          topicData.TopicHe,
          topicData.Icon,
          topicData.Order || 0,
          topicData.Difficulty || 'beginner',
          topicData.Description || '',
          topicData.DescriptionHe || ''
        ]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  }

  // Update topic
  static async update(topicName: string, updateData: Partial<ITopic>): Promise<boolean> {
    try {
      // Don't allow updating TopicName
      delete updateData.TopicName;
      
      // Build the SET part of the SQL query dynamically
      const updateFields = Object.keys(updateData)
        .map(field => {
          if (field === 'Order') {
            return '`Order` = ?';
          }
          return `${field} = ?`;
        })
        .join(', ');
      
      if (!updateFields) {
        return true; // Nothing to update
      }
      
      const values = [...Object.values(updateData), topicName];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE Topics SET ${updateFields} WHERE TopicName = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating topic:', error);
      throw error;
    }
  }

  // Initialize topics (used at startup)
  static async initializeTopics(): Promise<void> {
    try {
      const topicData = [
        { 
          TopicName: 'History and Heritage', 
          TopicHe: 'הסטוריה ומורשת', 
          Icon: '🏛️' 
        },
        { 
          TopicName: 'Diplomacy and International Relations', 
          TopicHe: 'דיפלומטיה ויחסים בינלאומיים', 
          Icon: '🤝' 
        },
        { 
          TopicName: 'Iron Swords War', 
          TopicHe: 'מלחמת חרבות ברזל', 
          Icon: '⚔️' 
        },
        { 
          TopicName: 'Innovation and Technology', 
          TopicHe: 'חדשנות וטכנולוגיה', 
          Icon: '💡' 
        },
        { 
          TopicName: 'Society and Multiculturalism', 
          TopicHe: 'חברה ורב תרבותיות', 
          Icon: '🌍' 
        },
        { 
          TopicName: 'Holocaust and Revival', 
          TopicHe: 'שואה ותקומה', 
          Icon: '✡️' 
        },
        { 
          TopicName: 'Environment and Sustainability', 
          TopicHe: 'סביבה וקיימות', 
          Icon: '🌱' 
        },
        { 
          TopicName: 'Economy and Entrepreneurship', 
          TopicHe: 'כלכלה ויזמות', 
          Icon: '💰' 
        }
      ];

      // Insert topics with ON DUPLICATE KEY UPDATE
      for (const topic of topicData) {
        await pool.execute(
          `INSERT INTO Topics (TopicName, TopicHe, Icon) 
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           TopicHe = VALUES(TopicHe), 
           Icon = VALUES(Icon)`,
          [topic.TopicName, topic.TopicHe, topic.Icon]
        );
      }
    } catch (error) {
      console.error('Error initializing topics:', error);
      throw error;
    }
  }
}

export default Topic;