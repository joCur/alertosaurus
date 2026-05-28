import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config, RuntimeInfo, DEFAULT_CONFIG } from '../shared/types';

export class ConfigManager {
  private readonly configPath: string;
  private readonly runtimePath: string;

  constructor(configDir?: string) {
    const dir = configDir ?? ConfigManager.defaultDir();
    fs.mkdirSync(dir, { recursive: true });
    this.configPath = path.join(dir, 'config.json');
    this.runtimePath = path.join(dir, 'runtime.json');
  }

  static defaultDir(): string {
    switch (process.platform) {
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'alertosaurus');
      case 'win32':
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'alertosaurus');
      default:
        return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'alertosaurus');
    }
  }

  load(): Config {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  save(config: Config): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  writeRuntime(info: RuntimeInfo): void {
    fs.writeFileSync(this.runtimePath, JSON.stringify(info, null, 2));
  }

  readRuntime(): RuntimeInfo | null {
    try {
      const raw = fs.readFileSync(this.runtimePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  removeRuntime(): void {
    try {
      fs.unlinkSync(this.runtimePath);
    } catch {}
  }
}
