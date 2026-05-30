import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { NotificationDb } from './db';
import { ToastQueue } from './queue';
import { ToastData } from '../shared/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

export type NotifyCallback = () => void;

export function createApp(db: NotificationDb, queue: ToastQueue, onNotify?: NotifyCallback) {
  const app = express();
  app.use(express.json());

  app.use(rateLimit({
    windowMs: 1000,
    max: 20,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: 'rate limit exceeded' },
  }));

  app.post('/notify', (req: Request, res: Response) => {
    const { caller, message, duration_ms } = req.body;

    if (!caller || typeof caller !== 'string') {
      res.status(400).json({ error: 'caller is required and must be a string' });
      return;
    }
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required and must be a string' });
      return;
    }
    if (caller.length > 64) {
      res.status(400).json({ error: 'caller must be 64 characters or fewer' });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: 'message must be 2000 characters or fewer' });
      return;
    }

    const dur = duration_ms !== undefined ? Number(duration_ms) : 5000;
    if (isNaN(dur) || dur < 0 || dur > 30000) {
      res.status(400).json({ error: 'duration_ms must be between 0 and 30000' });
      return;
    }

    const result = db.insert({ caller, message, duration_ms: dur });
    const toast: ToastData = { ...result, caller, message, duration_ms: dur };
    queue.push(toast);
    onNotify?.();

    res.json({ id: result.id, received_at: result.received_at });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version,
      uptime_s: Math.floor(process.uptime()),
    });
  });

  return app;
}
