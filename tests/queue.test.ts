import { describe, it, expect, beforeEach } from 'vitest';
import { ToastQueue } from '../src/main/queue';
import { ToastData } from '../src/shared/types';

function makeToast(id: string): ToastData {
  return { id, caller: 'test', message: `msg-${id}`, duration_ms: 5000, received_at: new Date().toISOString() };
}

describe('ToastQueue', () => {
  let queue: ToastQueue;

  beforeEach(() => {
    queue = new ToastQueue(5);
  });

  it('push returns the toast when queue is empty (show immediately)', () => {
    const toast = makeToast('1');
    const result = queue.push(toast);
    expect(result).toEqual(toast);
  });

  it('push returns null when a toast is already active (queued)', () => {
    queue.push(makeToast('1'));
    const result = queue.push(makeToast('2'));
    expect(result).toBeNull();
  });

  it('next returns the next queued toast after dismissal', () => {
    queue.push(makeToast('1'));
    queue.push(makeToast('2'));
    queue.push(makeToast('3'));

    const next = queue.next();
    expect(next).not.toBeNull();
    expect(next!.id).toBe('2');
  });

  it('next returns null when no more queued', () => {
    queue.push(makeToast('1'));
    const next = queue.next();
    expect(next).toBeNull();
  });

  it('tracks pending count', () => {
    queue.push(makeToast('1'));
    expect(queue.pendingCount).toBe(0);

    queue.push(makeToast('2'));
    expect(queue.pendingCount).toBe(1);

    queue.push(makeToast('3'));
    expect(queue.pendingCount).toBe(2);

    queue.next();
    expect(queue.pendingCount).toBe(1);
  });

  it('reports overflow when pending exceeds max', () => {
    queue.push(makeToast('active'));
    for (let i = 1; i <= 5; i++) {
      queue.push(makeToast(`q${i}`));
    }
    expect(queue.pendingCount).toBe(5);
    expect(queue.overflowCount).toBe(0);

    queue.push(makeToast('q6'));
    expect(queue.pendingCount).toBe(6);
    expect(queue.overflowCount).toBe(1);
  });

  it('isActive reflects whether a toast is being shown', () => {
    expect(queue.isActive).toBe(false);
    queue.push(makeToast('1'));
    expect(queue.isActive).toBe(true);
    queue.next();
    expect(queue.isActive).toBe(false);
  });

  it('clear removes everything', () => {
    queue.push(makeToast('1'));
    queue.push(makeToast('2'));
    queue.push(makeToast('3'));
    queue.clear();
    expect(queue.isActive).toBe(false);
    expect(queue.pendingCount).toBe(0);
  });
});
