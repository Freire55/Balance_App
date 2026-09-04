import Database from 'better-sqlite3';

export interface SQLiteDatabase {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: any[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
}

let sharedDb: SQLiteDatabase | null = null;

export function setMockDatabase(db: SQLiteDatabase | null) {
  sharedDb = db;
}

export function createMockDatabase(): SQLiteDatabase {
  const rawDb = new Database(':memory:');
  rawDb.pragma('foreign_keys = ON');
  rawDb.pragma('synchronous = NORMAL');
  rawDb.pragma('temp_store = MEMORY');

  return {
    execAsync: async (sql: string) => {
      rawDb.exec(sql);
    },
    runAsync: async (sql: string, params: any[] = []) => {
      const stmt = rawDb.prepare(sql);
      const info = stmt.run(...params);
      return {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: info.changes,
      };
    },
    getAllAsync: async <T>(sql: string, params: any[] = []): Promise<T[]> => {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...params) as T[];
    },
    getFirstAsync: async <T>(sql: string, params: any[] = []): Promise<T | null> => {
      const stmt = rawDb.prepare(sql);
      const row = stmt.get(...params);
      return (row as T) ?? null;
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      rawDb.exec('SAVEPOINT sp_tx;');
      try {
        await fn();
        rawDb.exec('RELEASE sp_tx;');
      } catch (e) {
        rawDb.exec('ROLLBACK TO sp_tx;');
        rawDb.exec('RELEASE sp_tx;');
        throw e;
      }
    },
  };
}

export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  if (!sharedDb) {
    sharedDb = createMockDatabase();
  }
  return sharedDb;
}
