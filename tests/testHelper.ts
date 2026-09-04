import Database from 'better-sqlite3';
import { runMigrations } from '../src/database/migrations';
import { setDbInstance } from '../src/database/database';

export function createInMemoryDb() {
  const rawDb = new Database(':memory:');

  // Configure SQLite PRAGMAs
  rawDb.pragma('foreign_keys = ON');
  rawDb.pragma('synchronous = NORMAL');
  rawDb.pragma('temp_store = MEMORY');

  const mockExpoDb: any = {
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
    getAllAsync: async (sql: string, params: any[] = []) => {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...params);
    },
    getFirstAsync: async (sql: string, params: any[] = []) => {
      const stmt = rawDb.prepare(sql);
      const row = stmt.get(...params);
      return row ?? null;
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

  return { rawDb, mockExpoDb };
}

export async function setupTestDatabase() {
  const { rawDb, mockExpoDb } = createInMemoryDb();
  setDbInstance(mockExpoDb);
  await runMigrations(mockExpoDb);
  return { rawDb, mockExpoDb };
}
