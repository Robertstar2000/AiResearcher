import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'research_db';
const DB_VERSION = 1;

interface StorageItem {
  id: string;
  data: any;
}

class StorageService {
  private static instance: StorageService;
  private db: IDBPDatabase | null = null;

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Create stores if they don't exist
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('research')) {
            db.createObjectStore('research', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('sqlite')) {
            db.createObjectStore('sqlite', { keyPath: 'id' });
          }
        },
      });
      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  }

  public async saveData(storeName: string, id: string, data: any): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      await this.db!.put(storeName, { id, data });
    } catch (error) {
      console.error(`Failed to save data to ${storeName}:`, error);
      throw error;
    }
  }

  public async getData(storeName: string, id: string): Promise<any | null> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const item = await this.db!.get(storeName, id);
      return item ? item.data : null;
    } catch (error) {
      console.error(`Failed to get data from ${storeName}:`, error);
      throw error;
    }
  }

  public async deleteData(storeName: string, id: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      await this.db!.delete(storeName, id);
    } catch (error) {
      console.error(`Failed to delete data from ${storeName}:`, error);
      throw error;
    }
  }

  public async getAllData(storeName: string): Promise<StorageItem[]> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      return await this.db!.getAll(storeName);
    } catch (error) {
      console.error(`Failed to get all data from ${storeName}:`, error);
      throw error;
    }
  }

  public async clearStore(storeName: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      await this.db!.clear(storeName);
    } catch (error) {
      console.error(`Failed to clear store ${storeName}:`, error);
      throw error;
    }
  }
}

export const storageService = StorageService.getInstance();
