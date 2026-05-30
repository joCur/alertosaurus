import { ToastData } from '../shared/types';

export class ToastQueue {
  private pending: ToastData[] = [];
  private _active: ToastData | null = null;
  private readonly overflowThreshold: number;

  constructor(overflowThreshold = 5) {
    this.overflowThreshold = overflowThreshold;
  }

  push(toast: ToastData): ToastData | null {
    if (!this._active) {
      this._active = toast;
      return toast;
    }
    this.pending.push(toast);
    return null;
  }

  next(): ToastData | null {
    if (this.pending.length > 0) {
      this._active = this.pending.shift()!;
      return this._active;
    }
    this._active = null;
    return null;
  }

  get active(): ToastData | null {
    return this._active;
  }

  get isActive(): boolean {
    return this._active !== null;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get overflowCount(): number {
    return Math.max(0, this.pending.length - this.overflowThreshold);
  }

  clear(): void {
    this.pending = [];
    this._active = null;
  }
}
