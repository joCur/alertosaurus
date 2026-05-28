import Database from 'better-sqlite3';
import crypto from 'crypto';
import { Notification } from '../shared/types';

export class NotificationDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          TEXT PRIMARY KEY,
        caller      TEXT NOT NULL,
        message     TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 5000,
        received_at TEXT NOT NULL,
        seq         INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_received_at ON notifications(received_at DESC, seq DESC)
    `);
  }

  private seq = 0;

  insert(data: { caller: string; message: string; duration_ms: number }): { id: string; received_at: string } {
    const id = crypto.randomUUID();
    const received_at = new Date().toISOString();
    const seq = ++this.seq;
    this.db.prepare(
      'INSERT INTO notifications (id, caller, message, duration_ms, received_at, seq) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, data.caller, data.message, data.duration_ms, received_at, seq);
    return { id, received_at };
  }

  getAll(): Notification[] {
    return this.db.prepare(
      'SELECT id, caller, message, duration_ms, received_at FROM notifications ORDER BY received_at DESC, seq DESC'
    ).all() as Notification[];
  }

  clear(): void {
    this.db.exec('DELETE FROM notifications');
    this.seq = 0;
  }

  close(): void {
    this.db.close();
  }
}
