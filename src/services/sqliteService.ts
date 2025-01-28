import initSqlJs, { Database } from 'sql.js';
import { storageService } from './storageService';

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
  private initializationPromise: Promise<void> | null = null;
  private maxRetries = 3;
  private retryCount = 0;
  private retryDelay = 1000; // 1 second
  private readonly SQLITE_STORE_KEY = 'sqlite_db';

  private constructor() {}

  public static getInstance(): SQLiteService {
    if (!SQLiteService.instance) {
      SQLiteService.instance = new SQLiteService();
    }
    return SQLiteService.instance;
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    try {
      const data = await storageService.getData('sqlite', this.SQLITE_STORE_KEY);
      if (data) {
        console.log('Loaded database from IndexedDB');
        return new Uint8Array(data);
      }
      return null;
    } catch (error) {
      console.error('Failed to load database from IndexedDB:', error);
      return null;
    }
  }

  private async saveToIndexedDB(): Promise<void> {
    if (!this.db) return;

    try {
      const data = this.db.export();
      await storageService.saveData('sqlite', this.SQLITE_STORE_KEY, Array.from(data));
      console.log('Saved database to IndexedDB');
    } catch (error) {
      console.error('Failed to save database to IndexedDB:', error);
    }
  }

  private async waitForWasm(): Promise<void> {
    const wasmUrl = '/sql-wasm.wasm';
    let attempts = 0;
    const maxAttempts = 5;
    const delay = 1000;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(wasmUrl);
        if (response.ok) {
          console.log('WASM file is available');
          return;
        }
        console.log(`WASM file not ready (attempt ${attempts + 1}/${maxAttempts})`);
      } catch (error) {
        console.log(`Error checking WASM file (attempt ${attempts + 1}/${maxAttempts}):`, error);
      }
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Failed to load WASM file after multiple attempts');
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('SQLite already initialized');
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeWithRetry();
    return this.initializationPromise;
  }

  private async initializeWithRetry(): Promise<void> {
    try {
      await this.waitForWasm();
      console.log('Initializing SQLite...');
      
      // Initialize storage service first
      await storageService.initialize();
      
      const SQL = await initSqlJs({
        locateFile: () => `/sql-wasm.wasm`
      });

      // Try to load existing database from IndexedDB
      const savedData = await this.loadFromIndexedDB();
      
      if (savedData) {
        // Load existing database
        this.db = new SQL.Database(savedData);
        console.log('Loaded existing database from IndexedDB');
      } else {
        // Create new database
        this.db = new SQL.Database();
        await this.createTables();
        console.log('Created new database');
      }

      // Setup auto-save
      this.setupAutoSave();
      
      this.initialized = true;
      this.retryCount = 0;
      console.log('SQLite initialized successfully');
    } catch (error) {
      console.error(`SQLite initialization failed (attempt ${this.retryCount + 1}/${this.maxRetries}):`, error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        this.initializationPromise = null;
        return this.initialize();
      }
      
      throw new Error(`Failed to initialize SQLite after ${this.maxRetries} attempts`);
    }
  }

  private setupAutoSave(): void {
    // Save every 30 seconds if there are changes
    setInterval(async () => {
      if (this.db) {
        await this.saveToIndexedDB();
      }
    }, 30000);

    // Save before page unload
    window.addEventListener('beforeunload', async () => {
      if (this.db) {
        await this.saveToIndexedDB();
      }
    });
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

  public async authenticateUserById(id: string): Promise<User | null> {
    try {
      if (!this.db) await this.initialize();
      if (!this.db) throw new Error('Database not initialized');
      
      const result = this.db.exec(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        const getValue = (value: any): string => value ? String(value) : '';
        const getOptionalValue = (value: any): string | undefined => value ? String(value) : undefined;
        
        return {
          id: getValue(row[0]),
          email: getValue(row[1]),
          password: getValue(row[2]),
          name: getValue(row[3]),
          occupation: getOptionalValue(row[4]),
          location: getOptionalValue(row[5]),
          created_at: getValue(row[6])
        };
      }
      return null;
    } catch (error) {
      console.error('Error authenticating user by ID:', error);
      return null;
    }
  }

  public async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT id, email, name, occupation, location, created_at FROM users ORDER BY created_at DESC'
    );

    if (!result.length) {
      return [];
    }

    const getValue = (value: any): string => value ? String(value) : '';
    const getOptionalValue = (value: any): string | undefined => value ? String(value) : undefined;

    return result[0].values.map(row => ({
      id: getValue(row[0]),
      email: getValue(row[1]),
      name: getValue(row[2]),
      occupation: getOptionalValue(row[3]),
      location: getOptionalValue(row[4]),
      created_at: getValue(row[5])
    }));
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
      'SELECT * FROM research WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    if (!result.length) {
      return [];
    }

    const getValue = (value: any): string => value ? String(value) : '';
    const getJsonValue = (value: any): any => value ? JSON.parse(String(value)) : null;

    return result[0].values.map(row => ({
      id: getValue(row[0]),
      user_id: getValue(row[1]),
      title: getValue(row[2]),
      content: getJsonValue(row[3]),
      references: getJsonValue(row[4]),
      created_at: getValue(row[5]),
      updated_at: getValue(row[6])
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
