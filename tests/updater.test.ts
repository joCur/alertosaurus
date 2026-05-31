import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAutoUpdater = vi.hoisted(() => ({
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
}));

const mockApp = vi.hoisted(() => ({ isPackaged: true }));

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

vi.mock('electron', () => ({
  app: mockApp,
}));

import { initAutoUpdater, installUpdate, _resetForTesting } from '../src/main/updater';

describe('updater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockAutoUpdater.autoDownload = false;
    mockAutoUpdater.autoInstallOnAppQuit = false;
    mockApp.isPackaged = true;
    _resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when app.isPackaged is false', () => {
    mockApp.isPackaged = false;
    initAutoUpdater(vi.fn());
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(mockAutoUpdater.on).not.toHaveBeenCalled();
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

  it('registers event listeners for update-downloaded and error', () => {
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

  it('does not initialize twice when called a second time', () => {
    initAutoUpdater(vi.fn());
    const callsAfterFirst = mockAutoUpdater.checkForUpdates.mock.calls.length;

    initAutoUpdater(vi.fn());
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('installUpdate calls quitAndInstall only after update is downloaded', () => {
    const onUpdateReady = vi.fn();
    initAutoUpdater(onUpdateReady);

    // Before update downloaded: should be a no-op
    installUpdate();
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();

    // Simulate update-downloaded event
    const downloadedHandler = mockAutoUpdater.on.mock.calls.find(
      (c: any[]) => c[0] === 'update-downloaded'
    )![1];
    downloadedHandler({ version: '2.0.0' });

    // Now installUpdate should proceed
    installUpdate();
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
