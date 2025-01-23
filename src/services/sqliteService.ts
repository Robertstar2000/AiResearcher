import initSqlJs, { Database } from 'sql.js';

// Types
export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  occupation?: string;
  location?: string;
  created_at: string;
}

export interface ResearchEntry {
  id: string;
  user_id: string;
  title: string;
  content: any;
  references: string[];
  created_at: string;
  updated_at: string;
}

class SQLiteService {
  private db: Database | null = null;
  private static instance: SQLiteService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): SQLiteService {
    if (!SQLiteService.instance) {
      SQLiteService.instance = new SQLiteService();
    }
    return SQLiteService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('SQLite already initialized');
      return;
    }

    try {
      console.log('Initializing SQLite...');
      const SQL = await initSqlJs({
        // Use CDN for the wasm file
        locateFile: file => `https://sql.js.org/dist/${file}`
      });
      
      // Clear existing database for fresh start
      localStorage.removeItem('research_db');
      
      // Create new database
      this.db = new SQL.Database();
      await this.createTables();

      // Setup auto-save
      this.setupAutoSave();
      
      this.initialized = true;
      console.log('SQLite initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Enable foreign key support
      this.db.run('PRAGMA foreign_keys = ON;');

      // Create users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          occupation TEXT,
          location TEXT,
          created_at TEXT NOT NULL
        );
      `);

      // Create research table with proper SQLite foreign key syntax
      this.db.run(`
        CREATE TABLE IF NOT EXISTS research (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          ref_list TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CONSTRAINT fk_user
            FOREIGN KEY (user_id) 
            REFERENCES users (id)
            ON DELETE CASCADE
        );
      `);
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Auto-save setup
  private setupAutoSave(): void {
    const saveDb = () => {
      if (this.db) {
        const data = this.db.export();
        const base64 = btoa(Array.from(data).map(byte => String.fromCharCode(byte)).join(''));
        localStorage.setItem('research_db', base64);
      }
    };

    // Save on these operations
    const originalCreateUser = this.createUser.bind(this);
    this.createUser = async (...args) => {
      const result = await originalCreateUser(...args);
      saveDb();
      return result;
    };

    const originalSaveResearch = this.saveResearchEntry.bind(this);
    this.saveResearchEntry = async (...args) => {
      const result = await originalSaveResearch(...args);
      saveDb();
      return result;
    };

    const originalUpdateResearch = this.updateResearchEntry.bind(this);
    this.updateResearchEntry = async (...args) => {
      const result = await originalUpdateResearch(...args);
      saveDb();
      return result;
    };

    const originalDeleteResearch = this.deleteResearchEntry.bind(this);
    this.deleteResearchEntry = async (...args) => {
      const result = await originalDeleteResearch(...args);
      saveDb();
      return result;
    };
  }

  // User operations
  public async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = crypto.randomUUID();
      const created_at = new Date().toISOString();

      // Check if email already exists
      const existingUser = this.db.exec(
        'SELECT id FROM users WHERE email = ?',
        [userData.email]
      );

      if (existingUser.length > 0 && existingUser[0].values.length > 0) {
        throw new Error('Email already exists');
      }

      this.db.run(
        'INSERT INTO users (id, email, password, name, occupation, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userData.email, userData.password, userData.name, userData.occupation || null, userData.location || null, created_at]
      );

      return {
        id,
        ...userData,
        created_at
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  public async authenticateUser(email: string, password: string): Promise<User | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.exec(
        'SELECT * FROM users WHERE email = ? AND password = ?',
        [email, password]
      );

      if (result.length === 0 || result[0].values.length === 0) {
        return null;
      }

      const row = result[0].values[0];
      return {
        id: String(row[0]),
        email: String(row[1]),
        password: String(row[2]),
        name: String(row[3]),
        occupation: row[4] ? String(row[4]) : undefined,
        location: row[5] ? String(row[5]) : undefined,
        created_at: String(row[6])
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }

  // Research operations
  public async saveResearchEntry(data: Omit<ResearchEntry, 'id' | 'created_at' | 'updated_at'>): Promise<{ id: string }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.db) throw new Error('Database not initialized');

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    this.db.run(
      'INSERT INTO research (id, user_id, title, content, ref_list, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.user_id, data.title, JSON.stringify(data.content), JSON.stringify(data.references), timestamp, timestamp]
    );

    return { id };
  }

  public async getResearchEntries(userId: string): Promise<ResearchEntry[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT id, user_id, title, content, ref_list, created_at, updated_at FROM research WHERE user_id = ?',
      [userId]
    );

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => ({
      id: String(row[0]),
      user_id: String(row[1]),
      title: String(row[2]),
      content: JSON.parse(String(row[3])),
      references: JSON.parse(String(row[4])),
      created_at: String(row[5]),
      updated_at: String(row[6])
    }));
  }

  public async updateResearchEntry(id: string, updates: Partial<Omit<ResearchEntry, 'id' | 'created_at'>>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.db) throw new Error('Database not initialized');

    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      values.push(JSON.stringify(updates.content));
    }
    if (updates.references !== undefined) {
      updateFields.push('ref_list = ?');
      values.push(JSON.stringify(updates.references));
    }

    if (updateFields.length === 0) return;

    values.push(new Date().toISOString());
    values.push(id);

    this.db.run(
      `UPDATE research SET ${updateFields.join(', ')}, updated_at = ? WHERE id = ?`,
      values
    );
  }

  public async deleteResearchEntry(id: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('DELETE FROM research WHERE id = ?', [id]);
  }

  // Export database
  public exportDatabase(): Uint8Array {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }
    return this.db!.export();
  }

  // Import database
  public importDatabase(data: Uint8Array): void {
    const SQL = require('sql.js');
    this.db = new SQL.Database(data);
  }
}

export const sqliteService = SQLiteService.getInstance();
