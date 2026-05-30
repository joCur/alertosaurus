export interface Notification {
  id: string;
  caller: string;
  message: string;
  duration_ms: number;
  received_at: string;
}

export type ToastData = Notification;

export interface Config {
  port: number;
  host: string;
  idle_timeout_ms: number;
  pet_position: { x: number; y: number };
  gravity_enabled: boolean;
  edge_threshold: number;
}

export interface RuntimeInfo {
  host: string;
  port: number;
  pid: number;
  started_at: string;
}

export const DEFAULT_CONFIG: Config = {
  port: 4174,
  host: '127.0.0.1',
  idle_timeout_ms: 30_000,
  pet_position: { x: 100, y: 100 },
  gravity_enabled: true,
  edge_threshold: 30,
};
