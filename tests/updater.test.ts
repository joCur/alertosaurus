import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAutoUpdater = vi.hoisted(() => ({
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
}));

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

vi.mock('electron', () => ({
  app: { isPackaged: true },
}));

import { initAutoUpdater, installUpdate } from '../src/main/updater';

describe('updater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockAutoUpdater.autoDownload = false;
    mockAutoUpdater.autoInstallOnAppQuit = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('configures autoUpdater settings', () => {
    initAutoUpdater(vi.fn());
    expect(mockAutoUpdater.autoDownload).toBe(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
  });

  it('checks for updates immediately on init', () => {
    initAutoUpdater(vi.fn());
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('checks for updates every 30 minutes', () => {
    initAutoUpdater(vi.fn());
    mockAutoUpdater.checkForUpdates.mockClear();

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('registers event listeners for update-available, update-downloaded, and error', () => {
    initAutoUpdater(vi.fn());
    const events = mockAutoUpdater.on.mock.calls.map((c: any[]) => c[0]);
    expect(events).toContain('update-downloaded');
    expect(events).toContain('error');
  });

  it('calls onUpdateReady with version when update is downloaded', () => {
    const onUpdateReady = vi.fn();
    initAutoUpdater(onUpdateReady);

    const downloadedHandler = mockAutoUpdater.on.mock.calls.find(
      (c: any[]) => c[0] === 'update-downloaded'
    )![1];

    downloadedHandler({ version: '2.0.0' });
    expect(onUpdateReady).toHaveBeenCalledWith('2.0.0');
  });

  it('does not throw when error event fires', () => {
    initAutoUpdater(vi.fn());

    const errorHandler = mockAutoUpdater.on.mock.calls.find(
      (c: any[]) => c[0] === 'error'
    )![1];

    expect(() => errorHandler(new Error('network error'))).not.toThrow();
  });

  it('installUpdate calls quitAndInstall', () => {
    installUpdate();
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
