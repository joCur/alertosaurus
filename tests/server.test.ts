import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createApp } from '../src/main/server';
import { NotificationDb } from '../src/main/db';
import { ToastQueue } from '../src/main/queue';
import packageJson from '../package.json';

vi.mock('../src/main/logger', () => ({ log: vi.fn() }));

describe('HTTP Server', () => {
  let db: NotificationDb;
  let queue: ToastQueue;
  let app: ReturnType<typeof createApp>;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `alertosaurus-server-test-${Date.now()}.db`);
    db = new NotificationDb(dbPath);
    queue = new ToastQueue();
    app = createApp(db, queue);
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  describe('POST /notify', () => {
    it('returns 200 with id and received_at for valid request', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test-agent', message: 'build complete' })
        .expect(200);

      expect(res.body.id).toBeTruthy();
      expect(res.body.received_at).toBeTruthy();
    });

    it('stores notification in database', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done' });

      const all = db.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].caller).toBe('agent');
      expect(all[0].message).toBe('done');
    });

    it('enqueues toast in queue', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done' });

      expect(queue.isActive).toBe(true);
    });

    it('uses default duration_ms of 5000', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done' });

      const all = db.getAll();
      expect(all[0].duration_ms).toBe(5000);
    });

    it('accepts custom duration_ms', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'done', duration_ms: 10000 });

      const all = db.getAll();
      expect(all[0].duration_ms).toBe(10000);
    });

    it('accepts duration_ms of 0 (sticky)', async () => {
      await request(app)
        .post('/notify')
        .send({ caller: 'agent', message: 'stuck', duration_ms: 0 });

      const all = db.getAll();
      expect(all[0].duration_ms).toBe(0);
    });

    it('returns 400 when caller is missing', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ message: 'hello' })
        .expect(400);

      expect(res.body.error).toContain('caller');
    });

    it('returns 400 when message is missing', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test' })
        .expect(400);

      expect(res.body.error).toContain('message');
    });

    it('returns 400 when caller exceeds 64 chars', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'x'.repeat(65), message: 'hi' })
        .expect(400);

      expect(res.body.error).toContain('64');
    });

    it('returns 400 when message exceeds 2000 chars', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test', message: 'x'.repeat(2001) })
        .expect(400);

      expect(res.body.error).toContain('2000');
    });

    it('returns 400 when duration_ms exceeds 30000', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ caller: 'test', message: 'hi', duration_ms: 30001 })
        .expect(400);

      expect(res.body.error).toContain('duration_ms');
    });
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe(packageJson.version);
      expect(typeof res.body.uptime_s).toBe('number');
    });
  });
});
