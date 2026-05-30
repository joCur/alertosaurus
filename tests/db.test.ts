import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { NotificationDb } from '../src/main/db';

describe('NotificationDb', () => {
  let db: NotificationDb;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `alertosaurus-test-${Date.now()}.db`);
    db = new NotificationDb(dbPath);
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it('inserts a notification and returns id + timestamp', () => {
    const result = db.insert({ caller: 'test', message: 'hello', duration_ms: 5000 });
    expect(result.id).toBeTruthy();
    expect(result.received_at).toBeTruthy();
    expect(new Date(result.received_at).getTime()).not.toBeNaN();
  });

  it('getAll returns notifications in reverse chronological order', () => {
    db.insert({ caller: 'a', message: 'first', duration_ms: 5000 });
    db.insert({ caller: 'b', message: 'second', duration_ms: 5000 });
    db.insert({ caller: 'c', message: 'third', duration_ms: 5000 });

    const all = db.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].caller).toBe('c');
    expect(all[1].caller).toBe('b');
    expect(all[2].caller).toBe('a');
  });

  it('getAll returns full notification objects', () => {
    db.insert({ caller: 'test', message: 'hello world', duration_ms: 3000 });
    const [n] = db.getAll();
    expect(n.id).toBeTruthy();
    expect(n.caller).toBe('test');
    expect(n.message).toBe('hello world');
    expect(n.duration_ms).toBe(3000);
    expect(n.received_at).toBeTruthy();
  });

  it('clear removes all notifications', () => {
    db.insert({ caller: 'a', message: 'one', duration_ms: 5000 });
    db.insert({ caller: 'b', message: 'two', duration_ms: 5000 });
    expect(db.getAll()).toHaveLength(2);

    db.clear();
    expect(db.getAll()).toHaveLength(0);
  });

  it('deletes a single notification by id', () => {
    db.insert({ caller: 'a', message: 'one', duration_ms: 5000 });
    const { id } = db.insert({ caller: 'b', message: 'two', duration_ms: 5000 });
    db.insert({ caller: 'c', message: 'three', duration_ms: 5000 });

    const deleted = db.delete(id);
    expect(deleted).toBe(true);

    const all = db.getAll();
    expect(all).toHaveLength(2);
    expect(all.map(n => n.caller)).toEqual(['c', 'a']);
  });

  it('returns false when deleting a non-existent id', () => {
    db.insert({ caller: 'a', message: 'one', duration_ms: 5000 });
    const deleted = db.delete('non-existent-id');
    expect(deleted).toBe(false);
    expect(db.getAll()).toHaveLength(1);
  });

  it('handles empty database', () => {
    expect(db.getAll()).toEqual([]);
  });
});
